import json
import os
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.security import get_password_hash
from app.db.database import DATABASE_PATH, get_db
from app.db.models import AuditLog, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class UserCreateAdmin(BaseModel):
    email: EmailStr
    password: str
    role: Literal["accountant", "admin"] = "accountant"


class UserUpdateAdmin(BaseModel):
    role: Literal["accountant", "admin"] | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@router.get("/users")
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all user accounts."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreateAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new accountant or admin account."""
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Există deja un cont cu acest email.",
        )

    new_user = User(
        email=data.email,
        password=get_password_hash(data.password),
        role=data.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    data: UserUpdateAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a user's role or active status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit.")

    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a user account. Admins cannot delete themselves."""
    if user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nu te poți șterge pe tine însuți.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit.")

    db.delete(user)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
@router.get("/audit-log")
def get_audit_log(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return the audit log ordered by newest first."""
    total = db.query(AuditLog).count()
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "details": log.details,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            }
            for log in logs
        ],
    }


# ---------------------------------------------------------------------------
# Database export
# ---------------------------------------------------------------------------
@router.get("/export-db")
def export_database(current_user: User = Depends(require_admin)):
    """Export the full database and uploaded images as a ZIP archive."""
    base_dir = os.path.dirname(DATABASE_PATH)
    uploads_dir = os.path.join(base_dir, "uploads")

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(DATABASE_PATH):
            zf.write(DATABASE_PATH, "database.db")

        if os.path.isdir(uploads_dir):
            for root, _, files in os.walk(uploads_dir):
                for file in files:
                    full_path = os.path.join(root, file)
                    arcname = os.path.relpath(full_path, base_dir)
                    zf.write(full_path, arcname)

        manifest = {
            "version": "1.0.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "database": "database.db",
            "uploads": "uploads",
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    buf.seek(0)
    filename = f"contaflow-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
