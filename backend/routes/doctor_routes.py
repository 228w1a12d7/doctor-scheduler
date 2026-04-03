from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Doctor
from schemas import DoctorOut
from utils import upload_image_to_cloudinary

router = APIRouter(tags=["doctors"])


@router.post("/doctors")
def create_doctor(
    name: str = Form(...),
    speciality: str = Form(...),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    clean_name = name.strip()
    clean_speciality = speciality.strip()

    if not clean_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if not clean_speciality:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Speciality is required")

    image_url = upload_image_to_cloudinary(image=image, folder="doctors")

    doctor = Doctor(name=clean_name, speciality=clean_speciality, image=image_url)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    return {"id": doctor.id, "message": "Doctor added"}


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    doctors = db.query(Doctor).order_by(Doctor.id.asc()).all()
    return doctors
