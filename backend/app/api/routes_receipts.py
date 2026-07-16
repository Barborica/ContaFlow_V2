import logging
import os
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from PIL import Image
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.db.models import AuditLog, Client, Receipt, ReceiptItem, Supplier, User
from app.schemas import ReceiptValidationRequest, ReceiptValidationResponse
from app.services.processing import receipt_queue

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "temp")
PERMANENT_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "receipts")

logger = logging.getLogger(__name__)


def _normalize_cui(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.upper().replace(" ", "").replace(".", "")
    normalized = re.sub(r"^(RO|R0)", "", normalized)
    return re.sub(r"\D", "", normalized) or None


def _ensure_supplier(db: Session, supplier_cui: str | None) -> Supplier | None:
    if not supplier_cui:
        return None

    return (
        db.query(Supplier)
        .filter(Supplier.cui == _normalize_cui(supplier_cui))
        .first()
    )


def _compress_and_move_image(temp_path: str, receipt_id: str, client_id: str | None) -> str:
    """Compress the receipt image and move it to permanent storage."""
    ext = os.path.splitext(temp_path)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg"):
        ext = ".jpg"

    subdir = os.path.join(PERMANENT_UPLOAD_DIR, client_id) if client_id else PERMANENT_UPLOAD_DIR
    os.makedirs(subdir, exist_ok=True)

    permanent_filename = f"{receipt_id}{ext}"
    permanent_path = os.path.join(subdir, permanent_filename)

    with Image.open(temp_path) as img:
        # Convert to RGB if needed (e.g. PNG with transparency)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # Downscale very large images to keep storage reasonable
        max_width = 2048
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

        img.save(permanent_path, "JPEG", quality=85, optimize=True)

    # Remove the original temporary file
    try:
        os.remove(temp_path)
    except OSError:
        logger.warning(f"Could not remove temp image {temp_path}")

    return permanent_filename


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

    # Attach receipt to the currently selected client (if any).  The accountant
    # chooses the active client on the web dashboard before scanning from the
    # mobile app.
    active_client_id = current_user.active_client_id

    # Create receipt in "processing" state; OCR runs later in background worker
    new_receipt = Receipt(
        uploaded_by=str(current_user.id),
        client_id=active_client_id,
        image_path=unique_filename,
        status="processing",
    )
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)

    # Enqueue for sequential OCR processing and return immediately
    await receipt_queue.put(new_receipt.id)

    message = "Bonul a fost primit și se procesează."
    if not active_client_id:
        message += " Atentionare: niciun client activ selectat. Bonul va rămâne nealocat."

    return {
        "status": "accepted",
        "receipt_id": new_receipt.id,
        "message": message,
    }


