import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Calendar, ChevronDown, ChevronLeft, ChevronRight, Check, Clock, RefreshCw, Search, X } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase } from '../lib/supabase'

type Submission = {
    id: string
    nomor_aju: string
    nomor_blawb: string
    tanggal_blawb: string
    kode_kantor: string
    total_foto: number
    created_at: string
    updated_at: string
}

const PAGE_SIZE = 10

// ─── Date Range Picker (reused pattern) ──────────────────────────────────────

type DatePreset = 'last7' | 'last30' | 'thisMonth' | 'custom' | 'all'

interface DateRange { from: Date; to: Date }

const PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'all',       label: 'Semua tanggal'    },
    { key: 'last7',     label: '7 hari terakhir'  },
    { key: 'last30',    label: '30 hari terakhir' },
    { key: 'thisMonth', label: 'Bulan ini'         },
    { key: 'custom',    label: 'Kustom'            },
]

function getPresetRange(preset: DatePreset): DateRange | null {
    const now = new Date()
    switch (preset) {
        case 'last7':     return { from: subDays(now, 6),   to: now }
        case 'last30':    return { from: subDays(now, 29),  to: now }
        case 'thisMonth': return { from: startOfMonth(now), to: endOfMonth(now) }
        default:          return null
    }
}

interface DateFilterProps {
    label: string
    value: DateRange | null
    preset: DatePreset
    onChange: (range: DateRange | null, preset: DatePreset) => void
}

