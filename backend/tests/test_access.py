import csv
import io
import jwt
from sqlmodel import Session
from app.config import JWT_SECRET
from app.database import engine, sample_listings
from app.models import Account, now

AUTH = "/api/v1/auth"
BATCH = "/api/v1/listings"
GROUP = "/api/v1/groups"
ADMIN = "/api/v1/admin"

def payload():
    item = sample_listings()[0]
    return item.model_dump(exclude={"id","farmer_id","hub_id","created_at","updated_at"})

def promote(client, user, password):
    with Session(engine) as db:
        db.get(Account, user["id"]).role = "admin"
        db.commit()
    res = client.post(AUTH+"/login", json={"email": user["email"], "password": password})
    client.headers["Authorization"] = "Bearer "+res.json()["access_token"]

def test_tokens_sessions_and_password(client, account):
    http, user, pwd = account("Alice")
    assert client.get(BATCH).status_code == 401
    token = http.headers["Authorization"].split()[1]
    claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    assert 0 < claims["exp"] - claims["iat"] <= 900
    for invalid in ["invalid", jwt.encode(claims, "invalid-key"*4, algorithm="HS256"),
                    jwt.encode({**claims, "exp":now()-1}, JWT_SECRET, algorithm="HS256")]:
        assert client.get(BATCH, headers={"Authorization": "Bearer "+invalid}).status_code == 401
    original = http.cookies.get("haat_refresh")
    assert http.post(AUTH+"/refresh").status_code == 200
    client.cookies.set("haat_refresh", original)
    assert client.post(AUTH+"/refresh").status_code == 401
    assert http.put(AUTH+"/password", json={"current_password":"wrong","new_password":pwd+"!"}).status_code == 400
    assert http.patch(AUTH+"/profile", json={"name":"Updated name"}).json()["name"] == "Updated name"
    assert http.put(AUTH+"/password", json={"current_password":pwd,"new_password":pwd+"!"}).status_code == 204
    assert http.get(BATCH).status_code == 401
    assert http.post(AUTH+"/login",json={"email":user["email"],"password":pwd}).status_code == 401
    res = http.post(AUTH+"/login",json={"email":user["email"],"password":pwd+"!"})
    http.headers["Authorization"] = "Bearer "+res.json()["access_token"]
    assert http.get(AUTH+"/sessions").json()[0]["id"] == res.json()["session_id"]
    assert http.post(AUTH+"/logout").status_code == 204
    assert http.get(BATCH).status_code == 401
    assert http.post(AUTH+"/refresh").status_code == 401

def test_private_and_shared_access(account):
    owner, _, _ = account("Owner")
    member, user, _ = account("Member")
    bid = owner.post(BATCH,json=payload()).json()["id"]
    assert member.get(BATCH).json()["total"] == 0
    assert member.get(f"{BATCH}/{bid}").status_code == 404
    assert member.delete(f"{BATCH}/{bid}").status_code == 404
    gid = owner.post(GROUP,json={"name":"Cooperative"}).json()["id"]
    group = f"{GROUP}/{gid}"
    assert member.post(BATCH,json={**payload(),"group_id":gid}).status_code == 404
    assert owner.put(group+"/members",json={"email":user["email"],"create_batches":True}).status_code == 204
    bid = member.post(BATCH,json={**payload(),"group_id":gid}).json()["id"]
    assert member.get(f"{BATCH}/{bid}").status_code == 200
    assert member.patch(f"{BATCH}/{bid}",json={"available_qty_kg":1}).status_code == 403
    assert member.delete(f"{BATCH}/{bid}").status_code == 403
    assert member.patch(group,json={"name":"Other"}).status_code == 403
    assert member.put(group+"/members",json={"email":user["email"]}).status_code == 403
    assignment = f"{group}/batches/{bid}/assignment"
    assert member.put(assignment,json={"user_id":user["id"]}).status_code == 403
    owner.put(group+"/members",json={"email":user["email"],"update_batches":True,"assign_batches":True})
    assert member.put(assignment,json={"user_id":user["id"]}).status_code == 204
    assert member.patch(f"{BATCH}/{bid}",json={"available_qty_kg":1}).status_code == 200
    assert member.patch(f"{BATCH}/{bid}",json={"commodity_name":"Rename"}).status_code == 403
    assert owner.delete(group+"/members/"+user["id"]).status_code == 204
    assert member.get(f"{BATCH}/{bid}").status_code == 404
    assert owner.delete(group).status_code == 204
    assert owner.get(f"{BATCH}/{bid}").status_code == 404

