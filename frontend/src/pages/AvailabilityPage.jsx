import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { WEEK_DAYS } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

function AvailabilityPage() {
  const { addAvailability, getAvailability, getClinics, getDoctors } = useMockApi()
  const [doctors, setDoctors] = useState([])
  const [clinics, setClinics] = useState([])
  const [availabilityRows, setAvailabilityRows] = useState([])
  const [filters, setFilters] = useState({
    doctor_id: '',
    speciality: '',
    clinic: '',
    day: '',
  })
  const [form, setForm] = useState({
    doctor_id: '',
    clinic_id: '',
    day: 'Monday',
    start_time: '09:00',
    end_time: '14:00',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const loadAvailabilityRows = async (doctorList) => {
    const nestedRows = await Promise.all(
      doctorList.map(async (doctor) => {
        const rows = await getAvailability(doctor.id)

        return rows.map((row, index) => ({
          ...row,
          doctor_id: doctor.id,
          doctor_name: doctor.name,
          speciality: doctor.speciality,
          key: `${doctor.id}-${row.clinic}-${row.day}-${row.start_time}-${row.end_time}-${index}`,
        }))
      }),
    )

    return nestedRows.flat()
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [doctorList, clinicList] = await Promise.all([
          getDoctors(),
          getClinics(),
        ])
        const availabilityList = await loadAvailabilityRows(doctorList)

        if (!mounted) {
          return
        }

        setDoctors(doctorList)
        setClinics(clinicList)
        setAvailabilityRows(availabilityList)
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

    void loadData()

    return () => {
      mounted = false
    }
  }, [getDoctors, getClinics, getAvailability])

  const filteredAvailabilityRows = useMemo(
    () =>
      availabilityRows.filter((row) => {
        const doctorMatches =
          !filters.doctor_id || String(row.doctor_id) === String(filters.doctor_id)
        const specialityMatches =
          !filters.speciality ||
          row.speciality.toLowerCase().includes(filters.speciality.trim().toLowerCase())
        const clinicMatches = !filters.clinic || row.clinic === filters.clinic
        const dayMatches = !filters.day || row.day === filters.day

        return doctorMatches && specialityMatches && clinicMatches && dayMatches
      }),
    [availabilityRows, filters],
  )

  const handleFieldChange = (event) => {
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
      await addAvailability({
        doctor_id: Number(form.doctor_id),
        clinic_id: Number(form.clinic_id),
        day: form.day,
        start_time: form.start_time,
        end_time: form.end_time,
      })

      const refreshedDoctors = await getDoctors()
      const refreshed = await loadAvailabilityRows(refreshedDoctors)
      setDoctors(refreshedDoctors)
      setAvailabilityRows(refreshed)
      setFeedback('Availability added')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Availability Management"
        subtitle="Add day/time windows for mapped doctor-clinic pairs and review availability with doctor and speciality context."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-lg shadow-teal-100/40"
        >
          <h3 className="text-xl font-semibold">Add Availability</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Doctor</span>
              <select
                required
                name="doctor_id"
                value={form.doctor_id}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Clinic</span>
              <select
                required
                name="clinic_id"
                value={form.clinic_id}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
              >
                <option value="">Select clinic</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Day</span>
              <select
                required
                name="day"
                value={form.day}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
              >
                {WEEK_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Start Time</span>
                <input
                  required
                  type="time"
                  name="start_time"
                  value={form.start_time}
                  onChange={handleFieldChange}
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
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>

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
              {isSubmitting ? 'Saving...' : 'Add Availability'}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <h3 className="text-xl font-semibold">Availability List</h3>
          <p className="mt-1 text-sm text-slate-600">
            Response shape from API: [ clinic, day, start_time, end_time ] plus derived doctor profile fields.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
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

            <input
              value={filters.speciality}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  speciality: event.target.value,
                }))
              }
              placeholder="Filter by speciality"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500"
            />

            <select
              value={filters.clinic}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  clinic: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500"
            >
              <option value="">Filter by clinic</option>
              {[...new Set(availabilityRows.map((row) => row.clinic))].map((clinicName) => (
                <option key={clinicName} value={clinicName}>
                  {clinicName}
                </option>
              ))}
            </select>

            <select
              value={filters.day}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  day: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500"
            >
              <option value="">Filter by day</option>
              {WEEK_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setFilters({
                  doctor_id: '',
                  speciality: '',
                  clinic: '',
                  day: '',
                })
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
            >
              Clear
            </button>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading availability...</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2">Doctor</th>
                    <th className="px-3 py-2">Speciality</th>
                    <th className="px-3 py-2">Clinic</th>
                    <th className="px-3 py-2">Day</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailabilityRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-sm text-slate-500">
                        No availability rows match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAvailabilityRows.map((row) => (
                      <tr key={row.key} className="bg-slate-50">
                        <td className="px-3 py-3 font-semibold text-slate-800">{row.doctor_name}</td>
                        <td className="px-3 py-3 text-slate-700">{row.speciality}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{row.clinic}</td>
                        <td className="px-3 py-3 text-slate-700">{row.day}</td>
                        <td className="px-3 py-3 text-slate-700">{row.start_time}</td>
                        <td className="px-3 py-3 text-slate-700">{row.end_time}</td>
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
