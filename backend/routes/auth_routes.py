from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import get_db
from models import Doctor, Patient, Specialty, User
from schemas import LoginRequest, SignupRequest

router = APIRouter(prefix="/auth", tags=["auth"])
VALID_ROLES = {"admin", "patient", "doctor"}
PATIENT_GENDER_TAXONOMY = {
    "male": "Male",
    "female": "Female",
    "other": "Other",
    "prefer_not_to_say": "Prefer not to say",
    "prefer not to say": "Prefer not to say",
}
DEFAULT_DOCTOR_SPECIALITY = "General Physician"


def normalize_patient_gender(value: str) -> str:
    normalized = "_".join(value.strip().lower().split())
    mapped = PATIENT_GENDER_TAXONOMY.get(normalized)
    if mapped is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="gender must be Male, Female, Other, or Prefer not to say",
        )
    return mapped


def get_or_create_default_speciality(db: Session) -> Specialty:
    existing = (
        db.query(Specialty)
        .filter(func.lower(Specialty.name) == DEFAULT_DOCTOR_SPECIALITY.lower())
        .first()
    )
    if existing is not None:
        return existing

    specialty = Specialty(name=DEFAULT_DOCTOR_SPECIALITY)
    db.add(specialty)
    db.flush()
    return specialty


@router.post("/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    name = payload.name.strip()
    role = payload.role.strip().lower()
    normalized_email = payload.email.strip().lower()

    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required")
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be admin, patient, or doctor",
        )
    if role == "patient":
        if not payload.contact or not payload.contact.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="contact is required for patient signup",
            )
        if payload.dob is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="dob is required for patient signup",
            )
        if not payload.gender or not payload.gender.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="gender is required for patient signup",
            )

    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=name,
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.flush()
    doctor_pending_approval = False

    if role == "patient":
        normalized_gender = normalize_patient_gender(payload.gender)
        patient = Patient(
            user_id=user.id,
            name=name,
            contact=payload.contact.strip(),
            dob=payload.dob,
            gender=normalized_gender,
            email=normalized_email,
        )
        db.add(patient)
    elif role == "doctor":
        existing_doctor = (
            db.query(Doctor)
            .filter(func.lower(Doctor.email) == normalized_email)
            .first()
        )
        if existing_doctor is None:
            specialty = get_or_create_default_speciality(db)
            doctor = Doctor(
                name=name,
                email=normalized_email,
                specialty_id=specialty.id,
                mode="online",
                fee=0,
                active=False,
            )
            db.add(doctor)
            doctor_pending_approval = True
        else:
            doctor_pending_approval = not bool(existing_doctor.active)

    db.commit()

    success_message = "User registered successfully"
    if role == "doctor":
        success_message = (
            "Doctor account created and pending admin approval"
            if doctor_pending_approval
            else "Doctor account linked successfully"
        )

    return {"user_id": user.id, "message": success_message}


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})

    patient_id = None
    patient_gender = None
    doctor_id = None
    if user.role.lower() == "patient":
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if patient:
            patient_id = patient.id
            patient_gender = patient.gender
    elif user.role.lower() == "doctor":
        doctor = db.query(Doctor).filter(func.lower(Doctor.email) == user.email.lower()).first()
        if doctor is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctor profile is missing. Contact admin.",
            )
        if not doctor.active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctor account is pending admin approval",
            )
        doctor_id = doctor.id

    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "patient_id": patient_id,
            "gender": patient_gender,
            "doctor_id": doctor_id,
        },
    }


@router.get("/me")
def get_current_user_info(db: Session = Depends(get_db), user=Depends(get_current_user)):
    patient_id = None
    patient_gender = None
    doctor_id = None
    if user.role.lower() == "patient":
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if patient:
            patient_id = patient.id
            patient_gender = patient.gender
    elif user.role.lower() == "doctor":
        doctor = db.query(Doctor).filter(func.lower(Doctor.email) == user.email.lower()).first()
        if doctor:
            doctor_id = doctor.id

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "patient_id": patient_id,
        "gender": patient_gender,
        "doctor_id": doctor_id,
    }
