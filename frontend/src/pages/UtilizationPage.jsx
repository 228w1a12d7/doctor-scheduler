import { useEffect, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { APPOINTMENT_MODES } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const getTodayDateInputValue = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function UtilizationPage() {
  const { getDailySummary, getSpecialties } = useMockApi()
  const [specialties, setSpecialties] = useState([])
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({
    date: getTodayDateInputValue(),
    mode: '',
    speciality_id: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      try {
        const specialtyRows = await getSpecialties()

        if (!mounted) {
          return
        }

        setSpecialties(specialtyRows)
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

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [getSpecialties])

  useEffect(() => {
    let mounted = true

    const loadSummary = async () => {
      setIsFetching(true)
      setError('')

      try {
        const stats = await getDailySummary({
          date: filters.date,
          mode: filters.mode || undefined,
          speciality_id: filters.speciality_id || undefined,
        })

        if (mounted) {
          setSummary(stats)
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message)
        }
      } finally {
        if (mounted) {
          setIsFetching(false)
        }
      }
    }

    void loadSummary()

    return () => {
      mounted = false
    }
  }, [filters, getDailySummary])

  return (
    <section>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Daily appointment and revenue summary, filterable by date, mode, and speciality."
      />

      <section className="rounded-3xl border border-orange-100 bg-white/90 p-6 shadow-lg shadow-orange-100/40">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  date: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Mode</span>
            <select
              value={filters.mode}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  mode: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            >
              <option value="">All modes</option>
              {APPOINTMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Speciality</span>
            <select
              value={filters.speciality_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  speciality_id: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            >
              <option value="">All specialties</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() =>
              setFilters({
                date: getTodayDateInputValue(),
                mode: '',
                speciality_id: '',
              })
            }
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-500 hover:text-orange-700"
          >
            Reset
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        {isLoading || isFetching || !summary ? (
          <LoadingSpinner className="mt-5" label="Loading dashboard summary..." />
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                <h3 className="mt-2 text-2xl font-semibold">{summary.total_appointments}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmed</p>
                <h3 className="mt-2 text-2xl font-semibold">{summary.confirmed_count}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</p>
                <h3 className="mt-2 text-2xl font-semibold">{summary.completed_count}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cancelled</p>
                <h3 className="mt-2 text-2xl font-semibold">{summary.cancelled_count}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">No Show</p>
                <h3 className="mt-2 text-2xl font-semibold">{summary.no_show_count}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue</p>
                <h3 className="mt-2 text-2xl font-semibold">{summary.revenue}</h3>
              </article>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>Completion Rate</span>
                <span>
                  {summary.total_appointments > 0
                    ? ((summary.completed_count / summary.total_appointments) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 via-teal-600 to-emerald-500 transition-all"
                  style={{
                    width: `${
                      summary.total_appointments > 0
                        ? (summary.completed_count / summary.total_appointments) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">By Mode</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-sm">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="py-2">Mode</th>
                        <th className="py-2">Appointments</th>
                        <th className="py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_mode.length === 0 ? (
                        <tr>
                          <td className="py-2 text-slate-500" colSpan={3}>
                            No records
                          </td>
                        </tr>
                      ) : (
                        summary.by_mode.map((row) => (
                          <tr key={row.mode} className="border-t border-slate-100">
                            <td className="py-2 font-semibold text-slate-800">{row.mode}</td>
                            <td className="py-2 text-slate-700">{row.appointment_count}</td>
                            <td className="py-2 text-slate-700">{row.revenue}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">By Speciality</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[340px] text-left text-sm">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="py-2">Speciality</th>
                        <th className="py-2">Appointments</th>
                        <th className="py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_speciality.length === 0 ? (
                        <tr>
                          <td className="py-2 text-slate-500" colSpan={3}>
                            No records
                          </td>
                        </tr>
                      ) : (
                        summary.by_speciality.map((row) => (
                          <tr key={row.speciality} className="border-t border-slate-100">
                            <td className="py-2 font-semibold text-slate-800">{row.speciality}</td>
                            <td className="py-2 text-slate-700">{row.appointment_count}</td>
                            <td className="py-2 text-slate-700">{row.revenue}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

export default UtilizationPage
