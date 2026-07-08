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
    __tabname__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)  # hashed
    role = Column(String, default="accountant")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    receipt = relationship("Receipt", back_populates="uploader")


class Client(Base):
    __tabname__ = "clients"

    id = Column(String, primary_key=True, default=generate_uuid)
    cui = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    receipt = relationship("Receipt", back_populates="client")


class Supplier(Base):
    __tabname__ = "suppliers"

    id = Column(String, primary_key=True, default=generate_uuid)
    cui = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


class Receipt(Base):
    __tabname__ = "receipts"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)

    entry_number = Column(String, nullable=False)  # receipt number
    date = Column(Date, nullable=False)
    time = Column(Time, nullable=False)
    total_amount = Column(Float, nullable=False)
    image_path = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending/validated

    client = relationship("Client", back_populates="receipts")
    supplier = relationship("Supplier", back_populates="receipts")
    uploader = relationship("User", back_populates="receipts")
    items = relationship(
        "ReceiptItem", back_populates="receipt", cascade="all, delete-orphan"
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(String, primary_key=True, default=generate_uuid)
    receipt_id = Column(String, ForeignKey("receipts.id"), nullable=False)
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
    timestamp = Column(DateTime, default=datetime.now(timezone.utc))
