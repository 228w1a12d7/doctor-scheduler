from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DoctorClinicMapRequest(BaseModel):
    doctor_id: int
    clinic_id: int


class AvailabilityCreateRequest(BaseModel):
    doctor_id: int
    clinic_id: int
    day: str
    start_time: str
    end_time: str


class LeaveCreateRequest(BaseModel):
    doctor_id: int
    start_date: date
    end_date: date
    reason: str


class AppointmentCreateRequest(BaseModel):
    patient_id: int
    doctor_id: int
    clinic_id: int
    date: date
    time: str


class AppointmentUpdateRequest(BaseModel):
    status: str


class UtilizationResponse(BaseModel):
    clinic_id: int
    total_slots: int
    booked_slots: int
    utilization_percentage: int


class DoctorOut(BaseModel):
    id: int
    name: str
    speciality: str
    image: Optional[str] = None


class ClinicOut(BaseModel):
    id: int
    name: str
    location: str
    image: Optional[str] = None


class AvailabilityOut(BaseModel):
    clinic: str
    day: str
    start_time: str
    end_time: str


class SearchOut(BaseModel):
    doctor_id: int
    doctor_name: str
    speciality: str
    clinic: str
    day: str
    time: str
    image: Optional[str] = None


class AvailabilityByDateOut(BaseModel):
    doctor_id: int
    available_slots: list[str]


class AppointmentOut(BaseModel):
    appointment_id: int
    doctor_id: int
    clinic_id: int
    date: date
    time: str
    status: str
