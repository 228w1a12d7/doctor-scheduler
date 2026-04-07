import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { APPOINTMENT_MODES, PLACEHOLDER_IMAGE } from '../constants/appConstants.js'
import { useMockApi } from '../context/MockApiContext.jsx'

const emptyForm = {
  name: '',
  email: '',
  speciality: '',
  mode: 'online',
  fee: '',
  active: true,
  meeting_link: '',
  clinic_address: '',
  imageFile: null,
  imagePreview: '',
}

function DoctorsPage() {
  const { addDoctor, updateDoctor, deleteDoctor, getDoctors, getSpecialties } = useMockApi()
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [doctors, setDoctors] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [editingDoctorId, setEditingDoctorId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMutatingRowId, setIsMutatingRowId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const [editFileInputKey, setEditFileInputKey] = useState(0)

  useEffect(() => {
    let mounted = true

    const loadData = async (isInitial = false) => {
      try {
        const [doctorRows, specialtyRows] = await Promise.all([getDoctors(), getSpecialties()])
        if (!mounted) {
          return
        }

        setDoctors(doctorRows)
        setSpecialties(specialtyRows)
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message)
        }
      } finally {
        if (mounted && isInitial) {
          setIsLoading(false)
        }
      }
    }

    void loadData(true)
    const intervalId = window.setInterval(() => {
      void loadData(false)
    }, 15000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [getDoctors, getSpecialties])

  const specialtyNames = useMemo(
    () => specialties.map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    [specialties],
  )

  const reloadDoctors = async () => {
    const rows = await getDoctors()
    setDoctors(rows)
  }

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }

      if (name === 'mode' && value === 'online') {
        next.clinic_address = ''
      }

      if (name === 'mode' && value === 'offline') {
        next.meeting_link = ''
      }

      return next
    })
  }

  const handleImageChange = (event, isEdit = false) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const previewUrl = URL.createObjectURL(file)

    if (isEdit) {
      setEditForm((prev) => ({
        ...prev,
        imageFile: file,
        imagePreview: previewUrl,
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: previewUrl,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFeedback('')
    setIsSubmitting(true)

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        speciality: form.speciality.trim(),
        mode: form.mode,
        fee: Number(form.fee),
        active: form.active,
        meeting_link: form.mode === 'online' ? form.meeting_link.trim() : '',
        clinic_address: form.mode === 'offline' ? form.clinic_address.trim() : '',
        imageFile: form.imageFile,
      }

      const response = await addDoctor(payload)
      await reloadDoctors()
      setFeedback(`${response.message} (id: ${response.id})`)
      setForm(emptyForm)
      setFileInputKey((prev) => prev + 1)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEditing = (doctor) => {
    setEditingDoctorId(doctor.id)
    setEditForm({
      name: doctor.name,
      email: doctor.email || '',
      speciality: doctor.speciality,
      mode: doctor.mode,
      fee: doctor.fee,
      active: doctor.active,
      meeting_link: doctor.meeting_link || '',
      clinic_address: doctor.clinic_address || '',
      imageFile: null,
      imagePreview: doctor.image || '',
    })
    setEditFileInputKey((prev) => prev + 1)
  }

  const cancelEditing = () => {
    setEditingDoctorId(null)
    setEditForm(emptyForm)
  }

  const handleEditFieldChange = (event) => {
    const { name, value, type, checked } = event.target
    setEditForm((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }
      if (name === 'mode' && value === 'online') {
        next.clinic_address = ''
      }
      if (name === 'mode' && value === 'offline') {
        next.meeting_link = ''
      }
      return next
    })
  }

  const handleUpdateDoctor = async (doctorId) => {
    setError('')
    setFeedback('')
    setIsMutatingRowId(doctorId)

    try {
      const response = await updateDoctor({
        id: doctorId,
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        speciality: editForm.speciality.trim(),
        mode: editForm.mode,
        fee: Number(editForm.fee),
        active: editForm.active,
        meeting_link: editForm.mode === 'online' ? editForm.meeting_link.trim() : '',
        clinic_address: editForm.mode === 'offline' ? editForm.clinic_address.trim() : '',
        imageFile: editForm.imageFile,
      })

      await reloadDoctors()
      setFeedback(response.message)
      cancelEditing()
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsMutatingRowId(null)
    }
  }

  const handleDeleteDoctor = async (doctorId) => {
    const confirmed = window.confirm('Delete this doctor and related schedules/appointments?')
    if (!confirmed) {
      return
    }

    setError('')
    setFeedback('')
    setIsMutatingRowId(doctorId)

    try {
      const response = await deleteDoctor(doctorId)
      await reloadDoctors()
      setFeedback(response.message)
      if (editingDoctorId === doctorId) {
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
        title="Doctor Management"
        subtitle="Admin can add, update, and delete doctors with speciality, mode, fee, active status, online meeting links, image, and offline clinic address."
      />

      <datalist id="speciality-options">
        {specialtyNames.map((specialityName) => (
          <option key={specialityName} value={specialityName} />
        ))}
      </datalist>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.45fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-teal-100 bg-white/85 p-6 shadow-lg shadow-teal-100/40"
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
              <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
              <input
                required
                type="email"
                name="email"
                value={form.email}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                placeholder="doctor@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Speciality</span>
              <input
                required
                name="speciality"
                value={form.speciality}
                list="speciality-options"
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                placeholder="Cardiology"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Mode</span>
                <select
                  required
                  name="mode"
                  value={form.mode}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                >
                  {APPOINTMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Fee</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  name="fee"
                  value={form.fee}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                  placeholder="500"
                />
              </label>
            </div>

            {form.mode === 'online' && (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Meeting Link</span>
                <input
                  required
                  type="url"
                  name="meeting_link"
                  value={form.meeting_link}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                  placeholder="https://meet.google.com/your-room"
                />
              </label>
            )}

            {form.mode === 'offline' && (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Clinic Address</span>
                <input
                  required
                  name="clinic_address"
                  value={form.clinic_address}
                  onChange={handleFieldChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-teal-500 focus:bg-white"
                  placeholder="Hitech City, Hyderabad"
                />
              </label>
            )}

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleFieldChange}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>Active Doctor</span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Image (optional)</span>
              <input
                key={fileInputKey}
                type="file"
                accept="image/*"
                onChange={(event) => handleImageChange(event)}
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
          <p className="mt-1 text-sm text-slate-600">Mode and active status drive online/offline appointment eligibility.</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Auto-refresh every 15 seconds</p>

          {isLoading ? (
            <LoadingSpinner className="mt-4" label="Loading doctors..." />
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {doctors.map((doctor) => (
                <article key={doctor.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <img
                    src={
                      editingDoctorId === doctor.id
                        ? editForm.imagePreview || PLACEHOLDER_IMAGE
                        : doctor.image || PLACEHOLDER_IMAGE
                    }
                    alt={doctor.name}
                    onError={(event) => {
                      if (event.currentTarget.src !== PLACEHOLDER_IMAGE) {
                        event.currentTarget.src = PLACEHOLDER_IMAGE
                      }
                    }}
                    className="h-36 w-full rounded-xl object-cover"
                  />

                  {editingDoctorId === doctor.id ? (
                    <div className="mt-3 space-y-3">
                      <input
                        name="name"
                        value={editForm.name}
                        onChange={handleEditFieldChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                      <input
                        name="email"
                        type="email"
                        value={editForm.email}
                        onChange={handleEditFieldChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                        placeholder="doctor@example.com"
                      />
                      <input
                        name="speciality"
                        value={editForm.speciality}
                        list="speciality-options"
                        onChange={handleEditFieldChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          name="mode"
                          value={editForm.mode}
                          onChange={handleEditFieldChange}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                        >
                          {APPOINTMENT_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="fee"
                          value={editForm.fee}
                          onChange={handleEditFieldChange}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                        />
                      </div>

                      {editForm.mode === 'online' && (
                        <input
                          type="url"
                          required
                          name="meeting_link"
                          value={editForm.meeting_link}
                          onChange={handleEditFieldChange}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                          placeholder="Meeting link"
                        />
                      )}

                      {editForm.mode === 'offline' && (
                        <input
                          name="clinic_address"
                          value={editForm.clinic_address}
                          onChange={handleEditFieldChange}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                          placeholder="Clinic address"
                        />
                      )}

                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          name="active"
                          checked={editForm.active}
                          onChange={handleEditFieldChange}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span>Active</span>
                      </label>

                      <input
                        key={editFileInputKey}
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleImageChange(event, true)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-white"
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateDoctor(doctor.id)}
                          disabled={isMutatingRowId === doctor.id}
                          className="flex-1 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isMutatingRowId === doctor.id ? 'Saving...' : 'Save'}
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
                      <h4 className="mt-3 text-lg font-semibold">{doctor.name}</h4>
                      {doctor.email && <p className="text-sm text-slate-600">{doctor.email}</p>}
                      <p className="text-sm text-slate-600">{doctor.speciality}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                          {doctor.mode}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                          Fee: {doctor.fee}
                        </span>
                        <span
                          className={[
                            'rounded-full px-2 py-1 font-semibold',
                            doctor.active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700',
                          ].join(' ')}
                        >
                          {doctor.active ? 'Approved' : 'Pending/Inactive'}
                        </span>
                      </div>

                      {doctor.mode === 'offline' && doctor.clinic_address && (
                        <p className="mt-2 text-xs text-slate-600">Address: {doctor.clinic_address}</p>
                      )}

                      {doctor.mode === 'online' && doctor.meeting_link && (
                        <p className="mt-2 truncate text-xs text-slate-600">Meeting: {doctor.meeting_link}</p>
                      )}

                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-teal-700">id: {doctor.id}</p>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(doctor)}
                          className="flex-1 rounded-xl border border-teal-300 px-3 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoctor(doctor.id)}
                          disabled={isMutatingRowId === doctor.id}
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

export default DoctorsPage
