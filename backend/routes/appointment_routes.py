from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Appointment, Doctor, DoctorLeave, DoctorSchedule, Patient, Specialty
from schemas import (
    AppointmentCreateRequest,
    AppointmentCreateResponse,
    AppointmentOut,
    AppointmentStatusUpdateResponse,
    AppointmentUpdateRequest,
)
from utils import is_future_datetime, send_appointment_confirmation_email

router = APIRouter(tags=["appointments"])
VALID_MODES = {"online", "offline"}
ALLOWED_NEXT_STATUS = {"COMPLETED", "CANCELLED", "NO_SHOW"}


def get_patient_profile_or_403(db: Session, user) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient profile not found for current user",
        )
    return patient


def get_doctor_profile_or_403(db: Session, user) -> Doctor:
    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor account email is missing",
        )

    doctor = db.query(Doctor).filter(func.lower(Doctor.email) == user.email.lower()).first()
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor profile not found for current user",
        )
    return doctor


def normalize_mode(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mode must be online or offline",
        )
    return normalized


def build_mode_artifacts(requested_mode: str, doctor: Doctor):
    if requested_mode == "online":
        if not doctor.meeting_link:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor meeting link is not configured",
            )
        return doctor.meeting_link, None, None

    return (
        None,
        doctor.clinic_address,
        "Please arrive 10 minutes early and carry a valid ID proof.",
    )


def build_patient_confirmation_email_body(
    patient_name: str,
    requested_mode: str,
    doctor_name: str,
    schedule_date,
    schedule_time_slot: str,
    video_link: str | None,
    clinic_address: str | None,
    clinic_instructions: str | None,
):
    body = (
        f"Hello {patient_name},\n\n"
        f"Your {requested_mode} appointment is confirmed with Dr. {doctor_name} on "
        f"{schedule_date} at {schedule_time_slot}.\n"
    )
    if video_link:
        body += f"Video link: {video_link}\n"
    if clinic_address:
        body += f"Clinic address: {clinic_address}\n"
        body += f"Instructions: {clinic_instructions}\n"

    return body


def build_doctor_confirmation_email_body(
    doctor_name: str,
    patient_name: str,
    patient_email: str,
    requested_mode: str,
    schedule_date,
    schedule_time_slot: str,
):
    return (
        f"Hello Dr. {doctor_name},\n\n"
        f"A new {requested_mode} appointment has been booked.\n"
        f"Patient: {patient_name} ({patient_email})\n"
        f"Date: {schedule_date}\n"
        f"Time: {schedule_time_slot}\n"
    )


def build_patient_status_email_body(
    patient_name: str,
    doctor_name: str,
    appointment_date,
    time_slot: str,
    new_status: str,
    mode: str,
):
    return (
        f"Hello {patient_name},\n\n"
        f"Your appointment with Dr. {doctor_name} on {appointment_date} at {time_slot} "
        f"({mode}) is now marked as: {new_status}.\n"
    )


def build_doctor_status_email_body(
    doctor_name: str,
    patient_name: str,
    patient_email: str,
    appointment_date,
    time_slot: str,
    new_status: str,
    mode: str,
):
    return (
        f"Hello Dr. {doctor_name},\n\n"
        f"Appointment status updated for patient {patient_name} ({patient_email}).\n"
        f"Date: {appointment_date}\n"
        f"Time: {time_slot}\n"
        f"Mode: {mode}\n"
        f"New status: {new_status}\n"
    )


