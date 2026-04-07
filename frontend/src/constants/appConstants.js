const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient></defs><rect width="640" height="420" fill="url(#bg)"/><g fill="#475569" font-family="sans-serif" text-anchor="middle"><text x="320" y="200" font-size="24" font-weight="700">Image Unavailable</text><text x="320" y="236" font-size="16">Doctor Availability Scheduler</text></g></svg>`

export const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderSvg)}`

export const APPOINTMENT_STATUSES = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']
export const APPOINTMENT_UPDATE_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW']
export const USER_ROLES = ['patient', 'admin', 'doctor']
export const APPOINTMENT_MODES = ['online', 'offline']
export const LEAVE_REASON_OPTIONS = ['Sick Leave', 'Conference', 'Out of Station']
export const PATIENT_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
