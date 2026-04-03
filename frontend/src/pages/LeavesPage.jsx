import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { LEAVE_REASON_OPTIONS } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const initialForm = {
  doctor_id: '',
  start_date: '',
  end_date: '',
  reason: LEAVE_REASON_OPTIONS[0],
}

const getLeaveDays = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 0
  }

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0
  }

  const difference = end.getTime() - start.getTime()
  return Math.floor(difference / (1000 * 60 * 60 * 24)) + 1
}

function LeavesPage() {
  const { createLeave, getLeaves, getDoctors } = useMockApi()
  const [doctors, setDoctors] = useState([])
  const [leaves, setLeaves] = useState([])
  const [filterDoctorId, setFilterDoctorId] = useState('')
  const [form, setForm] = useState(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const leaveDays = useMemo(
    () => getLeaveDays(form.start_date, form.end_date),
    [form.start_date, form.end_date],
  )

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [doctorRows, leaveRows] = await Promise.all([getDoctors(), getLeaves()])

        if (!mounted) {
          return
        }

        setDoctors(doctorRows)
        setLeaves(leaveRows)
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
  }, [getDoctors, getLeaves])

  const filteredLeaves = useMemo(
    () =>
      leaves.filter((row) => {
        if (!filterDoctorId) {
          return true
        }

        return String(row.doctor_id) === String(filterDoctorId)
      }),
    [leaves, filterDoctorId],
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

    if (!form.doctor_id) {
      setError('Please select a doctor')
      return
    }

    if (leaveDays <= 0) {
      setError('start_date must be less than or equal to end_date')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await createLeave({
        doctor_id: Number(form.doctor_id),
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        number_of_leaves: leaveDays,
      })

      const refreshedLeaves = await getLeaves()
      setLeaves(refreshedLeaves)
      setFeedback(`Leave assigned (${response.number_of_leaves} day(s))`)
      setForm((prev) => ({
        ...prev,
        start_date: '',
        end_date: '',
      }))
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Doctor Leave Management"
        subtitle="Assign doctor leaves with reason taxonomy and date range. Booking is blocked automatically on leave dates."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.45fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-rose-100 bg-white/85 p-6 shadow-lg shadow-rose-100/40"
        >
          <h3 className="text-xl font-semibold">Assign Leave</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Doctor</span>
              <select
                required
                name="doctor_id"
                value={form.doctor_id}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-rose-500 focus:bg-white"
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} ({doctor.speciality})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Leave Reason</span>
              <select
                required
                name="reason"
                value={form.reason}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-rose-500 focus:bg-white"
              >
                {LEAVE_REASON_OPTIONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Start Date</span>
                <input
                  required
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-rose-500 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">End Date</span>
                <input
                  required
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-rose-500 focus:bg-white"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Number of leaves: <span className="font-semibold">{leaveDays}</span>
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
              className="w-full rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Assigning...' : 'Assign Leave'}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-semibold">Assigned Leaves</h3>

            <select
              value={filterDoctorId}
              onChange={(event) => setFilterDoctorId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-500 sm:w-56"
            >
              <option value="">All doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading leaves...</p>
          ) : filteredLeaves.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No leaves assigned yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[660px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2">Doctor</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Start Date</th>
                    <th className="px-3 py-2">End Date</th>
                    <th className="px-3 py-2">Leaves</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((row) => (
                    <tr key={row.id} className="bg-slate-50 text-slate-700">
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.doctor_name}</td>
                      <td className="px-3 py-3">{row.reason}</td>
                      <td className="px-3 py-3">{row.start_date}</td>
                      <td className="px-3 py-3">{row.end_date}</td>
                      <td className="px-3 py-3 font-semibold">{row.number_of_leaves}</td>
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

export default LeavesPage
