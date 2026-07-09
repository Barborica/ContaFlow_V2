from paddleocr import PaddleOCR
import logging

# Setăm logger-ul pentru a vedea ce se întâmplă în terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inițializăm modelul o singură dată (Singleton) pentru a nu consuma memorie la fiecare bon
# Folosim limba 'en' pentru că recunoaște perfect caracterele latine și cifrele de pe bonuri
logger.info("Inițializare model PaddleOCR. Acest proces poate dura câteva secunde...")
ocr_model = PaddleOCR(use_angle_cls=True, lang="ro")


def extract_text_from_image(image_path: str) -> list:
    """
    Primește calea către o imagine și returnează o listă cu toate textele găsite.
    """
    logger.info(f"Începem procesarea OCR pentru: {image_path}")

    try:
        # Rulăm modelul pe imagine
        result = ocr_model.ocr(image_path)

        extracted_lines = []

        # PaddleOCR returnează o structură complexă (coordonate, text, încredere)
        # Noi extragem doar textul brut pentru moment
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                extracted_lines.append(text)

        logger.info(
            f"OCR finalizat cu succes. S-au extras {len(extracted_lines)} rânduri de text."
        )
        return extracted_lines

    except Exception as e:
        logger.error(f"Eroare la procesarea OCR: {str(e)}")
        return []
