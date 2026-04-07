import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { APPOINTMENT_MODES, PLACEHOLDER_IMAGE } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

function SearchPage() {
  const navigate = useNavigate()
  const { getSpecialties, searchDoctors } = useMockApi()

  const [specialties, setSpecialties] = useState([])
  const [filters, setFilters] = useState({
    name: '',
    speciality: '',
    mode: '',
  })
  const [results, setResults] = useState([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadInitial = async () => {
      try {
        const [specialtyRows, doctorRows] = await Promise.all([
          getSpecialties(),
          searchDoctors({ active_only: true }),
        ])

        if (!mounted) {
          return
        }

        setSpecialties(specialtyRows)
        setResults(doctorRows)
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message)
        }
      } finally {
        if (mounted) {
          setIsBootstrapping(false)
        }
      }
    }

    void loadInitial()

    return () => {
      mounted = false
    }
  }, [getSpecialties, searchDoctors])

  useEffect(() => {
    if (isBootstrapping) {
      return
    }

    let active = true

    const timer = window.setTimeout(() => {
      const runSearch = async () => {
        setIsLoading(true)
        setError('')

        try {
          const rows = await searchDoctors({
            ...filters,
            active_only: true,
          })

          if (active) {
            setResults(rows)
          }
        } catch (searchError) {
          if (active) {
            setError(searchError.message)
          }
        } finally {
          if (active) {
            setIsLoading(false)
          }
        }
      }

      void runSearch()
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [filters, isBootstrapping, searchDoctors])

  useEffect(() => {
    if (isBootstrapping) {
      return
    }

    let active = true

    const refreshSearch = async () => {
      try {
        const rows = await searchDoctors({
          ...filters,
          active_only: true,
        })

        if (active) {
          setResults(rows)
        }
      } catch (searchError) {
        if (active) {
          setError(searchError.message)
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshSearch()
    }, 15000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [filters, isBootstrapping, searchDoctors])

  const handleBookFromProfile = (doctor) => {
    const params = new URLSearchParams({
      doctorId: String(doctor.doctor_id),
      mode: doctor.mode,
    })

    navigate(`/app/book?${params.toString()}`)
  }

  let content = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {results.map((doctor) => (
        <article key={doctor.doctor_id} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <img
            src={doctor.image || PLACEHOLDER_IMAGE}
            alt={doctor.doctor_name}
            onError={(event) => {
              if (event.currentTarget.src !== PLACEHOLDER_IMAGE) {
                event.currentTarget.src = PLACEHOLDER_IMAGE
              }
            }}
            className="h-40 w-full rounded-xl object-cover"
          />

          <h3 className="mt-3 text-lg font-semibold">{doctor.doctor_name}</h3>
          <p className="text-sm font-medium text-teal-700">{doctor.speciality}</p>

          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>Mode: {doctor.mode}</p>
            <p>Fee: {doctor.fee}</p>
            {doctor.mode === 'offline' && doctor.clinic_address && (
              <p>Clinic: {doctor.clinic_address}</p>
            )}
            {doctor.location_map_url && (
              <a
                href={doctor.location_map_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex font-semibold text-teal-700 hover:text-teal-900"
              >
                View live location
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleBookFromProfile(doctor)}
            className="mt-3 w-full rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            Book Appointment
          </button>
        </article>
      ))}
    </div>
  )

  if (isBootstrapping) {
    content = <LoadingSpinner label="Loading doctor search data..." />
  } else if (isLoading) {
    content = <LoadingSpinner label="Searching doctors..." />
  } else if (results.length === 0) {
    content = (
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600">
        No doctors found for current filters.
      </section>
    )
  }

  return (
    <section>
      <PageHeader
        title="Search Doctors"
        subtitle="Patients can filter active doctors by speciality and mode (online/offline)."
      />

      <section className="mb-6 grid gap-3 rounded-3xl border border-teal-100 bg-white/85 p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <input
          value={filters.name}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              name: event.target.value,
            }))
          }
          placeholder="Doctor name"
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
        />

        <select
          value={filters.speciality}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              speciality: event.target.value,
            }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
        >
          <option value="">All specialties</option>
          {specialties.map((specialty) => (
            <option key={specialty.id} value={specialty.name}>
              {specialty.name}
            </option>
          ))}
        </select>

        <select
          value={filters.mode}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              mode: event.target.value,
            }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
        >
          <option value="">All modes</option>
          {APPOINTMENT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setFilters({
              name: '',
              speciality: '',
              mode: '',
            })
            setError('')
          }}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
        >
          Clear
        </button>
      </section>
      <p className="mb-4 text-[11px] uppercase tracking-wide text-slate-500">Auto-refresh every 15 seconds</p>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {content}
    </section>
  )
}

export default SearchPage
