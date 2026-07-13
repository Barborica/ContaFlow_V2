from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Receipt, User, Client
from app.api.deps import get_current_user
from app.schemas import ClientCreate, ClientResponse

router = APIRouter()


@router.get("", response_model=list[ClientResponse])
def list_clients(
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active clients, optionally filtered by name or CUI."""
    query = db.query(Client).filter(Client.is_deleted == False)  # noqa: E712

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(Client.name.ilike(term), Client.cui.ilike(term)))

    return query.order_by(Client.name).all()


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_in: ClientCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new client. Reactivates a soft-deleted client with the same CUI."""
    cui = client_in.cui.strip()

    existing = db.query(Client).filter(Client.cui == cui).first()
    if existing:
        if not existing.is_deleted:
            raise HTTPException(
                status_code=400, detail="Există deja un client cu acest CUI."
            )
        # Reactivate previously deleted client and refresh its data
        existing.is_deleted = False
        existing.name = client_in.name
        existing.address = client_in.address
        db.commit()
        db.refresh(existing)
        return existing

    new_client = Client(
        cui=cui,
        name=client_in.name,
        address=client_in.address,
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client


@router.get("/{client_id}/stats")
def get_client_stats(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return receipt statistics for a single client."""
    client = db.query(Client).filter(Client.id == client_id, Client.is_deleted == False).first()
    if not client:
        raise HTTPException(status_code=404, detail="Clientul nu a fost găsit.")

    base_query = db.query(Receipt).filter(
        Receipt.client_id == client_id,
        Receipt.uploaded_by == current_user.id,
    )

    pending = base_query.filter(Receipt.status == "pending").all()
    validated = base_query.filter(Receipt.status == "validated").all()

    return {
        "client_id": client_id,
        "client_name": client.name,
        "client_cui": client.cui,
        "pending_count": len(pending),
        "pending_total": round(sum(r.total_amount or 0 for r in pending), 2),
        "validated_count": len(validated),
        "validated_total": round(sum(r.total_amount or 0 for r in validated), 2),
    }


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a client (keeps historical receipts for statistics)."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client or client.is_deleted:
        raise HTTPException(status_code=404, detail="Clientul nu a fost găsit.")

    client.is_deleted = True

    # Clear it from any accountant that had it selected
    db.query(User).filter(User.active_client_id == client_id).update(
        {User.active_client_id: None}
    )
    db.commit()
    return None
