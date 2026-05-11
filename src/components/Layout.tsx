import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Users, Activity,
  LogOut, Menu, X, ChevronRight, Shield, Bell, SendIcon
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import logo from '../assets/logo.svg'
import { APP_VERSION } from '../utils/AppVersion'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/data', label: 'Data Inspeksi', icon: Package },
  { path: '/beacukai', label: 'Pengiriman Beacukai', icon: SendIcon},
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
    <div className="h-screen w-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} py-6 flex flex-col bg-[#F5F7FA] border-r border-subtle shrink-0`}>
        {/* Logo */}
        <div className="h-22 flex items-center gap-3 px-5 border-b border-subtle">
          {sidebarOpen && (
            <img src={logo} alt="Logo" className="w-full h-full object-contain pb-4" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const active = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-secondary text-light-normal-gray'
                    : 'text-dark-gray hover:text-light-normal-gray hover:bg-secondary/70'
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
        <div className={`p-3 border-t border-subtle ${sidebarOpen ? '' : 'flex justify-center'}`}>
          {sidebarOpen ? (
            <div className="space-y-2">
              <button
                onClick={handleSignOut}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-error/80 hover:text-red-400 hover:bg-error/10 transition-colors"
              >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                  />
                </svg>
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
      <div className="flex-1 flex flex-col h-full w-[calc(100%-15rem)] overflow-hidden">
        {/* Topbar */}
        <header className="h-28 w-full py-6 px-8 box-border flex flex-row justify-between items-center bg-[#F5F7FA] border-b border-[#D1D5DB]">
          <div className={"flex flex-col gap-1"}>
            <h1 className="not-italic font-bold text-[24px] leading-9 text-secondary flex-none order-0 grow-0">
              {filteredNav.find(n => location.pathname.startsWith(n.path))?.label || 'ManageStuff'}
            </h1>
            <p className="not-italic font-normal text-[16px] leading-5.5 text-secondary flex-none order-0 grow-0">Sistem Manajemen Inspeksi Barang</p>
          </div>
          <div className="flex flex-row gap-8">
            <div className={`flex flex-col justify-center items-end border-r-2 border-secondary pr-4`}>
              <div className={`flex flex-row justify-center gap-2 items-center `}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="not-italic font-medium text-[16px] leading-5.5 text-secondary flex-none order-0 grow-0">
                    Online
                  </span>
              </div>
              <span className="not-italic font-normal text-[12px] leading-5.5 text-secondary flex-none order-0 grow-0">
                  V.{APP_VERSION}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-300 font-medium">{profile?.full_name || profile?.email}</p>
              <p className="text-[10px] text-surface-500">{roleLabel[roleName]}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 flex w-full h-[calc(100%-112px)] overflow-hidden bg-[#F2F2F2]">
          <div className="flex-1 overflow-y-auto rounded-lg pb-2">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
