import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Profile from './pages/Profile'
import OwnerHome from './pages/owner/OwnerHome'
import StationComparison from './pages/owner/StationComparison'
import SalesRevenue from './pages/owner/SalesRevenue'
import StockSupply from './pages/owner/StockSupply'
import VarianceLosses from './pages/owner/VarianceLosses'
import AdminHome from './pages/admin/AdminHome'
import JuniorAdminHome from './pages/junioradmin/JuniorAdminHome'
import ManagerHome from './pages/manager/ManagerHome'
import ShiftReview from './pages/manager/ShiftReview'
import ShiftCorrection from './pages/manager/ShiftCorrection'
import ShiftClose from './pages/manager/ShiftClose'
import AttendantHome from './pages/attendant/AttendantHome'
import StationStock from './pages/manager/StationStock'
import DipEntry from './pages/manager/DipEntry'
import DeliveryEntry from './pages/manager/DeliveryEntry'
import StationCash from './pages/manager/StationCash'
import CashMovementEntry from './pages/manager/CashMovementEntry'
import FlagsInvestigations from './pages/manager/FlagsInvestigations'
import DipVerification from './pages/junioradmin/DipVerification'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/owner"
          element={
            <ProtectedRoute roles={['owner', 'admin']}>
              <OwnerHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/owner/compare"
          element={
            <ProtectedRoute roles={['owner', 'admin']}>
              <StationComparison />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/owner/sales"
          element={
            <ProtectedRoute roles={['owner', 'admin']}>
              <SalesRevenue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/owner/stock"
          element={
            <ProtectedRoute roles={['owner', 'admin']}>
              <StockSupply />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/owner/variance"
          element={
            <ProtectedRoute roles={['owner', 'admin']}>
              <VarianceLosses />
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
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <ManagerHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/shifts"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <ShiftReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/correct"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <ShiftCorrection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/close"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <ShiftClose />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/stock"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <StationStock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/dip"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <DipEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/delivery"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <DeliveryEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/cash"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <StationCash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/cash/new"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <CashMovementEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/manager/flags"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'owner']}>
              <FlagsInvestigations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/junior-admin/dip-verify"
          element={
            <ProtectedRoute roles={['junior_admin', 'admin', 'owner']}>
              <DipVerification />
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
