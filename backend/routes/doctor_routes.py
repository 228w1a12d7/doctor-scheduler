from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Doctor, Specialty
from schemas import (
    DoctorOut,
    SpecialtyOut,
)
from utils import upload_image_to_cloudinary

router = APIRouter(tags=["doctors"])
VALID_MODES = {"online", "offline"}
DEFAULT_SPECIALTIES = [
    "General Physician",
    "Pediatrics",
    "Dermatology",
    "Gynecology",
    "Orthopedics",
    "Cardiology",
    "Neurology",
    "Ophthalmology",
    "ENT",
    "Psychiatry",
    "Psychology",
    "Gastroenterology",
    "Nephrology",
    "Urology",
    "Pulmonology",
    "Endocrinology",
    "Oncology",
    "Rheumatology",
    "Dentistry",
    "Physiotherapy",
    "Nutrition",
    "Homeopathy",
    "Ayurveda",
    "General Surgery",
    "Plastic Surgery",
    "Vascular Surgery",
    "Spine",
    "Diabetology",
    "Pain Management",
]


def ensure_admin(user):
    if str(user.role).lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can perform this action",
        )


def normalize_speciality_name(value: str) -> str:
    return " ".join(value.strip().split())


def normalize_doctor_email(value: str | None) -> str:
    cleaned = value.strip().lower() if value else ""
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="doctor email is required",
        )
    if "@" not in cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="doctor email is invalid",
        )
    return cleaned


def normalize_meeting_link(value: str | None, *, required: bool) -> str | None:
    cleaned = value.strip() if value else ""
    if not cleaned:
        if required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="meeting_link is required for online doctors",
            )
        return None

    if not cleaned.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="meeting_link must start with http:// or https://",
        )

    return cleaned


def normalize_location(latitude: float | None, longitude: float | None) -> tuple[float | None, float | None]:
    if latitude is None and longitude is None:
        return None, None

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both location_latitude and location_longitude are required together",
        )

    if not (-90 <= latitude <= 90):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="location_latitude must be between -90 and 90",
        )

    if not (-180 <= longitude <= 180):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="location_longitude must be between -180 and 180",
        )

    return float(latitude), float(longitude)


def build_location_map_url(latitude: float | None, longitude: float | None) -> str | None:
    if latitude is None or longitude is None:
        return None
    return f"https://www.google.com/maps?q={latitude},{longitude}"


def get_or_create_specialty(db: Session, speciality_name: str) -> Specialty:
    normalized = normalize_speciality_name(speciality_name)
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Speciality is required")

    existing = (
        db.query(Specialty)
        .filter(func.lower(Specialty.name) == normalized.lower())
        .first()
    )
    if existing is not None:
        return existing

    specialty = Specialty(name=normalized)
    db.add(specialty)
    db.flush()
    return specialty


