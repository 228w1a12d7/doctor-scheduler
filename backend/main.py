from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

load_dotenv()

from database import Base, SessionLocal, engine
from models import Specialty
from routes.appointment_routes import router as appointment_router
from routes.auth_routes import router as auth_router
from routes.availability_routes import router as availability_router
from routes.doctor_routes import router as doctor_router
from routes.search_routes import router as search_router
from routes.utilization_routes import router as utilization_router

Base.metadata.create_all(bind=engine)


def ensure_patient_gender_column():
    inspector = inspect(engine)
    if "patients_v2" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("patients_v2")}
    if "gender" in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE patients_v2 ADD COLUMN gender VARCHAR(30)"))


ensure_patient_gender_column()


def ensure_doctor_meeting_link_column():
    inspector = inspect(engine)
    if "doctors_v2" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("doctors_v2")}
    if "meeting_link" in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE doctors_v2 ADD COLUMN meeting_link VARCHAR(500)"))


ensure_doctor_meeting_link_column()


def ensure_doctor_email_column():
    inspector = inspect(engine)
    if "doctors_v2" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("doctors_v2")}
    if "email" in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE doctors_v2 ADD COLUMN email VARCHAR(255)"))


ensure_doctor_email_column()


def ensure_doctor_location_columns():
    inspector = inspect(engine)
    if "doctors_v2" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("doctors_v2")}

    with engine.begin() as connection:
        if "location_latitude" not in existing_columns:
            connection.execute(text("ALTER TABLE doctors_v2 ADD COLUMN location_latitude NUMERIC(10, 7)"))
        if "location_longitude" not in existing_columns:
            connection.execute(text("ALTER TABLE doctors_v2 ADD COLUMN location_longitude NUMERIC(10, 7)"))


ensure_doctor_location_columns()


def ensure_appointment_doctor_email_confirmation_column():
    inspector = inspect(engine)
    if "appointments_v2" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("appointments_v2")}
    if "doctor_email_confirmation_sent" in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE appointments_v2 "
                "ADD COLUMN doctor_email_confirmation_sent BOOLEAN DEFAULT 0"
            )
        )


ensure_appointment_doctor_email_confirmation_column()

DEFAULT_SPECIALTIES = [
    "General Physician",
    "Pediatrics",
    "Dermatology",
    "Gynecology",
    "Orthopedics",
    "Cardiology",
    "Neurology",
    "Ophthalmology",
    "ENT",
    "Psychiatry",
    "Psychology",
    "Gastroenterology",
    "Nephrology",
    "Urology",
    "Pulmonology",
    "Endocrinology",
    "Oncology",
    "Rheumatology",
    "Dentistry",
    "Physiotherapy",
    "Nutrition",
    "Homeopathy",
    "Ayurveda",
    "General Surgery",
    "Plastic Surgery",
    "Vascular Surgery",
    "Spine",
    "Diabetology",
    "Pain Management",
]


def seed_default_specialties():
    db: Session = SessionLocal()
    try:
        existing_count = db.query(Specialty).count()
        if existing_count > 0:
            return

        for speciality_name in DEFAULT_SPECIALTIES:
            db.add(Specialty(name=speciality_name))
        db.commit()
    finally:
        db.close()


seed_default_specialties()

app = FastAPI(title="Doctor Appointment System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(doctor_router)
app.include_router(availability_router)
app.include_router(appointment_router)
app.include_router(search_router)
app.include_router(utilization_router)


@app.get("/")
def health_check():
    return {"message": "Doctor Appointment System API"}
