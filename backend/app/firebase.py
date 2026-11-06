import json
import logging
from typing import Any

from app.config import FIREBASE_CREDENTIALS_PATH, FIREBASE_JSON_CONTENT

logger = logging.getLogger("haat_bazar.firebase")

_firestore_client = None
_firebase_init_error = None


def get_firebase_status() -> dict:
    return {
        "active": _firestore_client is not None,
        "error": _firebase_init_error,
        "has_credentials": bool(FIREBASE_CREDENTIALS_PATH or FIREBASE_JSON_CONTENT),
        "source": "JSON env" if FIREBASE_JSON_CONTENT else ("File path" if FIREBASE_CREDENTIALS_PATH else "None"),
    }


def clean_private_key(pk: str) -> str:
    """
    Repairs PEM private keys that have been distorted by clipboard copy-pasting,
    browser word-wrapping, or environment variable newline escaping issues.
    """
    if not isinstance(pk, str):
        return pk

    import re

    # 1. Normalize escaped newlines
    pk = pk.replace("\\n", "\n")

    # 2. Fix distorted/spaced BEGIN and END headers (e.g. 'PRIVATE \n KEY')
    pk = re.sub(r"-----BEGIN[\s\r\n]+PRIVATE[\s\r\n]+KEY-----", "-----BEGIN PRIVATE KEY-----", pk)
    pk = re.sub(r"-----END[\s\r\n]+PRIVATE[\s\r\n]+KEY-----", "-----END PRIVATE KEY-----", pk)

    # 3. Clean up the base64 payload between the headers
    match = re.search(r"-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----", pk, re.DOTALL)
    if match:
        body = match.group(1)
        body_clean = "".join(body.split())
        lines = [body_clean[i : i + 64] for i in range(0, len(body_clean), 64)]
        pk = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(lines) + "\n-----END PRIVATE KEY-----\n"

    return pk


def get_firestore_client():
    global _firestore_client, _firebase_init_error

    if _firestore_client is not None:
        return _firestore_client

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred = None
        if FIREBASE_JSON_CONTENT:
            try:
                content = FIREBASE_JSON_CONTENT.strip()
                # Handle possible surrounding single or double quotes from dashboard copy-paste
                if (content.startswith("'") and content.endswith("'")) or (content.startswith('"') and content.endswith('"')):
                    content = content[1:-1]
                # Decode base64 if user encoded the JSON
                if not content.startswith("{"):
                    import base64
                    try:
                        content = base64.b64decode(content).decode("utf-8")
                    except Exception:
                        pass

                # Parse JSON with strict=False to tolerate literal control characters/newlines
                try:
                    cred_dict = json.loads(content, strict=False)
                except Exception:
                    # Fallback: sanitize unescaped raw newlines inside multiline string literals
                    import re
                    sanitized = re.sub(r"(?<!\\)\r?\n", r"\\n", content)
                    cred_dict = json.loads(sanitized, strict=False)

                # Clean and repair the private_key PEM structure
                if "private_key" in cred_dict:
                    cred_dict["private_key"] = clean_private_key(cred_dict["private_key"])

                cred = credentials.Certificate(cred_dict)
                logger.info("Initializing Firebase Admin via FIREBASE_CREDENTIALS_JSON env")
            except Exception as e:
                _firebase_init_error = f"Failed to parse FIREBASE_CREDENTIALS_JSON: {e}"
                logger.warning(_firebase_init_error)

        if not cred and FIREBASE_CREDENTIALS_PATH:
            try:
                logger.info("Initializing Firebase Admin using credentials file: %s", FIREBASE_CREDENTIALS_PATH)
                cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
            except Exception as e:
                _firebase_init_error = f"Failed to load credentials file: {e}"
                logger.warning(_firebase_init_error)

        if cred:
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            client = firestore.client()
            _firestore_client = client
            _firebase_init_error = None
            logger.info("Firebase Firestore initialized successfully for project: %s", cred.project_id)
            return _firestore_client
        else:
            if not _firebase_init_error:
                _firebase_init_error = "No Firebase credentials found. Provide FIREBASE_CREDENTIALS_JSON in environment variables."
            logger.warning(_firebase_init_error)
            return None
    except Exception as exc:
        _firebase_init_error = f"Firebase Firestore connection failed: {exc}"
        logger.warning(_firebase_init_error)
        return None
