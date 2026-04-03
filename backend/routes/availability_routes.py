from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Appointment, Availability, Clinic, Doctor, DoctorClinic, Leave
from schemas import (
    AvailabilityByDateOut,
    AvailabilityCreateRequest,
    AvailabilityOut,
    LeaveCreateRequest,
    LeaveOut,
)
from utils import (
    generate_15_min_slots,
    get_weekday_name,
    parse_time_or_400,
    time_to_minutes,
    validate_time_range,
)

router = APIRouter(tags=["availability"])
VALID_DAYS = {
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
}
LEAVE_REASON_TAXONOMY = {
    "sick leave": "Sick Leave",
    "sick": "Sick Leave",
    "conference": "Conference",
    "out of station": "Out of Station",
    "out-of-station": "Out of Station",
}


@router.post("/availability")
def create_availability(
    payload: AvailabilityCreateRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
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
            detail="Doctor must be mapped to clinic first",
        )

    day = payload.day.strip().capitalize()
    if day not in VALID_DAYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid day")

    start, end = validate_time_range(payload.start_time, payload.end_time)
    start_minutes = time_to_minutes(start)
    end_minutes = time_to_minutes(end)

    existing = (
        db.query(Availability)
        .filter(
            Availability.doctor_id == payload.doctor_id,
            Availability.clinic_id == payload.clinic_id,
            Availability.day == day,
        )
        .all()
    )

    for row in existing:
        existing_start = time_to_minutes(parse_time_or_400(row.start_time))
        existing_end = time_to_minutes(parse_time_or_400(row.end_time))
        has_overlap = start_minutes < existing_end and existing_start < end_minutes
        if has_overlap:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Availability overlaps with existing schedule",
            )

    availability = Availability(
        doctor_id=payload.doctor_id,
        clinic_id=payload.clinic_id,
        day=day,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    db.add(availability)
    db.commit()

    return {"message": "Availability added"}


@router.get("/availability", response_model=list[AvailabilityOut])
def list_availability(
    doctor_id: int = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    # If doctor_id provided, filter by doctor; otherwise return all availability
    if doctor_id is not None:
        doctor = db.get(Doctor, doctor_id)
        if doctor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
        query = db.query(Availability, Clinic).join(Clinic, Clinic.id == Availability.clinic_id).filter(Availability.doctor_id == doctor_id)
    else:
        # Return all availability across all doctors
        query = db.query(Availability, Clinic).join(Clinic, Clinic.id == Availability.clinic_id)
    
    rows = query.order_by(Availability.day.asc(), Availability.start_time.asc()).all()

    result = []
    for availability, clinic in rows:
        result.append(
            {
                "clinic": clinic.name,
                "day": availability.day,
                "start_time": availability.start_time,
                "end_time": availability.end_time,
            }
        )
    return result


@router.post("/leaves")
def create_leave(
    payload: LeaveCreateRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    if payload.start_date > payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date",
        )

    normalized_reason_key = payload.reason.strip().lower()
    normalized_reason = LEAVE_REASON_TAXONOMY.get(normalized_reason_key)
    if normalized_reason is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason must be one of: Sick Leave, Conference, Out of Station",
        )

    number_of_leaves = (payload.end_date - payload.start_date).days + 1
    if payload.number_of_leaves is not None and payload.number_of_leaves != number_of_leaves:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="number_of_leaves must match start_date and end_date range",
        )

    has_appointment_conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == payload.doctor_id,
            Appointment.date >= payload.start_date,
            Appointment.date <= payload.end_date,
            Appointment.status == "BOOKED",
        )
        .first()
    )
    if has_appointment_conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booked appointments conflict with requested leave dates",
        )

    leave = Leave(
        doctor_id=payload.doctor_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=normalized_reason,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    return {
        "message": "Leave recorded",
        "leave_id": leave.id,
        "number_of_leaves": number_of_leaves,
    }


@router.get("/leaves", response_model=list[LeaveOut])
def list_leaves(
    doctor_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(Leave, Doctor).join(Doctor, Doctor.id == Leave.doctor_id)

    if doctor_id is not None:
        query = query.filter(Leave.doctor_id == doctor_id)

    rows = query.order_by(Leave.start_date.desc(), Leave.id.desc()).all()

    return [
        {
            "id": leave.id,
            "doctor_id": leave.doctor_id,
            "doctor_name": doctor.name,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "reason": leave.reason,
            "number_of_leaves": (leave.end_date - leave.start_date).days + 1,
        }
        for leave, doctor in rows
    ]


@router.get("/availability-by-date", response_model=AvailabilityByDateOut)
def get_availability_by_date(
    doctor_id: int = Query(...),
    clinic_id: int | None = Query(default=None),
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    if target_date < datetime.now().date():
        return {
            "doctor_id": doctor_id,
            "available_slots": [],
            "is_on_leave": False,
            "leave_reason": None,
        }

    if clinic_id is not None:
        clinic = db.get(Clinic, clinic_id)
        if clinic is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    leave_exists = (
        db.query(Leave)
        .filter(
            Leave.doctor_id == doctor_id,
            Leave.start_date <= target_date,
            Leave.end_date >= target_date,
        )
        .first()
    )
    if leave_exists:
        return {
            "doctor_id": doctor_id,
            "available_slots": [],
            "is_on_leave": True,
            "leave_reason": leave_exists.reason,
        }

    weekday = get_weekday_name(target_date)
    availability_query = db.query(Availability).filter(
        Availability.doctor_id == doctor_id,
        Availability.day == weekday,
    )

    if clinic_id is not None:
        availability_query = availability_query.filter(Availability.clinic_id == clinic_id)

    availability_rows = availability_query.all()

    slot_set: set[str] = set()
    for row in availability_rows:
        for slot in generate_15_min_slots(row.start_time, row.end_time):
            slot_set.add(slot)

    booked_rows = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == target_date,
            Appointment.status == "BOOKED",
        )
        .all()
    )
    booked_slots = {row.time for row in booked_rows}

    available_slots = sorted(slot_set.difference(booked_slots))

    if target_date == datetime.now().date():
        now_minutes = time_to_minutes(datetime.now().time())
        available_slots = [
            slot
            for slot in available_slots
            if time_to_minutes(parse_time_or_400(slot)) > now_minutes
        ]

    return {
        "doctor_id": doctor_id,
        "available_slots": available_slots,
        "is_on_leave": False,
        "leave_reason": None,
    }
