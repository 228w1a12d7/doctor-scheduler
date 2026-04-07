import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const MockApiContext = createContext(null)
const AUTH_STORAGE_KEY = 'doctor_scheduler_auth'
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const DEFAULT_API_BASE_URLS = [
  'http://127.0.0.1:8001',
  'http://localhost:8001',
  'http://127.0.0.1:8000',
  'http://localhost:8000',
]
const API_BASE_URLS = Array.from(
  new Set(
    [configuredApiBaseUrl?.replace(/\/+$/, ''), ...DEFAULT_API_BASE_URLS].filter(Boolean),
  ),
)

const getErrorMessage = async (response) => {
  const fallback = `Request failed (${response.status})`

  try {
    const data = await response.json()

    if (typeof data?.detail === 'string') {
      return data.detail
    }

    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      const first = data.detail[0]
      if (typeof first === 'string') {
        return first
      }
      if (typeof first?.msg === 'string') {
        return first.msg
      }
    }

    if (typeof data?.message === 'string') {
      return data.message
    }

    return fallback
  } catch {
    return fallback
  }
}

const buildUrl = (baseUrl, path, query) => {
  const url = new URL(`${baseUrl}${path}`)

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

export function MockApiProvider({ children }) {
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

  const apiRequest = useCallback(
    async ({ path, method = 'GET', body, query, isFormData = false, authRequired = true }) => {
      const headers = {
        Accept: 'application/json',
      }

      if (authRequired) {
        if (!auth?.token) {
          throw new Error('Please login to continue')
        }
        headers.Authorization = `Bearer ${auth.token}`
      }

      if (!isFormData) {
        headers['Content-Type'] = 'application/json'
      }

      const requestBody = isFormData
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined

      for (let index = 0; index < API_BASE_URLS.length; index += 1) {
        const baseUrl = API_BASE_URLS[index]

        try {
          const response = await fetch(buildUrl(baseUrl, path, query), {
            method,
            headers,
            body: requestBody,
          })

          if (!response.ok) {
            throw new Error(await getErrorMessage(response))
          }

          if (response.status === 204) {
            return null
          }

          const text = await response.text()
          return text ? JSON.parse(text) : null
        } catch (requestError) {
          const isNetworkError = requestError instanceof TypeError
          const hasAnotherCandidate = index < API_BASE_URLS.length - 1

          if (isNetworkError && hasAnotherCandidate) {
            continue
          }

          if (isNetworkError && !hasAnotherCandidate) {
            throw new Error(
              'Unable to reach backend API. Start backend server on 127.0.0.1:8001 (or set VITE_API_BASE_URL).',
            )
          }

          throw requestError
        }
      }

      throw new Error('Unable to reach API server')
    },
    [auth?.token],
  )

  const currentRole = String(auth?.user?.role ?? 'patient').toLowerCase()

  const signup = useCallback(
    (payload) =>
      apiRequest({
        path: '/auth/signup',
        method: 'POST',
        body: payload,
        authRequired: false,
      }),
    [apiRequest],
  )

  const login = useCallback(
    async (payload) => {
      const response = await apiRequest({
        path: '/auth/login',
        method: 'POST',
        body: payload,
        authRequired: false,
      })

      setAuth(response)
      return response
    },
    [apiRequest],
  )

  const fetchCurrentUser = useCallback(async () => {
    const me = await apiRequest({ path: '/auth/me' })

    setAuth((prev) => {
      if (!prev) {
        return prev
      }

      return {
        ...prev,
        user: {
          ...prev.user,
          id: me.id,
          name: me.name,
          email: me.email,
          role: me.role,
          patient_id: me.patient_id,
          gender: me.gender,
          doctor_id: me.doctor_id,
        },
      }
    })

    return me
  }, [apiRequest])

  const ensurePatientId = useCallback(async () => {
    if (!auth?.user) {
      throw new Error('Please login to continue')
    }

    if (String(auth.user.role).toLowerCase() !== 'patient') {
      throw new Error('Patient account required for this action')
    }

    if (auth.user.patient_id) {
      return Number(auth.user.patient_id)
    }

    const me = await fetchCurrentUser()
    if (!me?.patient_id) {
      throw new Error('Patient profile not found')
    }

    return Number(me.patient_id)
  }, [auth, fetchCurrentUser])

  const logout = useCallback(() => {
    setAuth(null)
  }, [])

  const getSpecialties = useCallback(() => apiRequest({ path: '/specialties' }), [apiRequest])

  const getDoctors = useCallback(
    (filters = {}) =>
      apiRequest({
        path: '/doctors',
        query: {
          speciality: filters.speciality?.trim() || undefined,
          mode: filters.mode?.trim() || undefined,
          active_only:
            filters.active_only === undefined || filters.active_only === null
              ? undefined
              : Boolean(filters.active_only),
        },
      }),
    [apiRequest],
  )

  const addDoctor = useCallback(
    (payload) => {
      const formData = new FormData()
      formData.append('name', payload.name)
      formData.append('email', payload.email)
      formData.append('speciality', payload.speciality)
      formData.append('mode', payload.mode)
      formData.append('fee', String(payload.fee))
      formData.append('active', String(Boolean(payload.active)))

      if (payload.mode === 'online' && payload.meeting_link) {
        formData.append('meeting_link', payload.meeting_link)
      }

      if (payload.mode === 'offline' && payload.clinic_address) {
        formData.append('clinic_address', payload.clinic_address)
      }

      if (payload.imageFile) {
        formData.append('image', payload.imageFile)
      }

      return apiRequest({
        path: '/doctors',
        method: 'POST',
        body: formData,
        isFormData: true,
      })
    },
    [apiRequest],
  )

  const updateDoctor = useCallback(
    (payload) => {
      const formData = new FormData()
      formData.append('name', payload.name)
      formData.append('email', payload.email)
      formData.append('speciality', payload.speciality)
      formData.append('mode', payload.mode)
      formData.append('fee', String(payload.fee))
      formData.append('active', String(Boolean(payload.active)))

      if (payload.mode === 'online' && payload.meeting_link) {
        formData.append('meeting_link', payload.meeting_link)
      }

      if (payload.mode === 'offline' && payload.clinic_address) {
        formData.append('clinic_address', payload.clinic_address)
      }

      if (payload.imageFile) {
        formData.append('image', payload.imageFile)
      }

      return apiRequest({
        path: `/doctors/${Number(payload.id)}`,
        method: 'PUT',
        body: formData,
        isFormData: true,
      })
    },
    [apiRequest],
  )

  const deleteDoctor = useCallback(
    (doctorId) =>
      apiRequest({
        path: `/doctors/${Number(doctorId)}`,
        method: 'DELETE',
      }),
    [apiRequest],
  )

  const addDoctorSchedule = useCallback(
    (payload) =>
      apiRequest({
        path: '/doctor-schedules',
        method: 'POST',
        body: {
          doctor_id: Number(payload.doctor_id),
          date: payload.date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          booked: false,
        },
      }),
    [apiRequest],
  )

  const getDoctorSchedules = useCallback(
    (filters = {}) =>
      apiRequest({
        path: '/doctor-schedules',
        query: {
          doctor_id: filters.doctor_id ? Number(filters.doctor_id) : undefined,
          date: filters.date || undefined,
          mode: filters.mode || undefined,
          include_booked:
            filters.include_booked === undefined
              ? undefined
              : Boolean(filters.include_booked),
        },
      }),
    [apiRequest],
  )

  const createLeave = useCallback(
    (payload) =>
      apiRequest({
        path: '/leaves',
        method: 'POST',
        body: {
          doctor_id: Number(payload.doctor_id),
          start_date: payload.start_date,
          end_date: payload.end_date,
          reason: payload.reason,
          number_of_leaves: Number(payload.number_of_leaves),
        },
      }),
    [apiRequest],
  )

  const getLeaves = useCallback(
    (filters = {}) =>
      apiRequest({
        path: '/leaves',
        query: {
          doctor_id: filters.doctor_id ? Number(filters.doctor_id) : undefined,
        },
      }),
    [apiRequest],
  )

  const getAvailabilityByDate = useCallback(
    (payload) =>
      apiRequest({
        path: '/availability-by-date',
        query: {
          doctor_id: Number(payload.doctor_id),
          date: payload.date,
          mode: payload.mode || undefined,
        },
      }),
    [apiRequest],
  )

  const searchDoctors = useCallback(
    (filters = {}) =>
      apiRequest({
        path: '/search',
        query: {
          name: filters.name?.trim() || undefined,
          speciality: filters.speciality?.trim() || undefined,
          mode: filters.mode?.trim() || undefined,
          active_only:
            filters.active_only === undefined || filters.active_only === null
              ? undefined
              : Boolean(filters.active_only),
        },
      }),
    [apiRequest],
  )

  const createAppointment = useCallback(
    async (payload) => {
      await ensurePatientId()

      return apiRequest({
        path: '/appointments',
        method: 'POST',
        body: {
          doctor_id: Number(payload.doctor_id),
          schedule_id: Number(payload.schedule_id),
          mode: payload.mode,
        },
      })
    },
    [apiRequest, ensurePatientId],
  )

  const getAppointments = useCallback(
    (filters = {}) =>
      apiRequest({
        path: '/appointments',
        query: {
          patient_id: filters.patient_id ? Number(filters.patient_id) : undefined,
          doctor_id: filters.doctor_id ? Number(filters.doctor_id) : undefined,
          date: filters.date || undefined,
        },
      }),
    [apiRequest],
  )

  const updateAppointmentStatus = useCallback(
    (payload) =>
      apiRequest({
        path: `/appointments/${Number(payload.appointment_id)}/status`,
        method: 'PUT',
        body: {
          status: payload.status,
        },
      }),
    [apiRequest],
  )

  const getDailySummary = useCallback(
    (filters = {}) =>
      apiRequest({
        path: '/dashboard/daily-summary',
        query: {
          date: filters.date || undefined,
          mode: filters.mode || undefined,
          speciality_id: filters.speciality_id ? Number(filters.speciality_id) : undefined,
        },
      }),
    [apiRequest],
  )

  const value = useMemo(
    () => ({
      auth,
      currentRole,
      signup,
      login,
      logout,
      fetchCurrentUser,
      ensurePatientId,
      getSpecialties,
      getDoctors,
      addDoctor,
      updateDoctor,
      deleteDoctor,
      addDoctorSchedule,
      getDoctorSchedules,
      createLeave,
      getLeaves,
      getAvailabilityByDate,
      searchDoctors,
      createAppointment,
      getAppointments,
      updateAppointmentStatus,
      getDailySummary,
    }),
    [
      auth,
      currentRole,
      signup,
      login,
      logout,
      fetchCurrentUser,
      ensurePatientId,
      getSpecialties,
      getDoctors,
      addDoctor,
      updateDoctor,
      deleteDoctor,
      addDoctorSchedule,
      getDoctorSchedules,
      createLeave,
      getLeaves,
      getAvailabilityByDate,
      searchDoctors,
      createAppointment,
      getAppointments,
      updateAppointmentStatus,
      getDailySummary,
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
