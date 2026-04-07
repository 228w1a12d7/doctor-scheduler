# Doctor Scheduler v2: Database Schema and API Contract

This document is the implementation-aligned contract for the updated use case:
- No clinic or doctor-clinic mapping tables.
- Doctor profile includes mode, fee, active flag, and optional clinic address.
- Date-based slot scheduling with booked flags.
- Mode-specific booking artifacts (video link for online, clinic details for offline).
- Appointment lifecycle with admin transitions.
- Daily summary endpoint with revenue by mode and speciality.
- Privacy-safe patient access rules.

## 1) Database Schema (Backend)

### users
Purpose: Authentication identity and role.

Columns:
- id: INTEGER, primary key
- name: VARCHAR(100), not null
- email: VARCHAR(255), unique, indexed, not null
- password_hash: VARCHAR(255), not null
- role: VARCHAR(50), not null (admin or patient)

Relations:
- One-to-one with patients_v2 via patients_v2.user_id

### specialties
Purpose: Master list of medical specialties.

Columns:
- id: INTEGER, primary key
- name: VARCHAR(120), unique, not null

Relations:
- One-to-many with doctors_v2
- One-to-many with appointments_v2

### doctors_v2
Purpose: Doctor catalog used by search, schedules, and booking.

Columns:
- id: INTEGER, primary key
- name: VARCHAR(100), not null
- specialty_id: INTEGER, foreign key -> specialties.id, not null
- mode: VARCHAR(20), not null (online or offline)
- fee: NUMERIC(10,2), not null
- active: BOOLEAN, not null, default true
- image: VARCHAR(500), nullable
- clinic_address: VARCHAR(300), nullable (required logically when mode=offline)
- created_at: DATETIME, not null, default UTC now

Relations:
- One-to-many with doctor_schedules
- One-to-many with appointments_v2

### patients_v2
Purpose: Patient profile data tied to a user account.

Columns:
- id: INTEGER, primary key
- user_id: INTEGER, foreign key -> users.id, unique, not null
- name: VARCHAR(100), not null
- contact: VARCHAR(30), not null
- dob: DATE, not null
- email: VARCHAR(255), unique, not null

Relations:
- One-to-many with appointments_v2

### doctor_schedules
Purpose: Per-doctor date slots in 15-minute increments.

Columns:
- id: INTEGER, primary key
- doctor_id: INTEGER, foreign key -> doctors_v2.id, not null
- schedule_date: DATE, not null
- time_slot: VARCHAR(5), not null (HH:MM)
- booked: BOOLEAN, not null, default false

Constraints:
- uq_doctor_date_time UNIQUE(doctor_id, schedule_date, time_slot)

Relations:
- One-to-one with appointments_v2 via appointments_v2.schedule_id

### appointments_v2
Purpose: Confirmed patient bookings tied to a single schedule slot.

Columns:
- id: INTEGER, primary key
- patient_id: INTEGER, foreign key -> patients_v2.id, not null
- doctor_id: INTEGER, foreign key -> doctors_v2.id, not null
- specialty_id: INTEGER, foreign key -> specialties.id, not null
- schedule_id: INTEGER, foreign key -> doctor_schedules.id, unique, not null
- mode: VARCHAR(20), not null (online or offline)
- date: DATE, not null
- time_slot: VARCHAR(5), not null
- status: VARCHAR(20), not null, default CONFIRMED
- fee: NUMERIC(10,2), not null
- video_link: VARCHAR(500), nullable (online only)
- clinic_address: VARCHAR(300), nullable (offline only)
- clinic_instructions: VARCHAR(500), nullable (offline only)
- email_confirmation_sent: BOOLEAN, not null, default false
- created_at: DATETIME, not null, default UTC now
- updated_at: DATETIME, not null, default UTC now, auto-updated

Status lifecycle:
- Initial: CONFIRMED
- Admin updates allowed from CONFIRMED only:
  - COMPLETED
  - CANCELLED
  - NO_SHOW
- When status becomes CANCELLED, the linked schedule slot is released (booked=false).

## 2) Business Rules

