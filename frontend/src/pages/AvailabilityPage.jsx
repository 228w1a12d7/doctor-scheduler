import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { APPOINTMENT_MODES } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const todayDate = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function AvailabilityPage() {
  const { addDoctorSchedule, getDoctorSchedules, getDoctors } = useMockApi()

  const [doctors, setDoctors] = useState([])
  const [scheduleRows, setScheduleRows] = useState([])
  const [filters, setFilters] = useState({
    doctor_id: '',
    mode: '',
    date: '',
    include_booked: false,
  })
  const [form, setForm] = useState({
    doctor_id: '',
    date: todayDate(),
    start_time: '09:00',
    end_time: '14:00',
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let mounted = true

    const loadData = async (isInitial = false) => {
      try {
        const [doctorRows, schedules] = await Promise.all([getDoctors(), getDoctorSchedules()])

        if (!mounted) {
          return
        }

        setDoctors(doctorRows)
        setScheduleRows(schedules)
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message)
        }
      } finally {
        if (mounted && isInitial) {
          setIsLoading(false)
        }
      }
    }

    void loadData(true)
    const intervalId = window.setInterval(() => {
      void loadData(false)
    }, 15000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [getDoctors, getDoctorSchedules])

  const reloadSchedules = async () => {
    const rows = await getDoctorSchedules()
    setScheduleRows(rows)
  }

  const filteredRows = useMemo(
    () =>
      scheduleRows.filter((row) => {
        const doctorMatches =
          !filters.doctor_id || String(row.doctor_id) === String(filters.doctor_id)
        const modeMatches = !filters.mode || row.mode === filters.mode
        const dateMatches = !filters.date || String(row.date) === filters.date
        const bookedMatches = filters.include_booked || row.booked === false

        return doctorMatches && modeMatches && dateMatches && bookedMatches
      }),
    [scheduleRows, filters],
  )

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFeedback('')
    setIsSubmitting(true)

    try {
      const response = await addDoctorSchedule({
        doctor_id: Number(form.doctor_id),
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
      })

      await reloadSchedules()
      setFeedback(`${response.message}: ${response.created_slots} slot(s) created`)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Doctor Schedule Management"
        subtitle="Admin creates date-based 15-minute slot schedules for each doctor."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-lg shadow-teal-100/40"
        >
          <h3 className="text-xl font-semibold">Add Schedule</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Doctor</span>
              <select
                required
                name="doctor_id"
                value={form.doctor_id}
                onChange={handleFormChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} ({doctor.speciality} - {doctor.mode})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Date</span>
              <input
                required
                type="date"
                name="date"
                min={todayDate()}
                value={form.date}
                onChange={handleFormChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Start Time</span>
                <input
                  required
                  type="time"
                  name="start_time"
                  value={form.start_time}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">End Time</span>
                <input
                  required
                  type="time"
                  name="end_time"
                  value={form.end_time}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>

            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              New slots are created as available by default.
            </p>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </p>
            )}

            {feedback && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {feedback}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : 'Create Slots'}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <h3 className="text-xl font-semibold">Doctor Schedules</h3>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Auto-refresh every 15 seconds</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <select
              value={filters.doctor_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  doctor_id: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500"
            >
              <option value="">Filter by doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500"
            >
              <option value="">Filter by mode</option>
              {APPOINTMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filters.date}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  date: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500"
            />

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.include_booked}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    include_booked: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>Include booked</span>
            </label>
          </div>

          {isLoading ? (
            <LoadingSpinner className="mt-4" label="Loading schedules..." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[780px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2">Doctor</th>
                    <th className="px-3 py-2">Speciality</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Slot</th>
                    <th className="px-3 py-2">Booked</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-sm text-slate-500">
                        No schedule rows match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="bg-slate-50">
                        <td className="px-3 py-3 font-semibold text-slate-800">{row.doctor_name}</td>
                        <td className="px-3 py-3 text-slate-700">{row.speciality}</td>
                        <td className="px-3 py-3 text-slate-700">{row.mode}</td>
                        <td className="px-3 py-3 text-slate-700">{row.date}</td>
                        <td className="px-3 py-3 text-slate-700">{row.time_slot}</td>
                        <td className="px-3 py-3">
                          <span
                            className={[
                              'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                              row.booked
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-700',
                            ].join(' ')}
                          >
                            {row.booked ? 'Booked' : 'Available'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default AvailabilityPage
