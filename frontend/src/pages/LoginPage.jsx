import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMockApi } from '../context/MockApiContext.jsx'

function LoginPage() {
  const navigate = useNavigate()
  const { auth, login } = useMockApi()
  const [form, setForm] = useState({
    email: 'sree@gmail.com',
    password: '123456',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (auth?.token) {
    return <Navigate to="/app" replace />
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await login({
        email: form.email,
        password: form.password,
      })
      navigate('/app', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="grid w-full gap-6 rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-xl shadow-teal-100/60 backdrop-blur md:grid-cols-2 md:p-10">
        <div className="rounded-2xl bg-teal-900 p-6 text-white md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
            Doctor Availability Scheduler
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Welcome back</h1>
          <p className="mt-3 text-sm text-teal-100 sm:text-base">
            Login response shape:
            {' '}
            {`{ token, user: { id, name, role, patient_id } }`}
          </p>
          <div className="mt-6 space-y-2 text-sm text-teal-100">
            <p>Patient demo: sree@gmail.com / 123456</p>
            <p>Admin demo: admin@hospital.com / admin123</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-3 md:p-4">
          <h2 className="text-2xl font-semibold">Login</h2>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
            <input
              required
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
            <input
              required
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>

          <p className="text-sm text-slate-600">
            New here?
            {' '}
            <Link to="/signup" className="font-semibold text-teal-700 hover:text-teal-900">
              Create account
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
