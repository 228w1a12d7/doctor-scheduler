import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  APPOINTMENT_STATUSES,
  PLACEHOLDER_IMAGE,
  WEEK_DAYS,
} from '../constants/appConstants.js'

const MockApiContext = createContext(null)
const AUTH_STORAGE_KEY = 'doctor_scheduler_auth'

const initialUsers = [
  {
    id: 1,
    name: 'Sree',
    email: 'sree@gmail.com',
    password: '123456',
    role: 'patient',
  },
  {
    id: 2,
    name: 'Admin User',
    email: 'admin@hospital.com',
    password: 'admin123',
    role: 'admin',
  },
]

const initialDoctors = [
  {
    id: 1,
    name: 'Dr Ravi',
    speciality: 'Cardiology',
    image: PLACEHOLDER_IMAGE,
  },
  {
    id: 2,
    name: 'Dr Maya',
    speciality: 'Dermatology',
    image: PLACEHOLDER_IMAGE,
  },
]

const initialClinics = [
  {
    id: 1,
    name: 'City Clinic',
    location: 'Hyderabad',
    image: PLACEHOLDER_IMAGE,
  },
  {
    id: 2,
    name: 'Sunrise Care',
    location: 'Bengaluru',
    image: PLACEHOLDER_IMAGE,
  },
]

const initialMappings = [
  {
    doctor_id: 1,
    clinic_id: 1,
  },
  {
    doctor_id: 2,
    clinic_id: 2,
  },
]

const initialAvailability = [
  {
    doctor_id: 1,
    clinic_id: 1,
    day: 'Monday',
    start_time: '09:00',
    end_time: '14:00',
  },
  {
    doctor_id: 1,
    clinic_id: 1,
    day: 'Wednesday',
    start_time: '10:00',
    end_time: '13:00',
  },
  {
    doctor_id: 2,
    clinic_id: 2,
    day: 'Friday',
    start_time: '11:00',
    end_time: '16:00',
  },
]

const initialAppointments = [
  {
    appointment_id: 101,
    doctor_id: 1,
    clinic_id: 1,
    date: '2026-04-05',
    time: '10:00',
    status: 'BOOKED',
    user_id: 1,
  },
]

const dayFromDateIndex = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const withLatency = (value, ms = 250) =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })

const withError = (message, ms = 250) =>
  new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ms)
  })

const nextId = (items, key) =>
  items.reduce((max, item) => Math.max(max, Number(item[key]) || 0), 0) + 1

const toMinutes = (timeValue) => {
  const [hours, minutes] = timeValue.split(':').map(Number)
  return hours * 60 + minutes
}

const toTime = (minutes) => {
  const safeMinutes = Math.max(0, minutes)
  const hrs = String(Math.floor(safeMinutes / 60)).padStart(2, '0')
  const mins = String(safeMinutes % 60).padStart(2, '0')
  return `${hrs}:${mins}`
}

const buildSlots = (startTime, endTime) => {
  const slots = []
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return slots
  }

  for (let point = start; point < end; point += 15) {
    slots.push(toTime(point))
  }

  return slots
}

const getDayNameFromDate = (isoDate) => {
  const parsed = new Date(`${isoDate}T00:00:00`)
  const day = parsed.getDay()

  if (Number.isNaN(day)) {
    return ''
  }

  return dayFromDateIndex[day]
}

const toApiAppointmentShape = ({ user_id, ...appointment }) => appointment

