import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User, Receipt
from app.api.deps import get_current_user
from app.services.ocr_service import extract_text_from_image
from app.services.parser_service import parse_receipt_text

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "temp")


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save uploaded image to temp, run OCR, create pending receipt in DB."""
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

    # Run OCR pipeline
    extracted_text = extract_text_from_image(file_path)
    structured_data = parse_receipt_text(extracted_text)

    # Parse date if available
    receipt_date = None
    if structured_data.get("date"):
        try:
            receipt_date = datetime.strptime(structured_data["date"], "%Y-%m-%d").date()
        except ValueError:
            pass

    # Create pending receipt in DB
    new_receipt = Receipt(
        uploaded_by=str(current_user.id),
        date=receipt_date,
        total_amount=structured_data.get("total"),
        image_path=unique_filename,
        status="pending",
    )
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)

    return {
        "status": "success",
        "receipt_id": new_receipt.id,
        "temp_path": unique_filename,
        "parsed_data": {
            "company_name": structured_data.get("company_name"),
            "supplier_cui": structured_data.get("supplier_cui"),
            "client_cui": structured_data.get("client_cui"),
            "date": structured_data.get("date"),
            "total": structured_data.get("total"),
            "items": structured_data.get("items", []),
        },
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
        }
        for r in receipts
    ]
