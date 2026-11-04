import json
import logging
from typing import Any

from app.config import FIREBASE_CREDENTIALS_PATH, FIREBASE_JSON_CONTENT

logger = logging.getLogger("haat_bazar.firebase")

_firestore_client = None
_firebase_initialized = False

def get_firestore_client():
    global _firestore_client, _firebase_initialized

    if _firestore_client is not None:
        return _firestore_client

    if _firebase_initialized:
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred = None
        if FIREBASE_JSON_CONTENT:
            try:
                cred_dict = json.loads(FIREBASE_JSON_CONTENT)
                cred = credentials.Certificate(cred_dict)
                logger.info("Initializing Firebase Admin via FIREBASE_CREDENTIALS_JSON env")
            except Exception as e:
                logger.warning("Failed to parse FIREBASE_CREDENTIALS_JSON: %s", e)

        if not cred and FIREBASE_CREDENTIALS_PATH:
            logger.info("Initializing Firebase Admin using credentials file: %s", FIREBASE_CREDENTIALS_PATH)
            cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)

        if cred:
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            client = firestore.client()
            _firestore_client = client
            _firebase_initialized = True
            logger.info("Firebase Firestore initialized successfully for project: %s", cred.project_id)
            return _firestore_client
        else:
            logger.warning("No Firebase credentials file found. Please provide Firebase service account JSON.")
            _firebase_initialized = True
            return None
    except Exception as exc:
        logger.warning("Firebase Firestore connection unavailable (%s). Falling back to local storage.", exc)
        _firebase_initialized = True
        return None
