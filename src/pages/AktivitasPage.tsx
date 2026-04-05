import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Activity, LogIn, LogOut, Edit, Eye, Trash2, Plus, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react'
import { supabase, UserActivity } from '../lib/supabase'

const PAGE_SIZE = 30

const ACTION_CONFIG: Record<string, { label: string; color: string; Icon: typeof Activity }> = {
  login: { label: 'Login', color: 'text-green-400 bg-green-900/20 border-green-800/50', Icon: LogIn },
  logout: { label: 'Logout', color: 'text-red-400 bg-red-900/20 border-red-800/50', Icon: LogOut },
  create: { label: 'Buat', color: 'text-blue-400 bg-blue-900/20 border-blue-800/50', Icon: Plus },
  update: { label: 'Edit', color: 'text-amber-400 bg-amber-900/20 border-amber-800/50', Icon: Edit },
  delete: { label: 'Hapus', color: 'text-red-400 bg-red-900/20 border-red-800/50', Icon: Trash2 },
  view: { label: 'Lihat', color: 'text-surface-400 bg-surface-800 border-surface-700', Icon: Eye },
}

export default function AktivitasPage() {
  const [data, setData] = useState<UserActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterAction, setFilterAction] = useState('')
  const [filterUser, setFilterUser] = useState('')

  useEffect(() => { fetchData() }, [page, filterAction, filterUser])

  const fetchData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('user_activities')
        .select(`
          *,
          profiles(full_name, email)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filterAction) query = query.eq('action', filterAction)

      const { data: rows, count } = await query
      setData(rows as UserActivity[] || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Summary counts
  const summaryCounts = Object.keys(ACTION_CONFIG).reduce((acc, key) => {
    acc[key] = data.filter(d => d.action === key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-white">Log Aktivitas</h2>
          <p className="text-surface-400 text-sm mt-0.5">
            <span className="font-mono text-brand-400">{total}</span> aktivitas tercatat
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(ACTION_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.Icon
          return (
            <button
              key={key}
              onClick={() => { setFilterAction(filterAction === key ? '' : key); setPage(1) }}
              className={`card p-3 text-left transition-all ${filterAction === key ? 'border-brand-600' : 'hover:border-surface-600'}`}
            >
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border mb-2 ${cfg.color}`}>
                <Icon size={10} />{cfg.label}
              </div>
              <p className="text-xl font-bold font-display text-white">{summaryCounts[key] || 0}</p>
              <p className="text-[10px] text-surface-500">di halaman ini</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-surface-400" />
            <span className="text-xs text-surface-400">Filter:</span>
          </div>
          <select
            className="input w-auto text-xs py-1.5"
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          >
            <option value="">Semua Aksi</option>
            {Object.entries(ACTION_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {(filterAction) && (
            <button onClick={() => { setFilterAction(''); setPage(1) }} className="text-xs text-brand-400 hover:text-brand-300">
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-900/50">
                  {['Waktu', 'User', 'Aksi', 'Target', 'Deskripsi'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Activity size={32} className="text-surface-600 mx-auto mb-3" />
                      <p className="text-surface-400 text-sm">Tidak ada aktivitas</p>
                    </td>
                  </tr>
                ) : data.map(row => {
                  const cfg = ACTION_CONFIG[row.action] || ACTION_CONFIG.view
                  const Icon = cfg.Icon
                  const profile = row.profiles as { full_name?: string; email?: string } | undefined
                  return (
                    <tr key={row.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="text-xs text-surface-300">
                          {format(new Date(row.created_at), 'dd MMM yyyy', { locale: id })}
                        </div>
                        <div className="text-[10px] font-mono text-surface-500">
                          {format(new Date(row.created_at), 'HH:mm:ss')}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-brand-300">
                              {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-surface-200 font-medium truncate max-w-[120px]">
                              {profile?.full_name || 'Unknown'}
                            </p>
                            <p className="text-[10px] text-surface-500 truncate max-w-[120px]">
                              {profile?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cfg.color}`}>
                          <Icon size={10} />{cfg.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {row.target_table ? (
                          <div>
                            <span className="text-xs font-mono text-surface-400">{row.target_table}</span>
                            {row.target_id && (
                              <p className="text-[10px] font-mono text-surface-600 truncate max-w-[100px]">
                                {row.target_id.substring(0, 8)}...
                              </p>
                            )}
                          </div>
                        ) : <span className="text-surface-600 text-xs">—</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-xs text-surface-400 truncate max-w-[200px] block">
                          {row.description || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
            <p className="text-xs text-surface-400">
              Hlm {page} dari {totalPages} — {total} total
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 disabled:opacity-40 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-mono text-surface-300">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 disabled:opacity-40 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
