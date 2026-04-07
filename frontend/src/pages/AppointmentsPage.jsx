import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { APPOINTMENT_UPDATE_STATUSES } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const toInitialStatusMap = (rows) =>
  Object.fromEntries(
    rows.map((row) => [
      row.appointment_id,
      row.status === 'CONFIRMED' ? 'COMPLETED' : row.status,
    ]),
  )

const sortAppointmentsByRecent = (rows) =>
  [...rows].sort((a, b) => {
    const firstTs = new Date(`${a.date}T${a.time_slot}:00`).getTime()
    const secondTs = new Date(`${b.date}T${b.time_slot}:00`).getTime()

    if (secondTs !== firstTs) {
      return secondTs - firstTs
    }

    return Number(b.appointment_id) - Number(a.appointment_id)
  })

const SLOT_WINDOW_MINUTES = 15

const toAppointmentStartTimestamp = (appointment) => {
  if (!appointment?.date || !appointment?.time_slot) {
    return null
  }

  const trimmed = String(appointment.time_slot).trim()
  const normalizedTime = trimmed.length === 5 ? `${trimmed}:00` : trimmed
  const parsed = new Date(`${appointment.date}T${normalizedTime}`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.getTime()
}

const formatJoinTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

const getJoinAccess = (appointment, nowTimestamp) => {
  if (appointment.mode !== 'online') {
    return { enabled: false, reason: '' }
  }

  if (!appointment.video_link) {
    return { enabled: false, reason: 'No meeting link generated' }
  }

  if (appointment.status !== 'CONFIRMED') {
    return {
      enabled: false,
      reason: `Join is disabled for ${appointment.status} appointments`,
    }
  }

  const startTimestamp = toAppointmentStartTimestamp(appointment)
  if (startTimestamp === null) {
    return { enabled: false, reason: 'Invalid appointment slot time' }
  }

  const endTimestamp = startTimestamp + SLOT_WINDOW_MINUTES * 60 * 1000

  if (nowTimestamp < startTimestamp) {
    return {
      enabled: false,
      reason: `Join opens at ${formatJoinTime(startTimestamp)}`,
    }
  }

  if (nowTimestamp >= endTimestamp) {
    return {
      enabled: false,
      reason: 'Join window closed for this slot',
    }
  }

  return {
    enabled: true,
    reason: `Join open until ${formatJoinTime(endTimestamp)}`,
  }
}

function AppointmentsPage() {
  const { auth, getAppointments, updateAppointmentStatus } = useMockApi()

  const [appointments, setAppointments] = useState([])
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now())
  const [statusById, setStatusById] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const isAdmin = String(auth?.user?.role ?? '').toLowerCase() === 'admin'
  const isDoctor = String(auth?.user?.role ?? '').toLowerCase() === 'doctor'

  const handleJoinMeeting = (appointment) => {
    if (!appointment.video_link) {
      return
    }

    const patientName =
      isAdmin || isDoctor
        ? appointment.patient_name || auth?.user?.name || 'N/A'
        : auth?.user?.name || appointment.patient_name || 'N/A'
    const patientEmail =
      isAdmin || isDoctor
        ? appointment.patient_email || auth?.user?.email || 'N/A'
        : auth?.user?.email || appointment.patient_email || 'N/A'

    const shouldOpen = window.confirm(
      [
        'Join the meet with your scheduled patient?',
        '',
        `Patient Name: ${patientName}`,
        `Patient Email: ${patientEmail}`,
      ].join('\n'),
    )

    if (shouldOpen) {
      window.open(appointment.video_link, '_blank', 'noopener,noreferrer')
    }
  }

  useEffect(() => {
    let mounted = true

    const loadData = async (showSpinner = false) => {
      if (showSpinner) {
        setIsLoading(true)
      }

      try {
        const appointmentRows = await getAppointments()

        if (!mounted) {
          return
        }

        setAppointments(sortAppointmentsByRecent(appointmentRows))
        setStatusById(toInitialStatusMap(appointmentRows))
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message)
        }
      } finally {
        if (mounted && showSpinner) {
          setIsLoading(false)
        }
      }
    }

    void loadData(true)
    const refreshId = window.setInterval(() => {
      void loadData(false)
    }, 10000)

    return () => {
      mounted = false
      window.clearInterval(refreshId)
    }
  }, [getAppointments])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTimestamp(Date.now())
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const handleUpdateStatus = async (appointmentId) => {
    if (!isAdmin && !isDoctor) {
      return
    }

    const nextStatus = statusById[appointmentId]
    if (!nextStatus) {
      setError('Please select a status')
      return
    }

    setError('')
    setFeedback('')
    setIsUpdating(true)

    try {
      const response = await updateAppointmentStatus({
        appointment_id: Number(appointmentId),
        status: nextStatus,
      })

      const refreshed = await getAppointments()
      setAppointments(sortAppointmentsByRecent(refreshed))
      setStatusById(toInitialStatusMap(refreshed))
      const patientMailStatus = response.patient_status_email_sent ? 'sent' : 'not sent'
      const doctorMailStatus = response.doctor_status_email_sent ? 'sent' : 'not sent'
      setFeedback(
        `${response.message} (${response.status}) | Patient status mail: ${patientMailStatus} | Doctor status mail: ${doctorMailStatus}`,
      )
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const statusBadgeByState = useMemo(
    () => ({
      CONFIRMED: 'bg-amber-100 text-amber-800 border-amber-200',
      COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
      NO_SHOW: 'bg-slate-200 text-slate-700 border-slate-300',
    }),
    [],
  )

  let appointmentsContent = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left text-sm">
        <thead>
          <tr className="text-slate-500">
            <th className="px-3 py-2">Appointment ID</th>
            {(isAdmin || isDoctor) && <th className="px-3 py-2">Patient</th>}
            <th className="px-3 py-2">Doctor</th>
            <th className="px-3 py-2">Speciality</th>
            <th className="px-3 py-2">Mode</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Time Slot</th>
            <th className="px-3 py-2">Fee</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Artifacts</th>
            {(isAdmin || isDoctor) && <th className="px-3 py-2">Action</th>}
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => {
            const canUpdate = (isAdmin || isDoctor) && appointment.status === 'CONFIRMED'
            const joinAccess = getJoinAccess(appointment, nowTimestamp)

            return (
              <tr
                key={appointment.appointment_id}
                className="bg-slate-50 text-slate-700"
              >
                <td className="px-3 py-3 font-semibold text-slate-900">
                  {appointment.appointment_id}
                </td>
                {(isAdmin || isDoctor) && (
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900">#{appointment.patient_id}</div>
                    <div className="text-xs text-slate-500">{appointment.patient_name || 'N/A'}</div>
                    <div className="text-[11px] text-slate-500">{appointment.patient_email || 'N/A'}</div>
                  </td>
                )}
                <td className="px-3 py-3">{appointment.doctor_name}</td>
                <td className="px-3 py-3">{appointment.speciality}</td>
                <td className="px-3 py-3">{appointment.mode}</td>
                <td className="px-3 py-3">{appointment.date}</td>
                <td className="px-3 py-3">{appointment.time_slot}</td>
                <td className="px-3 py-3">{appointment.fee}</td>
                <td className="px-3 py-3">
                  {canUpdate ? (
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
                      {APPOINTMENT_UPDATE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={[
                        'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                        statusBadgeByState[appointment.status] || 'bg-white text-slate-700 border-slate-300',
                      ].join(' ')}
                    >
                      {appointment.status}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">
                  {appointment.mode === 'online' ? (
                    <div className="space-y-1">
                      {joinAccess.enabled ? (
                        <button
                          type="button"
                          onClick={() => handleJoinMeeting(appointment)}
                          className="inline-flex rounded-md bg-teal-700 px-2.5 py-1 font-semibold text-white hover:bg-teal-800"
                        >
                          Join meeting
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex cursor-not-allowed rounded-md border border-slate-300 bg-slate-200 px-2.5 py-1 font-semibold text-slate-500"
                        >
                          Join meeting
                        </button>
                      )}
                      {joinAccess.reason && <p className="text-[11px] text-slate-500">{joinAccess.reason}</p>}
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-600">
                      <p>{appointment.clinic_address || 'No clinic address'}</p>
                      {appointment.clinic_instructions && <p>{appointment.clinic_instructions}</p>}
                    </div>
                  )}

                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    Patient booking mail: {appointment.email_confirmation_sent ? 'sent' : 'not sent'}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Doctor booking mail: {appointment.doctor_email_confirmation_sent ? 'sent' : 'not sent'}
                  </p>
                </td>
                {(isAdmin || isDoctor) && (
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(appointment.appointment_id)}
                      disabled={isUpdating || !canUpdate}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {canUpdate ? 'Update' : 'Locked'}
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  if (isLoading) {
    appointmentsContent = <LoadingSpinner label="Loading appointments..." />
  } else if (appointments.length === 0) {
    appointmentsContent = (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        No appointments found.
      </p>
    )
  }

  let pageTitle = 'My Appointments'
  if (isAdmin) {
    pageTitle = 'All Appointments'
  } else if (isDoctor) {
    pageTitle = 'Doctor Appointments'
  }

  return (
    <section>
      <PageHeader
        title={pageTitle}
        subtitle="Mode-aware appointment list with controlled status transitions and booking/status email visibility."
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

        {appointmentsContent}
      </section>
    </section>
  )
}

export default AppointmentsPage
