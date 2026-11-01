"""One authenticated account, independently owned buyer/supplier companies."""
from fastapi import APIRouter
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict
from typing import Literal
from app.api import DB, Actor
from app.models import BusinessProfile, User, Company, PrototypeWorkspace
from app.prototype import ensure_workspace

router = APIRouter(prefix="/account/profiles", tags=["Бизнес-профили"])


class ProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["buyer", "supplier"]


def account_profiles(db, actor):
    # Serialize creation per account to make repeated clicks idempotent.
    user = db.scalar(select(User).where(User.id == actor.id).with_for_update())
    profiles = list(db.scalars(select(BusinessProfile).where(BusinessProfile.user_id == user.id)))
    if not profiles:
        workspace = db.get(PrototypeWorkspace, user.company_id)
        role = "supplier" if workspace and workspace.state.get("role") == "supplier" else "buyer"
        profile = BusinessProfile(user_id=user.id, company_id=user.company_id, role=role)
        db.add(profile)
        db.flush()
        profiles.append(profile)
    return user, profiles


def result(db, profiles):
    return [{"company_id": profile.company_id, "role": profile.role, "name": db.get(Company, profile.company_id).name} for profile in profiles]


@router.get("")
def list_profiles(db: DB, user: Actor):
    _, profiles = account_profiles(db, user)
    response = result(db, profiles)
    db.commit()
    return {"profiles": response}


@router.post("")
def create_profile(body: ProfileCreate, db: DB, actor: Actor):
    user, profiles = account_profiles(db, actor)
    profile = next((item for item in profiles if item.role == body.role), None)
    if profile is None:
        company = Company(name="", inn=None)
        db.add(company)
        db.flush()
        workspace = ensure_workspace(db, company)
        workspace.state = {**workspace.state, "role": body.role}
        profile = BusinessProfile(user_id=user.id, company_id=company.id, role=body.role)
        db.add(profile)
        db.flush()
    db.commit()
    return {"company_id": profile.company_id, "role": profile.role}
