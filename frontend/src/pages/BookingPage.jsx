import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useMockApi } from '../context/MockApiContext.jsx'

const getTodayDateInputValue = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function BookingPage() {
  const [searchParams] = useSearchParams()
  const {
    createAppointment,
    getAvailabilityByDate,
    getClinics,
    getDoctors,
    getMappings,
  } = useMockApi()

  const [doctors, setDoctors] = useState([])
  const [clinics, setClinics] = useState([])
  const [mappings, setMappings] = useState([])
  const [form, setForm] = useState({
    doctor_id: '',
    clinic_id: '',
    date: '',
  })
  const [slotsResponse, setSlotsResponse] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingSlots, setIsFetchingSlots] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const todayDate = getTodayDateInputValue()

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [doctorList, clinicList, mappingList] = await Promise.all([
          getDoctors(),
          getClinics(),
          getMappings(),
        ])

        if (!mounted) {
          return
        }

        setDoctors(doctorList)
        setClinics(clinicList)
        setMappings(mappingList)
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
  }, [getDoctors, getClinics, getMappings])

  useEffect(() => {
    if (isLoading || doctors.length === 0) {
      return
    }

    const doctorIdFromQuery = searchParams.get('doctorId')
    if (!doctorIdFromQuery) {
      return
    }

    const doctorExists = doctors.some((doctor) => String(doctor.id) === doctorIdFromQuery)
    if (!doctorExists) {
      return
    }

    const clinicNameFromQuery = searchParams.get('clinic')
    const mappedClinicIds = mappings
      .filter((item) => String(item.doctor_id) === doctorIdFromQuery)
      .map((item) => item.clinic_id)
    const matchedClinic = clinicNameFromQuery
      ? clinics.find(
          (clinic) =>
            mappedClinicIds.includes(clinic.id) &&
            clinic.name.toLowerCase() === clinicNameFromQuery.toLowerCase(),
        )
      : null

    setForm((prev) => {
      const nextClinicId = matchedClinic ? String(matchedClinic.id) : prev.clinic_id

      if (prev.doctor_id === doctorIdFromQuery && prev.clinic_id === nextClinicId) {
        return prev
      }

      return {
        ...prev,
        doctor_id: doctorIdFromQuery,
        clinic_id: nextClinicId,
      }
    })
  }, [isLoading, doctors, clinics, mappings, searchParams])

  const availableClinics = useMemo(() => {
    if (!form.doctor_id) {
      return clinics
    }

    const mappedClinicIds = mappings
      .filter((item) => String(item.doctor_id) === form.doctor_id)
      .map((item) => item.clinic_id)

    return clinics.filter((clinic) => mappedClinicIds.includes(clinic.id))
  }, [form.doctor_id, clinics, mappings])

  useEffect(() => {
    if (!form.clinic_id) {
      return
    }

    const clinicExists = availableClinics.some(
      (clinic) => String(clinic.id) === form.clinic_id,
    )

    if (!clinicExists) {
      setForm((prev) => ({
        ...prev,
        clinic_id: '',
      }))
    }
  }, [availableClinics, form.clinic_id])

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setSelectedSlot('')
    setFeedback('')
    setError('')
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  useEffect(() => {
    if (!form.doctor_id || !form.clinic_id || !form.date) {
      setSlotsResponse(null)
      setIsFetchingSlots(false)
      return
    }

    if (form.date < todayDate) {
      setSlotsResponse({ doctor_id: Number(form.doctor_id), available_slots: [] })
      setError('Please choose today or a future date')
      setIsFetchingSlots(false)
      return
    }

    let active = true

    const fetchSlots = async () => {
      setIsFetchingSlots(true)
      setError('')

      try {
        const response = await getAvailabilityByDate({
          doctor_id: Number(form.doctor_id),
          clinic_id: Number(form.clinic_id),
          date: form.date,
        })

        if (!active) {
          return
        }

        setSlotsResponse(response)
      } catch (fetchError) {
        if (active) {
          setError(fetchError.message)
          setSlotsResponse(null)
        }
      } finally {
        if (active) {
          setIsFetchingSlots(false)
        }
      }
    }

    void fetchSlots()

    return () => {
      active = false
    }
  }, [form.doctor_id, form.clinic_id, form.date, todayDate, getAvailabilityByDate])

  const handleBook = async () => {
    if (!selectedSlot) {
      setError('Please select an available slot before booking')
      return
    }

    if (!slotsResponse?.available_slots?.includes(selectedSlot)) {
      setError('Selected slot is no longer available. Please select again.')
      setSelectedSlot('')
      return
    }

    setError('')
    setFeedback('')
    setIsBooking(true)

    try {
      const response = await createAppointment({
        doctor_id: Number(form.doctor_id),
        clinic_id: Number(form.clinic_id),
        date: form.date,
        time: selectedSlot,
      })

      setFeedback(`Appointment booked (id: ${response.appointment_id}, status: ${response.status})`)

      const refreshedSlots = await getAvailabilityByDate({
        doctor_id: Number(form.doctor_id),
        clinic_id: Number(form.clinic_id),
        date: form.date,
      })
      setSlotsResponse(refreshedSlots)
      setSelectedSlot('')
    } catch (bookError) {
      setError(bookError.message)
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Appointment Booking"
        subtitle="Pick doctor, clinic, and date. Slots load automatically for that day, and only valid future bookings are allowed."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.45fr]">
        <section className="rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-lg shadow-teal-100/40">
          <h3 className="text-xl font-semibold">Find Slots</h3>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading doctors and clinics...</p>
          ) : (
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
                      {doctor.name} ({doctor.speciality})
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
                  {availableClinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name} ({clinic.location})
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
                  min={todayDate}
                  value={form.date}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>

              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Slots are loaded automatically when doctor, clinic, and date are selected.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <h3 className="text-xl font-semibold">Available Slots</h3>
          <p className="mt-1 text-sm text-slate-600">
            Slots refresh instantly when date or location changes.
          </p>

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

          {isFetchingSlots && (
            <p className="mt-5 text-sm text-slate-500">Checking live slot availability...</p>
          )}

          {!slotsResponse ? (
            <p className="mt-5 text-sm text-slate-500">Choose doctor, clinic and date to load slots.</p>
          ) : slotsResponse.available_slots.length === 0 ? (
            slotsResponse.is_on_leave ? (
              <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                Doctor is on leave{slotsResponse.leave_reason ? ` (${slotsResponse.leave_reason})` : ''}.
              </p>
            ) : (
              <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No slots available for selected date.
              </p>
            )
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                {slotsResponse.available_slots.map((slot) => {
                  const isActive = slot === selectedSlot
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      disabled={isBooking}
                      className={[
                        'rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                        isActive
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700',
                      ].join(' ')}
                    >
                      {slot}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleBook}
                disabled={!selectedSlot || isBooking}
                className="mt-5 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBooking ? 'Booking...' : selectedSlot ? `Book ${selectedSlot}` : 'Select a slot'}
              </button>
            </>
          )}
        </section>
      </div>
    </section>
  )
}

export default BookingPage
