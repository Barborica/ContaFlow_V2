import re
import logging

logger = logging.getLogger(__name__)


def parse_receipt_text(text_lines: list) -> dict:
    """
    Primește o listă de rânduri de text și extrage datele cheie folosind Regex.
    Optimizat pentru bonuri fiscale românești cu text OCR (care poate conține erori minore).
    """
    parsed_data = {
        "company_name": None,
        "cui": None,
        "date": None,
        "total": None,
        "items": [],
        "raw_text": text_lines,  # Păstrăm și textul brut pentru debug/ajutor vizual
    }

    if not text_lines:
        logger.warning("Nu s-au primit rânduri de text pentru parsare.")
        return parsed_data

    # Unim toate rândurile într-un singur text mare pentru ușurința căutării
    full_text = " ".join(text_lines).upper()

    # 0. Extragerea numelui companiei
    # De obicei este primul rând de pe bon (ex: "IHTIS S.R.L.")
    for line in text_lines:
        line_stripped = line.strip()
        if line_stripped and len(line_stripped) > 2:
            parsed_data["company_name"] = line_stripped
            break

    # 1. Extragerea CUI-ului / CIF-ului
    # OCR-ul poate citi "RO" ca "R0" (zero în loc de O), deci acceptăm ambele variante
    # Tipare: CIF:RO9257696, CUI: RO 9257696, CF RO9257696, CIF:R09257696
    cui_match = re.search(
        r"(?:C\.?U\.?I\.?|C\.?I\.?F\.?|C\.?F\.?)\s*:?\s*(?:RO|R0)?\s*(\d{2,10})",
        full_text,
    )
    if cui_match:
        number = cui_match.group(1)
        parsed_data["cui"] = f"RO{number}"
    else:
        # Căutăm pattern-ul RO/R0 urmat direct de cifre (fără prefix CUI/CIF)
        ro_match = re.search(r"\b(?:RO|R0)\s*(\d{2,10})\b", full_text)
        if ro_match:
            parsed_data["cui"] = f"RO{ro_match.group(1)}"

    # 2. Extragerea Datei
    # Formatul pe bonuri: DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY
    # Poate apărea precedat de "DATA:" sau independent
    date_match = re.search(
        r"(?:DATA\s*:?\s*)?(\d{1,2})[./-](\d{1,2})[./-](20\d{2})", full_text
    )
    if date_match:
        day, month, year = date_match.groups()
        # Standardizăm data în formatul cerut de baza de date (YYYY-MM-DD)
        parsed_data["date"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # 3. Extragerea Totalului
    # Prioritizăm "TOTAL LEI" (totalul final), apoi "TOTAL" simplu
    # Evităm "SUBTOTAL", "TOTAL TVA", "TOTAL TUA" care nu sunt totalul final
    total_lei_match = re.search(
        r"TOTAL\s+LEI\s+(\d+[.,]\d{2})", full_text
    )
    if total_lei_match:
        clean_total = total_lei_match.group(1).replace(",", ".")
        try:
            parsed_data["total"] = float(clean_total)
        except ValueError:
            pass

    if parsed_data["total"] is None:
        # Fallback: caută "TOTAL" care NU este precedat de "SUB" și NU este urmat de "TVA/TUA"
        total_match = re.search(
            r"(?<!SUB)TOTAL\s+(?!TVA|TUA|T\.V\.A)[\s\S]*?(\d+[.,]\d{2})",
            full_text,
        )
        if total_match:
            clean_total = total_match.group(1).replace(",", ".")
            try:
                parsed_data["total"] = float(clean_total)
            except ValueError:
                pass

    # 4. Extragerea articolelor de pe bon
    # Tipare comune: "1 BUC. X 15.00= 15.00 A", "ADAPTOR 15.00"
    # Căutăm rânduri care conțin cantitate x preț = total
    for line in text_lines:
        item_match = re.match(
            r"(\d+)\s*(?:BUC\.?|X)\s*[xX*]\s*(\d+[.,]\d{2})\s*=?\s*(\d+[.,]\d{2})",
            line.strip(),
            re.IGNORECASE,
        )
        if item_match:
            qty = int(item_match.group(1))
            unit_price = float(item_match.group(2).replace(",", "."))
            line_total = float(item_match.group(3).replace(",", "."))
            parsed_data["items"].append(
                {
                    "quantity": qty,
                    "unit_price": unit_price,
                    "total": line_total,
                }
            )

    logger.info(f"Date parsate cu succes: {parsed_data}")
    return parsed_data
