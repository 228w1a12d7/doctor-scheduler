import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import RoleGate from './components/RoleGate.jsx'
import { useMockApi } from './context/MockApiContext.jsx'
import AppointmentsPage from './pages/AppointmentsPage.jsx'
import AvailabilityPage from './pages/AvailabilityPage.jsx'
import BookingPage from './pages/BookingPage.jsx'
import DoctorDashboardPage from './pages/DoctorDashboardPage.jsx'
import DoctorsPage from './pages/DoctorsPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LeavesPage from './pages/LeavesPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import UtilizationPage from './pages/UtilizationPage.jsx'

function RoleHomeRedirect() {
  const { auth } = useMockApi()
  const role = String(auth?.user?.role ?? '').toLowerCase()

  let destination = '/app/search'
  if (role === 'admin') {
    destination = '/app/doctors'
  } else if (role === 'doctor') {
    destination = '/app/appointments'
  }

  return <Navigate to={destination} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signin" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHomeRedirect />} />

        <Route
          path="search"
          element={
            <RoleGate allowedRoles={['patient']}>
              <SearchPage />
            </RoleGate>
          }
        />
        <Route
          path="book"
          element={
            <RoleGate allowedRoles={['patient']}>
              <BookingPage />
            </RoleGate>
          }
        />
        <Route path="appointments" element={<AppointmentsPage />} />

        <Route
          path="doctors"
          element={
            <RoleGate allowedRoles={['admin']}>
              <DoctorsPage />
            </RoleGate>
          }
        />
        <Route
          path="availability"
          element={
            <RoleGate allowedRoles={['admin']}>
              <AvailabilityPage />
            </RoleGate>
          }
        />
        <Route
          path="leaves"
          element={
            <RoleGate allowedRoles={['admin']}>
              <LeavesPage />
            </RoleGate>
          }
        />
        <Route
          path="doctor-dashboard"
          element={
            <RoleGate allowedRoles={['admin']}>
              <DoctorDashboardPage />
            </RoleGate>
          }
        />
        <Route
          path="dashboard"
          element={
            <RoleGate allowedRoles={['admin']}>
              <UtilizationPage />
            </RoleGate>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
