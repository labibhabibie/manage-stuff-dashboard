import { useEffect, useState } from 'react'
import {
  Users, Plus, Edit2, Shield, Check, X, Loader2,
  AlertCircle, UserCheck, UserX, Mail, RefreshCw, Key
} from 'lucide-react'
import { supabase, Profile, Role, logActivity } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

type ModalMode = 'create' | 'edit' | null

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode>(null)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { user: currentUser, isSuperAdmin } = useAuth()

  const [form, setForm] = useState({
    email: '', full_name: '', password: '', role_id: '', is_active: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: usersData }, { data: rolesData }] = await Promise.all([
      supabase.from('profiles').select('*, roles(*)').order('created_at', { ascending: false }),
      supabase.from('roles').select('*').order('name')
    ])
    setUsers(usersData as Profile[] || [])
    setRoles(rolesData as Role[] || [])
    setLoading(false)
  }

  const openCreate = () => {
    setForm({ email: '', full_name: '', password: '', role_id: roles[0]?.id || '', is_active: true })
    setError('')
    setModal('create')
  }

  const openEdit = (u: Profile) => {
    setSelectedUser(u)
    setForm({ email: u.email, full_name: u.full_name || '', password: '', role_id: u.role_id || '', is_active: u.is_active })
    setError('')
    setModal('edit')
  }

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.role_id) {
      setError('Email, password, dan role wajib diisi'); return
    }
    setSaving(true); setError('')
    try {
      // Create user via Supabase Admin (needs service role in production)
      // For now, use signUp flow
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
        user_metadata: { full_name: form.full_name }
      })

      if (authError) {
        // Fallback: try regular signup (limited to admin use)
        setError(authError.message)
        setSaving(false)
        return
      }

      if (authData.user) {
        await supabase.from('profiles').update({
          full_name: form.full_name,
          role_id: form.role_id,
          is_active: form.is_active
        }).eq('id', authData.user.id)

        if (currentUser) {
          await logActivity(currentUser.id, 'create', {
            targetTable: 'profiles',
            targetId: authData.user.id,
            description: `Membuat user baru: ${form.email}`
          })
        }
        setSuccess(`User ${form.email} berhasil dibuat`)
        setTimeout(() => setSuccess(''), 3000)
        setModal(null)
        fetchData()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    }
    setSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedUser || !form.role_id) { setError('Role wajib dipilih'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('profiles').update({
      full_name: form.full_name,
      role_id: form.role_id,
      is_active: form.is_active
    }).eq('id', selectedUser.id)

    if (err) { setError(err.message); setSaving(false); return }

    if (currentUser) {
      await logActivity(currentUser.id, 'update', {
        targetTable: 'profiles',
        targetId: selectedUser.id,
        description: `Update user: ${selectedUser.email}`
      })
    }
    setSuccess(`User ${selectedUser.email} berhasil diperbarui`)
    setTimeout(() => setSuccess(''), 3000)
    setModal(null)
    fetchData()
    setSaving(false)
  }

  const toggleActive = async (u: Profile) => {
    await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id)
    if (currentUser) {
      await logActivity(currentUser.id, 'update', {
        targetTable: 'profiles',
        targetId: u.id,
        description: `${u.is_active ? 'Nonaktifkan' : 'Aktifkan'} user: ${u.email}`
      })
    }
    fetchData()
  }

  const roleColors: Record<string, string> = {
    super_admin: 'text-amber-400 bg-amber-900/30 border-amber-800',
    admin: 'text-brand-400 bg-brand-900/30 border-brand-800',
    operator: 'text-blue-400 bg-blue-900/30 border-blue-800',
    viewer: 'text-surface-400 bg-surface-800 border-surface-700',
  }

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin', admin: 'Admin', operator: 'Operator', viewer: 'Viewer'
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-white">Manajemen User</h2>
          <p className="text-surface-400 text-sm mt-0.5">
            <span className="font-mono text-brand-400">{users.length}</span> pengguna terdaftar
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary"><RefreshCw size={14} /></button>
          {isSuperAdmin && (
            <button onClick={openCreate} className="btn-primary">
              <Plus size={14} />Tambah User
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded-lg text-green-300 text-sm">
          <Check size={15} />{success}
        </div>
      )}

      {/* User list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-900/50">
                {['Pengguna', 'Role', 'Status', 'Bergabung', 'Aksi'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/50">
              {users.map(u => {
                const rName = (u.roles as { name?: string })?.name || ''
                const isCurrentUser = u.id === currentUser?.id
                return (
                  <tr key={u.id} className={`hover:bg-surface-800/30 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isCurrentUser ? 'bg-brand-700 ring-2 ring-brand-500' : 'bg-surface-700'
                        }`}>
                          <span className="text-xs font-bold text-white">
                            {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-100">
                            {u.full_name || <span className="italic text-surface-500">Tanpa nama</span>}
                            {isCurrentUser && <span className="ml-1.5 text-[10px] text-brand-400">(Anda)</span>}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-surface-500">
                            <Mail size={10} />{u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${roleColors[rName] || roleColors.viewer}`}>
                        <Shield size={10} />{roleLabels[rName] || rName || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <UserCheck size={13} />Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <UserX size={13} />Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-surface-400">
                        {format(new Date(u.created_at), 'dd MMM yyyy', { locale: id })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {!isCurrentUser && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(u)} className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => toggleActive(u)}
                            className={`p-1.5 rounded-lg transition-colors ${u.is_active
                              ? 'text-red-400 hover:bg-red-900/20'
                              : 'text-green-400 hover:bg-green-900/20'}`}>
                            {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-white">
                {modal === 'create' ? 'Tambah User Baru' : `Edit User`}
              </h3>
              <button onClick={() => setModal(null)} className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Nama Lengkap</label>
                <input type="text" className="input" placeholder="John Doe"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email {modal === 'edit' && <span className="text-surface-600">(tidak dapat diubah)</span>}</label>
                <input type="email" className="input" placeholder="email@domain.com"
                  value={form.email} disabled={modal === 'edit'}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              {modal === 'create' && (
                <div>
                  <label className="label flex items-center gap-1"><Key size={10} />Password</label>
                  <input type="password" className="input" placeholder="Min. 8 karakter"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role_id}
                  onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
                  <option value="">Pilih role...</option>
                  {roles
                    .filter(r => isSuperAdmin ? true : r.name !== 'super_admin')
                    .map(r => (
                      <option key={r.id} value={r.id}>{roleLabels[r.name] || r.name}</option>
                    ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <div className="w-10 h-5 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-surface-300">User Aktif</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-xs">
                <AlertCircle size={13} />{error}
              </div>
            )}

            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="btn-secondary">Batal</button>
              <button
                onClick={modal === 'create' ? handleCreate : handleEdit}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {modal === 'create' ? 'Buat User' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
