import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { APPOINTMENT_STATUSES } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

function AppointmentsPage() {
  const {
    auth,
    getAppointments,
    getClinics,
    getDoctors,
    updateAppointment,
  } = useMockApi()

  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [clinics, setClinics] = useState([])
  const [statusById, setStatusById] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [appointmentRows, doctorRows, clinicRows] = await Promise.all([
          getAppointments(),
          getDoctors(),
          getClinics(),
        ])

        if (!mounted) {
          return
        }

        setAppointments(appointmentRows)
        setDoctors(doctorRows)
        setClinics(clinicRows)
        setStatusById(
          Object.fromEntries(
            appointmentRows.map((row) => [row.appointment_id, row.status]),
          ),
        )
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
  }, [getAppointments, getDoctors, getClinics])

  const doctorById = useMemo(
    () => Object.fromEntries(doctors.map((doctor) => [doctor.id, doctor.name])),
    [doctors],
  )

  const clinicById = useMemo(
    () => Object.fromEntries(clinics.map((clinic) => [clinic.id, clinic.name])),
    [clinics],
  )

  const handleUpdateStatus = async (appointmentId) => {
    const nextStatus = statusById[appointmentId]
    setError('')
    setFeedback('')
    setIsUpdating(true)

    try {
      const response = await updateAppointment({
        appointment_id: Number(appointmentId),
        status: nextStatus,
      })

      const refreshed = await getAppointments()
      setAppointments(refreshed)
      setFeedback(response.message)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <section>
      <PageHeader
        title={auth?.user?.role === 'admin' ? 'All Appointments' : 'My Appointments'}
        subtitle="View appointments and update status with backend-aligned fields: appointment_id, doctor_id, clinic_id, date, time, status."
      />

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-100/60">
        {error && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        {feedback && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {feedback}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No appointments found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-3 py-2">Appointment ID</th>
                  <th className="px-3 py-2">Doctor</th>
                  <th className="px-3 py-2">Clinic</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr
                    key={appointment.appointment_id}
                    className="bg-slate-50 text-slate-700"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {appointment.appointment_id}
                    </td>
                    <td className="px-3 py-3">
                      {doctorById[appointment.doctor_id] ?? `Doctor ${appointment.doctor_id}`}
                    </td>
                    <td className="px-3 py-3">
                      {clinicById[appointment.clinic_id] ?? `Clinic ${appointment.clinic_id}`}
                    </td>
                    <td className="px-3 py-3">{appointment.date}</td>
                    <td className="px-3 py-3">{appointment.time}</td>
                    <td className="px-3 py-3">
                      <select
                        value={statusById[appointment.appointment_id] ?? appointment.status}
                        onChange={(event) =>
                          setStatusById((prev) => ({
                            ...prev,
                            [appointment.appointment_id]: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-teal-500"
                      >
                        {APPOINTMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(appointment.appointment_id)}
                        disabled={isUpdating}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

export default AppointmentsPage
