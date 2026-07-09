from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import os
import uuid
from app.db.models import User
from app.api.deps import get_current_user
from app.services.ocr_service import extract_text_from_image
from app.services.parser_service import parse_receipt_text

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "temp")


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(
        get_current_user
    ),  # Only user with JWT Token can upload
):
    # Validate that file is image
    content_type = file.content_type
    if not content_type or not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="The file must be an image")

    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid file name.")

    # Generate unique name
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

    extracted_text = extract_text_from_image(file_path)
    structured_data = parse_receipt_text(extracted_text)

    # Return temp parh
    return {
        "status": "success",
        "message": "Imagine încărcată cu succes",
        "temp_path": unique_filename,
        "extracted_text": structured_data,
    }
