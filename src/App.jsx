import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Profile from './pages/Profile'
import OwnerHome from './pages/owner/OwnerHome'
import AdminHome from './pages/admin/AdminHome'
import JuniorAdminHome from './pages/junioradmin/JuniorAdminHome'
import ManagerHome from './pages/manager/ManagerHome'
import AttendantHome from './pages/attendant/AttendantHome'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/owner"
          element={
            <ProtectedRoute roles={['owner']}>
              <OwnerHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/junior-admin"
          element={
            <ProtectedRoute roles={['junior_admin']}>
              <JuniorAdminHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager"
          element={
            <ProtectedRoute roles={['manager']}>
              <ManagerHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/attendant"
          element={
            <ProtectedRoute roles={['attendant']}>
              <AttendantHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/profile"
          element={
            <ProtectedRoute roles={['owner', 'admin', 'junior_admin', 'manager', 'attendant']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
