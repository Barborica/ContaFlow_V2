from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    active_client_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True  # Permit autoconvertion from SQLAlchemy model


class UserActiveClientUpdate(BaseModel):
    client_id: str


class Token(BaseModel):
    access_token: str
    token_type: str


class ClientCreate(BaseModel):
    cui: str
    name: str
    address: Optional[str] = None


class ClientResponse(BaseModel):
    id: str
    cui: str
    name: str
    address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CompanyInfoResponse(BaseModel):
    cui: str
    name: str
    address: Optional[str] = None
    source: str = "lista-firme.info"


class ReceiptItemValidation(BaseModel):
    description: Optional[str] = None
    quantity: float = 1.0
    unit_price: float = 0.0
    total_price: float = 0.0


class ReceiptValidationRequest(BaseModel):
    company_name: Optional[str] = None
    supplier_cui: Optional[str] = None
    client_cui: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    total_amount: Optional[float] = None
    items: List[ReceiptItemValidation] = []
    switch_client_id: Optional[str] = None  # reassign receipt to a different client


class ReceiptValidationResponse(BaseModel):
    id: str
    status: str
    image_path: Optional[str] = None
