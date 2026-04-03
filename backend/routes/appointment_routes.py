from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Appointment, Availability, Clinic, Doctor, DoctorClinic, Leave, Patient
from schemas import AppointmentCreateRequest, AppointmentOut, AppointmentUpdateRequest
from utils import get_weekday_name, is_future_datetime, parse_time_or_400, time_to_minutes, validate_15_minute_slot

router = APIRouter(tags=["appointments"])
ALLOWED_NEXT_STATUS = {"COMPLETED", "CANCELLED", "NOSHOW"}


@router.post("/appointments")
def create_appointment(
    payload: AppointmentCreateRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    patient = db.get(Patient, payload.patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    clinic = db.get(Clinic, payload.clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    mapping = (
        db.query(DoctorClinic)
        .filter(
            DoctorClinic.doctor_id == payload.doctor_id,
            DoctorClinic.clinic_id == payload.clinic_id,
        )
        .first()
    )
    if mapping is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor is not mapped to this clinic",
        )

    validate_15_minute_slot(payload.time)

    if not is_future_datetime(payload.date, payload.time):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment must be in the future",
        )

    leave_conflict = (
        db.query(Leave)
        .filter(
            Leave.doctor_id == payload.doctor_id,
            Leave.start_date <= payload.date,
            Leave.end_date >= payload.date,
        )
        .first()
    )
    if leave_conflict:
        leave_reason = leave_conflict.reason.strip() if leave_conflict.reason else "Leave"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Doctor is on leave ({leave_reason})",
        )

    day = get_weekday_name(payload.date)
    availabilities = (
        db.query(Availability)
        .filter(
            Availability.doctor_id == payload.doctor_id,
            Availability.clinic_id == payload.clinic_id,
            Availability.day == day,
        )
        .all()
    )

    if not availabilities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected slot is outside doctor availability",
        )

    target_minutes = time_to_minutes(parse_time_or_400(payload.time))
    slot_inside_availability = False
    for row in availabilities:
        start_minutes = time_to_minutes(parse_time_or_400(row.start_time))
        end_minutes = time_to_minutes(parse_time_or_400(row.end_time))
        if start_minutes <= target_minutes < end_minutes:
            slot_inside_availability = True
            break

    if not slot_inside_availability:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected slot is outside doctor availability",
        )

    already_booked = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == payload.doctor_id,
            Appointment.date == payload.date,
            Appointment.time == payload.time,
            Appointment.status == "BOOKED",
        )
        .first()
    )
    if already_booked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slot already booked",
        )

    appointment = Appointment(
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        clinic_id=payload.clinic_id,
        date=payload.date,
        time=payload.time,
        status="BOOKED",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return {"appointment_id": appointment.id, "status": appointment.status}


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    patient_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    is_admin = str(user.role).lower() == "admin"

    query = db.query(Appointment)

    if is_admin:
        if patient_id is not None:
            query = query.filter(Appointment.patient_id == patient_id)
    else:
        if patient_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_id is required",
            )

        query = query.filter(Appointment.patient_id == patient_id)

    appointments = query.order_by(Appointment.date.desc(), Appointment.time.desc()).all()

    return [
        {
            "appointment_id": row.id,
            "patient_id": row.patient_id,
            "doctor_id": row.doctor_id,
            "clinic_id": row.clinic_id,
            "date": row.date,
            "time": row.time,
            "status": row.status,
        }
        for row in appointments
    ]


@router.put("/appointments/{appointment_id}")
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if str(user.role).lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can update appointment status",
        )

    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    new_status = payload.status.strip().upper()
    if new_status not in ALLOWED_NEXT_STATUS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status transition",
        )

    if appointment.status != "BOOKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only BOOKED appointments can be updated",
        )

    appointment.status = new_status
    db.commit()

    return {"message": "Appointment updated"}
