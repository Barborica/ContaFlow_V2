from paddleocr import PaddleOCR
import logging
from PIL import Image, ImageOps

# Setăm logger-ul pentru a vedea ce se întâmplă în terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inițializăm modelul o singură dată (Singleton) pentru a nu consuma memorie la fiecare bon
# PaddleOCR v3.x: use_textline_orientation înlocuiește use_angle_cls
logger.info("Inițializare model PaddleOCR. Acest proces poate dura câteva secunde...")
ocr_model = PaddleOCR(use_textline_orientation=True, lang="ro")


def fix_image_orientation(image_path: str):
    """
    Citește meta-datele EXIF ale pozei făcute cu telefonul
    și o rotește fizic în poziția corectă (verticală) înainte de OCR.
    """
    try:
        img = Image.open(image_path)
        # ImageOps.exif_transpose aplică rotația dictată de EXIF și șterge tag-ul
        img_fixed = ImageOps.exif_transpose(img)

        # O convertim în RGB pentru a evita problemele cu imaginile transparente (PNG/WebP)
        if img_fixed.mode != "RGB":
            img_fixed = img_fixed.convert("RGB")

        img_fixed.save(image_path)
        logger.info("Orientarea imaginii a fost corectată cu succes.")
    except Exception as e:
        logger.warning(
            f"Nu s-a putut corecta orientarea (posibil imagine fără EXIF): {e}"
        )


def extract_text_from_image(image_path: str) -> list:
    """
    Primește calea către o imagine și returnează o listă cu toate textele găsite.

    PaddleOCR v3.x returnează obiecte OCRResult (dict-like) cu cheia 'rec_texts'
    care conține lista de texte recunoscute.
    """
    logger.info(f"Începem procesarea OCR pentru: {image_path}")

    try:
        fix_image_orientation(image_path)

        # Rulăm modelul pe imagine - folosim predict() (API-ul v3.x)
        result = ocr_model.predict(image_path)

        extracted_lines = []

        # PaddleOCR v3.x returnează o listă de OCRResult (un obiect per pagină/imagine)
        # Fiecare OCRResult este dict-like cu cheile: 'rec_texts', 'rec_scores', 'dt_polys', etc.
        if result:
            for page_result in result:
                rec_texts = page_result.get("rec_texts", [])
                rec_scores = page_result.get("rec_scores", [])

                for text, score in zip(rec_texts, rec_scores):
                    # Filtrăm textele cu încredere prea mică (sub 60%)
                    if score >= 0.6:
                        extracted_lines.append(text)

        logger.info(
            f"OCR finalizat cu succes. S-au extras {len(extracted_lines)} rânduri de text."
        )
        logger.info(f"Text extras: {extracted_lines}")
        return extracted_lines

    except Exception as e:
        logger.error(f"Eroare la procesarea OCR: {str(e)}", exc_info=True)
        return []
