import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from app.db.database import SessionLocal
from app.db.models import Receipt, ReceiptItem
from app.services.ocr_service import extract_text_from_image, get_ocr_model
from app.services.parser_service import parse_receipt_text
from app.api.routes_ws import manager as ws_manager

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "temp")

# Queue holds receipt IDs waiting to be processed by OCR, one at a time
receipt_queue: "asyncio.Queue[str]" = asyncio.Queue()

# Single dedicated thread for OCR: PaddleOCR is not thread-safe and must always
# run on the same thread as the one that created the model.
_ocr_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ocr")


def _run_ocr_pipeline(file_path: str) -> dict:
    """Blocking OCR + parse step (runs on the dedicated OCR thread)."""
    extracted_text = extract_text_from_image(file_path)
    return parse_receipt_text(extracted_text)


async def warmup_ocr():
    """Load the OCR model on its dedicated thread at startup."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(_ocr_executor, get_ocr_model)
    logger.info("OCR model warmed up on dedicated thread.")


async def _process_one(receipt_id: str):
    """Run OCR for a single receipt, persist results, notify web clients."""
    db = SessionLocal()
    try:
        receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
        if not receipt or not receipt.image_path:
            logger.warning(f"Receipt {receipt_id} not found or missing image.")
            return

        file_path = os.path.join(TEMP_UPLOAD_DIR, str(receipt.image_path))

        # Offload heavy OCR to the dedicated single thread (keeps loop responsive)
        loop = asyncio.get_running_loop()
        structured_data = await loop.run_in_executor(
            _ocr_executor, _run_ocr_pipeline, file_path
        )

        # Parse date if available
        receipt_date = None
        if structured_data.get("date"):
            try:
                receipt_date = datetime.strptime(
                    structured_data["date"], "%Y-%m-%d"
                ).date()
            except ValueError:
                pass

        # Update receipt with raw OCR data and mark as ready for validation
        receipt.date = receipt_date
        receipt.total_amount = structured_data.get("total")
        receipt.company_name = structured_data.get("company_name")
        receipt.supplier_cui = structured_data.get("supplier_cui")
        receipt.client_cui = structured_data.get("client_cui")
        receipt.status = "pending"
        db.commit()

        # Persist parsed line items
        for item in structured_data.get("items", []):
            db.add(
                ReceiptItem(
                    receipt_id=receipt.id,
                    description=item.get("description"),
                    quantity=item.get("quantity", 1.0),
                    unit_price=item.get("unit_price", 0.0),
                    total_price=item.get("total", 0.0),
                )
            )
        db.commit()

        # Notify connected web clients that a processed receipt is ready
        await ws_manager.broadcast(
            {
                "event": "new_receipt",
                "data": {
                    "status": "success",
                    "receipt_id": receipt.id,
                    "temp_path": receipt.image_path,
                    "parsed_data": {
                        "company_name": structured_data.get("company_name"),
                        "supplier_cui": structured_data.get("supplier_cui"),
                        "client_cui": structured_data.get("client_cui"),
                        "date": structured_data.get("date"),
                        "total": structured_data.get("total"),
                        "items": structured_data.get("items", []),
                    },
                },
            }
        )
    finally:
        db.close()


async def worker():
    """Background worker: process queued receipts sequentially."""
    logger.info("Receipt processing worker started.")
    while True:
        receipt_id = await receipt_queue.get()
        try:
            await _process_one(receipt_id)
        except Exception:
            logger.exception(f"Failed to process receipt {receipt_id}")
        finally:
            receipt_queue.task_done()
