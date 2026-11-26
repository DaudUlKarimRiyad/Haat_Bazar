from sqlmodel import Session, select

from app import firebase
from app.database import engine
from app.models import Account, GrowerGroup, Member, SharedBatch


class _FakeDocSnap:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    def to_dict(self):
        return dict(self._data)


class _FakeDocRef:
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id


class _FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id):
        return _FakeDocRef(self._store, doc_id)

    def stream(self):
        return [_FakeDocSnap(k, v) for k, v in self._store.items()]


class _FakeBatch:
    def __init__(self):
        self._ops = []

    def set(self, ref, data):
        self._ops.append(("set", ref, data))

    def delete(self, ref):
        self._ops.append(("delete", ref, None))

    def commit(self):
        for action, ref, data in self._ops:
            if action == "set":
                ref._store[ref.id] = dict(data)
            else:
                ref._store.pop(ref.id, None)


class _FakeFirestore:
    def __init__(self):
        self.collections_data = {}

    def collection(self, name):
        return _FakeCollection(self.collections_data.setdefault(name, {}))

    def batch(self):
        return _FakeBatch()


def test_clean_private_key_repairs_pem():
    raw = "-----BEGIN PRIVATE \n KEY-----\\nYWJj\\nZGVm\\n-----END PRIVATE\n KEY-----"
    cleaned = firebase.clean_private_key(raw)
    assert cleaned.startswith("-----BEGIN PRIVATE KEY-----\n")
    assert cleaned.endswith("\n-----END PRIVATE KEY-----\n")
    assert "YWJjZGVm" in cleaned


def test_migrate_and_hydrate_full_database(monkeypatch, account):
    fake_db = _FakeFirestore()
    monkeypatch.setattr(firebase, "FIRESTORE_SYNC_ENABLED", True)
    monkeypatch.setattr(firebase, "get_firestore_client", lambda: fake_db)

    grower, g_user, _ = account("SyncGrower", role="grower")
    _, m_user, _ = account("SyncMember", role="grower")
    gid = grower.post("/api/v1/groups", json={"name": "Sync Coop"}).json()["id"]
    grower.put(f"/api/v1/groups/{gid}/members", json={"email": m_user["email"], "create_batches": True})
    bid = grower.post("/api/v1/listings", json={
        "commodity_name": "Sync Potato",
        "category": "Tubers",
        "farmer_name": "SyncGrower",
        "hub_name": "Bogura Central Hub",
        "total_yield_kg": 100.0,
        "available_qty_kg": 80.0,
        "farmer_unit_price": 30.0,
        "b2c_moq_kg": 2.0,
        "b2b_moq_kg": 20.0,
        "grade": "GRADE_A",
        "harvest_date": "2026-11-10",
        "is_active": True,
        "group_id": gid,
    }).json()["id"]

    with Session(engine) as db:
        counts = firebase.migrate_sql_to_firestore(db)

    assert counts["account"] == 2
    assert counts["growergroup"] == 1
    assert counts["member"] == 1
    assert counts["sharedbatch"] == 1
    assert counts[firebase.FIRESTORE_COLLECTION] == 1
    assert f"{gid}__{m_user['id']}" in fake_db.collections_data["member"]
    assert bid in fake_db.collections_data["sharedbatch"]

    # Clear SQL tables and hydrate back from fake Firestore
    with Session(engine) as db:
        for model, _ in reversed(firebase.SYNC_MODELS):
            for row in db.exec(select(model)).all():
                db.delete(row)
        db.commit()
        assert db.exec(select(Account)).first() is None
        restored = firebase.hydrate_sql_from_firestore(db)

    assert restored["account"] == 2
    assert restored["growergroup"] == 1
    assert restored["member"] == 1
    assert restored["sharedbatch"] == 1
    with Session(engine) as db:
        assert db.get(Account, g_user["id"]) is not None
        assert db.get(GrowerGroup, gid) is not None
        assert db.get(Member, (gid, m_user["id"])) is not None
        assert db.get(SharedBatch, bid) is not None
