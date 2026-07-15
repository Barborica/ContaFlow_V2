from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.database import get_db
from app.db.models import Receipt, User

router = APIRouter()

Period = Literal["day", "month", "year"]


def _format_period(period: Period, dt: datetime | date) -> str:
    if period == "day":
        return dt.strftime("%Y-%m-%d")
    if period == "month":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y")


@router.get("/summary")
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a summary of receipt counts and totals.

    Admins see global numbers; accountants see only their own.
    """
    is_admin = current_user.role == "admin"
    base_query = db.query(Receipt)
    if not is_admin:
        base_query = base_query.filter(Receipt.uploaded_by == current_user.id)

    pending = base_query.filter(Receipt.status == "pending")
    validated = base_query.filter(Receipt.status == "validated")

    return {
        "pending_count": pending.count(),
        "pending_total": round(
            sum(r.total_amount or 0 for r in pending.all()), 2
        ),
        "validated_count": validated.count(),
        "validated_total": round(
            sum(r.total_amount or 0 for r in validated.all()), 2
        ),
        "is_admin_view": is_admin,
    }


@router.get("/by-period")
def get_stats_by_period(
    period: Period = Query("month", description="Aggregation period"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate receipt totals by day/month/year.

    Admins see global data; accountants see only their own.
    """
    is_admin = current_user.role == "admin"
    query = db.query(Receipt).filter(Receipt.status == "validated")
    if not is_admin:
        query = query.filter(Receipt.uploaded_by == current_user.id)

    receipts = query.all()

    groups: dict[str, dict] = {}
    for r in receipts:
        if not r.date:
            continue
        key = _format_period(period, r.date)
        if key not in groups:
            groups[key] = {"period": key, "count": 0, "total": 0.0}
        groups[key]["count"] += 1
        groups[key]["total"] += r.total_amount or 0

    return {
        "period": period,
        "data": [
            {**g, "total": round(g["total"], 2)}
            for g in sorted(groups.values(), key=lambda x: x["period"])
        ],
    }


@router.get("/by-accountant")
def get_stats_by_accountant(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: summary per accountant."""
    users = db.query(User).all()
    result = []
    for user in users:
        receipts = db.query(Receipt).filter(Receipt.uploaded_by == user.id)
        pending = receipts.filter(Receipt.status == "pending").all()
        validated = receipts.filter(Receipt.status == "validated").all()
        result.append(
            {
                "user_id": user.id,
                "email": user.email,
                "role": user.role,
                "pending_count": len(pending),
                "pending_total": round(sum(r.total_amount or 0 for r in pending), 2),
                "validated_count": len(validated),
                "validated_total": round(
                    sum(r.total_amount or 0 for r in validated), 2
                ),
            }
        )
    return result
