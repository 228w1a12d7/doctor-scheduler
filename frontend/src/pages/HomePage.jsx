import { Link } from 'react-router-dom'

const featureCards = [
  {
    title: 'Smart Slot Engine',
    description:
      'Manage date-based 15-minute schedules, enforce mode compatibility, and avoid double-booking conflicts automatically.',
  },
  {
    title: 'Leave-Aware Booking',
    description:
      'Doctor leaves block slot creation and patient booking immediately, with transparent leave reasons during search and booking.',
  },
  {
    title: 'Actionable Dashboards',
    description:
      'Track daily revenue, status mix, utilization trends, and doctor-level operational health from one admin workspace.',
  },
]

function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-teal-200/35 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-teal-100/70 bg-white/80 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Care Operations Suite</p>
            <h1 className="text-2xl font-semibold">Doctor Appointment System</h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              to="/signin"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Create Account
            </Link>
          </nav>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-slate-200 bg-white/85 p-8 shadow-xl shadow-slate-200/50">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">Production-ready workflow</p>
            <h2 className="mt-4 text-4xl leading-tight sm:text-5xl">
              Schedule fast.
              <br />
              Book confidently.
              <br />
              Monitor intelligently.
            </h2>
            <p className="mt-5 max-w-2xl text-base text-slate-600">
              A full-stack platform for clinics and hospitals to run online/offline appointments,
              doctor schedules, leave management, and operational analytics without fragmented tools.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
              >
                Start with Signup
              </Link>
              <Link
                to="/signin"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
              >
                I already have an account
              </Link>
            </div>
          </article>

          <aside className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-900 p-6 text-slate-100 shadow-xl shadow-slate-300/30">
            <h3 className="text-2xl text-white">System Highlights</h3>

            <div className="grid grid-cols-2 gap-3">
              <article className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Slot Granularity</p>
                <p className="mt-2 text-2xl font-semibold text-white">15 min</p>
              </article>

              <article className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Modes</p>
                <p className="mt-2 text-2xl font-semibold text-white">Online + Offline</p>
              </article>

              <article className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Join Window</p>
                <p className="mt-2 text-2xl font-semibold text-white">Slot-bound</p>
              </article>

              <article className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Admin Controls</p>
                <p className="mt-2 text-2xl font-semibold text-white">Role-gated</p>
              </article>
            </div>

            <p className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm text-teal-100">
              Built for fast feedback cycles: schedule updates and bookings reflect immediately in UI and APIs.
            </p>
          </aside>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {featureCards.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm shadow-slate-200/40"
            >
              <h3 className="text-2xl">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}

export default HomePage
