import { Navigate } from 'react-router-dom'
import { useMockApi } from '../context/MockApiContext.jsx'

function ProtectedRoute({ children }) {
  const { auth } = useMockApi()

  if (!auth?.token) {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
