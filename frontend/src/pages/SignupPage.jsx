import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PATIENT_GENDERS, USER_ROLES } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

function SignupPage() {
  const { auth, signup } = useMockApi()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    contact: '',
    dob: '',
    gender: 'Female',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState(null)

  if (auth?.token) {
    return <Navigate to="/app" replace />
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      }

      if (name === 'role' && value !== 'patient') {
        next.contact = ''
        next.dob = ''
        next.gender = 'Female'
      }

      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      }

      if (form.role === 'patient') {
        payload.contact = form.contact.trim()
        payload.dob = form.dob
        payload.gender = form.gender
      }

      const result = await signup(payload)
      setResponse(result)
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'patient',
        contact: '',
        dob: '',
        gender: 'Female',
      })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isPatientRole = form.role === 'patient'

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="grid w-full gap-6 rounded-3xl border border-orange-100 bg-white/85 p-6 shadow-xl shadow-orange-100/70 backdrop-blur md:grid-cols-2 md:p-10">
        <div className="rounded-2xl bg-orange-600 p-6 text-white md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-100">
            Auth Setup
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Create account</h1>
          <p className="mt-3 text-sm text-orange-50 sm:text-base">
            Signup request uses:
            {' '}
            {`{ name, email, password, role, contact?, dob? }`}
          </p>
          <p className="mt-2 text-sm text-orange-50 sm:text-base">
            Signup response shape:
            {' '}
            {`{ user_id, message }`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-3 md:p-4">
          <h2 className="text-2xl font-semibold">Signup</h2>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Name</span>
            <input
              required
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
            <input
              required
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
            <input
              required
              minLength={6}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Role</span>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          {isPatientRole && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Contact</span>
                <input
                  required
                  name="contact"
                  value={form.contact}
                  onChange={handleChange}
                  placeholder="9876543210"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Date of Birth</span>
                <input
                  required
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Gender</span>
                <select
                  required
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
                >
                  {PATIENT_GENDERS.map((genderOption) => (
                    <option key={genderOption} value={genderOption}>
                      {genderOption}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {!isPatientRole && form.role === 'doctor' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Doctor accounts require admin approval before signin is allowed.
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          {response && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {response.message} (user_id: {response.user_id})
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Creating...' : 'Signup'}
          </button>

          <p className="text-sm text-slate-600">
            Already have an account?
            {' '}
            <Link to="/signin" className="font-semibold text-orange-700 hover:text-orange-900">
              Go to login
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}

export default SignupPage
