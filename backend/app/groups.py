from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select
from sqlalchemy import delete, update
from app.access import ASSIGN, CONSUMER, CREATE, DB, OWNER, Grower, audit, group_access, visible_groups
from app.auth import Input, Name
from app.listings.models import ProductListing
from app.models import Account, GrowerGroup, Member, SharedBatch

router = APIRouter(prefix="/api/v1/groups", tags=["grower groups"])

class GroupName(Input):
    name: Name

class Permissions(Input):
    create_batches: bool = False
    update_batches: bool = False
    assign_batches: bool = False

class MemberInput(Permissions):
    email: str

class Assignment(Input):
    user_id: Optional[str] = None

def group_summary(db, group, user):
    owner = group.owner_id == user.id
    member = db.get(Member, (group.id, user.id))
    permissions = {key: owner or bool(member and getattr(member, key)) for key in Permissions.model_fields}
    return {**group.model_dump(), "owner": owner, **permissions}

@router.get("")
def groups(db: DB, user: Grower):
    rows = db.exec(select(GrowerGroup).where(GrowerGroup.id.in_(visible_groups(user))).order_by(GrowerGroup.name))
    return [group_summary(db, row, user) for row in rows]

@router.post("", status_code=201)
def create(data: GroupName, db: DB, user: Grower):
    group = GrowerGroup(owner_id=user.id, name=data.name)
    db.add(group)
    db.commit()
    return group_summary(db, group, user)

@router.get("/{gid}")
def detail(gid: str, db: DB, user: Grower):
    group = group_access(db, user, gid)
    members = db.exec(select(Member, Account).join(Account, Member.user_id == Account.id)
                      .where(Member.group_id == gid)).all()
    owner = db.get(Account, group.owner_id)
    batches = db.exec(select(ProductListing, SharedBatch).join(SharedBatch, SharedBatch.listing_id == ProductListing.id)
                      .where(SharedBatch.group_id == gid)).all()
    return {**group_summary(db, group, user), "owner_name": owner.name,
            "members": [{**m.model_dump(), "name": a.name, "email": a.email} for m, a in members],
            "batches": [{"id": b.id, "name": b.commodity_name, "assignee": s.assignee} for b, s in batches]}

@router.patch("/{gid}")
def rename(gid: str, data: GroupName, db: DB, user: Grower):
    group = group_access(db, user, gid, OWNER, lock=True)
    group.name = data.name
    db.commit()
    return group_summary(db, group, user)

@router.put("/{gid}/members", status_code=204)
def set_member(gid: str, data: MemberInput, db: DB, user: Grower):
    group = group_access(db, user, gid, OWNER, lock=True)
    account = db.exec(select(Account).where(Account.email == data.email.strip().lower(),
                      Account.banned == False, Account.role != CONSUMER)).first()
    if not account or account.id == group.owner_id:
        raise HTTPException(422, "Choose another active grower account.")
    member = db.get(Member, (gid, account.id)) or Member(group_id=gid, user_id=account.id)
    for key in Permissions.model_fields:
        setattr(member, key, getattr(data, key))
    db.add(member)
    db.commit()

@router.delete("/{gid}/members/{uid}", status_code=204)
def remove_member(gid: str, uid: str, db: DB, user: Grower):
    group_access(db, user, gid, OWNER, lock=True)
    member = db.get(Member, (gid, uid))
    if not member:
        raise HTTPException(404, "Member not found.")
    db.execute(update(SharedBatch).where(SharedBatch.group_id == gid, SharedBatch.assignee == uid).values(assignee=None))
    db.delete(member)
    db.commit()

@router.post("/{gid}/batches/{bid}", status_code=204)
def share_batch(gid: str, bid: str, db: DB, user: Grower, request: Request):
    group_access(db, user, gid, CREATE, lock=True)
    item = db.exec(select(ProductListing).where(ProductListing.id == bid,
                   ProductListing.farmer_id == user.id).with_for_update()).first()
    if not item:
        raise HTTPException(404, "Private batch not found.")
    if db.get(SharedBatch, bid):
        raise HTTPException(409, "Batch already belongs to a group.")
    db.add(SharedBatch(group_id=gid, listing_id=bid))
    audit(db, request, "share_batch", user.id, bid, gid)
    db.commit()

@router.put("/{gid}/batches/{bid}/assignment", status_code=204)
def assign(gid: str, bid: str, data: Assignment, db: DB, user: Grower):
    group = group_access(db, user, gid, ASSIGN, lock=True)
    share = db.get(SharedBatch, bid)
    if not share or share.group_id != gid:
        raise HTTPException(404, "Batch not found in group.")
    if data.user_id is not None and data.user_id != group.owner_id and not db.get(Member, (gid, data.user_id)):
        raise HTTPException(422, "Choose a group member.")
    share.assignee = data.user_id
    db.commit()

def delete_group(db, group):
    batch_ids = select(SharedBatch.listing_id).where(SharedBatch.group_id == group.id)
    db.execute(delete(ProductListing).where(ProductListing.id.in_(batch_ids)))
    db.delete(group)

@router.delete("/{gid}", status_code=204)
def remove(gid: str, db: DB, user: Grower, request: Request):
    group = group_access(db, user, gid, OWNER, lock=True)
    audit(db, request, "delete", user.id, gid, group.name)
    delete_group(db, group)
    db.commit()