function DateFilter({ label, value, preset, onChange }: DateFilterProps) {
    const [open, setOpen]               = useState(false)
    const [localPreset, setLocalPreset] = useState<DatePreset>(preset)
    const [customFrom, setCustomFrom]   = useState(value ? format(value.from, 'yyyy-MM-dd') : '')
    const [customTo, setCustomTo]       = useState(value ? format(value.to,   'yyyy-MM-dd') : '')
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handlePresetClick = (key: DatePreset) => {
        setLocalPreset(key)
        if (key !== 'custom' && key !== 'all') {
            const range = getPresetRange(key)
            if (range) {
                setCustomFrom(format(range.from, 'yyyy-MM-dd'))
                setCustomTo(format(range.to, 'yyyy-MM-dd'))
            }
        }
    }

    const handleApply = () => {
        if (localPreset === 'all') {
            onChange(null, 'all')
        } else if (localPreset === 'custom') {
            if (customFrom && customTo) onChange({ from: new Date(customFrom), to: new Date(customTo) }, 'custom')
        } else {
            onChange(getPresetRange(localPreset), localPreset)
        }
        setOpen(false)
    }

    const handleReset = () => {
        setLocalPreset('all')
        onChange(null, 'all')
        setOpen(false)
    }

    const isActive = preset !== 'all'

    const displayLabel = !value
        ? label
        : preset === 'last7'     ? '7 hari terakhir'
            : preset === 'last30'    ? '30 hari terakhir'
                : preset === 'thisMonth' ? 'Bulan ini'
                    : `${format(value.from, 'dd MMM yyyy', { locale: id })} — ${format(value.to, 'dd MMM yyyy', { locale: id })}`

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                onClick={() => setOpen(v => !v)}
                className={`p-2 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    isActive
                        ? 'bg-blue-50 border-blue-400 text-blue-900'
                        : open
                            ? 'bg-blue-50 border-blue-400'
                            : 'bg-slate-100 border-gray-300 hover:bg-gray-50'
                }`}
            >
                <Calendar size={15} className={isActive ? 'text-blue-700 shrink-0' : 'text-blue-900 shrink-0'} />
                <span className={`text-base font-semibold whitespace-nowrap ${isActive ? 'text-blue-700' : 'text-blue-900'}`}>
          {displayLabel}
        </span>
                {isActive ? (
                    <span
                        onClick={(e) => { e.stopPropagation(); onChange(null, 'all'); setLocalPreset('all') }}
                        className="ml-0.5 text-blue-400 hover:text-blue-700 transition-colors"
                    >
            <X size={14} />
          </span>
                ) : (
                    <ChevronDown
                        size={15}
                        className={`text-blue-900 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    />
                )}
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-1.5 z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.14)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">{label}</span>
                        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={15} />
                        </button>
                    </div>

                    <div className="p-3 flex flex-col gap-1 border-b border-gray-100">
                        {PRESETS.map(({ key, label: pLabel }) => (
                            <button
                                key={key}
                                onClick={() => handlePresetClick(key)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                                    localPreset === key ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {pLabel}
                                {localPreset === key && <Check size={14} className="text-blue-600" />}
                            </button>
                        ))}
                    </div>

                    {localPreset === 'custom' && (
                        <div className="p-3 border-b border-gray-100 flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dari</label>
                                <input type="date" value={customFrom} max={customTo}
                                       onChange={e => setCustomFrom(e.target.value)}
                                       className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-gray-700"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sampai</label>
                                <input type="date" value={customTo} min={customFrom}
                                       onChange={e => setCustomTo(e.target.value)}
                                       className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-gray-700"
                                />
                            </div>
                        </div>
                    )}

                    {localPreset !== 'custom' && localPreset !== 'all' && (
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            {(() => { const r = getPresetRange(localPreset); return r ? (
                                <p className="text-xs text-gray-500">
                                    {format(r.from, 'dd MMM yyyy', { locale: id })} &ndash; {format(r.to, 'dd MMM yyyy', { locale: id })}
                                </p>
                            ) : null })()}
                        </div>
                    )}

                    <div className="p-3 flex items-center gap-2">
                        <button onClick={handleReset}
                                className="flex-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            Reset
                        </button>
                        <button onClick={handleApply}
                                className="flex-1 px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                            Terapkan
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function XraySubmissionsWidget() {
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading]         = useState(true)
    const [totalFoto, setTotalFoto]     = useState(0)
    const [page, setPage]               = useState(1)
    const [total, setTotal]             = useState(0)

    // ── Filters ──
    const [searchAju,   setSearchAju]   = useState('')
    const [searchBlawb, setSearchBlawb] = useState('')

    const [tanggalRange,  setTanggalRange]  = useState<DateRange | null>(null)
    const [tanggalPreset, setTanggalPreset] = useState<DatePreset>('all')

    const [waktuRange,  setWaktuRange]  = useState<DateRange | null>(null)
    const [waktuPreset, setWaktuPreset] = useState<DatePreset>('all')

    // Refetch whenever filters or page change
    useEffect(() => { fetchSubmissions() }, [page, searchAju, searchBlawb, tanggalRange, waktuRange])

    const fetchSubmissions = async () => {
        setLoading(true)

        let query = supabase
            .from('beacukai_xray_submissions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })

        // No. AJU search
        if (searchAju.trim())   query = query.ilike('nomor_aju',   `%${searchAju.trim()}%`)
        // BL/AWB search
        if (searchBlawb.trim()) query = query.ilike('nomor_blawb', `%${searchBlawb.trim()}%`)

        // Tanggal AWB range
        if (tanggalRange) {
            const from = new Date(tanggalRange.from); from.setHours(0, 0, 0, 0)
            const to   = new Date(tanggalRange.to);   to.setHours(23, 59, 59, 999)
            query = query.gte('tanggal_blawb', from.toISOString().split('T')[0])
                .lte('tanggal_blawb', to.toISOString().split('T')[0])
        }

        // Waktu Masuk (created_at) range
        if (waktuRange) {
            const from = new Date(waktuRange.from); from.setHours(0, 0, 0, 0)
            const to   = new Date(waktuRange.to);   to.setHours(23, 59, 59, 999)
            query = query.gte('created_at', from.toISOString())
                .lte('created_at', to.toISOString())
        }

        const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

        setSubmissions(data || [])
        setTotal(count || 0)
        setTotalFoto((data || []).reduce((sum, s) => sum + (s.total_foto || 0), 0))
        setLoading(false)
    }

    const handleReset = () => {
        setSearchAju('')
        setSearchBlawb('')
        setTanggalRange(null);  setTanggalPreset('all')
        setWaktuRange(null);    setWaktuPreset('all')
        setPage(1)
    }

    const hasActiveFilter = searchAju || searchBlawb || tanggalRange || waktuRange

    const totalPages = Math.ceil(total / PAGE_SIZE)

    return (
        <div className="space-y-4">

            {/* ── Header ── */}
            <div className="flex flex-wrap justify-between items-end gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-xl font-bold text-gray-600 drop-shadow-sm">Pengiriman X-Ray ke Bea Cukai</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base font-semibold text-gray-600 drop-shadow-sm">{total}</span>
                        <span className="text-base font-normal text-gray-600 drop-shadow-sm">
              submission &middot; <span className="font-semibold">{totalFoto}</span> total foto
            </span>
                    </div>
                </div>
                <button
                    onClick={fetchSubmissions}
                    className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors shrink-0"
                >
                    <RefreshCw size={18} className="text-blue-900 shrink-0" />
                    <span className="text-base font-semibold text-blue-900">Refresh</span>
                </button>
            </div>

            {/* ── Filter Bar ── */}
            <div className="p-3 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-1.5">

                    {/* No. AJU search */}
                    <div className="flex-1 min-w-[75px] px-3 py-2 bg-slate-100 rounded-lg border border-gray-300 flex items-center gap-1.5">
                        <Search size={15} className="text-gray-400 shrink-0" />
                        <input
                            className="flex-1 min-w-0 bg-transparent text-base text-gray-700 placeholder-gray-400 outline-none"
                            placeholder="Cari No. AJU"
                            value={searchAju}
                            onChange={e => { setSearchAju(e.target.value); setPage(1) }}
                        />
                        {searchAju && (
                            <button onClick={() => { setSearchAju(''); setPage(1) }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* BL/AWB search */}
                    <div className="flex-1 min-w-[75px] px-3 py-2 bg-slate-100 rounded-lg border border-gray-300 flex items-center gap-1.5">
                        <Search size={15} className="text-gray-400 shrink-0" />
                        <input
                            className="flex-1 min-w-0 bg-transparent text-base text-gray-700 placeholder-gray-400 outline-none"
                            placeholder="Cari No. BL/AWB"
                            value={searchBlawb}
                            onChange={e => { setSearchBlawb(e.target.value); setPage(1) }}
                        />
                        {searchBlawb && (
                            <button onClick={() => { setSearchBlawb(''); setPage(1) }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Tanggal AWB date filter */}
                    <DateFilter
                        label="Tanggal AWB"
                        value={tanggalRange}
                        preset={tanggalPreset}
                        onChange={(range, preset) => { setTanggalRange(range); setTanggalPreset(preset); setPage(1) }}
                    />

                    {/* Waktu Masuk date filter */}
                    <DateFilter
                        label="Waktu Masuk"
                        value={waktuRange}
                        preset={waktuPreset}
                        onChange={(range, preset) => { setWaktuRange(range); setWaktuPreset(preset); setPage(1) }}
                    />

                    {/* Reset all filters */}
                    {hasActiveFilter && (
                        <button
                            onClick={handleReset}
                            className="h-10 px-3 flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors shrink-0"
                        >
                            <X size={14} />
                            Reset Filter
                        </button>
                    )}
                </div>

                {/* Active filter summary chips */}
                {hasActiveFilter && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-400">Aktif:</span>
                        {searchAju && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                AJU: {searchAju}
                                <button onClick={() => { setSearchAju(''); setPage(1) }} className="hover:text-blue-900 transition-colors"><X size={10} /></button>
              </span>
                        )}
                        {searchBlawb && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                BL/AWB: {searchBlawb}
                                <button onClick={() => { setSearchBlawb(''); setPage(1) }} className="hover:text-blue-900 transition-colors"><X size={10} /></button>
              </span>
                        )}
                        {tanggalRange && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Tgl AWB: {tanggalPreset !== 'custom'
                                ? PRESETS.find(p => p.key === tanggalPreset)?.label
                                : `${format(tanggalRange.from, 'dd MMM', { locale: id })} — ${format(tanggalRange.to, 'dd MMM yyyy', { locale: id })}`}
                                <button onClick={() => { setTanggalRange(null); setTanggalPreset('all'); setPage(1) }} className="hover:text-blue-900 transition-colors"><X size={10} /></button>
              </span>
                        )}
                        {waktuRange && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Waktu: {waktuPreset !== 'custom'
                                ? PRESETS.find(p => p.key === waktuPreset)?.label
                                : `${format(waktuRange.from, 'dd MMM', { locale: id })} — ${format(waktuRange.to, 'dd MMM yyyy', { locale: id })}`}
                                <button onClick={() => { setWaktuRange(null); setWaktuPreset('all'); setPage(1) }} className="hover:text-blue-900 transition-colors"><X size={10} /></button>
              </span>
                        )}
                    </div>
                )}
            </div>

            {/* ── Table ── */}
            <div className="flex flex-col shadow-[0px_2px_2px_0px_rgba(0,0,0,0.12)]">

                {/* Column headers */}
                <div className="h-16 px-4 bg-slate-100 rounded-tl-lg rounded-tr-lg border border-gray-300 flex items-center gap-2">
                    {[
                        { label: 'NO. AJU',     flex: 'flex-[2] min-w-[100px]'  },
                        { label: 'BL/AWB',      flex: 'flex-[2] min-w-[80px]'   },
                        { label: 'TANGGAL AWB', flex: 'flex-[1.5] min-w-[90px]' },
                        { label: 'KODE KANTOR', flex: 'flex-[1.5] min-w-[80px]' },
                        { label: 'FOTO',        flex: 'flex-1 min-w-[40px]'     },
                        { label: 'WAKTU MASUK', flex: 'flex-[2] min-w-[120px]'  },
                    ].map(col => (
                        <div key={col.label} className={`${col.flex} h-6 p-0.5 flex items-center`}>
                            <span className="text-base font-semibold text-gray-800 truncate">{col.label}</span>
                        </div>
                    ))}
                </div>

                {/* Rows */}
                {loading ? (
                    <div className="flex items-center justify-center py-16 bg-slate-100 border-l border-r border-b border-gray-300">
                        <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : submissions.length === 0 ? (
                    <div className="py-12 text-center bg-slate-100 border-l border-r border-b border-gray-300">
                        <AlertTriangle size={28} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">
                            {hasActiveFilter ? 'Tidak ada data yang sesuai filter' : 'Belum ada data pengiriman X-Ray'}
                        </p>
                        {hasActiveFilter && (
                            <button onClick={handleReset} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                                Reset filter
                            </button>
                        )}
                    </div>
                ) : submissions.map(s => (
                    <div
                        key={s.id}
                        className="h-14 px-4 bg-slate-100 border-l border-r border-b border-gray-300 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
                            <span className="text-sm font-semibold text-blue-900 truncate">{s.nomor_aju}</span>
                        </div>
                        <div className="flex-[2] min-w-[80px] min-w-0 flex items-center">
                            <span className="text-sm font-semibold text-gray-600 truncate">{s.nomor_blawb}</span>
                        </div>
                        <div className="flex-[1.5] min-w-[90px] min-w-0 flex items-center">
              <span className="text-sm font-semibold text-gray-600 truncate">
                {s.tanggal_blawb ? format(new Date(s.tanggal_blawb), 'dd/MM/yyyy', { locale: id }) : '—'}
              </span>
                        </div>
                        <div className="flex-[1.5] min-w-[80px] min-w-0 flex items-center">
                            <span className="text-sm font-semibold text-gray-600 truncate">{s.kode_kantor || '—'}</span>
                        </div>
                        <div className="flex-1 min-w-[40px] min-w-0 flex items-center">
                            <span className="text-sm font-semibold text-gray-600">{s.total_foto}</span>
                        </div>
                        <div className="flex-[2] min-w-[120px] min-w-0 flex items-center gap-1">
                            <Clock size={12} className="text-gray-400 shrink-0" />
                            <span className="text-sm font-semibold text-gray-600 truncate">
                {format(new Date(s.created_at), 'dd/MM/yyyy', { locale: id })}
              </span>
                            <span className="text-sm font-normal text-gray-600 shrink-0">
                {format(new Date(s.created_at), 'HH:mm')}
              </span>
                        </div>
                    </div>
                ))}

                {/* ── Footer ── */}
                <div className="h-14 px-4 bg-slate-100 rounded-bl-lg rounded-br-lg border-l border-r border-b border-gray-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                        <span className="text-sm font-normal text-amber-500 truncate">
              Tabel: <span className="font-medium">beacukai_xray_submissions &amp; beacukai_xray_image</span>
            </span>
                    </div>

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