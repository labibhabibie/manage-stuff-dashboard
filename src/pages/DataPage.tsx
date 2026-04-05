import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Filter, ChevronLeft, ChevronRight,
  Atom, Leaf, Droplets, Zap, Eye, Clock, Package,
  RefreshCw, Download, SlidersHorizontal
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase, InspeksiBarang } from '../lib/supabase'

const PAGE_SIZE = 20

type Filters = {
  search: string
  logam: boolean
  organik: boolean
  cairan: boolean
  sintetis: boolean
  dateFrom: string
  dateTo: string
}

export default function DataPage() {
  const [data, setData] = useState<InspeksiBarang[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    search: '', logam: false, organik: false, cairan: false, sintetis: false,
    dateFrom: '', dateTo: ''
  })

  useEffect(() => {
    fetchData()
  }, [page, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('inspeksi_barang')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filters.search) query = query.ilike('id_barang', `%${filters.search}%`)
      if (filters.logam) query = query.eq('logam', true)
      if (filters.organik) query = query.eq('organik', true)
      if (filters.cairan) query = query.eq('cairan', true)
      if (filters.sintetis) query = query.eq('sintetis', true)
      if (filters.dateFrom) query = query.gte('waktu_masuk', filters.dateFrom)
      if (filters.dateTo) query = query.lte('waktu_masuk', filters.dateTo + 'T23:59:59')

      const { data: rows, count } = await query
      setData(rows || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const resetFilters = () => {
    setFilters({ search: '', logam: false, organik: false, cairan: false, sintetis: false, dateFrom: '', dateTo: '' })
    setPage(1)
  }

  const activeFilterCount = [filters.logam, filters.organik, filters.cairan, filters.sintetis, filters.dateFrom, filters.dateTo].filter(Boolean).length

  const exportCSV = () => {
    const headers = ['ID Barang', 'Waktu Masuk', 'Logam', 'Organik', 'Cairan', 'Sintetis', 'Catatan']
    const rows = data.map(d => [
      d.id_barang,
      format(new Date(d.waktu_masuk), 'dd/MM/yyyy HH:mm'),
      d.logam ? 'Ya' : 'Tidak',
      d.organik ? 'Ya' : 'Tidak',
      d.cairan ? 'Ya' : 'Tidak',
      d.sintetis ? 'Ya' : 'Tidak',
      d.catatan || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inspeksi_${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-white">Data Inspeksi</h2>
          <p className="text-surface-400 text-sm mt-0.5">
            Total <span className="font-mono text-brand-400">{total.toLocaleString('id-ID')}</span> data inspeksi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn-secondary">
            <RefreshCw size={14} />
          </button>
          <button onClick={exportCSV} className="btn-secondary">
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari ID barang..."
              value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary ${activeFilterCount > 0 ? 'border border-brand-700 text-brand-400' : ''}`}
          >
            <SlidersHorizontal size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-brand-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-surface-700 space-y-3">
            <div className="flex flex-wrap gap-2">
              <p className="text-xs text-surface-400 w-full font-medium">Filter Tipe:</p>
              {[
                { key: 'logam', label: 'Logam', icon: Atom, cls: 'badge-logam' },
                { key: 'organik', label: 'Organik', icon: Leaf, cls: 'badge-organik' },
                { key: 'cairan', label: 'Cairan', icon: Droplets, cls: 'badge-cairan' },
                { key: 'sintetis', label: 'Sintetis', icon: Zap, cls: 'badge-sintetis' },
              ].map(f => {
                const Icon = f.icon
                const active = filters[f.key as keyof Filters] as boolean
                return (
                  <button
                    key={f.key}
                    onClick={() => { setFilters(prev => ({ ...prev, [f.key]: !prev[f.key as keyof Filters] })); setPage(1) }}
                    className={`${f.cls} cursor-pointer transition-all ${active ? 'ring-2 ring-white/30' : 'opacity-60 hover:opacity-100'}`}
                  >
                    <Icon size={11} />{f.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Dari Tanggal</label>
                <input type="date" className="input" value={filters.dateFrom}
                  onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(1) }} />
              </div>
              <div className="flex-1">
                <label className="label">Sampai Tanggal</label>
                <input type="date" className="input" value={filters.dateTo}
                  onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(1) }} />
              </div>
              <div className="flex items-end">
                <button onClick={resetFilters} className="btn-secondary">Reset</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-900/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">ID Barang</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Waktu Masuk</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Tipe Terdeteksi</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Catatan</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Package size={32} className="text-surface-600 mx-auto mb-3" />
                      <p className="text-surface-400 text-sm">Tidak ada data ditemukan</p>
                    </td>
                  </tr>
                ) : data.map(item => (
                  <tr key={item.id} className="hover:bg-surface-800/40 transition-colors group">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-brand-400 font-medium">{item.id_barang}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-surface-300">
                        <Clock size={11} className="text-surface-500" />
                        {format(new Date(item.waktu_masuk), 'dd MMM yyyy', { locale: id })}
                        <span className="font-mono text-surface-500">{format(new Date(item.waktu_masuk), 'HH:mm')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {item.logam && <span className="badge-logam"><Atom size={10} />Logam</span>}
                        {item.organik && <span className="badge-organik"><Leaf size={10} />Organik</span>}
                        {item.cairan && <span className="badge-cairan"><Droplets size={10} />Cairan</span>}
                        {item.sintetis && <span className="badge-sintetis"><Zap size={10} />Sintetis</span>}
                        {!item.logam && !item.organik && !item.cairan && !item.sintetis && (
                          <span className="text-xs text-surface-600 italic">Tidak ada</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-surface-400 truncate max-w-[200px] block">
                        {item.catatan || <span className="italic text-surface-600">—</span>}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/data/${item.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-brand-900/30 text-brand-400 border border-brand-800/60 hover:bg-brand-800/40 transition-colors"
                      >
                        <Eye size={12} />
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
            <p className="text-xs text-surface-400">
              Menampilkan {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total} data
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-mono text-surface-300">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
