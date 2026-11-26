from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any, Iterable

from sqlmodel import Session, select

from app.config import (
    FIREBASE_CREDENTIALS_PATH,
    FIREBASE_JSON_CONTENT,
    FIRESTORE_COLLECTION,
    FIRESTORE_SYNC_ENABLED,
)
from app.listings.models import ProductListing
from app.models import (
    Account,
    Activity,
    GrowerGroup,
    LoginSession,
    Member,
    Order,
    OrderItem,
    SalesMemo,
    SharedBatch,
)

logger = logging.getLogger("haat_bazar.firebase")

_firestore_client = None
_firebase_init_error = None

# Ordered by foreign-key dependencies for clean restore/hydration.
SYNC_MODELS = [
    (Account, "account"),
    (LoginSession, "loginsession"),
    (Activity, "activity"),
    (GrowerGroup, "growergroup"),
    (Member, "member"),
    (ProductListing, FIRESTORE_COLLECTION),
    (SharedBatch, "sharedbatch"),
    (Order, "orders"),
    (OrderItem, "order_items"),
    (SalesMemo, "sales_memos"),
]
MODEL_TO_COLLECTION = {model: name for model, name in SYNC_MODELS}


def get_firebase_status() -> dict[str, Any]:
    return {
        "enabled": FIRESTORE_SYNC_ENABLED,
        "active": _firestore_client is not None,
        "error": _firebase_init_error,
        "has_credentials": bool(FIREBASE_CREDENTIALS_PATH or FIREBASE_JSON_CONTENT),
        "source": "JSON env" if FIREBASE_JSON_CONTENT else ("File path" if FIREBASE_CREDENTIALS_PATH else "None"),
    }


def clean_private_key(pk: str) -> str:
    """Repair PEM private keys distorted by env-var escaping or clipboard wrapping."""
    if not isinstance(pk, str):
        return pk
    pk = pk.replace("\\n", "\n")
    pk = re.sub(r"-----BEGIN[\s\r\n]+PRIVATE[\s\r\n]+KEY-----", "-----BEGIN PRIVATE KEY-----", pk)
    pk = re.sub(r"-----END[\s\r\n]+PRIVATE[\s\r\n]+KEY-----", "-----END PRIVATE KEY-----", pk)
    match = re.search(r"-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----", pk, re.DOTALL)
    if match:
        body_clean = "".join(match.group(1).split())
        lines = [body_clean[i : i + 64] for i in range(0, len(body_clean), 64)]
        pk = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(lines) + "\n-----END PRIVATE KEY-----\n"
    return pk


def get_firestore_client():
    global _firestore_client, _firebase_init_error
    if not FIRESTORE_SYNC_ENABLED:
        return None
    if _firestore_client is not None:
        return _firestore_client

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred = None
        if FIREBASE_JSON_CONTENT:
            try:
                content = FIREBASE_JSON_CONTENT.strip()
                if (content.startswith("'") and content.endswith("'")) or (
                    content.startswith('"') and content.endswith('"')
                ):
                    content = content[1:-1]
                if not content.startswith("{"):
                    try:
                        content = base64.b64decode(content).decode("utf-8")
                    except Exception:
                        pass
                try:
                    cred_dict = json.loads(content, strict=False)
                except Exception:
                    sanitized = re.sub(r"(?<!\\)\r?\n", r"\\n", content)
                    cred_dict = json.loads(sanitized, strict=False)
                if "private_key" in cred_dict:
                    cred_dict["private_key"] = clean_private_key(cred_dict["private_key"])
                cred = credentials.Certificate(cred_dict)
            except Exception as exc:
                _firebase_init_error = f"Failed to parse FIREBASE_CREDENTIALS_JSON: {exc}"
                logger.warning(_firebase_init_error)

        if not cred and FIREBASE_CREDENTIALS_PATH:
            try:
                cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
            except Exception as exc:
                _firebase_init_error = f"Failed to load credentials file: {exc}"
                logger.warning(_firebase_init_error)

        if not cred:
            if not _firebase_init_error:
                _firebase_init_error = "No Firebase credentials configured."
            return None

        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        _firestore_client = firestore.client()
        _firebase_init_error = None
        return _firestore_client
    except Exception as exc:
        _firebase_init_error = f"Firebase Firestore connection failed: {exc}"
        logger.warning(_firebase_init_error)
        return None


def doc_id_for(instance: Any) -> str:
    if isinstance(instance, Member):
        return f"{instance.group_id}__{instance.user_id}"
    if isinstance(instance, SharedBatch):
        return str(instance.listing_id)
    return str(instance.id)


def collection_for(instance: Any) -> str | None:
    return MODEL_TO_COLLECTION.get(type(instance))


def serialize_instance(instance: Any) -> dict[str, Any]:
    return instance.model_dump()


def sync_operations(ops: Iterable[tuple[str, str, str, dict[str, Any] | None]]) -> int:
    ops_list = list(ops)
    if not ops_list or not FIRESTORE_SYNC_ENABLED:
        return 0
    client = get_firestore_client()
    if client is None:
        return 0
    try:
        written = 0
        for i in range(0, len(ops_list), 400):
            batch = client.batch()
            for action, collection, doc_id, data in ops_list[i : i + 400]:
                ref = client.collection(collection).document(doc_id)
                if action == "delete":
                    batch.delete(ref)
                else:
                    batch.set(ref, data or {})
                written += 1
            batch.commit()
        return written
    except Exception as exc:
        logger.warning("Firestore live sync skipped due to error: %s", exc)
        return 0


def migrate_sql_to_firestore(session: Session) -> dict[str, int]:
    """Copy all rows from every SQL table into its corresponding Firestore collection."""
    client = get_firestore_client()
    if client is None:
        raise RuntimeError(_firebase_init_error or "Firestore client unavailable.")

    ops: list[tuple[str, str, str, dict[str, Any]]] = []
    counts: dict[str, int] = {}
    for model, collection in SYNC_MODELS:
        rows = session.exec(select(model)).all()
        counts[collection] = len(rows)
        for row in rows:
            ops.append(("set", collection, doc_id_for(row), serialize_instance(row)))

    for i in range(0, len(ops), 400):
        batch = client.batch()
        for _, collection, doc_id, data in ops[i : i + 400]:
            batch.set(client.collection(collection).document(doc_id), data)
        batch.commit()

    return counts


def hydrate_sql_from_firestore(session: Session) -> dict[str, int]:
    """Populate an empty SQL database from Firestore collections on startup."""
    if not FIRESTORE_SYNC_ENABLED:
        return {}
    if session.exec(select(Account.id).limit(1)).first() is not None:
        return {}
    client = get_firestore_client()
    if client is None:
        return {}

    restored: dict[str, int] = {}
    try:
        session.info["skip_firestore_sync"] = True
        for model, collection in SYNC_MODELS:
            docs = list(client.collection(collection).stream())
            count = 0
            for doc in docs:
                data = doc.to_dict() or {}
                if model is ProductListing and "farmer_id" not in data:
                    data["farmer_id"] = None
                try:
                    row = model.model_validate(data)
                except Exception:
                    continue
                session.merge(row)
                count += 1
            session.flush()
            restored[collection] = count
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.warning("Firestore startup hydration failed: %s", exc)
        return {}
    finally:
        session.info.pop("skip_firestore_sync", None)
    return restored
