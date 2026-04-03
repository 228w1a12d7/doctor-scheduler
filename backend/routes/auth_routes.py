from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import get_db
from models import Patient, User
from schemas import LoginRequest, SignupRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    name = payload.name.strip()
    role = payload.role.strip()

    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required")
    if not role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role is required")

    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.flush()

    if role.lower() == "patient":
        patient = Patient(name=name)
        db.add(patient)

    db.commit()

    return {"user_id": user.id, "message": "User registered successfully"}


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})

    # Fetch patient_id if user is a patient
    patient_id = None
    if user.role.lower() == "patient":
        patient = db.query(Patient).filter(Patient.name == user.name).first()
        if patient:
            patient_id = patient.id

    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "patient_id": patient_id,
        },
    }


@router.get("/me")
def get_current_user_info(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get current logged-in user info including patient_id"""
    patient_id = None
    if user.role.lower() == "patient":
        patient = db.query(Patient).filter(Patient.name == user.name).first()
        if patient:
            patient_id = patient.id
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "patient_id": patient_id,
    }
