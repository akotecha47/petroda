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
import UserManagement from './pages/admin/UserManagement'
import StationManagement from './pages/admin/StationManagement'
import ThresholdsRules from './pages/admin/ThresholdsRules'
import PaymentMethods from './pages/admin/PaymentMethods'
import FuelPrices from './pages/admin/FuelPrices'
import InvestigationAudit from './pages/admin/InvestigationAudit'
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
            <ProtectedRoute roles={['admin', 'owner']}>
              <AdminHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/users"
          element={
            <ProtectedRoute roles={['admin', 'owner']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/stations"
          element={
            <ProtectedRoute roles={['admin', 'owner']}>
              <StationManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/thresholds"
          element={
            <ProtectedRoute roles={['admin', 'owner']}>
              <ThresholdsRules />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/payment-methods"
          element={
            <ProtectedRoute roles={['admin', 'owner']}>
              <PaymentMethods />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/fuel-prices"
          element={
            <ProtectedRoute roles={['admin', 'owner']}>
              <FuelPrices />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/investigations"
          element={
            <ProtectedRoute roles={['admin', 'owner']}>
              <InvestigationAudit />
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
