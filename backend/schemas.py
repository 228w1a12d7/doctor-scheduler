from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    contact: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SpecialtyOut(BaseModel):
    id: int
    name: str


class DoctorScheduleCreateRequest(BaseModel):
    doctor_id: int
    date: date
    start_time: str
    end_time: str
    booked: bool = False


class DoctorScheduleOut(BaseModel):
    id: int
    doctor_id: int
    doctor_name: str
    speciality: str
    mode: str
    date: date
    time_slot: str
    booked: bool


class AvailabilitySlotOut(BaseModel):
    schedule_id: int
    time_slot: str


class AvailabilityByDateOut(BaseModel):
    doctor_id: int
    date: date
    mode: str
    available_slots: list[AvailabilitySlotOut]
    is_on_leave: bool = False
    leave_reason: Optional[str] = None


class LeaveCreateRequest(BaseModel):
    doctor_id: int
    start_date: date
    end_date: date
    reason: str
    number_of_leaves: Optional[int] = None


class LeaveOut(BaseModel):
    id: int
    doctor_id: int
    doctor_name: str
    start_date: date
    end_date: date
    reason: str
    number_of_leaves: int


class AppointmentCreateRequest(BaseModel):
    doctor_id: int
    schedule_id: int
    mode: str


class AppointmentUpdateRequest(BaseModel):
    status: str


class DailySummaryByModeOut(BaseModel):
    mode: str
    appointment_count: int
    revenue: float


class DailySummaryBySpecialityOut(BaseModel):
    speciality: str
    appointment_count: int
    revenue: float


class DailySummaryResponse(BaseModel):
    date: date
    total_appointments: int
    confirmed_count: int
    completed_count: int
    cancelled_count: int
    no_show_count: int
    revenue: float
    by_mode: list[DailySummaryByModeOut]
    by_speciality: list[DailySummaryBySpecialityOut]


class DoctorOut(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    speciality_id: int
    speciality: str
    mode: str
    fee: float
    active: bool
    image: Optional[str] = None
    meeting_link: Optional[str] = None
    clinic_address: Optional[str] = None
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_map_url: Optional[str] = None


class SearchOut(BaseModel):
    doctor_id: int
    doctor_name: str
    speciality: str
    mode: str
    fee: float
    active: bool
    image: Optional[str] = None
    clinic_address: Optional[str] = None
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_map_url: Optional[str] = None


class AppointmentOut(BaseModel):
    appointment_id: int
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    patient_email: Optional[str] = None
    doctor_id: int
    doctor_name: str
    speciality: str
    mode: str
    date: date
    time_slot: str
    status: str
    fee: float
    video_link: Optional[str] = None
    clinic_address: Optional[str] = None
    clinic_instructions: Optional[str] = None
    email_confirmation_sent: bool
    doctor_email_confirmation_sent: bool


class AppointmentCreateResponse(BaseModel):
    appointment_id: int
    status: str
    mode: str
    date: date
    time_slot: str
    fee: float
    video_link: Optional[str] = None
    clinic_address: Optional[str] = None
    clinic_instructions: Optional[str] = None
    email_confirmation_sent: bool
    doctor_email_confirmation_sent: bool


class AppointmentStatusUpdateResponse(BaseModel):
    message: str
    appointment_id: int
    status: str
    status_email_sent: bool
    patient_status_email_sent: bool
    doctor_status_email_sent: bool


class DoctorScheduleCreateResponse(BaseModel):
    message: str
    doctor_id: int
    date: date
    created_slots: int
    slots: list[str]
