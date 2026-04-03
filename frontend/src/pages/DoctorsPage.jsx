import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { PLACEHOLDER_IMAGE } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const emptyForm = {
  name: '',
  speciality: '',
  imageFile: null,
  imagePreview: '',
}

function DoctorsPage() {
  const { addDoctor, getDoctors } = useMockApi()
  const [form, setForm] = useState(emptyForm)
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    let mounted = true

    const loadDoctors = async () => {
      try {
        const list = await getDoctors()
        if (mounted) {
          setDoctors(list)
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

    void loadDoctors()

    return () => {
      mounted = false
    }
  }, [getDoctors])

  useEffect(
    () => () => {
      if (form.imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(form.imagePreview)
      }
    },
    [form.imagePreview],
  )

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: previewUrl,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback('')
    setError('')

    try {
      const response = await addDoctor({
        name: form.name.trim(),
        speciality: form.speciality.trim(),
        image: form.imagePreview,
      })

      const updatedDoctors = await getDoctors()
      setDoctors(updatedDoctors)
      setFeedback(`${response.message} (id: ${response.id})`)
      setForm(emptyForm)
      setFileInputKey((prev) => prev + 1)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Doctor Management"
        subtitle="Add doctors using FormData-like fields (name, speciality, image) and preview image before submitting."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.45fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-lg shadow-teal-100/50"
        >
          <h3 className="text-xl font-semibold">Add Doctor</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Name</span>
              <input
                required
                name="name"
                value={form.name}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                placeholder="Dr Ravi"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Speciality</span>
              <input
                required
                name="speciality"
                value={form.speciality}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                placeholder="Cardiology"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Image (required)</span>
              <input
                key={fileInputKey}
                required
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-white"
              />
            </label>

            {form.imagePreview && (
              <img
                src={form.imagePreview}
                alt="Doctor preview"
                className="h-32 w-32 rounded-xl border border-slate-200 object-cover"
              />
            )}

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
              {isSubmitting ? 'Saving doctor...' : 'Add Doctor'}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <h3 className="text-xl font-semibold">Doctors List</h3>
          <p className="mt-1 text-sm text-slate-600">Response shape: [ id, name, speciality, image ]</p>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading doctors...</p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {doctors.map((doctor) => (
                <article
                  key={doctor.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <img
                    src={doctor.image || PLACEHOLDER_IMAGE}
                    alt={doctor.name}
                    className="h-36 w-full rounded-xl object-cover"
                  />
                  <h4 className="mt-3 text-lg font-semibold">{doctor.name}</h4>
                  <p className="text-sm text-slate-600">{doctor.speciality}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
                    id: {doctor.id}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default DoctorsPage
