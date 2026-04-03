import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { PLACEHOLDER_IMAGE } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

function SearchPage() {
  const { searchDoctorsBySpeciality } = useMockApi()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const runInitialSearch = async () => {
      try {
        const rows = await searchDoctorsBySpeciality('')
        if (mounted) {
          setResults(rows)
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void runInitialSearch()

    return () => {
      mounted = false
    }
  }, [searchDoctorsBySpeciality])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const rows = await searchDoctorsBySpeciality(query)
      setResults(rows)
    } catch (searchError) {
      setError(searchError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Search Doctors"
        subtitle="Search by speciality and render backend response fields: doctor_id, doctor_name, speciality, clinic, day, time, image."
      />

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-3 rounded-3xl border border-teal-100 bg-white/85 p-4 shadow-sm sm:flex-row"
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by speciality (e.g. Cardiology)"
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
        />
        <button
          type="submit"
          className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Searching doctors...</p>
      ) : results.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600">
          No doctors found for this speciality.
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((doctor, index) => (
            <article
              key={`${doctor.doctor_id}-${doctor.clinic}-${doctor.day}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
            >
              <img
                src={doctor.image || PLACEHOLDER_IMAGE}
                alt={doctor.doctor_name}
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
                doctor_id: {doctor.doctor_id}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default SearchPage
