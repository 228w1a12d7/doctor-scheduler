from datetime import date as date_type, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Doctor, DoctorLeave, DoctorSchedule, Specialty
from schemas import (
    AvailabilityByDateOut,
    DoctorScheduleCreateRequest,
    DoctorScheduleCreateResponse,
    DoctorScheduleOut,
    LeaveCreateRequest,
    LeaveOut,
)
from utils import generate_15_min_slots, parse_time_or_400, time_to_minutes, validate_time_range

router = APIRouter(tags=["schedules"])
VALID_MODES = {"online", "offline"}
LEAVE_REASON_TAXONOMY = {
    "sick leave": "Sick Leave",
    "sick": "Sick Leave",
    "conference": "Conference",
    "out of station": "Out of Station",
    "out-of-station": "Out of Station",
}


def ensure_admin(user):
    if str(user.role).lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can perform this action",
        )


def normalize_leave_reason(reason_value: str) -> str:
    normalized = " ".join(reason_value.strip().lower().replace("-", " ").split())
    mapped = LEAVE_REASON_TAXONOMY.get(normalized)
    if mapped is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reason must be Sick Leave, Conference, or Out of Station",
        )
    return mapped


@router.post("/leaves")
def create_leave(
    payload: LeaveCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_admin(user)

    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    if payload.start_date > payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date",
        )

    normalized_reason = normalize_leave_reason(payload.reason)
    calculated_days = (payload.end_date - payload.start_date).days + 1

    if payload.number_of_leaves is not None and payload.number_of_leaves != calculated_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="number_of_leaves must match start_date and end_date",
        )

    overlap = (
        db.query(DoctorLeave)
        .filter(
            DoctorLeave.doctor_id == payload.doctor_id,
            DoctorLeave.start_date <= payload.end_date,
            DoctorLeave.end_date >= payload.start_date,
        )
        .first()
    )
    if overlap is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave overlaps with an existing leave range",
        )

    leave = DoctorLeave(
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
        "number_of_leaves": calculated_days,
    }


@router.get("/leaves", response_model=list[LeaveOut])
def list_leaves(
    doctor_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(DoctorLeave, Doctor).join(Doctor, Doctor.id == DoctorLeave.doctor_id)

    if doctor_id is not None:
        query = query.filter(DoctorLeave.doctor_id == doctor_id)

    rows = query.order_by(DoctorLeave.start_date.desc(), DoctorLeave.id.desc()).all()

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


@router.post("/doctor-schedules", response_model=DoctorScheduleCreateResponse)
def create_doctor_schedule(
    payload: DoctorScheduleCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_admin(user)

    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    start, end = validate_time_range(payload.start_time, payload.end_time)
    if payload.date < date_type.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule date cannot be in the past",
        )

    leave_conflict = (
        db.query(DoctorLeave)
        .filter(
            DoctorLeave.doctor_id == payload.doctor_id,
            DoctorLeave.start_date <= payload.date,
            DoctorLeave.end_date >= payload.date,
        )
        .first()
    )
    if leave_conflict is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Doctor is on leave ({leave_conflict.reason}) for selected date",
        )

    generated_slots = generate_15_min_slots(start.strftime("%H:%M"), end.strftime("%H:%M"))

    existing_rows = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id == payload.doctor_id,
            DoctorSchedule.schedule_date == payload.date,
            DoctorSchedule.time_slot.in_(generated_slots),
        )
        .all()
    )
    existing_slots = {row.time_slot for row in existing_rows}
    if existing_slots:
        taken = ", ".join(sorted(existing_slots))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Schedule already exists for slots: {taken}",
        )

    for slot in generated_slots:
        db.add(
            DoctorSchedule(
                doctor_id=payload.doctor_id,
                schedule_date=payload.date,
                time_slot=slot,
                booked=False,
            )
        )

    db.commit()

    return {
        "message": "Doctor schedule created",
        "doctor_id": payload.doctor_id,
        "date": payload.date,
        "created_slots": len(generated_slots),
        "slots": generated_slots,
    }


@router.get("/doctor-schedules", response_model=list[DoctorScheduleOut])
def list_doctor_schedules(
    doctor_id: int | None = Query(default=None),
    date: date_type | None = Query(default=None),
    mode: str | None = Query(default=None),
    include_booked: bool = Query(default=True),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = (
        db.query(DoctorSchedule, Doctor, Specialty)
        .join(Doctor, Doctor.id == DoctorSchedule.doctor_id)
        .join(Specialty, Specialty.id == Doctor.specialty_id)
    )

    if doctor_id is not None:
        query = query.filter(DoctorSchedule.doctor_id == doctor_id)

    if date is not None:
        query = query.filter(DoctorSchedule.schedule_date == date)

    if mode:
        normalized_mode = mode.strip().lower()
        if normalized_mode not in VALID_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="mode must be online or offline",
            )
        query = query.filter(Doctor.mode == normalized_mode)

    if str(user.role).lower() == "patient":
        query = query.filter(Doctor.active.is_(True))

    if not include_booked:
        query = query.filter(DoctorSchedule.booked.is_(False))

    rows = (
        query.order_by(
            DoctorSchedule.schedule_date.asc(),
            Doctor.name.asc(),
            DoctorSchedule.time_slot.asc(),
        )
        .all()
    )

    return [
        {
            "id": schedule.id,
            "doctor_id": doctor.id,
            "doctor_name": doctor.name,
            "speciality": specialty.name,
            "mode": doctor.mode,
            "date": schedule.schedule_date,
            "time_slot": schedule.time_slot,
            "booked": bool(schedule.booked),
        }
        for schedule, doctor, specialty in rows
    ]


@router.get("/availability-by-date", response_model=AvailabilityByDateOut)
def get_availability_by_date(
    doctor_id: int = Query(...),
    target_date: date_type = Query(..., alias="date"),
    mode: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    if str(user.role).lower() == "patient" and not doctor.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    if mode:
        normalized_mode = mode.strip().lower()
        if normalized_mode not in VALID_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="mode must be online or offline",
            )
        if normalized_mode != doctor.mode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor mode mismatch for requested appointment mode",
            )

    leave_conflict = (
        db.query(DoctorLeave)
        .filter(
            DoctorLeave.doctor_id == doctor_id,
            DoctorLeave.start_date <= target_date,
            DoctorLeave.end_date >= target_date,
        )
        .first()
    )
    if leave_conflict is not None:
        return {
            "doctor_id": doctor_id,
            "date": target_date,
            "mode": doctor.mode,
            "available_slots": [],
            "is_on_leave": True,
            "leave_reason": leave_conflict.reason,
        }

    schedule_rows = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.schedule_date == target_date,
            DoctorSchedule.booked.is_(False),
        )
        .order_by(DoctorSchedule.time_slot.asc())
        .all()
    )

    if target_date == date_type.today():
        now_minutes = time_to_minutes(datetime.now().time())
        schedule_rows = [
            row
            for row in schedule_rows
            if time_to_minutes(parse_time_or_400(row.time_slot)) > now_minutes
        ]

    return {
        "doctor_id": doctor_id,
        "date": target_date,
        "mode": doctor.mode,
        "available_slots": [
            {
                "schedule_id": row.id,
                "time_slot": row.time_slot,
            }
            for row in schedule_rows
        ],
        "is_on_leave": False,
        "leave_reason": None,
    }
