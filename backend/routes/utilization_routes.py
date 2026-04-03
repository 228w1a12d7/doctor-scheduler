from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Appointment, Availability, Clinic
from schemas import UtilizationResponse
from utils import parse_time_or_400, time_to_minutes

router = APIRouter(tags=["utilization"])


@router.get("/utilization", response_model=UtilizationResponse)
def get_clinic_utilization(
    clinic_id: int = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    clinic = db.get(Clinic, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    availability_rows = db.query(Availability).filter(Availability.clinic_id == clinic_id).all()

    total_slots = 0
    for row in availability_rows:
        start_minutes = time_to_minutes(parse_time_or_400(row.start_time))
        end_minutes = time_to_minutes(parse_time_or_400(row.end_time))
        total_slots += max((end_minutes - start_minutes) // 15, 0)

    booked_slots = (
        db.query(Appointment)
        .filter(Appointment.clinic_id == clinic_id, Appointment.status == "BOOKED")
        .count()
    )

    utilization_percentage = (
        int(round((booked_slots / total_slots) * 100)) if total_slots > 0 else 0
    )

    return {
        "clinic_id": clinic_id,
        "total_slots": total_slots,
        "booked_slots": booked_slots,
        "utilization_percentage": utilization_percentage,
    }
