import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { useMockApi } from '../context/MockApiContext.jsx'

function MappingPage() {
  const { getClinics, getDoctors, getMappings, mapDoctorToClinic } = useMockApi()
  const [doctors, setDoctors] = useState([])
  const [clinics, setClinics] = useState([])
  const [mappings, setMappings] = useState([])
  const [form, setForm] = useState({
    doctor_id: '',
    clinic_id: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

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

  const mappedRows = useMemo(
    () =>
      mappings.map((mapping) => ({
        ...mapping,
        doctorName:
          doctors.find((doctor) => doctor.id === mapping.doctor_id)?.name ??
          'Unknown doctor',
        clinicName:
          clinics.find((clinic) => clinic.id === mapping.clinic_id)?.name ??
          'Unknown clinic',
      })),
    [mappings, doctors, clinics],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFeedback('')
    setIsSubmitting(true)

    try {
      const response = await mapDoctorToClinic({
        doctor_id: Number(form.doctor_id),
        clinic_id: Number(form.clinic_id),
      })

      const refreshedMappings = await getMappings()
      setMappings(refreshedMappings)
      setFeedback(response.message)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Doctor-Clinic Mapping"
        subtitle="Assign doctors to clinics using the exact payload: doctor_id and clinic_id."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-lg shadow-teal-100/40"
        >
          <h3 className="text-xl font-semibold">Assign Doctor</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Doctor</span>
              <select
                required
                value={form.doctor_id}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    doctor_id: event.target.value,
                  }))
                }
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
                value={form.clinic_id}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    clinic_id: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
              >
                <option value="">Select clinic</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name} ({clinic.location})
                  </option>
                ))}
              </select>
            </label>

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
              {isSubmitting ? 'Assigning...' : 'Map Doctor to Clinic'}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <h3 className="text-xl font-semibold">Mapped Doctors</h3>
          <p className="mt-1 text-sm text-slate-600">Response shape: {'{ message: "Doctor mapped to clinic" }'}</p>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading mapping list...</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[380px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2">Doctor</th>
                    <th className="px-3 py-2">Clinic</th>
                    <th className="px-3 py-2">Request Pair</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.map((row, index) => (
                    <tr key={`${row.doctor_id}-${row.clinic_id}-${index}`} className="rounded-xl bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-slate-800">{row.doctorName}</td>
                      <td className="px-3 py-3 text-slate-700">{row.clinicName}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        doctor_id: {row.doctor_id}, clinic_id: {row.clinic_id}
                      </td>
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

export default MappingPage