@router.post("/appointments", response_model=AppointmentCreateResponse)
def create_appointment(
    payload: AppointmentCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if str(user.role).lower() != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patient users can create appointments",
        )

    patient = get_patient_profile_or_403(db=db, user=user)
    requested_mode = normalize_mode(payload.mode)

    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    if not doctor.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor is currently inactive",
        )
    if doctor.mode != requested_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor mode mismatch for requested appointment mode",
        )

    schedule = db.get(DoctorSchedule, payload.schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule slot not found")
    if schedule.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected slot does not belong to the selected doctor",
        )
    if schedule.booked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slot already booked")
    if not is_future_datetime(schedule.schedule_date, schedule.time_slot):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment must be in the future",
        )

    leave_conflict = (
        db.query(DoctorLeave)
        .filter(
            DoctorLeave.doctor_id == doctor.id,
            DoctorLeave.start_date <= schedule.schedule_date,
            DoctorLeave.end_date >= schedule.schedule_date,
        )
        .first()
    )
    if leave_conflict is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Doctor is on leave ({leave_conflict.reason})",
        )

    specialty = db.get(Specialty, doctor.specialty_id)
    if specialty is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor speciality is not configured",
        )

    video_link, clinic_address, clinic_instructions = build_mode_artifacts(
        requested_mode=requested_mode,
        doctor=doctor,
    )

    try:
        updated_rows = (
            db.query(DoctorSchedule)
            .filter(DoctorSchedule.id == schedule.id, DoctorSchedule.booked.is_(False))
            .update({DoctorSchedule.booked: True}, synchronize_session=False)
        )
        if updated_rows == 0:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slot already booked")

        patient_email_body = build_patient_confirmation_email_body(
            patient_name=patient.name,
            requested_mode=requested_mode,
            doctor_name=doctor.name,
            schedule_date=schedule.schedule_date,
            schedule_time_slot=schedule.time_slot,
            video_link=video_link,
            clinic_address=clinic_address,
            clinic_instructions=clinic_instructions,
        )

        patient_email_sent = send_appointment_confirmation_email(
            to_email=patient.email,
            subject="Appointment Confirmation",
            body=patient_email_body,
        )

        doctor_email_sent = False
        if doctor.email:
            doctor_email_sent = send_appointment_confirmation_email(
                to_email=doctor.email,
                subject="New Appointment Booked",
                body=build_doctor_confirmation_email_body(
                    doctor_name=doctor.name,
                    patient_name=patient.name,
                    patient_email=patient.email,
                    requested_mode=requested_mode,
                    schedule_date=schedule.schedule_date,
                    schedule_time_slot=schedule.time_slot,
                ),
            )

        appointment = Appointment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            specialty_id=specialty.id,
            schedule_id=schedule.id,
            mode=requested_mode,
            date=schedule.schedule_date,
            time_slot=schedule.time_slot,
            status="CONFIRMED",
            fee=doctor.fee,
            video_link=video_link,
            clinic_address=clinic_address,
            clinic_instructions=clinic_instructions,
            email_confirmation_sent=patient_email_sent,
            doctor_email_confirmation_sent=doctor_email_sent,
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create appointment",
        )

    return {
        "appointment_id": appointment.id,
        "status": appointment.status,
        "mode": appointment.mode,
        "date": appointment.date,
        "time_slot": appointment.time_slot,
        "fee": float(appointment.fee),
        "video_link": appointment.video_link,
        "clinic_address": appointment.clinic_address,
        "clinic_instructions": appointment.clinic_instructions,
        "email_confirmation_sent": bool(appointment.email_confirmation_sent),
        "doctor_email_confirmation_sent": bool(appointment.doctor_email_confirmation_sent),
    }


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    patient_id: int | None = Query(default=None),
    doctor_id: int | None = Query(default=None),
    date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_role = str(user.role).lower()
    is_admin = user_role == "admin"
    is_doctor = user_role == "doctor"

    query = (
        db.query(Appointment, Doctor, Specialty, Patient)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(Specialty, Specialty.id == Appointment.specialty_id)
        .join(Patient, Patient.id == Appointment.patient_id)
    )

    if is_admin:
        if patient_id is not None:
            query = query.filter(Appointment.patient_id == patient_id)
        if doctor_id is not None:
            query = query.filter(Appointment.doctor_id == doctor_id)
    elif is_doctor:
        doctor = get_doctor_profile_or_403(db=db, user=user)
        query = query.filter(Appointment.doctor_id == doctor.id)
        if patient_id is not None:
            query = query.filter(Appointment.patient_id == patient_id)
    else:
        patient = get_patient_profile_or_403(db=db, user=user)
        query = query.filter(Appointment.patient_id == patient.id)

    if date:
        query = query.filter(Appointment.date == date)

    rows = query.order_by(Appointment.date.desc(), Appointment.time_slot.desc()).all()

    return [
        {
            "appointment_id": appointment.id,
            "patient_id": appointment.patient_id if (is_admin or is_doctor) else None,
            "patient_name": patient.name if (is_admin or is_doctor) else None,
            "patient_email": patient.email if (is_admin or is_doctor) else None,
            "doctor_id": doctor.id,
            "doctor_name": doctor.name,
            "speciality": specialty.name,
            "mode": appointment.mode,
            "date": appointment.date,
            "time_slot": appointment.time_slot,
            "status": appointment.status,
            "fee": float(appointment.fee),
            "video_link": appointment.video_link,
            "clinic_address": appointment.clinic_address,
            "clinic_instructions": appointment.clinic_instructions,
            "email_confirmation_sent": bool(appointment.email_confirmation_sent),
            "doctor_email_confirmation_sent": bool(appointment.doctor_email_confirmation_sent),
        }
        for appointment, doctor, specialty, patient in rows
    ]