@router.get("/specialties", response_model=list[SpecialtyOut])
def list_specialties(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    existing = db.query(Specialty).order_by(Specialty.name.asc()).all()
    if existing:
        return existing

    for name in DEFAULT_SPECIALTIES:
        db.add(Specialty(name=name))
    db.commit()

    return db.query(Specialty).order_by(Specialty.name.asc()).all()


@router.post("/doctors")
def create_doctor(
    name: str = Form(...),
    email: str = Form(...),
    speciality: str = Form(...),
    mode: str = Form(...),
    fee: float = Form(...),
    active: bool = Form(default=True),
    meeting_link: str | None = Form(default=None),
    clinic_address: str | None = Form(default=None),
    location_latitude: float | None = Form(default=None),
    location_longitude: float | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_admin(user)

    clean_name = name.strip()
    clean_email = normalize_doctor_email(email)
    clean_mode = mode.strip().lower()
    clean_speciality = normalize_speciality_name(speciality)
    clean_meeting_link = normalize_meeting_link(meeting_link, required=clean_mode == "online")
    clean_clinic_address = clinic_address.strip() if clinic_address else None
    clean_latitude, clean_longitude = normalize_location(location_latitude, location_longitude)

    duplicate_email = db.query(Doctor).filter(func.lower(Doctor.email) == clean_email).first()
    if duplicate_email is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor email is already registered",
        )

    if not clean_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if clean_mode not in VALID_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mode must be online or offline",
        )
    if fee < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fee must be non-negative")
    if clean_mode == "offline" and not clean_clinic_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="clinic_address is required for offline doctors",
        )

    image_url = upload_image_to_cloudinary(image=image, folder="doctors")
    specialty = get_or_create_specialty(db=db, speciality_name=clean_speciality)

    doctor = Doctor(
        name=clean_name,
        email=clean_email,
        specialty_id=specialty.id,
        mode=clean_mode,
        fee=fee,
        active=active,
        image=image_url,
        meeting_link=clean_meeting_link if clean_mode == "online" else None,
        clinic_address=clean_clinic_address if clean_mode == "offline" else None,
        location_latitude=clean_latitude,
        location_longitude=clean_longitude,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    return {"id": doctor.id, "message": "Doctor added"}


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(
    speciality: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    active_only: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    is_admin = str(user.role).lower() == "admin"
    query = db.query(Doctor, Specialty).join(Specialty, Specialty.id == Doctor.specialty_id)

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

    rows = query.order_by(Doctor.id.asc()).all()

    return [
        {
            "id": doctor.id,
            "name": doctor.name,
            "email": doctor.email if is_admin else None,
            "speciality_id": specialty.id,
            "speciality": specialty.name,
            "mode": doctor.mode,
            "fee": float(doctor.fee),
            "active": bool(doctor.active),
            "image": doctor.image,
            "meeting_link": doctor.meeting_link if is_admin else None,
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


@router.put("/doctors/{doctor_id}")
def update_doctor(
    doctor_id: int,
    name: str = Form(...),
    email: str = Form(...),
    speciality: str = Form(...),
    mode: str = Form(...),
    fee: float = Form(...),
    active: bool = Form(default=True),
    meeting_link: str | None = Form(default=None),
    clinic_address: str | None = Form(default=None),
    location_latitude: float | None = Form(default=None),
    location_longitude: float | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_admin(user)

    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    clean_name = name.strip()
    clean_email = normalize_doctor_email(email)
    clean_mode = mode.strip().lower()
    clean_speciality = normalize_speciality_name(speciality)
    clean_meeting_link = normalize_meeting_link(meeting_link, required=clean_mode == "online")
    clean_clinic_address = clinic_address.strip() if clinic_address else None
    clean_latitude, clean_longitude = normalize_location(location_latitude, location_longitude)

    duplicate_email = (
        db.query(Doctor)
        .filter(func.lower(Doctor.email) == clean_email, Doctor.id != doctor.id)
        .first()
    )
    if duplicate_email is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor email is already registered",
        )

    if not clean_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if clean_mode not in VALID_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mode must be online or offline",
        )
    if fee < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fee must be non-negative")
    if clean_mode == "offline" and not clean_clinic_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="clinic_address is required for offline doctors",
        )

    doctor.name = clean_name
    doctor.email = clean_email
    doctor.mode = clean_mode
    doctor.fee = fee
    doctor.active = active
    doctor.meeting_link = clean_meeting_link if clean_mode == "online" else None
    doctor.clinic_address = clean_clinic_address if clean_mode == "offline" else None
    doctor.location_latitude = clean_latitude
    doctor.location_longitude = clean_longitude
    doctor.specialty_id = get_or_create_specialty(db=db, speciality_name=clean_speciality).id

    if image is not None:
        doctor.image = upload_image_to_cloudinary(image=image, folder="doctors")

    db.commit()
    db.refresh(doctor)

    return {"id": doctor.id, "message": "Doctor updated"}


@router.delete("/doctors/{doctor_id}")
def delete_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_admin(user)

    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    db.delete(doctor)
    db.commit()

    return {"message": "Doctor deleted"}
