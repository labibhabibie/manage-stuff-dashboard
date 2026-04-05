import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Users, Activity,
  LogOut, Menu, X, ChevronRight, Shield, Bell
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/data', label: 'Data Inspeksi', icon: Package },
  { path: '/aktivitas', label: 'Log Aktivitas', icon: Activity, adminOnly: true },
  { path: '/users', label: 'Manajemen User', icon: Users, superAdminOnly: true },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { profile, signOut, isSuperAdmin, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const roleName = (profile?.roles as { name?: string })?.name ?? ''
  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin', admin: 'Admin',
    operator: 'Operator', viewer: 'Viewer'
  }
  const roleColors: Record<string, string> = {
    super_admin: 'text-amber-400 bg-amber-900/30 border-amber-800',
    admin: 'text-brand-400 bg-brand-900/30 border-brand-800',
    operator: 'text-blue-400 bg-blue-900/30 border-blue-800',
    viewer: 'text-surface-400 bg-surface-800 border-surface-700',
  }

  const filteredNav = navItems.filter(item => {
    if (item.superAdminOnly && !isSuperAdmin) return false
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0 bg-surface-900 border-r border-surface-800 flex flex-col transition-all duration-300 ease-in-out`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-surface-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <span className="font-display font-bold text-white text-sm">ManageStuff</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const active = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                  ${active
                    ? 'bg-brand-900/50 text-brand-400 border border-brand-800/60'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800'
                  }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    {active && <ChevronRight size={14} />}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className={`p-3 border-t border-surface-800 ${sidebarOpen ? '' : 'flex justify-center'}`}>
          {sidebarOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">
                    {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-surface-200 truncate">
                    {profile?.full_name || profile?.email}
                  </p>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${roleColors[roleName] || roleColors.viewer}`}>
                    {roleLabel[roleName] || roleName}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut size={14} />
                Keluar
              </button>
            </div>
          ) : (
            <button onClick={handleSignOut} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-surface-900/80 backdrop-blur border-b border-surface-800 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-surface-100">
              {filteredNav.find(n => location.pathname.startsWith(n.path))?.label || 'ManageStuff'}
            </h1>
            <p className="text-xs text-surface-500">Sistem Manajemen Inspeksi Barang</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded-lg transition-colors relative">
              <Bell size={16} />
            </button>
            <div className="w-px h-6 bg-surface-700" />
            <div className="text-right">
              <p className="text-xs text-surface-300 font-medium">{profile?.full_name || profile?.email}</p>
              <p className="text-[10px] text-surface-500">{roleLabel[roleName]}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
