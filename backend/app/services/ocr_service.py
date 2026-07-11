import logging
from PIL import Image, ImageOps
from paddleocr import PaddleOCR

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize PaddleOCR model as a singleton
logger.info("Initializing PaddleOCR model. This may take a few seconds...")
ocr_model = PaddleOCR(use_textline_orientation=True, lang="ro")


def fix_image_orientation(image_path: str):
    """Fix image rotation using EXIF metadata before OCR."""
    try:
        img = Image.open(image_path)
        img_fixed = ImageOps.exif_transpose(img)

        # Convert to RGB to prevent transparency issues
        if img_fixed.mode != "RGB":
            img_fixed = img_fixed.convert("RGB")

        img_fixed.save(image_path)
        logger.info("Image orientation corrected successfully.")
    except Exception as e:
        logger.warning(f"Could not fix orientation (missing EXIF?): {e}")


def extract_text_from_image(image_path: str) -> list:
    """Run OCR on image and return list of recognized texts."""
    logger.info(f"Starting OCR processing for: {image_path}")

    try:
        fix_image_orientation(image_path)

        # Run prediction using PaddleOCR v3.x API
        result = ocr_model.predict(image_path)
        extracted_lines = []

        # Parse text lines with confidence score >= 60%
        if result:
            for page_result in result:
                rec_texts = page_result.get("rec_texts", [])
                rec_scores = page_result.get("rec_scores", [])

                for text, score in zip(rec_texts, rec_scores):
                    if score >= 0.6:
                        extracted_lines.append(text)

        logger.info(f"OCR successful. Extracted {len(extracted_lines)} lines.")
        logger.info(f"Extracted text: {extracted_lines}")
        return extracted_lines

    except Exception as e:
        logger.error(f"OCR processing failed: {str(e)}", exc_info=True)
        return []
