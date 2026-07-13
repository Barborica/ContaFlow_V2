from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.db.models import User
from app.schemas import CompanyInfoResponse
from app.services.company_lookup import lookup_company

router = APIRouter()


@router.get("/company-lookup", response_model=CompanyInfoResponse)
def lookup_company_by_cui(
    cui: str = Query(..., description="CUI or CIF to look up (RO prefix optional)"),
    current_user: User = Depends(get_current_user),
):
    """Look up a Romanian company by CUI/CIF via lista-firme.info.

    Used when adding a new client or supplier to pre-fill name and address.
    """
    try:
        data = lookup_company(cui)
    except ValueError:
        raise HTTPException(status_code=400, detail="CUI invalid.")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if not data:
        raise HTTPException(
            status_code=404, detail="Firma nu a fost găsită în registrul public."
        )

    return {
        "cui": data["cui"],
        "name": data["name"],
        "address": data.get("address"),
    }
