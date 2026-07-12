import os
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User, Receipt
from app.api.deps import get_current_user
from app.services.processing import receipt_queue

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "temp")


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save uploaded image to temp, create processing receipt, enqueue for OCR."""
    # Validate file is an image
    content_type = file.content_type
    if not content_type or not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Fișierul trebuie să fie o imagine.")

    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Numele fișierului este invalid.")

    # Generate unique filename
    file_extension = filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.join(TEMP_UPLOAD_DIR, unique_filename)

    # Save image to disk
    try:
        os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception:
        raise HTTPException(
            status_code=500, detail="Eroare la salvarea imaginii pe server."
        )

    # Create receipt in "processing" state; OCR runs later in background worker
    new_receipt = Receipt(
        uploaded_by=str(current_user.id),
        image_path=unique_filename,
        status="processing",
    )
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)

    # Enqueue for sequential OCR processing and return immediately
    await receipt_queue.put(new_receipt.id)

    return {
        "status": "accepted",
        "receipt_id": new_receipt.id,
        "message": "Bonul a fost primit și se procesează.",
    }


@router.get("/pending")
def get_pending_receipts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all pending receipts for the current user."""
    receipts = (
        db.query(Receipt)
        .filter(Receipt.uploaded_by == current_user.id, Receipt.status == "pending")
        .order_by(Receipt.id.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "temp_path": r.image_path,
            "date": str(r.date) if r.date else None,
            "total_amount": r.total_amount,
            "status": r.status,
            "company_name": r.company_name,
            "supplier_cui": r.supplier_cui,
            "client_cui": r.client_cui,
        }
        for r in receipts
    ]


@router.get("/{receipt_id}")
def get_receipt(
    receipt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a single receipt with all raw OCR data and line items."""
    receipt = (
        db.query(Receipt)
        .filter(Receipt.id == receipt_id, Receipt.uploaded_by == current_user.id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Bonul nu a fost găsit.")

    return {
        "id": receipt.id,
        "temp_path": receipt.image_path,
        "status": receipt.status,
        "date": str(receipt.date) if receipt.date else None,
        "total_amount": receipt.total_amount,
        "company_name": receipt.company_name,
        "supplier_cui": receipt.supplier_cui,
        "client_cui": receipt.client_cui,
        "items": [
            {
                "id": item.id,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
            }
            for item in receipt.items
        ],
    }
