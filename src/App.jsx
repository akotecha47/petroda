import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import FuelPrices from './pages/admin/FuelPrices'
import ThresholdsRules from './pages/admin/ThresholdsRules'
import UserManagement from './pages/admin/UserManagement'
import ReportGenerator from './pages/ReportGenerator'
import InvestigationAudit from './pages/admin/InvestigationAudit'
import ManagerHome from './pages/manager/ManagerHome'
import DailySalesForm from './pages/manager/DailySalesForm'
import DeliveryEntry from './pages/manager/DeliveryEntry'
import DipEntry from './pages/manager/DipEntry'

function RootRedirect() {
  const { session, user, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (user?.role === 'owner') return <Navigate to="/owner" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'manager') return <Navigate to="/manager" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Owner routes */}
        <Route
          path="/owner"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <div>Owner Home</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/fuel-prices"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <FuelPrices />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/thresholds"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <ThresholdsRules />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <div>Admin Home</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/fuel-prices"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <FuelPrices readOnly={true} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ReportGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/investigations"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <InvestigationAudit />
            </ProtectedRoute>
          }
        />

        {/* Manager routes */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <ManagerHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/daily-sales"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <DailySalesForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/delivery"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <DeliveryEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/dip"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <DipEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/deposit"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <div>Deposit Slip — coming soon</div>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
