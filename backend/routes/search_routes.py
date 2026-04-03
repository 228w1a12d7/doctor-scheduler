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
    name: str | None = Query(default=None),
    speciality: str | None = Query(default=None),
    doctor_id: int | None = Query(default=None),
    clinic_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = (
        db.query(Doctor, Availability, Clinic)
        .join(Availability, Availability.doctor_id == Doctor.id)
        .join(Clinic, Clinic.id == Availability.clinic_id)
    )

    if name is not None and name.strip():
        normalized_name = name.strip().lower()
        query = query.filter(func.lower(Doctor.name).contains(normalized_name))

    if speciality is not None and speciality.strip():
        normalized = speciality.strip().lower()
        query = query.filter(func.lower(Doctor.speciality).contains(normalized))

    if doctor_id is not None:
        query = query.filter(Doctor.id == doctor_id)

    if clinic_id is not None:
        query = query.filter(Clinic.id == clinic_id)

    rows = query.order_by(Doctor.id.asc(), Clinic.id.asc(), Availability.day.asc()).all()

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