@router.put("/appointments/{appointment_id}/status", response_model=AppointmentStatusUpdateResponse)
@router.put("/appointments/{appointment_id}", response_model=AppointmentStatusUpdateResponse)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_role = str(user.role).lower()
    is_admin = user_role == "admin"
    is_doctor = user_role == "doctor"

    if not is_admin and not is_doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or doctor users can update appointment status",
        )

    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if is_doctor:
        doctor = get_doctor_profile_or_403(db=db, user=user)
        if appointment.doctor_id != doctor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctor can only update their own appointments",
            )

    new_status = payload.status.strip().upper().replace("-", "_")
    if new_status not in ALLOWED_NEXT_STATUS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be COMPLETED, CANCELLED, or NO_SHOW",
        )

    if appointment.status != "CONFIRMED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CONFIRMED appointments can be updated",
        )

    appointment.status = new_status
    patient_status_email_sent = False
    doctor_status_email_sent = False

    if new_status == "CANCELLED":
        schedule = db.get(DoctorSchedule, appointment.schedule_id)
        if schedule is not None:
            schedule.booked = False

    patient = db.get(Patient, appointment.patient_id)
    doctor = db.get(Doctor, appointment.doctor_id)
    if patient is not None and doctor is not None:
        patient_status_email_sent = send_appointment_confirmation_email(
            to_email=patient.email,
            subject=f"Appointment Status Updated: {new_status}",
            body=build_patient_status_email_body(
                patient_name=patient.name,
                doctor_name=doctor.name,
                appointment_date=appointment.date,
                time_slot=appointment.time_slot,
                new_status=new_status,
                mode=appointment.mode,
            ),
        )

        if doctor.email:
            doctor_status_email_sent = send_appointment_confirmation_email(
                to_email=doctor.email,
                subject=f"Appointment Status Updated: {new_status}",
                body=build_doctor_status_email_body(
                    doctor_name=doctor.name,
                    patient_name=patient.name,
                    patient_email=patient.email,
                    appointment_date=appointment.date,
                    time_slot=appointment.time_slot,
                    new_status=new_status,
                    mode=appointment.mode,
                ),
            )

    db.commit()

    return {
        "message": "Appointment updated",
        "appointment_id": appointment.id,
        "status": appointment.status,
        "status_email_sent": patient_status_email_sent,
        "patient_status_email_sent": patient_status_email_sent,
        "doctor_status_email_sent": doctor_status_email_sent,
    }
