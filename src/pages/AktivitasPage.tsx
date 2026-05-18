import { useEffect, useRef, useState } from 'react'
import { format, startOfMonth, endOfMonth, subDays, isWithinInterval, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import {
  Activity, LogIn, LogOut, Edit, Eye, Trash2, Plus,
  ChevronLeft, ChevronRight, RefreshCw, Search, Calendar, X, Check
} from 'lucide-react'
import { supabase, UserActivity } from '../lib/supabase'

const PAGE_SIZE = 30

const ACTION_CONFIG: Record<string, {
  label: string
  pillBg: string
  pillBorder: string
  textColor: string
  Icon: typeof Activity
}> = {
  login:  { label: 'Log in',  pillBg: 'bg-emerald-100', pillBorder: 'outline-gray-300', textColor: 'text-green-600',  Icon: LogIn   },
  logout: { label: 'Log Out', pillBg: 'bg-red-200',     pillBorder: 'outline-gray-300', textColor: 'text-red-600',    Icon: LogOut  },
  create: { label: 'Buat',    pillBg: 'bg-blue-100',    pillBorder: 'outline-gray-300', textColor: 'text-blue-600',   Icon: Plus    },
  update: { label: 'Edit',    pillBg: 'bg-yellow-100',  pillBorder: 'outline-gray-300', textColor: 'text-amber-500',  Icon: Edit    },
  delete: { label: 'Hapus',   pillBg: 'bg-red-200',     pillBorder: 'outline-gray-300', textColor: 'text-red-600',    Icon: Trash2  },
  view:   { label: 'Lihat',   pillBg: 'bg-gray-100',    pillBorder: 'outline-gray-300', textColor: 'text-gray-500',   Icon: Eye     },
}

const SUMMARY_KEYS: { key: string; label: string }[] = [
  { key: '',       label: 'Semua Aksi' },
  { key: 'login',  label: 'Login'      },
  { key: 'update', label: 'Edit'       },
  { key: 'logout', label: 'Logout'     },
  { key: 'view',   label: 'Lihat'      },
  { key: 'create', label: 'Buat'       },
  { key: 'delete', label: 'Hapus'      },
]

// ─── Date Range Types ──────────────────────────────────────────────────────────

type DatePreset = 'last7' | 'last30' | 'thisMonth' | 'custom'

interface DateRange {
  from: Date
  to: Date
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'last7',     label: '7 hari terakhir'  },
  { key: 'last30',    label: '30 hari terakhir' },
  { key: 'thisMonth', label: 'Bulan ini'         },
  { key: 'custom',    label: 'Kustom'            },
]

function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date()
  switch (preset) {
    case 'last7':     return { from: subDays(now, 6),        to: now }
    case 'last30':    return { from: subDays(now, 29),       to: now }
    case 'thisMonth': return { from: startOfMonth(now),      to: endOfMonth(now) }
    default:          return { from: subDays(now, 6),        to: now }
  }
}

// ─── DateRangePicker Component ─────────────────────────────────────────────────

interface DateRangePickerProps {
  value: DateRange
  preset: DatePreset
  onChange: (range: DateRange, preset: DatePreset) => void
}

