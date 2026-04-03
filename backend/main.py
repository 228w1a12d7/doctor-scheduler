from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import Base, engine
from routes.appointment_routes import router as appointment_router
from routes.auth_routes import router as auth_router
from routes.availability_routes import router as availability_router
from routes.clinic_routes import router as clinic_router
from routes.doctor_routes import router as doctor_router
from routes.search_routes import router as search_router
from routes.utilization_routes import router as utilization_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Doctor Availability Scheduler API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(doctor_router)
app.include_router(clinic_router)
app.include_router(availability_router)
app.include_router(appointment_router)
app.include_router(search_router)
app.include_router(utilization_router)


@app.get("/")
def health_check():
    return {"message": "Doctor Availability Scheduler API"}
