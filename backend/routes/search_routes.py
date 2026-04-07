from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Doctor, Specialty
from schemas import SearchOut

router = APIRouter(tags=["search"])
VALID_MODES = {"online", "offline"}


def build_location_map_url(latitude: float | None, longitude: float | None) -> str | None:
    if latitude is None or longitude is None:
        return None
    return f"https://www.google.com/maps?q={latitude},{longitude}"


@router.get("/search", response_model=list[SearchOut])
def search_doctors(
    name: str | None = Query(default=None),
    speciality: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    active_only: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(Doctor, Specialty).join(Specialty, Specialty.id == Doctor.specialty_id)

    if name and name.strip():
        query = query.filter(func.lower(Doctor.name).contains(name.strip().lower()))

    if speciality and speciality.strip():
        query = query.filter(func.lower(Specialty.name).contains(speciality.strip().lower()))

    if mode and mode.strip():
        normalized_mode = mode.strip().lower()
        if normalized_mode not in VALID_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="mode must be online or offline",
            )
        query = query.filter(Doctor.mode == normalized_mode)

    if str(user.role).lower() == "patient":
        query = query.filter(Doctor.active.is_(True))
    elif active_only is not None:
        query = query.filter(Doctor.active.is_(active_only))

    rows = query.order_by(Specialty.name.asc(), Doctor.name.asc()).all()

    return [
        {
            "doctor_id": doctor.id,
            "doctor_name": doctor.name,
            "speciality": specialty.name,
            "mode": doctor.mode,
            "fee": float(doctor.fee),
            "active": bool(doctor.active),
            "image": doctor.image,
            "clinic_address": doctor.clinic_address,
            "location_latitude": float(doctor.location_latitude) if doctor.location_latitude is not None else None,
            "location_longitude": float(doctor.location_longitude) if doctor.location_longitude is not None else None,
            "location_map_url": build_location_map_url(
                float(doctor.location_latitude) if doctor.location_latitude is not None else None,
                float(doctor.location_longitude) if doctor.location_longitude is not None else None,
            ),
        }
        for doctor, specialty in rows
    ]