function DateRangePicker({ value, preset, onChange }: DateRangePickerProps) {
  const [open, setOpen]               = useState(false)
  const [localPreset, setLocalPreset] = useState<DatePreset>(preset)
  const [localRange, setLocalRange]   = useState<DateRange>(value)
  const [customFrom, setCustomFrom]   = useState(format(value.from, 'yyyy-MM-dd'))
  const [customTo, setCustomTo]       = useState(format(value.to,   'yyyy-MM-dd'))
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePresetClick = (key: DatePreset) => {
    setLocalPreset(key)
    if (key !== 'custom') {
      const range = getPresetRange(key)
      setLocalRange(range)
      setCustomFrom(format(range.from, 'yyyy-MM-dd'))
      setCustomTo(format(range.to,   'yyyy-MM-dd'))
    }
  }

  const handleApply = () => {
    let finalRange = localRange
    if (localPreset === 'custom') {
      finalRange = {
        from: new Date(customFrom),
        to:   new Date(customTo),
      }
    }
    onChange(finalRange, localPreset)
    setOpen(false)
  }

  const handleReset = () => {
    const defaultRange = getPresetRange('last7')
    setLocalPreset('last7')
    setLocalRange(defaultRange)
    setCustomFrom(format(defaultRange.from, 'yyyy-MM-dd'))
    setCustomTo(format(defaultRange.to,   'yyyy-MM-dd'))
    onChange(defaultRange, 'last7')
    setOpen(false)
  }

  const displayLabel = preset === 'custom'
      ? `${format(value.from, 'dd MMM yyyy', { locale: id })} — ${format(value.to, 'dd MMM yyyy', { locale: id })}`
      : `${format(value.from, 'dd MMM yyyy', { locale: id })} — ${format(value.to, 'dd MMM yyyy', { locale: id })}`

  return (
      <div ref={ref} className="relative shrink-0">
        {/* Trigger */}
        <button
            onClick={() => setOpen(v => !v)}
            className={`p-2 bg-slate-100 rounded-lg border flex items-center gap-1.5 cursor-pointer select-none transition-colors ${
                open ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
            }`}
        >
          <Calendar size={16} className="text-blue-900 shrink-0" />
          <span className="text-base font-semibold text-blue-900 whitespace-nowrap">
          {displayLabel}
        </span>
          <ChevronRight
              size={18}
              className={`text-blue-900 shrink-0 transition-transform duration-200 ${open ? 'rotate-[270deg]' : 'rotate-90'}`}
          />
        </button>

        {/* Dropdown */}
        {open && (
            <div className="absolute top-full left-0 mt-1.5 z-50 w-72 bg-white rounded-xl border border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.14)] overflow-hidden">

              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Filter Tanggal</span>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Presets */}
              <div className="p-3 flex flex-col gap-1 border-b border-gray-100">
                {PRESETS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => handlePresetClick(key)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                            localPreset === key
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {label}
                      {localPreset === key && <Check size={14} className="text-blue-600" />}
                    </button>
                ))}
              </div>

              {/* Custom date inputs */}
              {localPreset === 'custom' && (
                  <div className="p-3 border-b border-gray-100 flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dari</label>
                      <input
                          type="date"
                          value={customFrom}
                          max={customTo}
                          onChange={e => setCustomFrom(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-gray-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sampai</label>
                      <input
                          type="date"
                          value={customTo}
                          min={customFrom}
                          onChange={e => setCustomTo(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-gray-700"
                      />
                    </div>
                  </div>
              )}

              {/* Preview */}
              {localPreset !== 'custom' && (
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs text-gray-500">
                      {format(localRange.from, 'dd MMM yyyy', { locale: id })}
                      {' '}&ndash;{' '}
                      {format(localRange.to, 'dd MMM yyyy', { locale: id })}
                    </p>
                  </div>
              )}

              {/* Actions */}
              <div className="p-3 flex items-center gap-2">
                <button
                    onClick={handleReset}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Reset
                </button>
                <button
                    onClick={handleApply}
                    className="flex-1 px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Terapkan
                </button>
              </div>
            </div>
        )}
      </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AktivitasPage() {
  const today       = new Date()
  const defaultFrom = subDays(today, 6)

  const [data, setData]               = useState<UserActivity[]>([])
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [total, setTotal]             = useState(0)
  const [filterAction, setFilterAction] = useState('')
  const [filterTarget, setFilterTarget] = useState('')
  const [filterUser, setFilterUser]   = useState('')
  const [searchDesc, setSearchDesc]   = useState('')
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({})

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>({ from: defaultFrom, to: today })
  const [datePreset, setDatePreset] = useState<DatePreset>('last7')

  useEffect(() => { fetchData() }, [page, filterAction, filterUser, dateRange])
  useEffect(() => { fetchCounts() }, [dateRange])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Set time bounds: start of `from` day → end of `to` day
      const fromISO = new Date(dateRange.from); fromISO.setHours(0, 0, 0, 0)
      const toISO   = new Date(dateRange.to);   toISO.setHours(23, 59, 59, 999)

      let query = supabase
          .from('user_activities')
          .select(`*, profiles(full_name, email)`, { count: 'exact' })
          .order('created_at', { ascending: false })
          .gte('created_at', fromISO.toISOString())
          .lte('created_at', toISO.toISOString())
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filterAction) query = query.eq('action', filterAction)

      const { data: rows, count } = await query
      setData(rows as UserActivity[] || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }

  const fetchCounts = async () => {
    const fromISO = new Date(dateRange.from); fromISO.setHours(0, 0, 0, 0)
    const toISO   = new Date(dateRange.to);   toISO.setHours(23, 59, 59, 999)

    const { data: rows } = await supabase
        .from('user_activities')
        .select('action')
        .gte('created_at', fromISO.toISOString())
        .lte('created_at', toISO.toISOString())

    if (!rows) return
    const counts: Record<string, number> = {}
    rows.forEach(r => { counts[r.action] = (counts[r.action] || 0) + 1 })
    setActionCounts(counts)
  }

  const handleDateChange = (range: DateRange, preset: DatePreset) => {
    setDateRange(range)
    setDatePreset(preset)
    setPage(1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const totalAll   = Object.values(actionCounts).reduce((a, b) => a + b, 0)

  return (
      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap justify-between items-end gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xl font-bold text-gray-600 drop-shadow-sm">Log Aktifitas</span>
            <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base font-semibold text-gray-600 drop-shadow-sm">
              {total.toLocaleString('id-ID')}
            </span>
              <span className="text-base font-normal text-gray-600 drop-shadow-sm">Aktifitas tercatat</span>
            </div>
          </div>

          <button
              onClick={() => { fetchData(); fetchCounts() }}
              className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors shrink-0"
          >
            <RefreshCw size={18} className="text-blue-900 shrink-0" />
            <span className="text-base font-semibold text-blue-900">Refresh</span>
          </button>
        </div>

        {/* ── Filters + Summary Bar ── */}
        <div className="p-3 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-4">

          {/* Filter dropdowns row */}
          <div className="flex flex-wrap items-center gap-1.5">

            {/* ── Date Range Picker (now functional) ── */}
            <DateRangePicker
                value={dateRange}
                preset={datePreset}
                onChange={handleDateChange}
            />

            {/* Target filter */}
            <div className="flex-1 min-w-[130px] p-2 bg-slate-100 rounded-lg border border-gray-300 flex items-center gap-1.5">
              <select
                  className="flex-1 min-w-0 bg-transparent text-base font-semibold text-blue-900 outline-none cursor-pointer"
                  value={filterTarget}
                  onChange={e => { setFilterTarget(e.target.value); setPage(1) }}
              >
                <option value="">Semua Target</option>
                <option value="inspeksi_barang_v3">Inspeksi_Barang_v3</option>
                <option value="user_activities">User Activities</option>
              </select>
            </div>

            {/* Action filter */}
            <div className="flex-1 min-w-[120px] p-2 bg-slate-100 rounded-lg border border-gray-300 flex items-center gap-1.5">
              <select
                  className="flex-1 min-w-0 bg-transparent text-base font-semibold text-blue-900 outline-none cursor-pointer"
                  value={filterAction}
                  onChange={e => { setFilterAction(e.target.value); setPage(1) }}
              >
                <option value="">Semua Aksi</option>
                {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* User filter */}
            <div className="flex-1 min-w-[120px] p-2 bg-slate-100 rounded-lg border border-gray-300 flex items-center gap-1.5">
              <select
                  className="flex-1 min-w-0 bg-transparent text-base font-semibold text-blue-900 outline-none cursor-pointer"
                  value={filterUser}
                  onChange={e => { setFilterUser(e.target.value); setPage(1) }}
              >
                <option value="">Semua User</option>
              </select>
            </div>

            {/* Description search */}
            <div className="flex-1 min-w-[150px] px-4 py-2 bg-slate-100 rounded-lg border border-gray-300 flex items-center gap-1.5">
              <input
                  className="flex-1 min-w-0 bg-transparent text-base text-gray-400 placeholder-gray-400 outline-none"
                  placeholder="Cari deskripsi"
                  value={searchDesc}
                  onChange={e => setSearchDesc(e.target.value)}
              />
              <Search size={20} className="text-gray-400 shrink-0" />
            </div>
          </div>

          {/* Summary counts bar */}
          <div className="bg-slate-100 rounded-lg flex flex-wrap">
            {SUMMARY_KEYS.map(({ key, label }, i) => {
              const count  = key === '' ? totalAll : (actionCounts[key] || 0)
              const isLast = i === SUMMARY_KEYS.length - 1
              return (
                  <button
                      key={key}
                      onClick={() => { setFilterAction(key); setPage(1) }}
                      className={`p-4 flex flex-col justify-center items-start gap-0.5 ${filterAction === key ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <div className={`flex items-center gap-2.5 pr-4 ${!isLast ? 'border-r border-gray-300' : ''}`}>
                  <span className={`text-base font-medium whitespace-nowrap ${filterAction === key ? 'text-blue-900 font-semibold' : 'text-gray-500'}`}>
                    {label}
                  </span>
                      <span className={`text-base font-semibold ${filterAction === key ? 'text-blue-900' : 'text-gray-500'}`}>
                    {count}
                  </span>
                    </div>
                  </button>
              )
            })}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex flex-col shadow-[0px_2px_2px_0px_rgba(0,0,0,0.12)]">

          {/* Column Headers */}
          <div className="h-16 px-4 bg-slate-100 rounded-tl-lg rounded-tr-lg border border-gray-300 flex items-center gap-2">
            <div className="flex-[2] min-w-[110px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">WAKTU</span>
            </div>
            <div className="flex-[2] min-w-[100px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">USER</span>
            </div>
            <div className="flex-[1.5] min-w-[80px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">AKSI</span>
            </div>
            <div className="flex-[2] min-w-[90px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">TARGET</span>
            </div>
            <div className="flex-[3] min-w-[120px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">DESKRIPSI</span>
            </div>
          </div>

          {/* Rows */}
          {loading ? (
              <div className="flex justify-center items-center py-16 bg-slate-100 border-l border-r border-b border-gray-300">
                <div className="w-7 h-7 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
              </div>
          ) : data.length === 0 ? (
              <div className="py-12 text-center bg-slate-100 border-l border-r border-b border-gray-300">
                <Activity size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Tidak ada aktivitas</p>
              </div>
          ) : data
              .filter(row =>
                  (!searchDesc || row.description?.toLowerCase().includes(searchDesc.toLowerCase())) &&
                  (!filterTarget || row.target_table === filterTarget)
              )
              .map(row => {
                const cfg     = ACTION_CONFIG[row.action] || ACTION_CONFIG.view
                const profile = row.profiles as { full_name?: string; email?: string } | undefined
                return (
                    <div
                        key={row.id}
                        className="h-14 px-4 bg-slate-100 border-l border-r border-b border-gray-300 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      {/* WAKTU */}
                      <div className="flex-[2] min-w-[110px] min-w-0 flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-600 shrink-0">
                    {format(new Date(row.created_at), 'dd MMM yyyy', { locale: id })}
                  </span>
                        <span className="text-sm font-normal text-gray-600 shrink-0">
                    {format(new Date(row.created_at), 'HH:mm')}
                  </span>
                      </div>

                      {/* USER */}
                      <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
                  <span className="text-sm font-semibold text-gray-600 truncate">
                    {profile?.email || profile?.full_name || 'Unknown'}
                  </span>
                      </div>

                      {/* AKSI badge */}
                      <div className="flex-[1.5] min-w-[80px] min-w-0 flex items-center">
                        <div
                            className={`h-6 px-1.5 py-0.5 ${cfg.pillBg} rounded-full shadow-[2px_2px_10px_0px_rgba(0,0,0,0.20)] outline outline-[0.50px] outline-offset-[-0.50px] ${cfg.pillBorder} inline-flex items-center gap-0.5 shrink-0`}
                        >
                          <cfg.Icon size={12} className={cfg.textColor} />
                          <span className={`text-xs font-medium ${cfg.textColor} whitespace-nowrap`}>{cfg.label}</span>
                        </div>
                      </div>

                      {/* TARGET */}
                      <div className="flex-[2] min-w-[90px] min-w-0 flex items-center">
                  <span className="text-sm font-normal text-gray-600 truncate">
                    {row.target_table || '-'}
                  </span>
                      </div>

                      {/* DESKRIPSI */}
                      <div className="flex-[3] min-w-[120px] min-w-0 flex items-center">
                  <span className="text-sm font-semibold text-gray-600 truncate">
                    {row.description || '-'}
                  </span>
                      </div>
                    </div>
                )
              })}

          {/* Pagination Footer */}
          <div className="h-16 px-4 bg-slate-100 rounded-bl-lg rounded-br-lg border border-t-0 border-gray-300 flex justify-between items-center gap-2">
          <span className="text-base font-medium text-gray-600 truncate min-w-0">
            Menampilkan {Math.min((page - 1) * PAGE_SIZE + 1, total)} – {Math.min(page * PAGE_SIZE, total)} dari {total.toLocaleString('id-ID')} aktifitas
          </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 p-1.5 flex items-center justify-center disabled:opacity-40"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(4, totalPages) }, (_, i) => i + 1).map(p => (
                    <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`p-1.5 rounded-md w-8 h-8 text-base font-medium text-center transition-colors ${
                            page === p
                                ? 'bg-blue-200 border border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {p}
                    </button>
                ))}
              </div>
              <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="w-8 h-8 p-1.5 flex items-center justify-center disabled:opacity-40"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
  )
}