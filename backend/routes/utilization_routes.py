from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Appointment, Specialty
from schemas import DailySummaryResponse

router = APIRouter(tags=["dashboard"])
VALID_MODES = {"online", "offline"}
REVENUE_STATUSES = {"CONFIRMED", "COMPLETED"}


def ensure_admin(user):
    if str(user.role).lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can access dashboard summaries",
        )


@router.get("/dashboard/daily-summary", response_model=DailySummaryResponse)
def get_daily_summary(
    date: date_type = Query(default_factory=date_type.today),
    mode: str | None = Query(default=None),
    speciality_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_admin(user)

    query = (
        db.query(Appointment, Specialty)
        .join(Specialty, Specialty.id == Appointment.specialty_id)
        .filter(Appointment.date == date)
    )

    if mode and mode.strip():
        normalized_mode = mode.strip().lower()
        if normalized_mode not in VALID_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="mode must be online or offline",
            )
        query = query.filter(Appointment.mode == normalized_mode)

    if speciality_id is not None:
        query = query.filter(Appointment.specialty_id == speciality_id)

    rows = query.all()

    confirmed_count = 0
    completed_count = 0
    cancelled_count = 0
    no_show_count = 0
    revenue_total = 0.0
    mode_summary: dict[str, dict[str, float | int | str]] = {}
    specialty_summary: dict[str, dict[str, float | int | str]] = {}

    for appointment, specialty in rows:
        status_value = appointment.status.upper()
        fee_value = float(appointment.fee)

        if status_value == "CONFIRMED":
            confirmed_count += 1
        elif status_value == "COMPLETED":
            completed_count += 1
        elif status_value == "CANCELLED":
            cancelled_count += 1
        elif status_value == "NO_SHOW":
            no_show_count += 1

        if status_value in REVENUE_STATUSES:
            revenue_total += fee_value

        mode_key = appointment.mode.lower()
        if mode_key not in mode_summary:
            mode_summary[mode_key] = {
                "mode": mode_key,
                "appointment_count": 0,
                "revenue": 0.0,
            }
        mode_summary[mode_key]["appointment_count"] += 1
        if status_value in REVENUE_STATUSES:
            mode_summary[mode_key]["revenue"] += fee_value

        specialty_key = specialty.name
        if specialty_key not in specialty_summary:
            specialty_summary[specialty_key] = {
                "speciality": specialty_key,
                "appointment_count": 0,
                "revenue": 0.0,
            }
        specialty_summary[specialty_key]["appointment_count"] += 1
        if status_value in REVENUE_STATUSES:
            specialty_summary[specialty_key]["revenue"] += fee_value

    return {
        "date": date,
        "total_appointments": len(rows),
        "confirmed_count": confirmed_count,
        "completed_count": completed_count,
        "cancelled_count": cancelled_count,
        "no_show_count": no_show_count,
        "revenue": round(revenue_total, 2),
        "by_mode": [
            {
                "mode": item["mode"],
                "appointment_count": item["appointment_count"],
                "revenue": round(float(item["revenue"]), 2),
            }
            for item in sorted(mode_summary.values(), key=lambda value: value["mode"])
        ],
        "by_speciality": [
            {
                "speciality": item["speciality"],
                "appointment_count": item["appointment_count"],
                "revenue": round(float(item["revenue"]), 2),
            }
            for item in sorted(specialty_summary.values(), key=lambda value: value["speciality"])
        ],
    }