### Role rules
- admin:
  - Manage doctors and schedules.
  - View all appointments.
  - Update appointment statuses.
  - Access dashboard daily summary.
- patient:
  - Search active doctors.
  - View doctor availability by date.
  - Create appointments for own profile only.
  - View only own appointments (patient_id and patient_name hidden in response).

### Mode rules
- Doctor mode is immutable per doctor record unless admin updates doctor.
- Booking mode must match doctor mode.
- Availability check with mode mismatch returns 400.

### Scheduling rules
- Admin creates schedules by date + time range.
- Time range must be valid and 15-minute aligned.
- Duplicate slots for same doctor/date/time are rejected.
- Booking requires future date-time slot.

## 3) Backend API Contract

Authentication: Bearer token in Authorization header for all endpoints except login/signup.

### Auth

POST /auth/signup
- Auth: Public
- Request JSON:
  - name: string
  - email: string (email)
  - password: string
  - role: admin | patient
  - contact: string (required when role=patient)
  - dob: YYYY-MM-DD (required when role=patient)
- Response JSON:
  - user_id: number
  - message: string

POST /auth/login
- Auth: Public
- Request JSON:
  - email: string
  - password: string
- Response JSON:
  - token: string
  - user:
    - id: number
    - name: string
    - role: string
    - patient_id: number | null

GET /auth/me
- Auth: Any logged-in user
- Response JSON:
  - id, name, email, role, patient_id

### Specialties and Doctors

GET /specialties
- Auth: Logged-in user
- Response JSON array:
  - id: number
  - name: string

POST /doctors
- Auth: Admin
- Content-Type: multipart/form-data
- Form fields:
  - name: string
  - speciality: string
  - mode: online | offline
  - fee: number
  - active: boolean
  - clinic_address: string (required for offline)
  - image: file (optional)
- Response JSON:
  - id: number
  - message: string

GET /doctors
- Auth: Logged-in user
- Query params:
  - speciality?: string
  - mode?: online | offline
  - active_only?: boolean
- Response JSON array:
  - id, name, speciality_id, speciality, mode, fee, active, image, clinic_address

PUT /doctors/{doctor_id}
- Auth: Admin
- Content-Type: multipart/form-data
- Same form fields as POST /doctors
- Response JSON:
  - id: number
  - message: string

DELETE /doctors/{doctor_id}
- Auth: Admin
- Response JSON:
  - message: string

### Schedules and Availability

POST /doctor-schedules
- Auth: Admin
- Request JSON:
  - doctor_id: number
  - date: YYYY-MM-DD
  - start_time: HH:MM
  - end_time: HH:MM
  - booked: boolean (optional, default false)
- Response JSON:
  - message: string
  - doctor_id: number
  - date: YYYY-MM-DD
  - created_slots: number
  - slots: string[]

GET /doctor-schedules
- Auth: Logged-in user
- Query params:
  - doctor_id?: number
  - date?: YYYY-MM-DD
  - mode?: online | offline
  - include_booked?: boolean (default true)
- Response JSON array:
  - id, doctor_id, doctor_name, speciality, mode, date, time_slot, booked

GET /availability-by-date
- Auth: Logged-in user
- Query params:
  - doctor_id: number
  - date: YYYY-MM-DD
  - mode?: online | offline
- Response JSON:
  - doctor_id: number
  - date: YYYY-MM-DD
  - mode: online | offline
  - available_slots:
    - schedule_id: number
    - time_slot: HH:MM

### Doctor Search

GET /search
- Auth: Logged-in user
- Query params:
  - name?: string
  - speciality?: string
  - mode?: online | offline
  - active_only?: boolean
- Response JSON array:
  - doctor_id, doctor_name, speciality, mode, fee, active, image, clinic_address

### Appointments

POST /appointments
- Auth: Patient only
- Request JSON:
  - doctor_id: number
  - schedule_id: number
  - mode: online | offline
- Response JSON:
  - appointment_id: number
  - status: CONFIRMED
  - mode: online | offline
  - date: YYYY-MM-DD
  - time_slot: HH:MM
  - fee: number
  - video_link: string | null
  - clinic_address: string | null
  - clinic_instructions: string | null
  - email_confirmation_sent: boolean

