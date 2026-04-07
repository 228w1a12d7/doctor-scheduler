import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { APPOINTMENT_MODES } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const getTodayDateInputValue = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function BookingPage() {
  const [searchParams] = useSearchParams()
  const { createAppointment, getAvailabilityByDate, getDoctorSchedules, getDoctors, getSpecialties } = useMockApi()

  const preselectedDoctorId = searchParams.get('doctorId') || ''

  const [doctors, setDoctors] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [form, setForm] = useState({
    mode: searchParams.get('mode') || 'online',
    speciality: '',
    doctor_id: searchParams.get('doctorId') || '',
    date: '',
  })
  const [availability, setAvailability] = useState(null)
  const [availabilityMeta, setAvailabilityMeta] = useState(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingSlots, setIsFetchingSlots] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const todayDate = getTodayDateInputValue()

  useEffect(() => {
    let mounted = true

    const loadData = async (isInitial = false) => {
      try {
        const [doctorRows, specialtyRows] = await Promise.all([
          getDoctors({ active_only: true }),
          getSpecialties(),
        ])

        if (!mounted) {
          return
        }

        setDoctors(doctorRows)
        setSpecialties(specialtyRows)
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
  }, [getDoctors, getSpecialties])

  const filteredDoctors = useMemo(
    () =>
      doctors.filter((doctor) => {
        const modeMatches = !form.mode || doctor.mode === form.mode
        const specialityMatches =
          !form.speciality || doctor.speciality.toLowerCase() === form.speciality.toLowerCase()

        return modeMatches && specialityMatches
      }),
    [doctors, form.mode, form.speciality],
  )

  const preselectedDoctorExists = useMemo(
    () => doctors.some((doctor) => String(doctor.id) === String(preselectedDoctorId)),
    [doctors, preselectedDoctorId],
  )

  const isDoctorSelectionLocked = Boolean(preselectedDoctorId) && preselectedDoctorExists

  useEffect(() => {
    if (!isDoctorSelectionLocked) {
      return
    }

    const doctor = doctors.find((row) => String(row.id) === String(preselectedDoctorId))
    if (!doctor) {
      return
    }

    setForm((prev) => ({
      ...prev,
      mode: doctor.mode,
      speciality: doctor.speciality,
      doctor_id: String(doctor.id),
    }))
  }, [doctors, isDoctorSelectionLocked, preselectedDoctorId])

  useEffect(() => {
    if (!form.doctor_id || !form.date || !form.mode) {
      setAvailability(null)
      setAvailabilityMeta(null)
      return
    }

    if (form.date < todayDate) {
      setAvailability({ available_slots: [] })
      setAvailabilityMeta(null)
      setError('Please choose today or a future date')
      return
    }

    let active = true

    const loadSlots = async (showLoading = true) => {
      if (showLoading) {
        setIsFetchingSlots(true)
        setError('')
        setFeedback('')
        setSelectedScheduleId('')
      }

      try {
        const [availabilityResponse, scheduleRows] = await Promise.all([
          getAvailabilityByDate({
            doctor_id: Number(form.doctor_id),
            date: form.date,
            mode: form.mode,
          }),
          getDoctorSchedules({
            doctor_id: Number(form.doctor_id),
            date: form.date,
            mode: form.mode,
            include_booked: true,
          }),
        ])

        if (active) {
          setAvailability(availabilityResponse)
          setAvailabilityMeta({
            totalScheduledSlots: scheduleRows.length,
            bookedSlots: scheduleRows.filter((row) => row.booked).length,
          })
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError.message)
          setAvailability(null)
          setAvailabilityMeta(null)
        }
      } finally {
        if (active && showLoading) {
          setIsFetchingSlots(false)
        }
      }
    }

    void loadSlots(true)
    const intervalId = window.setInterval(() => {
      void loadSlots(false)
    }, 15000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [
    form.doctor_id,
    form.date,
    form.mode,
    todayDate,
    getAvailabilityByDate,
    getDoctorSchedules,
    refreshTick,
  ])

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    if (isDoctorSelectionLocked && name !== 'date') {
      return
    }

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      }

      if (name === 'mode') {
        next.doctor_id = ''
      }

      return next
    })

    setSelectedScheduleId('')
    setError('')
    setFeedback('')
  }

  const selectedDoctor = filteredDoctors.find((doctor) => String(doctor.id) === form.doctor_id)

  const handleBook = async () => {
    if (!selectedScheduleId) {
      setError('Please select an available slot before booking')
      return
    }

    setError('')
    setFeedback('')
    setIsBooking(true)

    try {
      const response = await createAppointment({
        doctor_id: Number(form.doctor_id),
        schedule_id: Number(selectedScheduleId),
        mode: form.mode,
      })

      const detailParts = [
        `Appointment confirmed (id: ${response.appointment_id})`,
        `Status: ${response.status}`,
        `Fee: ${response.fee}`,
      ]

      if (response.video_link) {
        detailParts.push(`Video link: ${response.video_link}`)
      }
      if (response.clinic_address) {
        detailParts.push(`Clinic address: ${response.clinic_address}`)
      }
      if (response.clinic_instructions) {
        detailParts.push(`Instructions: ${response.clinic_instructions}`)
      }

      setFeedback(detailParts.join(' | '))

      const refreshed = await getAvailabilityByDate({
        doctor_id: Number(form.doctor_id),
        date: form.date,
        mode: form.mode,
      })
      setAvailability(refreshed)
      setSelectedScheduleId('')
    } catch (bookError) {
      setError(bookError.message)
    } finally {
      setIsBooking(false)
    }
  }

  let slotsContent = (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {availability?.available_slots?.map((slot) => {
          const active = String(slot.schedule_id) === String(selectedScheduleId)
          return (
            <button
              key={slot.schedule_id}
              type="button"
              onClick={() => setSelectedScheduleId(String(slot.schedule_id))}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                active
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700',
              ].join(' ')}
            >
              {slot.time_slot}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleBook}
        disabled={!selectedScheduleId || isBooking}
        className="mt-5 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isBooking ? 'Booking...' : 'Confirm Appointment'}
      </button>
    </>
  )

  if (isFetchingSlots) {
    slotsContent = <LoadingSpinner className="mt-4" label="Loading slot availability..." />
  } else if (!availability) {
    slotsContent = <p className="mt-4 text-sm text-slate-500">Choose mode, doctor and date to load slots.</p>
  } else if (availability.is_on_leave) {
    slotsContent = (
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Doctor is on leave for this date{availability.leave_reason ? ` (${availability.leave_reason})` : ''}.
      </p>
    )
  } else if (availability.available_slots.length === 0) {
    const totalScheduledSlots = availabilityMeta?.totalScheduledSlots ?? 0
    const bookedSlots = availabilityMeta?.bookedSlots ?? 0

    let noSlotReason = 'No slots available for selected date.'
    if (totalScheduledSlots === 0) {
      noSlotReason = 'No schedule is published for this date yet.'
    } else if (bookedSlots >= totalScheduledSlots) {
      noSlotReason = 'All slots are already booked for this date.'
    }

    slotsContent = (
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {noSlotReason}
      </p>
    )
  }

  return (
    <section>
      <PageHeader
        title="Book Appointment"
        subtitle="Patients choose mode, doctor and date; only mode-compatible doctors and available slots are shown."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.45fr]">
        <section className="rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-lg shadow-teal-100/40">
          <h3 className="text-xl font-semibold">Find Slots</h3>

          {isLoading ? (
            <LoadingSpinner className="mt-4" label="Loading doctors and specialties..." />
          ) : (
            <div className="mt-4 space-y-4">
              {isDoctorSelectionLocked && (
                <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                  Doctor selection is locked because you came from Search. You can change only the date.
                </p>
              )}

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Mode</span>
                <select
                  required
                  name="mode"
                  value={form.mode}
                  disabled={isDoctorSelectionLocked}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
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
                  name="speciality"
                  value={form.speciality}
                  disabled={isDoctorSelectionLocked}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">All specialties</option>
                  {specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.name}>
                      {specialty.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Doctor</span>
                <select
                  required
                  name="doctor_id"
                  value={form.doctor_id}
                  disabled={isDoctorSelectionLocked}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">Select doctor</option>
                  {filteredDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.speciality}) - {doctor.mode} - Fee {doctor.fee}
                    </option>
                  ))}
                </select>
              </label>

              {selectedDoctor?.mode === 'offline' && selectedDoctor.clinic_address && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Offline location: {selectedDoctor.clinic_address}
                </p>
              )}

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Date</span>
                <input
                  required
                  type="date"
                  name="date"
                  min={todayDate}
                  value={form.date}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-semibold">Available Slots</h3>
            <button
              type="button"
              onClick={() => setRefreshTick((prev) => prev + 1)}
              disabled={!form.doctor_id || !form.date || !form.mode || isFetchingSlots}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Refresh slots
            </button>
          </div>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Auto-refresh every 15 seconds</p>

          {error && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          {feedback && (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {feedback}
            </p>
          )}

          {slotsContent}
        </section>
      </div>
    </section>
  )
}

export default BookingPage
