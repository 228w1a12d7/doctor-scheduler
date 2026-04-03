import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const MockApiContext = createContext(null)
const AUTH_STORAGE_KEY = 'doctor_scheduler_auth'
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const API_BASE_URLS = configuredApiBaseUrl
  ? [configuredApiBaseUrl.replace(/\/+$/, '')]
  : ['http://127.0.0.1:8001', 'http://127.0.0.1:8000']

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
  const [mappingCache, setMappingCache] = useState([])
  const [hasFetchedMappings, setHasFetchedMappings] = useState(false)

  useEffect(() => {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
      return
    }

    localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [auth])

  const apiRequest = useCallback(
    async ({
      path,
      method = 'GET',
      body,
      query,
      isFormData = false,
      authRequired = true,
    }) => {
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
          if (!text) {
            return null
          }

          return JSON.parse(text)
        } catch (requestError) {
          const isNetworkError = requestError instanceof TypeError
          const hasAnotherCandidate = index < API_BASE_URLS.length - 1

          if (isNetworkError && hasAnotherCandidate) {
            continue
          }

          throw requestError
        }
      }

      throw new Error('Unable to reach API server')
    },
    [auth?.token],
  )

  const currentRole = auth?.user?.role ?? 'patient'

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
      setMappingCache([])
      setHasFetchedMappings(false)
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
          role: me.role,
          patient_id: me.patient_id,
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
      throw new Error('Patient profile not found for this user')
    }

    return Number(me.patient_id)
  }, [auth, fetchCurrentUser])

  const logout = useCallback(() => {
    setAuth(null)
    setMappingCache([])
    setHasFetchedMappings(false)
  }, [])

  const addDoctor = useCallback(
    (payload) => {
      const formData = new FormData()
      formData.append('name', payload.name)
      formData.append('speciality', payload.speciality)

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
      formData.append('speciality', payload.speciality)

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

  const getDoctors = useCallback(() => apiRequest({ path: '/doctors' }), [apiRequest])

  const addClinic = useCallback(
    (payload) => {
      const formData = new FormData()
      formData.append('name', payload.name)
      formData.append('location', payload.location)

      if (payload.imageFile) {
        formData.append('image', payload.imageFile)
      }

      return apiRequest({
        path: '/clinics',
        method: 'POST',
        body: formData,
        isFormData: true,
      })
    },
    [apiRequest],
  )

  const updateClinic = useCallback(
    (payload) => {
      const formData = new FormData()
      formData.append('name', payload.name)
      formData.append('location', payload.location)

      if (payload.imageFile) {
        formData.append('image', payload.imageFile)
      }

      return apiRequest({
        path: `/clinics/${Number(payload.id)}`,
        method: 'PUT',
        body: formData,
        isFormData: true,
      })
    },
    [apiRequest],
  )

  const deleteClinic = useCallback(
    (clinicId) =>
      apiRequest({
        path: `/clinics/${Number(clinicId)}`,
        method: 'DELETE',
      }),
    [apiRequest],
  )

  const getClinics = useCallback(() => apiRequest({ path: '/clinics' }), [apiRequest])

  const mapDoctorToClinic = useCallback(
    async (payload) => {
      const response = await apiRequest({
        path: '/doctor-clinic',
        method: 'POST',
        body: {
          doctor_id: Number(payload.doctor_id),
          clinic_id: Number(payload.clinic_id),
        },
      })

      setMappingCache((prev) => {
        const exists = prev.some(
          (item) =>
            item.doctor_id === Number(payload.doctor_id) &&
            item.clinic_id === Number(payload.clinic_id),
        )

        if (exists) {
          return prev
        }

        return [
          ...prev,
          {
            doctor_id: Number(payload.doctor_id),
            clinic_id: Number(payload.clinic_id),
          },
        ]
      })
      setHasFetchedMappings(true)

      return response
    },
    [apiRequest],
  )

  const getAvailability = useCallback(
    (doctorId) =>
      apiRequest({
        path: '/availability',
        query: doctorId ? { doctor_id: Number(doctorId) } : undefined,
      }),
    [apiRequest],
  )

  const getMappings = useCallback(async () => {
    if (hasFetchedMappings) {
      return [...mappingCache]
    }

    const mappingRows = await apiRequest({ path: '/doctor-clinic' })
    const normalizedRows = Array.isArray(mappingRows) ? mappingRows : []

    setMappingCache(normalizedRows)
    setHasFetchedMappings(true)
    return normalizedRows
  }, [hasFetchedMappings, mappingCache, apiRequest])

  const addAvailability = useCallback(
    (payload) =>
      apiRequest({
        path: '/availability',
        method: 'POST',
        body: {
          doctor_id: Number(payload.doctor_id),
          clinic_id: Number(payload.clinic_id),
          day: payload.day,
          start_time: payload.start_time,
          end_time: payload.end_time,
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
    (doctorId) =>
      apiRequest({
        path: '/leaves',
        query: doctorId ? { doctor_id: Number(doctorId) } : undefined,
      }),
    [apiRequest],
  )

  const searchDoctors = useCallback(
    (filters = {}) => {
      const query = {
        name: filters.name?.trim() || undefined,
        speciality: filters.speciality?.trim() || undefined,
        doctor_id: filters.doctor_id ? Number(filters.doctor_id) : undefined,
        clinic_id: filters.clinic_id ? Number(filters.clinic_id) : undefined,
      }

      return apiRequest({
        path: '/search',
        query,
      })
    },
    [apiRequest],
  )

  const getAvailabilityByDate = useCallback(
    (payload) =>
      apiRequest({
        path: '/availability-by-date',
        query: {
          doctor_id: Number(payload.doctor_id),
          clinic_id: Number(payload.clinic_id),
          date: payload.date,
        },
      }),
    [apiRequest],
  )

  const createAppointment = useCallback(
    async (payload) => {
      const patientId = await ensurePatientId()

      return apiRequest({
        path: '/appointments',
        method: 'POST',
        body: {
          patient_id: patientId,
          doctor_id: Number(payload.doctor_id),
          clinic_id: Number(payload.clinic_id),
          date: payload.date,
          time: payload.time,
        },
      })
    },
    [apiRequest, ensurePatientId],
  )

  const getAppointments = useCallback(async () => {
    if (!auth?.user) {
      return []
    }

    const role = String(auth.user.role).toLowerCase()

    if (role === 'admin') {
      return apiRequest({
        path: '/appointments',
      })
    }

    if (role !== 'patient') {
      return []
    }

    const patientId = await ensurePatientId()

    return apiRequest({
      path: '/appointments',
      query: { patient_id: patientId },
    })
  }, [auth?.user, ensurePatientId, apiRequest])

  const updateAppointment = useCallback(
    (payload) =>
      apiRequest({
        path: `/appointments/${Number(payload.appointment_id)}`,
        method: 'PUT',
        body: {
          status: payload.status,
        },
      }),
    [apiRequest],
  )

  const getUtilization = useCallback(
    (clinicId) =>
      apiRequest({
        path: '/utilization',
        query: { clinic_id: Number(clinicId) },
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
      addDoctor,
      updateDoctor,
      deleteDoctor,
      getDoctors,
      addClinic,
      updateClinic,
      deleteClinic,
      getClinics,
      mapDoctorToClinic,
      getMappings,
      addAvailability,
      createLeave,
      getLeaves,
      getAvailability,
      searchDoctors,
      getAvailabilityByDate,
      createAppointment,
      getAppointments,
      updateAppointment,
      getUtilization,
    }),
    [
      auth,
      currentRole,
      signup,
      login,
      logout,
      fetchCurrentUser,
      addDoctor,
      updateDoctor,
      deleteDoctor,
      getDoctors,
      addClinic,
      updateClinic,
      deleteClinic,
      getClinics,
      mapDoctorToClinic,
      getMappings,
      addAvailability,
      createLeave,
      getLeaves,
      getAvailability,
      searchDoctors,
      getAvailabilityByDate,
      createAppointment,
      getAppointments,
      updateAppointment,
      getUtilization,
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
