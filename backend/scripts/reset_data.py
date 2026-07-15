"""Reset ContaFlow data.

Usage:
    python scripts/reset_data.py

This deletes all clients, suppliers, receipts, receipt items, audit logs and
uploaded images, while keeping user accounts so you can still log in.
Run it from the backend directory with the virtual environment active.
"""
import os
import shutil
import sys

# Make imports work when running from backend/scripts
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.database import DATABASE_PATH, engine


def delete_uploads():
    base_dir = os.path.dirname(DATABASE_PATH)
    uploads_dir = os.path.join(base_dir, "uploads")
    if not os.path.isdir(uploads_dir):
        return

    for sub in ("temp", "receipts"):
        path = os.path.join(uploads_dir, sub)
        if os.path.isdir(path):
            print(f"Deleting {path} ...")
            shutil.rmtree(path)
            os.makedirs(path, exist_ok=True)


def reset_tables():
    # Order matters for foreign keys
    tables = [
        "audit_logs",
        "receipt_items",
        "receipts",
        "suppliers",
        "clients",
    ]
    with engine.connect() as conn:
        for table in tables:
            print(f"Truncating {table} ...")
            conn.execute(text(f"DELETE FROM {table}"))
        conn.commit()


def main():
    confirm = input(
        "This will DELETE all clients, suppliers, receipts, audit logs and uploaded images.\n"
        "User accounts are kept. Are you sure? [yes/no]: "
    )
    if confirm.strip().lower() != "yes":
        print("Aborted.")
        return

    reset_tables()
    delete_uploads()
    print("Done. Data has been reset.")


if __name__ == "__main__":
    main()
