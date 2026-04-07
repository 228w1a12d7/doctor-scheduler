from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)

    patient_profile = relationship("Patient", back_populates="user", uselist=False)


class Specialty(Base):
    __tablename__ = "specialties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)

    doctors = relationship("Doctor", back_populates="specialty", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="specialty")


class Doctor(Base):
    __tablename__ = "doctors_v2"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=False)
    mode = Column(String(20), nullable=False)
    fee = Column(Numeric(10, 2), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    image = Column(String(500), nullable=True)
    meeting_link = Column(String(500), nullable=True)
    clinic_address = Column(String(300), nullable=True)
    location_latitude = Column(Numeric(10, 7), nullable=True)
    location_longitude = Column(Numeric(10, 7), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    specialty = relationship("Specialty", back_populates="doctors")
    schedules = relationship("DoctorSchedule", back_populates="doctor", cascade="all, delete-orphan")
    leaves = relationship("DoctorLeave", back_populates="doctor", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")


class Patient(Base):
    __tablename__ = "patients_v2"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    contact = Column(String(30), nullable=False)
    dob = Column(Date, nullable=False)
    gender = Column(String(30), nullable=True)
    email = Column(String(255), unique=True, nullable=False)

    user = relationship("User", back_populates="patient_profile")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"
    __table_args__ = (
        UniqueConstraint("doctor_id", "schedule_date", "time_slot", name="uq_doctor_date_time"),
    )

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors_v2.id"), nullable=False)
    schedule_date = Column(Date, nullable=False)
    time_slot = Column(String(5), nullable=False)
    booked = Column(Boolean, nullable=False, default=False)

    doctor = relationship("Doctor", back_populates="schedules")
    appointment = relationship("Appointment", back_populates="schedule", uselist=False)


class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors_v2.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(100), nullable=False)

    doctor = relationship("Doctor", back_populates="leaves")


class Appointment(Base):
    __tablename__ = "appointments_v2"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients_v2.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors_v2.id"), nullable=False)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("doctor_schedules.id"), unique=True, nullable=False)
    mode = Column(String(20), nullable=False)
    date = Column(Date, nullable=False)
    time_slot = Column(String(5), nullable=False)
    status = Column(String(20), nullable=False, default="CONFIRMED")
    fee = Column(Numeric(10, 2), nullable=False)
    video_link = Column(String(500), nullable=True)
    clinic_address = Column(String(300), nullable=True)
    clinic_instructions = Column(String(500), nullable=True)
    email_confirmation_sent = Column(Boolean, nullable=False, default=False)
    doctor_email_confirmation_sent = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    specialty = relationship("Specialty", back_populates="appointments")
    schedule = relationship("DoctorSchedule", back_populates="appointment")