GET /appointments
- Auth: Logged-in user
- Query params:
  - patient_id?: number (admin only)
  - date?: YYYY-MM-DD
- Response JSON array:
  - appointment_id
  - patient_id (admin only, null for patient)
  - patient_name (admin only, null for patient)
  - doctor_id, doctor_name, speciality
  - mode, date, time_slot, status, fee
  - video_link, clinic_address, clinic_instructions
  - email_confirmation_sent

PUT /appointments/{appointment_id}/status
PUT /appointments/{appointment_id}
- Auth: Admin only
- Request JSON:
  - status: COMPLETED | CANCELLED | NO_SHOW
- Response JSON:
  - message: string
  - appointment_id: number
  - status: string

### Dashboard

GET /dashboard/daily-summary
- Auth: Admin only
- Query params:
  - date?: YYYY-MM-DD (defaults to today)
  - mode?: online | offline
  - speciality_id?: number
- Response JSON:
  - date: YYYY-MM-DD
  - total_appointments: number
  - confirmed_count: number
  - completed_count: number
  - cancelled_count: number
  - no_show_count: number
  - revenue: number
  - by_mode:
    - mode, appointment_count, revenue
  - by_speciality:
    - speciality, appointment_count, revenue

## 4) Frontend API Contract (Context Layer)

Source: frontend/src/context/MockApiContext.jsx

All page-level API usage should go through the context methods below.

Auth:
- signup(payload): POST /auth/signup
- login(payload): POST /auth/login
- fetchCurrentUser(): GET /auth/me
- logout(): client state reset
- ensurePatientId(): validates patient role and resolves patient_id using /auth/me if missing

Doctors and specialties:
- getSpecialties(): GET /specialties
- getDoctors(filters): GET /doctors
- addDoctor(payload): POST /doctors (FormData)
- updateDoctor(payload): PUT /doctors/{id} (FormData)
- deleteDoctor(doctorId): DELETE /doctors/{doctorId}

Schedules and search:
- addDoctorSchedule(payload): POST /doctor-schedules
- getDoctorSchedules(filters): GET /doctor-schedules
- getAvailabilityByDate(payload): GET /availability-by-date
- searchDoctors(filters): GET /search

Appointments and dashboard:
- createAppointment(payload): POST /appointments
- getAppointments(filters): GET /appointments
- updateAppointmentStatus(payload): PUT /appointments/{id}/status
- getDailySummary(filters): GET /dashboard/daily-summary

## 5) Frontend Page Responsibilities

- SignupPage:
  - Collects name, email, password, role.
  - If role=patient, requires contact and dob.

- DoctorsPage (admin):
  - CRUD doctor details with mode, fee, active flag, specialty, optional image, and offline clinic address.

- AvailabilityPage (admin):
  - Creates date-based time-slot schedules.
  - Lists schedules with filters (doctor, mode, date, include_booked).

- SearchPage (patient):
  - Searches active doctors by name/speciality/mode.
  - Navigates to booking with doctorId and mode preselected.

- BookingPage (patient):
  - Loads mode-compatible doctors and date availability.
  - Books using doctor_id + schedule_id + mode.
  - Displays online/offline appointment artifacts from API response.

- AppointmentsPage:
  - Patient sees own records only.
  - Admin sees patient context and can update status for CONFIRMED appointments.

- UtilizationPage (admin dashboard):
  - Consumes daily summary endpoint.
  - Supports date/mode/speciality filters.
  - Displays totals, lifecycle counts, revenue, and breakdown tables.

## 6) Prompt-Ready Implementation Notes

If this project is regenerated from prompt, enforce these non-negotiables:
- Never include clinic entity, clinic CRUD, or doctor-clinic mapping.
- Appointment booking must use schedule_id only (not free-form date/time writes).
- Doctor mode mismatch must return HTTP 400 on availability and booking.
- Patient appointment list must redact patient_id and patient_name.
- Admin status update allowed only from CONFIRMED state.
- Dashboard revenue counts only CONFIRMED and COMPLETED statuses.
- Offline doctor creation/update must require clinic_address.
