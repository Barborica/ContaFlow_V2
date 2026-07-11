import re
import logging

logger = logging.getLogger(__name__)

# Regex pattern for CUI/CIF with optional RO/R0 prefix
CUI_PATTERN = re.compile(
    r"(?:C\.?U\.?I\.?|C\.?I\.?F\.?|C\.?F\.?)\s*:?\s*(?:RO|R0)?\s*(\d{2,10})"
)
# Fallback pattern: standalone RO/R0 followed by digits
RO_PATTERN = re.compile(r"\b(?:RO|R0)\s*(\d{2,10})\b")


def _extract_all_cuis(full_text: str) -> list[str]:
    """Extract all unique CUI numbers found in text, preserving order of appearance."""
    found = []

    # Search with primary CUI/CIF pattern
    for match in CUI_PATTERN.finditer(full_text):
        cui = f"RO{match.group(1)}"
        if cui not in found:
            found.append(cui)

    # Fallback: standalone RO followed by digits
    for match in RO_PATTERN.finditer(full_text):
        cui = f"RO{match.group(1)}"
        if cui not in found:
            found.append(cui)

    return found


def parse_receipt_text(text_lines: list) -> dict:
    """Parse key data from receipt text lines using Regex for Romanian receipts."""
    parsed_data = {
        "company_name": None,
        "supplier_cui": None,  # first CUI on receipt (top = supplier)
        "client_cui": None,  # second CUI on receipt (middle = client)
        "date": None,
        "total": None,
        "items": [],
        "raw_text": text_lines,  # keep raw text for debugging
    }

    if not text_lines:
        logger.warning("No text lines provided for parsing.")
        return parsed_data

    # Combine lines for full-text search
    full_text = " ".join(text_lines).upper()

    # 0. Extract company name (usually the first non-empty line)
    for line in text_lines:
        line_stripped = line.strip()
        if line_stripped and len(line_stripped) > 2:
            parsed_data["company_name"] = line_stripped
            break

    # 1. Extract all CUI/CIF numbers from receipt
    # Receipt layout: supplier CUI at top, client CUI in the middle
    all_cuis = _extract_all_cuis(full_text)

    if len(all_cuis) >= 2:
        parsed_data["supplier_cui"] = all_cuis[0]  # first = supplier (top)
        parsed_data["client_cui"] = all_cuis[1]  # second = client (middle)
    elif len(all_cuis) == 1:
        parsed_data["supplier_cui"] = all_cuis[0]  # only one found

    # 2. Extract Date (formats: DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY)
    date_match = re.search(
        r"(?:DATA\s*:?\s*)?(\d{1,2})[./-](\d{1,2})[./-](20\d{2})", full_text
    )
    if date_match:
        day, month, year = date_match.groups()
        # Standardize date to DB format (YYYY-MM-DD)
        parsed_data["date"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # 3. Extract Total Amount
    # Primary match: look for "TOTAL LEI"
    total_lei_match = re.search(r"TOTAL\s+LEI\s+(\d+[.,]\d{2})", full_text)
    if total_lei_match:
        clean_total = total_lei_match.group(1).replace(",", ".")
        try:
            parsed_data["total"] = float(clean_total)
        except ValueError:
            pass

    if parsed_data["total"] is None:
        # Fallback: look for "TOTAL" not preceded by "SUB" and not followed by "TVA/TUA"
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

    # 4. Extract receipt items (pattern: qty X unit_price = total)
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

    logger.info(f"Successfully parsed data: {parsed_data}")
    return parsed_data
