from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes_ws import manager as ws_manager
from app.db.database import get_db
from app.db.models import Client, User
from app.schemas import UserActiveClientUpdate, UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Return the current authenticated user including active client."""
    return current_user


@router.post("/me/logout", status_code=204)
def logout_current_user(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    background_tasks.add_task(
        ws_manager.broadcast_to_user,
        str(current_user.id),
        {"type": "logout"},
    )


@router.put("/me/active-client", response_model=UserResponse)
def set_active_client(
    update: UserActiveClientUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set or clear the active client for the current accountant.

    The active client is used to tag every receipt uploaded from the mobile app
    until another client is selected.
    """
    if update.client_id:
        client = (
            db.query(Client)
            .filter(Client.id == update.client_id, Client.is_deleted == False)
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=404, detail="Clientul selectat nu există sau a fost șters."
            )

    current_user.active_client_id = update.client_id or None
    db.commit()
    db.refresh(current_user)

    # Notify all connected clients that the active client changed
    client_name = client.name if update.client_id else None
    client_cui = client.cui if update.client_id else None

    background_tasks.add_task(
        ws_manager.broadcast_to_user,
        str(current_user.id),
        {
            "type": "active_client_changed",
            "client_id": update.client_id,
            "client_name": client_name,
            "client_cui": client_cui,
        },
    )

    return current_user