export function MockApiProvider({ children }) {
  const [users, setUsers] = useState(initialUsers)
  const [doctors, setDoctors] = useState(initialDoctors)
  const [clinics, setClinics] = useState(initialClinics)
  const [mappings, setMappings] = useState(initialMappings)
  const [availability, setAvailability] = useState(initialAvailability)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
      return
    }

    localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [auth])

  const currentRole = auth?.user?.role ?? 'patient'

  const signup = async (payload) => {
    const normalizedEmail = payload.email.trim().toLowerCase()
    const alreadyExists = users.some(
      (user) => user.email.toLowerCase() === normalizedEmail,
    )

    if (alreadyExists) {
      return withError('Email already registered')
    }

    const userId = nextId(users, 'id')
    const newUser = {
      id: userId,
      name: payload.name,
      email: normalizedEmail,
      password: payload.password,
      role: payload.role,
    }

    setUsers((prev) => [...prev, newUser])

    return withLatency({
      user_id: userId,
      message: 'User registered successfully',
    })
  }

  const login = async (payload) => {
    const normalizedEmail = payload.email.trim().toLowerCase()
    const user = users.find(
      (item) =>
        item.email.toLowerCase() === normalizedEmail &&
        item.password === payload.password,
    )

    if (!user) {
      return withError('Invalid credentials')
    }

    const response = {
      token: 'jwt_token',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    }

    setAuth(response)
    return withLatency(response)
  }

  const logout = () => {
    setAuth(null)
  }

  const addDoctor = async (payload) => {
    if (!payload.image) {
      return withError('Image is required')
    }

    const doctorId = nextId(doctors, 'id')
    const newDoctor = {
      id: doctorId,
      name: payload.name,
      speciality: payload.speciality,
      image: payload.image,
    }

    setDoctors((prev) => [...prev, newDoctor])

    return withLatency({
      id: doctorId,
      message: 'Doctor added',
    })
  }

  const getDoctors = async () => withLatency([...doctors])

  const addClinic = async (payload) => {
    if (!payload.image) {
      return withError('Image is required')
    }

    const clinicId = nextId(clinics, 'id')
    const newClinic = {
      id: clinicId,
      name: payload.name,
      location: payload.location,
      image: payload.image,
    }

    setClinics((prev) => [...prev, newClinic])

    return withLatency({
      id: clinicId,
      message: 'Clinic created',
    })
  }

  const getClinics = async () => withLatency([...clinics])

  const mapDoctorToClinic = async (payload) => {
    const doctorId = Number(payload.doctor_id)
    const clinicId = Number(payload.clinic_id)

    const exists = mappings.some(
      (item) => item.doctor_id === doctorId && item.clinic_id === clinicId,
    )

    if (!exists) {
      setMappings((prev) => [...prev, { doctor_id: doctorId, clinic_id: clinicId }])
    }

    return withLatency({
      message: 'Doctor mapped to clinic',
    })
  }

  const getMappings = async () => withLatency([...mappings])

  const addAvailability = async (payload) => {
    const item = {
      doctor_id: Number(payload.doctor_id),
      clinic_id: Number(payload.clinic_id),
      day: payload.day,
      start_time: payload.start_time,
      end_time: payload.end_time,
    }

    if (toMinutes(item.end_time) <= toMinutes(item.start_time)) {
      return withError('End time must be after start time')
    }

    setAvailability((prev) => [...prev, item])

    return withLatency({
      message: 'Availability added',
    })
  }

  const getAvailability = async () => {
    const response = availability.map((item) => {
      const clinic = clinics.find((entry) => entry.id === item.clinic_id)
      return {
        clinic: clinic?.name ?? 'Unknown Clinic',
        day: item.day,
        start_time: item.start_time,
        end_time: item.end_time,
      }
    })

    return withLatency(response)
  }

  const searchDoctorsBySpeciality = async (speciality) => {
    const normalized = speciality.trim().toLowerCase()
    const filteredDoctors = doctors.filter((doctor) => {
      if (!normalized) {
        return true
      }

      return doctor.speciality.toLowerCase().includes(normalized)
    })

    const response = []

    filteredDoctors.forEach((doctor) => {
      const relatedMappings = mappings.filter(
        (item) => item.doctor_id === doctor.id,
      )

      relatedMappings.forEach((mapping) => {
        const clinic = clinics.find((entry) => entry.id === mapping.clinic_id)
        const relatedAvailability = availability.filter(
          (entry) =>
            entry.doctor_id === doctor.id && entry.clinic_id === mapping.clinic_id,
        )

        if (!relatedAvailability.length) {
          response.push({
            doctor_id: doctor.id,
            doctor_name: doctor.name,
            speciality: doctor.speciality,
            clinic: clinic?.name ?? 'Unknown Clinic',
            day: 'Not set',
            time: 'Not available',
            image: doctor.image,
          })
          return
        }

        relatedAvailability.forEach((slot) => {
          response.push({
            doctor_id: doctor.id,
            doctor_name: doctor.name,
            speciality: doctor.speciality,
            clinic: clinic?.name ?? 'Unknown Clinic',
            day: slot.day,
            time: `${slot.start_time}-${slot.end_time}`,
            image: doctor.image,
          })
        })
      })
    })

    return withLatency(response)
  }

  const computeSlotsForDate = ({ doctor_id, clinic_id, date }) => {
    const dayName = getDayNameFromDate(date)
    const doctorId = Number(doctor_id)
    const clinicId = clinic_id ? Number(clinic_id) : null

    if (!dayName || !WEEK_DAYS.includes(dayName)) {
      return []
    }

    const matchingWindows = availability.filter((entry) => {
      if (entry.doctor_id !== doctorId || entry.day !== dayName) {
        return false
      }

      if (!clinicId) {
        return true
      }

      return entry.clinic_id === clinicId
    })

    const generatedSlots = matchingWindows.flatMap((window) =>
      buildSlots(window.start_time, window.end_time),
    )

    const bookedSlots = new Set(
      appointments
        .filter(
          (entry) =>
            entry.doctor_id === doctorId &&
            entry.date === date &&
            entry.status === 'BOOKED',
        )
        .map((entry) => entry.time),
    )

    return [...new Set(generatedSlots)]
      .filter((slot) => !bookedSlots.has(slot))
      .sort()
  }

  const getAvailabilityByDate = async (payload) => {
    const doctorId = Number(payload.doctor_id)
    const availableSlots = computeSlotsForDate(payload)

    return withLatency({
      doctor_id: doctorId,
      available_slots: availableSlots,
    })
  }

  const createAppointment = async (payload) => {
    const availableSlots = computeSlotsForDate(payload)

    if (!availableSlots.includes(payload.time)) {
      return withError('Selected time slot is not available')
    }

    const appointmentId = nextId(appointments, 'appointment_id')
    const newAppointment = {
      appointment_id: appointmentId,
      doctor_id: Number(payload.doctor_id),
      clinic_id: Number(payload.clinic_id),
      date: payload.date,
      time: payload.time,
      status: 'BOOKED',
      user_id: auth?.user?.id ?? null,
    }

    setAppointments((prev) => [...prev, newAppointment])

    return withLatency({
      appointment_id: appointmentId,
      status: 'BOOKED',
    })
  }

  const getAppointments = async () => {
    const role = auth?.user?.role

    if (!role) {
      return withLatency([])
    }

    const scopedAppointments =
      role === 'admin'
        ? appointments
        : appointments.filter((item) => item.user_id === auth.user.id)

    return withLatency(scopedAppointments.map(toApiAppointmentShape))
  }

  const updateAppointment = async (payload) => {
    const appointmentId = Number(payload.appointment_id)

    if (!APPOINTMENT_STATUSES.includes(payload.status)) {
      return withError('Invalid status')
    }

    setAppointments((prev) =>
      prev.map((item) => {
        if (item.appointment_id !== appointmentId) {
          return item
        }

        return {
          ...item,
          status: payload.status,
        }
      }),
    )

    return withLatency({
      message: 'Appointment updated',
    })
  }

  const getUtilization = async (clinicId) => {
    const numericClinicId = Number(clinicId)

    const windows = availability.filter((item) => item.clinic_id === numericClinicId)
    const totalSlots = windows.reduce(
      (sum, item) => sum + buildSlots(item.start_time, item.end_time).length,
      0,
    )

    const bookedSlots = appointments.filter(
      (item) => item.clinic_id === numericClinicId && item.status === 'BOOKED',
    ).length

    const utilizationPercentage =
      totalSlots === 0 ? 0 : Math.min(100, Math.round((bookedSlots / totalSlots) * 100))

    return withLatency({
      clinic_id: numericClinicId,
      total_slots: totalSlots,
      booked_slots: bookedSlots,
      utilization_percentage: utilizationPercentage,
    })
  }

  const value = useMemo(
    () => ({
      auth,
      currentRole,
      signup,
      login,
      logout,
      addDoctor,
      getDoctors,
      addClinic,
      getClinics,
      mapDoctorToClinic,
      getMappings,
      addAvailability,
      getAvailability,
      searchDoctorsBySpeciality,
      getAvailabilityByDate,
      createAppointment,
      getAppointments,
      updateAppointment,
      getUtilization,
    }),
    [
      auth,
      currentRole,
      users,
      doctors,
      clinics,
      mappings,
      availability,
      appointments,
    ],
  )

  return <MockApiContext.Provider value={value}>{children}</MockApiContext.Provider>
}

export function useMockApi() {
  const context = useContext(MockApiContext)

  if (!context) {
    throw new Error('useMockApi must be used inside MockApiProvider')
  }

  return context
}
