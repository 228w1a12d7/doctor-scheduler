import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { WEEK_DAYS } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

function AvailabilityPage() {
  const { addAvailability, getAvailability, getClinics, getDoctors } = useMockApi()
  const [doctors, setDoctors] = useState([])
  const [clinics, setClinics] = useState([])
  const [availabilityRows, setAvailabilityRows] = useState([])
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

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [doctorList, clinicList, availabilityList] = await Promise.all([
          getDoctors(),
          getClinics(),
          getAvailability(),
        ])

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

      const refreshed = await getAvailability()
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
        subtitle="Add doctor availability windows and view response data as clinic, day, start_time, end_time."
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
          <p className="mt-1 text-sm text-slate-600">Response shape: [ clinic, day, start_time, end_time ]</p>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading availability...</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2">Clinic</th>
                    <th className="px-3 py-2">Day</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                  </tr>
                </thead>
                <tbody>
                  {availabilityRows.map((row, index) => (
                    <tr key={`${row.clinic}-${row.day}-${index}`} className="bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-slate-800">{row.clinic}</td>
                      <td className="px-3 py-3 text-slate-700">{row.day}</td>
                      <td className="px-3 py-3 text-slate-700">{row.start_time}</td>
                      <td className="px-3 py-3 text-slate-700">{row.end_time}</td>
                    </tr>
                  ))}
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
