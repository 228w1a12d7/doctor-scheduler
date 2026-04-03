import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { PLACEHOLDER_IMAGE } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const emptyForm = {
  name: '',
  location: '',
  imageFile: null,
  imagePreview: '',
}

function ClinicsPage() {
  const { addClinic, updateClinic, deleteClinic, getClinics } = useMockApi()
  const [form, setForm] = useState(emptyForm)
  const [clinics, setClinics] = useState([])
  const [editingClinicId, setEditingClinicId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMutatingRowId, setIsMutatingRowId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const [editFileInputKey, setEditFileInputKey] = useState(0)

  useEffect(() => {
    let mounted = true

    const loadClinics = async () => {
      try {
        const list = await getClinics()
        if (mounted) {
          setClinics(list)
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

  useEffect(
    () => () => {
      if (form.imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(form.imagePreview)
      }

      if (editForm.imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(editForm.imagePreview)
      }
    },
    [form.imagePreview, editForm.imagePreview],
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
      const response = await addClinic({
        name: form.name.trim(),
        location: form.location.trim(),
        imageFile: form.imageFile,
      })

      const updatedClinics = await getClinics()
      setClinics(updatedClinics)
      setFeedback(`${response.message} (id: ${response.id})`)
      setForm(emptyForm)
      setFileInputKey((prev) => prev + 1)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditFieldChange = (event) => {
    const { name, value } = event.target
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleEditImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setEditForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: previewUrl,
    }))
  }

  const startEditing = (clinic) => {
    setError('')
    setFeedback('')
    setEditingClinicId(clinic.id)
    setEditForm({
      name: clinic.name,
      location: clinic.location,
      imageFile: null,
      imagePreview: clinic.image || '',
    })
    setEditFileInputKey((prev) => prev + 1)
  }

  const cancelEditing = () => {
    setEditingClinicId(null)
    setEditForm(emptyForm)
  }

  const handleUpdateClinic = async (clinicId) => {
    setError('')
    setFeedback('')
    setIsMutatingRowId(clinicId)

    try {
      const response = await updateClinic({
        id: clinicId,
        name: editForm.name.trim(),
        location: editForm.location.trim(),
        imageFile: editForm.imageFile,
      })

      const updatedClinics = await getClinics()
      setClinics(updatedClinics)
      setFeedback(response.message)
      cancelEditing()
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsMutatingRowId(null)
    }
  }

  const handleDeleteClinic = async (clinicId) => {
    const confirmed = window.confirm('Delete this clinic? This will remove linked mapping, availability and appointments.')
    if (!confirmed) {
      return
    }

    setError('')
    setFeedback('')
    setIsMutatingRowId(clinicId)

    try {
      const response = await deleteClinic(clinicId)
      const updatedClinics = await getClinics()
      setClinics(updatedClinics)
      setFeedback(response.message)
      if (editingClinicId === clinicId) {
        cancelEditing()
      }
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setIsMutatingRowId(null)
    }
  }

  return (
    <section>
      <PageHeader
        title="Clinic Management"
        subtitle="Add clinics with image preview and maintain the backend field mapping: name, location, image."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.45fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-orange-100 bg-white/85 p-6 shadow-lg shadow-orange-100/40"
        >
          <h3 className="text-xl font-semibold">Add Clinic</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Name</span>
              <input
                required
                name="name"
                value={form.name}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
                placeholder="City Clinic"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Location</span>
              <input
                required
                name="location"
                value={form.location}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-orange-500 focus:bg-white"
                placeholder="Hyderabad"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-orange-600 file:px-3 file:py-1.5 file:text-white"
              />
            </label>

            {form.imagePreview && (
              <img
                src={form.imagePreview}
                alt="Clinic preview"
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
              className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Saving clinic...' : 'Add Clinic'}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-100/70">
          <h3 className="text-xl font-semibold">Clinics List</h3>
          <p className="mt-1 text-sm text-slate-600">Response shape: [ id, name, location, image ]</p>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading clinics...</p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {clinics.map((clinic) => (
                <article
                  key={clinic.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <img
                    src={
                      editingClinicId === clinic.id
                        ? editForm.imagePreview || PLACEHOLDER_IMAGE
                        : clinic.image || PLACEHOLDER_IMAGE
                    }
                    alt={clinic.name}
                    onError={(event) => {
                      if (event.currentTarget.src !== PLACEHOLDER_IMAGE) {
                        event.currentTarget.src = PLACEHOLDER_IMAGE
                      }
                    }}
                    className="h-36 w-full rounded-xl object-cover"
                  />

                  {editingClinicId === clinic.id ? (
                    <div className="mt-3 space-y-3">
                      <input
                        name="name"
                        value={editForm.name}
                        onChange={handleEditFieldChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-orange-500 focus:bg-white"
                      />
                      <input
                        name="location"
                        value={editForm.location}
                        onChange={handleEditFieldChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-orange-500 focus:bg-white"
                      />
                      <input
                        key={editFileInputKey}
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-orange-600 file:px-3 file:py-1.5 file:text-white"
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateClinic(clinic.id)}
                          disabled={isMutatingRowId === clinic.id}
                          className="flex-1 rounded-xl bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isMutatingRowId === clinic.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="mt-3 text-lg font-semibold">{clinic.name}</h4>
                      <p className="text-sm text-slate-600">{clinic.location}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
                        id: {clinic.id}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(clinic)}
                          className="flex-1 rounded-xl border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClinic(clinic.id)}
                          disabled={isMutatingRowId === clinic.id}
                          className="flex-1 rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default ClinicsPage
