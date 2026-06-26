import { useAuth } from '../context/AuthContext'
import AdminNav from '../components/admin/AdminNav'

// report data queries to be rebuilt against
// daily_sales_forms in a later step

export default function ReportGenerator() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">Report Generator</h1>
        <div className="bg-white rounded-xl border border-gray-200 px-8 py-16 text-center">
          <p className="text-gray-500 text-sm">Report generation coming soon.</p>
        </div>
      </div>
    </div>
  )
}
