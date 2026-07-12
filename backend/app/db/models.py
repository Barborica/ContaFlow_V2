import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Time,
)
from sqlalchemy.orm import relationship

from .database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)  # hashed
    role = Column(String, default="accountant")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Client currently selected by this accountant; scanned receipts attach to it
    active_client_id = Column(String, ForeignKey("clients.id"), nullable=True)

    receipts = relationship("Receipt", back_populates="uploader")
    active_client = relationship("Client", foreign_keys=[active_client_id])


class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, default=generate_uuid)
    cui = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    is_deleted = Column(Boolean, default=False)  # soft delete, keeps historical receipts
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    receipts = relationship(
        "Receipt", back_populates="client", foreign_keys="Receipt.client_id"
    )


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True, default=generate_uuid)
    cui = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    receipts = relationship("Receipt", back_populates="supplier")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_id = Column(String, ForeignKey("clients.id"), nullable=True)  # null until validated
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=True)  # null until validated
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)

    entry_number = Column(String, nullable=True)  # receipt number
    date = Column(Date, nullable=True)
    time = Column(Time, nullable=True)
    total_amount = Column(Float, nullable=True)
    image_path = Column(String, nullable=True)
    status = Column(String, default="pending")  # processing/pending/validated
    validated_at = Column(DateTime, nullable=True)  # set when accountant validates

    # Raw OCR data, unverified, kept until accountant validates
    company_name = Column(String, nullable=True)  # supplier name read from receipt
    supplier_cui = Column(String, nullable=True)  # first CUI on receipt (top)
    client_cui = Column(String, nullable=True)  # second CUI on receipt (middle)

    client = relationship(
        "Client", back_populates="receipts", foreign_keys=[client_id]
    )
    supplier = relationship("Supplier", back_populates="receipts")
    uploader = relationship("User", back_populates="receipts")
    items = relationship(
        "ReceiptItem", back_populates="receipt", cascade="all, delete-orphan"
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(String, primary_key=True, default=generate_uuid)
    receipt_id = Column(String, ForeignKey("receipts.id"), nullable=False)
    description = Column(String, nullable=True)  # product/service name
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    receipt = relationship("Receipt", back_populates="items")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
