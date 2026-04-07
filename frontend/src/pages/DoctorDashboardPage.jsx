import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useMockApi } from '../context/MockApiContext.jsx'

const getTodayDateInputValue = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const STATUS_KEYS = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

const getPerformanceScore = ({ totalSlots, bookedSlots, totalAppointments, completedCount, cancelledCount }) => {
  if (totalSlots === 0 && totalAppointments === 0) {
    return 35
  }

  const utilization = totalSlots > 0 ? bookedSlots / totalSlots : 0
  const completionRate = totalAppointments > 0 ? completedCount / totalAppointments : 0
  const cancellationRate = totalAppointments > 0 ? cancelledCount / totalAppointments : 0

  const score = 30 + utilization * 35 + completionRate * 30 - cancellationRate * 25
  return Math.max(0, Math.min(100, Math.round(score)))
}

const toHealthLabel = (score) => {
  if (score >= 75) {
    return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-700' }
  }
  if (score >= 55) {
    return { label: 'Stable', className: 'bg-amber-100 text-amber-700' }
  }
  return { label: 'Needs attention', className: 'bg-rose-100 text-rose-700' }
}

function DoctorDashboardPage() {
  const { getAppointments, getDoctorSchedules, getDoctors } = useMockApi()

  const [filters, setFilters] = useState({
    date: getTodayDateInputValue(),
    mode: '',
    doctorQuery: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({
    doctors: [],
    schedules: [],
    appointments: [],
  })

  useEffect(() => {
    let mounted = true

    const loadDashboard = async () => {
      setIsLoading(true)
      setError('')

      try {
        const [doctors, schedules, appointments] = await Promise.all([
          getDoctors({ active_only: null, mode: filters.mode || undefined }),
          getDoctorSchedules({
            date: filters.date,
            mode: filters.mode || undefined,
            include_booked: true,
          }),
          getAppointments({ date: filters.date }),
        ])

        if (!mounted) {
          return
        }

        setData({ doctors, schedules, appointments })
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

    void loadDashboard()

    return () => {
      mounted = false
    }
  }, [filters.date, filters.mode, getAppointments, getDoctorSchedules, getDoctors])

  const doctorRows = useMemo(() => {
    const normalizedQuery = filters.doctorQuery.trim().toLowerCase()

    return data.doctors
      .filter((doctor) => {
        if (!normalizedQuery) {
          return true
        }
        return doctor.name.toLowerCase().includes(normalizedQuery)
      })
      .map((doctor) => {
        const schedules = data.schedules.filter((row) => row.doctor_id === doctor.id)
        const appointments = data.appointments.filter((row) => row.doctor_id === doctor.id)

        const statusMap = STATUS_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
        appointments.forEach((row) => {
          if (statusMap[row.status] !== undefined) {
            statusMap[row.status] += 1
          }
        })

        const totalSlots = schedules.length
        const bookedSlots = schedules.filter((row) => row.booked).length
        const availableSlots = Math.max(totalSlots - bookedSlots, 0)
        const totalAppointments = appointments.length
        const performanceScore = getPerformanceScore({
          totalSlots,
          bookedSlots,
          totalAppointments,
          completedCount: statusMap.COMPLETED,
          cancelledCount: statusMap.CANCELLED,
        })

        return {
          doctor,
          totalSlots,
          bookedSlots,
          availableSlots,
          utilization: totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0,
          totalAppointments,
          statusMap,
          performanceScore,
          health: toHealthLabel(performanceScore),
        }
      })
      .sort((first, second) => second.performanceScore - first.performanceScore)
  }, [data.appointments, data.doctors, data.schedules, filters.doctorQuery])

  const headlineMetrics = useMemo(() => {
    const totalDoctors = doctorRows.length
    const activeDoctors = doctorRows.filter((row) => row.doctor.active).length
    const slots = doctorRows.reduce(
      (acc, row) => {
        acc.total += row.totalSlots
        acc.booked += row.bookedSlots
        return acc
      },
      { total: 0, booked: 0 },
    )
    const avgScore =
      totalDoctors > 0
        ? Math.round(doctorRows.reduce((sum, row) => sum + row.performanceScore, 0) / totalDoctors)
        : 0

    return {
      totalDoctors,
      activeDoctors,
      slots,
      avgScore,
    }
  }, [doctorRows])

  return (
    <section>
      <PageHeader
        title="Doctor Insights Dashboard"
        subtitle="Intelligent doctor-level operations view using schedule density, status mix, and performance signals."
      />

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-100/60">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  date: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Mode</span>
            <select
              value={filters.mode}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  mode: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
            >
              <option value="">All modes</option>
              <option value="online">online</option>
              <option value="offline">offline</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Doctor Search</span>
            <input
              value={filters.doctorQuery}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  doctorQuery: event.target.value,
                }))
              }
              placeholder="Search by doctor name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </label>

          <button
            type="button"
            onClick={() =>
              setFilters({
                date: getTodayDateInputValue(),
                mode: '',
                doctorQuery: '',
              })
            }
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
          >
            Reset
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        {isLoading ? (
          <LoadingSpinner className="mt-5" label="Loading doctor insights..." />
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctors</p>
                <h3 className="mt-2 text-2xl font-semibold">{headlineMetrics.totalDoctors}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Doctors</p>
                <h3 className="mt-2 text-2xl font-semibold">{headlineMetrics.activeDoctors}</h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slots Booked</p>
                <h3 className="mt-2 text-2xl font-semibold">
                  {headlineMetrics.slots.booked}/{headlineMetrics.slots.total}
                </h3>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Performance Score</p>
                <h3 className="mt-2 text-2xl font-semibold">{headlineMetrics.avgScore}</h3>
              </article>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1180px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2">Doctor</th>
                    <th className="px-3 py-2">Slots</th>
                    <th className="px-3 py-2">Utilization</th>
                    <th className="px-3 py-2">Appointments</th>
                    <th className="px-3 py-2">Status Mix</th>
                    <th className="px-3 py-2">Health</th>
                    <th className="px-3 py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-slate-500">
                        No doctor data available for selected filters.
                      </td>
                    </tr>
                  ) : (
                    doctorRows.map((row) => (
                      <tr key={row.doctor.id} className="bg-slate-50 text-slate-700">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-900">{row.doctor.name}</p>
                          <p className="text-xs text-slate-500">
                            {row.doctor.speciality} | {row.doctor.mode}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p>Total: {row.totalSlots}</p>
                          <p className="text-xs text-slate-500">
                            Booked: {row.bookedSlots} | Available: {row.availableSlots}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-2.5 w-32 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-teal-600"
                              style={{ width: `${row.utilization}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-600">{row.utilization}%</p>
                        </td>
                        <td className="px-3 py-3 font-semibold">{row.totalAppointments}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          CFM {row.statusMap.CONFIRMED} | CMP {row.statusMap.COMPLETED} | CAN{' '}
                          {row.statusMap.CANCELLED} | NS {row.statusMap.NO_SHOW}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={[
                              'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                              row.health.className,
                            ].join(' ')}
                          >
                            {row.health.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold">{row.performanceScore}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </section>
  )
}

export default DoctorDashboardPage