@router.get("/pending")
def get_pending_receipts(
    client_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return pending receipts for the current user, optionally filtered by client."""
    query = db.query(Receipt).filter(
        Receipt.uploaded_by == current_user.id, Receipt.status == "pending"
    )
    if client_id:
        query = query.filter(Receipt.client_id == client_id)

    receipts = query.order_by(Receipt.id.desc()).all()

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
            "client_id": r.client_id,
        }
        for r in receipts
    ]


@router.get("/validated")
def get_validated_receipts(
    client_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return validated receipts for the current user, optionally by client."""
    query = db.query(Receipt).filter(
        Receipt.uploaded_by == current_user.id, Receipt.status == "validated"
    )
    if client_id:
        query = query.filter(Receipt.client_id == client_id)

    return [
        {
            "id": receipt.id,
            "date": str(receipt.date) if receipt.date else None,
            "total_amount": receipt.total_amount,
            "company_name": receipt.company_name,
            "supplier_cui": receipt.supplier_cui,
        }
        for receipt in query.order_by(Receipt.validated_at.desc()).all()
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

    image_url = None
    if receipt.image_path:
        if receipt.status == "validated":
            image_url = f"/uploads/receipts/{receipt.client_id}/{receipt.image_path}"
        else:
            image_url = f"/uploads/temp/{receipt.image_path}"

    return {
        "id": receipt.id,
        "image_url": image_url,
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


@router.delete("/{receipt_id}", status_code=204)
def delete_pending_receipt(
    receipt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete a pending receipt and its temporary image."""
    receipt = (
        db.query(Receipt)
        .filter(Receipt.id == receipt_id, Receipt.uploaded_by == current_user.id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Bonul nu a fost găsit.")
    if receipt.status != "pending":
        raise HTTPException(
            status_code=409, detail="Pot fi șterse doar bonurile în așteptare."
        )

    image_path = os.path.join(TEMP_UPLOAD_DIR, receipt.image_path or "")
    db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt.id).delete()
    db.delete(receipt)
    db.commit()

    if receipt.image_path and os.path.isfile(image_path):
        try:
            os.remove(image_path)
        except OSError:
            logger.warning("Could not remove temporary image %s", image_path)


@router.post("/{receipt_id}/validate", response_model=ReceiptValidationResponse)
def validate_receipt(
    receipt_id: str,
    data: ReceiptValidationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate a pending receipt, verify supplier/client, persist and archive image."""
    receipt = (
        db.query(Receipt)
        .filter(Receipt.id == receipt_id, Receipt.uploaded_by == current_user.id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Bonul nu a fost găsit.")

    if receipt.status not in ("pending", "validated"):
        raise HTTPException(
            status_code=409, detail="Bonul nu poate fi modificat în starea curentă."
        )

    # Handle client switch: reassign receipt to a different client
    if data.switch_client_id:
        new_client = (
            db.query(Client)
            .filter(Client.id == data.switch_client_id, Client.is_deleted == False)  # noqa: E712
            .first()
        )
        if not new_client:
            raise HTTPException(
                status_code=404,
                detail="Clientul selectat nu există sau a fost șters.",
            )
        receipt.client_id = new_client.id
        # Keep the accountant's active client in sync
        current_user.active_client_id = new_client.id

    if not receipt.client_id:
        raise HTTPException(
            status_code=400,
            detail="Bonul nu este alocat unui client. Selectați un client activ înainte de scanare.",
        )

    client = db.query(Client).filter(Client.id == receipt.client_id).first()
    if not client or client.is_deleted:
        raise HTTPException(
            status_code=400,
            detail="Clientul asociat bonului nu mai există.",
        )

    normalized_client_cui = _normalize_cui(data.client_cui)
    supplier = _ensure_supplier(db, data.supplier_cui)

    if not data.items:
        raise HTTPException(
            status_code=400,
            detail="Bonul trebuie să conțină cel puțin un produs.",
        )

    # Parse and validate date
    receipt_date = None
    if data.date:
        try:
            receipt_date = datetime.strptime(data.date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Data trebuie să fie în format AAAA-LL-ZZ."
            )

    # Archive and compress the image only on the initial validation.
    temp_path = os.path.join(TEMP_UPLOAD_DIR, receipt.image_path or "")
    new_image_path = receipt.image_path
    if receipt.status == "pending" and receipt.image_path and os.path.exists(temp_path):
        new_image_path = _compress_and_move_image(
            temp_path, receipt.id, receipt.client_id
        )

    # Replace line items with validated ones
    db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt.id).delete()
    for item in data.items:
        db.add(
            ReceiptItem(
                receipt_id=receipt.id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=item.total_price,
            )
        )

    # Update receipt metadata
    receipt.company_name = data.company_name
    receipt.supplier_cui = _normalize_cui(data.supplier_cui)
    receipt.client_cui = normalized_client_cui
    receipt.date = receipt_date
    receipt.total_amount = data.total_amount
    receipt.supplier_id = supplier.id if supplier else None
    receipt.status = "validated"
    if receipt.validated_at is None:
        receipt.validated_at = datetime.now(timezone.utc)
    receipt.image_path = new_image_path
    db.commit()
    db.refresh(receipt)

    # Audit log
    db.add(
        AuditLog(
            user_id=str(current_user.id),
            action="validated",
            target_type="receipt",
            target_id=receipt.id,
            details={
                "supplier_cui": receipt.supplier_cui,
                "client_cui": receipt.client_cui,
                "client_id": receipt.client_id,
                "switched_client": bool(data.switch_client_id),
            },
        )
    )
    db.commit()

    return {
        "id": receipt.id,
        "status": receipt.status,
        "image_path": receipt.image_path,
    }

