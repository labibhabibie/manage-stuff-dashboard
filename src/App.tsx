import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DataPage from './pages/DataPage'
import DetailPage from './pages/DetailPage'
import AktivitasPage from './pages/AktivitasPage'
import UsersPage from './pages/UsersPage'

function ProtectedRoute({ children, requireAdmin, requireSuperAdmin }: {
  children: React.ReactNode
  requireAdmin?: boolean
  requireSuperAdmin?: boolean
}) {
  const { user, loading, isAdmin, isSuperAdmin } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-surface-500 text-sm font-mono">Memuat...</p>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />
  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/data" element={<ProtectedRoute><DataPage /></ProtectedRoute>} />
      <Route path="/data/:id" element={<ProtectedRoute><DetailPage /></ProtectedRoute>} />
      <Route path="/aktivitas" element={<ProtectedRoute requireAdmin><AktivitasPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute requireSuperAdmin><UsersPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
