from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Availability, Clinic, Doctor
from schemas import SearchOut

router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[SearchOut])
def search_by_speciality(
    speciality: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    rows = (
        db.query(Doctor, Availability, Clinic)
        .join(Availability, Availability.doctor_id == Doctor.id)
        .join(Clinic, Clinic.id == Availability.clinic_id)
        .filter(func.lower(Doctor.speciality) == speciality.strip().lower())
        .order_by(Doctor.id.asc(), Clinic.id.asc(), Availability.day.asc())
        .all()
    )

    return [
        {
            "doctor_id": doctor.id,
            "doctor_name": doctor.name,
            "speciality": doctor.speciality,
            "clinic": clinic.name,
            "day": availability.day,
            "time": f"{availability.start_time}-{availability.end_time}",
            "image": doctor.image,
        }
        for doctor, availability, clinic in rows
    ]
