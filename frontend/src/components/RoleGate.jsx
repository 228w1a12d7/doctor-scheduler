import { useMockApi } from '../context/MockApiContext.jsx'

function RoleGate({ allowedRoles, children }) {
  const { auth } = useMockApi()
  const role = String(auth?.user?.role ?? '').toLowerCase()
  const normalizedAllowedRoles = allowedRoles.map((allowedRole) => String(allowedRole).toLowerCase())

  if (!normalizedAllowedRoles.includes(role)) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <h2 className="text-2xl">Access restricted</h2>
        <p className="mt-2 text-sm text-amber-800">
          This section is only available for {allowedRoles.join(', ')} users.
        </p>
      </section>
    )
  }

  return children
}

export default RoleGate
