import { NavLink, useNavigate } from 'react-router-dom'
import { useMockApi } from '../context/MockApiContext.jsx'

const linksByRole = {
  admin: [
    { to: '/app/doctors', label: 'Doctors' },
    { to: '/app/clinics', label: 'Clinics' },
    { to: '/app/mapping', label: 'Mapping' },
    { to: '/app/availability', label: 'Availability' },
    { to: '/app/leaves', label: 'Leaves' },
    { to: '/app/appointments', label: 'Appointments' },
    { to: '/app/utilization', label: 'Utilization' },
  ],
  patient: [
    { to: '/app/search', label: 'Search Doctors' },
    { to: '/app/book', label: 'Book Appointment' },
    { to: '/app/appointments', label: 'My Appointments' },
  ],
}

const navLinkClassName = ({ isActive }) =>
  [
    'rounded-full px-3 py-1.5 text-sm font-semibold transition',
    isActive
      ? 'bg-teal-700 text-white shadow-sm shadow-teal-800/40'
      : 'text-slate-700 hover:bg-teal-100 hover:text-teal-900',
  ].join(' ')

function Navbar() {
  const navigate = useNavigate()
  const { auth, logout } = useMockApi()
  const role = auth?.user?.role ?? 'patient'
  const links = linksByRole[role] ?? []

  const handleLogout = () => {
    const shouldLogout = window.confirm('Are you sure you want to logout?')
    if (!shouldLogout) {
      return
    }

    logout()
    navigate('/signin', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 border-b border-teal-100/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Hackathon Build
          </p>
          <h1 className="text-2xl font-semibold">Doctor Availability Scheduler</h1>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClassName}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
            {role}
          </div>
          <div className="text-sm font-medium text-slate-700">{auth?.user?.name}</div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
