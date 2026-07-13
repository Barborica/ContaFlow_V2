import logging
import re

import requests

logger = logging.getLogger(__name__)

EXTERNAL_LOOKUP_URL = "https://lista-firme.info/api/v1/info"
TIMEOUT_SECONDS = 10


def _normalize_cui(cui: str) -> str:
    """Strip non-digits and optional RO/R0 prefix from a Romanian CUI/CIF."""
    value = (cui or "").upper().replace(" ", "").replace(".", "")
    value = re.sub(r"^(RO|R0)", "", value)
    return re.sub(r"\D", "", value)


def lookup_company(cui: str) -> dict | None:
    """Query lista-firme.info by CUI and return normalized company data.

    Returns None when the external API does not find the company.
    Raises RuntimeError for network/parse failures.
    """
    normalized = _normalize_cui(cui)
    if not normalized:
        raise ValueError("CUI invalid.")

    try:
        response = requests.get(
            EXTERNAL_LOOKUP_URL,
            params={"cui": normalized},
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning(f"External company lookup failed for CUI {normalized}: {exc}")
        raise RuntimeError("Serviciul extern de verificare firmă nu este disponibil.")

    try:
        payload = response.json()
    except ValueError as exc:
        logger.warning(f"Invalid JSON from external lookup: {exc}")
        raise RuntimeError("Răspuns invalid de la serviciul extern.")

    if not payload:
        return None

    # Defensive extraction: Romanian APIs often use Romanian keys
    def pick(*keys):
        for key in keys:
            if key in payload and payload[key]:
                return payload[key]
            # try case-insensitive match
            for p_key, p_val in payload.items():
                if p_key.lower() == key.lower() and p_val:
                    return p_val
        return None

    name = pick(
        "denumire",
        "nume",
        "Denumire",
        "company_name",
        "name",
        "Nume",
    )
    address = pick(
        "adresa",
        "adresaCompleta",
        "adresa_completa",
        "Adresa",
        "address",
        "Address",
    )

    if not name:
        return None

    return {
        "cui": f"RO{normalized}",
        "name": name,
        "address": address,
        "raw": payload,
    }
