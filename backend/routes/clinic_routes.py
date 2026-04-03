from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Clinic, Doctor, DoctorClinic
from schemas import ClinicOut, DoctorClinicMapRequest
from utils import upload_image_to_cloudinary

router = APIRouter(tags=["clinics"])


@router.post("/clinics")
def create_clinic(
    name: str = Form(...),
    location: str = Form(...),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    clean_name = name.strip()
    clean_location = location.strip()

    if not clean_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if not clean_location:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Location is required")

    image_url = upload_image_to_cloudinary(image=image, folder="clinics")

    clinic = Clinic(name=clean_name, location=clean_location, image=image_url)
    db.add(clinic)
    db.commit()
    db.refresh(clinic)

    return {"id": clinic.id, "message": "Clinic created"}


@router.get("/clinics", response_model=list[ClinicOut])
def list_clinics(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    clinics = db.query(Clinic).order_by(Clinic.id.asc()).all()
    return clinics


@router.post("/doctor-clinic")
def map_doctor_to_clinic(
    payload: DoctorClinicMapRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    clinic = db.get(Clinic, payload.clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    existing_map = (
        db.query(DoctorClinic)
        .filter(
            DoctorClinic.doctor_id == payload.doctor_id,
            DoctorClinic.clinic_id == payload.clinic_id,
        )
        .first()
    )

    if existing_map is None:
        mapping = DoctorClinic(doctor_id=payload.doctor_id, clinic_id=payload.clinic_id)
        db.add(mapping)
        db.commit()

    return {"message": "Doctor mapped to clinic"}


@router.get("/doctor-clinic", response_model=list[DoctorClinicMapRequest])
def list_doctor_clinic_mappings(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    rows = db.query(DoctorClinic).order_by(DoctorClinic.doctor_id.asc(), DoctorClinic.clinic_id.asc()).all()
    return [
        {
            "doctor_id": row.doctor_id,
            "clinic_id": row.clinic_id,
        }
        for row in rows
    ]


@router.put("/clinics/{clinic_id}")
def update_clinic(
    clinic_id: int,
    name: str = Form(...),
    location: str = Form(...),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    clinic = db.get(Clinic, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    clean_name = name.strip()
    clean_location = location.strip()

    if not clean_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if not clean_location:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Location is required")

    clinic.name = clean_name
    clinic.location = clean_location

    if image is not None:
        clinic.image = upload_image_to_cloudinary(image=image, folder="clinics")

    db.commit()
    db.refresh(clinic)

    return {"id": clinic.id, "message": "Clinic updated"}


@router.delete("/clinics/{clinic_id}")
def delete_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    clinic = db.get(Clinic, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    db.delete(clinic)
    db.commit()

    return {"message": "Clinic deleted"}
