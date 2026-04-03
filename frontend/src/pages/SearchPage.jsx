import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { PLACEHOLDER_IMAGE } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

function SearchPage() {
  const navigate = useNavigate()
  const { searchDoctors } = useMockApi()
  const [filters, setFilters] = useState({
    name: '',
    speciality: '',
  })
  const [results, setResults] = useState([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadInitialResults = async () => {
      try {
        const initialRows = await searchDoctors({})

        if (!mounted) {
          return
        }

        setResults(initialRows)
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

    loadInitialResults()

    return () => {
      mounted = false
    }
  }, [searchDoctors])

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
          const rows = await searchDoctors(filters)

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

      runSearch()
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [filters, isBootstrapping, searchDoctors])

  const handleBookFromProfile = (doctor) => {
    const params = new URLSearchParams({
      doctorId: String(doctor.doctor_id),
      clinic: doctor.clinic,
    })

    navigate(`/app/book?${params.toString()}`)
  }

  let resultsContent = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {results.map((doctor, index) => (
        <article
          key={doctor.key || `${doctor.doctor_id}-${doctor.clinic}-${doctor.day}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
        >
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
            <p>Clinic: {doctor.clinic}</p>
            <p>Day: {doctor.day}</p>
            <p>Time: {doctor.time}</p>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Doctor ID: {doctor.doctor_id}
          </p>
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
    resultsContent = <p className="text-sm text-slate-500">Loading search data...</p>
  } else if (isLoading) {
    resultsContent = <p className="text-sm text-slate-500">Searching doctors...</p>
  } else if (results.length === 0) {
    resultsContent = (
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600">
        No doctors found for the current filters.
      </section>
    )
  }

  return (
    <section>
      <PageHeader
        title="Search Doctors"
        subtitle="Search automatically by doctor name and specialization."
      />

      <section className="mb-6 grid gap-3 rounded-3xl border border-teal-100 bg-white/85 p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
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

        <input
          value={filters.speciality}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              speciality: event.target.value,
            }))
          }
          placeholder="Specialization"
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
        />

        <button
          type="button"
          onClick={() => {
            setFilters({
              name: '',
              speciality: '',
            })
            setError('')
          }}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
        >
          Clear
        </button>
      </section>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {resultsContent}
    </section>
  )
}

export default SearchPage