def test_admin_actions_exports_security(account):
    admin, a, pwd = account("Admin")
    promote(admin,a,pwd)
    other, b, pwd = account("OtherAdmin")
    promote(other,b,pwd)
    grower, g, pwd = account("Grower")
    assert grower.get(ADMIN+"/users").status_code == 403
    assert admin.put(ADMIN+"/users/"+a["id"]+"/role",json={"role":"user"}).status_code == 403
    ban = {"ids":[g["id"],b["id"]],"banned":True,"reason":"Review"}
    assert admin.post(ADMIN+"/users/status",json=ban).status_code == 403
    assert grower.get(BATCH).status_code == 200
    assert admin.post(ADMIN+"/users/status",json={**ban,"ids":[g["id"]]}).status_code == 204
    assert grower.get(BATCH).status_code == 401
    assert grower.post(AUTH+"/refresh").status_code == 401
    assert grower.post(AUTH+"/login",json={"email":g["email"],"password":pwd}).status_code == 401
    assert admin.get(ADMIN+"/security").json()["by_account"][0]["value"] == g["email"]
    assert admin.get(ADMIN+"/overview").json()["banned"] == 1
    assert admin.get(ADMIN+"/users?status=banned").json()["total"] == 1
    rows = list(csv.DictReader(io.StringIO(admin.get(ADMIN+"/users/export?status=banned").text)))
    assert len(rows) == 1 and rows[0]["id"] == g["id"] and "password_hash" not in rows[0]
    assert admin.get(ADMIN+"/activity?event=export").json()["total"] == 1
    detail = admin.get(ADMIN+"/users/"+g["id"]+"/detail").json()
    assert detail["sessions"][0]["revoked"] and "digest" not in detail["sessions"][0]
    assert admin.post(ADMIN+"/users/status",json={**ban,"ids":[g["id"]],"banned":False}).status_code == 204

def test_moderation_existing_batch_sharing_and_lockout(account):
    owner, _, _ = account("Owner")
    member, user, _ = account("Member")
    admin, a, pwd = account("Admin")
    promote(admin,a,pwd)
    group = owner.post(GROUP,json={"name":"Market growers"}).json()["id"]
    path = f"{GROUP}/{group}"
    owner.put(path+"/members",json={"email":user["email"],"create_batches":True})
    bid = owner.post(BATCH,json=payload()).json()["id"]
    assert member.post(path+"/batches/"+bid).status_code == 404
    assert owner.post(path+"/batches/"+bid).status_code == 204
    assert member.get(BATCH+"/"+bid).status_code == 200
    assert admin.post(ADMIN+"/records/delete",json={"ids":[bid,"absent"]}).status_code == 404
    assert owner.get(BATCH+"/"+bid).status_code == 200
    assert admin.post(ADMIN+"/groups/delete",json={"ids":[group]}).status_code == 204
    assert owner.get(BATCH+"/"+bid).status_code == 404
    assert admin.get(ADMIN+"/activity?event=delete").json()["total"] == 1
    assert owner.post(BATCH,json={**payload(),"harvest_date":"2026-02-31"}).status_code == 422
    for _ in range(10):
        assert member.post(AUTH+"/login",json={"email":user["email"],"password":"incorrect"}).status_code == 401
    assert member.post(AUTH+"/login",json={"email":user["email"],"password":"incorrect"}).status_code == 429
