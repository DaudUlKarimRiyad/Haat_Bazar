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
                cred_dict = json.loads(content)
                # Fix escaped newlines in private_key (common issue when passing env vars)
                if "private_key" in cred_dict and "\\n" in cred_dict["private_key"]:
                    cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
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
