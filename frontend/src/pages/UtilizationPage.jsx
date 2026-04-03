import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { useMockApi } from '../context/MockApiContext.jsx'

function UtilizationPage() {
  const { getClinics, getUtilization } = useMockApi()
  const [clinics, setClinics] = useState([])
  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [utilization, setUtilization] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadClinics = async () => {
      try {
        const clinicRows = await getClinics()

        if (!mounted) {
          return
        }

        setClinics(clinicRows)
        if (clinicRows.length) {
          setSelectedClinicId((prev) => prev || String(clinicRows[0].id))
        }
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

    void loadClinics()

    return () => {
      mounted = false
    }
  }, [getClinics])

  useEffect(() => {
    if (!selectedClinicId) {
      return
    }

    let mounted = true

    const loadUtilization = async () => {
      setIsFetching(true)
      setError('')

      try {
        const stats = await getUtilization(Number(selectedClinicId))
        if (mounted) {
          setUtilization(stats)
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

    void loadUtilization()

    return () => {
      mounted = false
    }
  }, [selectedClinicId, getUtilization])

  const selectedClinic =
    clinics.find((clinic) => String(clinic.id) === selectedClinicId) ?? null

  return (
    <section>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Clinic utilization based on total slots and booked slots with API shape: clinic_id, total_slots, booked_slots, utilization_percentage."
      />

      <section className="rounded-3xl border border-orange-100 bg-white/90 p-6 shadow-lg shadow-orange-100/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block max-w-xs">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Select Clinic</span>
            <select
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name} ({clinic.location})
                </option>
              ))}
            </select>
          </label>

          {selectedClinic && (
            <p className="text-sm font-medium text-slate-600">
              Tracking: <span className="font-semibold text-slate-900">{selectedClinic.name}</span>
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        {isLoading || isFetching || !utilization ? (
          <p className="mt-5 text-sm text-slate-500">Loading utilization metrics...</p>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clinic ID</p>
                <h3 className="mt-2 text-2xl font-semibold">{utilization.clinic_id}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Slots</p>
                <h3 className="mt-2 text-2xl font-semibold">{utilization.total_slots}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booked Slots</p>
                <h3 className="mt-2 text-2xl font-semibold">{utilization.booked_slots}</h3>
              </article>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>Utilization</span>
                <span>{utilization.utilization_percentage}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 via-teal-600 to-emerald-500 transition-all"
                  style={{ width: `${utilization.utilization_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

export default UtilizationPage
