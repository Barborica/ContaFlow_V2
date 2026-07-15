import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.db.models import Supplier, User

router = APIRouter()


def _normalize_cui(value: str) -> str:
    normalized = value.upper().replace(" ", "").replace(".", "")
    normalized = re.sub(r"^(RO|R0)", "", normalized)
    return re.sub(r"\D", "", normalized)


class SupplierCreate(BaseModel):
    name: str
    cui: str
    address: str | None = None


@router.get("/by-cui")
def get_supplier_by_cui(
    cui: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized_cui = _normalize_cui(cui)
    if not normalized_cui:
        raise HTTPException(status_code=400, detail="CUI invalid.")

    supplier = db.query(Supplier).filter(Supplier.cui == normalized_cui).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Furnizorul nu a fost găsit.")

    return supplier


@router.post("", status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized_cui = _normalize_cui(data.cui)
    if not normalized_cui:
        raise HTTPException(status_code=400, detail="CUI invalid.")
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Denumirea furnizorului este obligatorie.")

    existing = db.query(Supplier).filter(Supplier.cui == normalized_cui).first()
    if existing:
        return existing

    supplier = Supplier(
        cui=normalized_cui,
        name=data.name.strip(),
        address=data.address.strip() if data.address else None,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier
