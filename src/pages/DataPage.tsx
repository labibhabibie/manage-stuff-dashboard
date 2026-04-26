import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, ChevronLeft, ChevronRight,
  Eye, Clock, Package,
  RefreshCw, Download, SlidersHorizontal, Send
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase, InspeksiBarang } from '../lib/supabase'

const PAGE_SIZE = 20

type Filters = {
  search: string
  dateFrom: string
  dateTo: string
}

export default function DataPage() {
  const [data, setData] = useState<InspeksiBarang[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [barangCountMap, setBarangCountMap] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    search: '', dateFrom: '', dateTo: ''
  })
  const [selected, setSelected] = useState<string[]>([])
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchData() }, [page, filters])
  useEffect(() => {
    if (selectAllRef.current) {
      const allChecked = data.length > 0 && data.every(d => selected.includes(d.id))
      const someChecked = data.some(d => selected.includes(d.id))
      selectAllRef.current.indeterminate = someChecked && !allChecked
    }
  }, [data, selected])

  const fetchData = async () => {
    setLoading(true)
    try {
      let query = supabase
          .from('inspeksi_barang_v2')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filters.search)
        query = query.or(
            `aju.ilike.%${filters.search}%,mawb.ilike.%${filters.search}%,hawb.ilike.%${filters.search}%`
        )
      if (filters.dateFrom) query = query.gte('waktu_masuk', filters.dateFrom)
      if (filters.dateTo)   query = query.lte('waktu_masuk', filters.dateTo + 'T23:59:59')

      const { data: rows, count, error } = await query

      // fetch barang counts for all returned rows
      const ids = (rows || []).map(r => r.mawb).filter(Boolean)
      const { data: barangCounts } = await supabase
          .from('barang')
          .select('mawb, id')
          .in('mawb', ids)

      // build a map: mawb → count
      const barangCountMap: Record<string, number> = {}
      barangCounts?.forEach(b => {
        if (b.mawb) barangCountMap[b.mawb] = (barangCountMap[b.mawb] || 0) + 1
      })

      if (error) {
        console.error('fetchData error:', error.message)
        setData([])
        setTotal(0)
        return
      }

      setData(rows || [])
      setTotal(count || 0)
      setBarangCountMap(barangCountMap)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const resetFilters = () => {
    setFilters({ search: '', dateFrom: '', dateTo: '' })
    setPage(1)
  }

  const setToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    setFilters(f => ({ ...f, dateFrom: today, dateTo: today }))
    setPage(1)
  }

  const activeFilterCount = [filters.dateFrom, filters.dateTo].filter(Boolean).length

  const exportCSV = () => {
    const headers = [
      'No AJU', 'MAWB', 'HAWB', 'Tanggal AWB', 'Airline Code',
      'Ori/Dest', 'Jumlah Pieces', 'Berat (Kg)',
      'Shipper PIC Name', 'Shipper PIC Number',
      'Note Handling', 'Waktu Masuk',
    ]
    const rows = data.map(d => [
      d.aju || '',
      d.mawb || '',
      d.hawb || '',
      d.tanggal_awb || '',
      d.airline_code || '',
      d.ori_dest || '',
      d.jumlah_pieces ?? '',
      d.weight || '',
      d.shipper_pic_name || '',
      d.shipper_pic_number || '',
      d.note_handling || '',
      format(new Date(d.waktu_masuk), 'dd/MM/yyyy HH:mm'),
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
            {selected.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                      onClick={() => setSelected([])}
                      className="text-xs text-surface-400 hover:text-surface-200 transition-colors"
                  >
                    Batal pilih ({selected.length})
                  </button>
                </div>
            )}
            {selected.length > 0 ? (
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                  <Send size={14} /> Kirim {selected.length} ke Bea Cukai
                  {/* Show a hint if selection spans multiple pages */}
                  {selected.length > PAGE_SIZE && (
                      <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                        {Math.ceil(selected.length / PAGE_SIZE)} halaman
                      </span>
                  )}
                </button>
            ) : (
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-400 text-white cursor-default transition-colors">
                  <Send size={14} /> Kirim 0 ke Bea Cukai
                </button>
            )}
            <button onClick={fetchData} className="btn-secondary"><RefreshCw size={14} /></button>
            <button onClick={exportCSV} className="btn-secondary">
              <Download size={14} /> Export CSV
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
                  placeholder="Cari No AJU, MAWB, atau HAWB..."
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
              <div className="pt-3 border-t border-surface-700">
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
                  <div className="flex items-end gap-2">
                    <button onClick={setToday} className="btn-secondary">Hari Ini</button>
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
                    <th className="py-3 px-4">
                      <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="rounded border-surface-600 bg-surface-800 text-brand-500 cursor-pointer"
                          onChange={(e) => {
                            const currentPageIds = data.map(d => d.id)
                            if (e.target.checked) {
                              setSelected(prev => [...new Set([...prev, ...currentPageIds])])
                            } else {
                              setSelected(prev => prev.filter(id => !currentPageIds.includes(id)))
                            }
                          }}
                          checked={data.length > 0 && data.every(d => selected.includes(d.id))}
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">No. AJU</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Waktu Masuk</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">No. MAWB</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">No. HAWB</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Airline / Rute</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Pieces / Berat</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Aksi</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/50">
                  {data.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <Package size={32} className="text-surface-600 mx-auto mb-3" />
                          <p className="text-surface-400 text-sm">Tidak ada data ditemukan</p>
                        </td>
                      </tr>
                  ) : data.map(item => (
                      <tr key={item.id} className="hover:bg-surface-800/40 transition-colors group">
                        <td className="py-3 px-4">
                          <input
                              type="checkbox"
                              className="rounded border-surface-600 bg-surface-800 text-brand-500 cursor-pointer"
                              checked={selected.includes(item.id)}
                              onChange={(e) =>
                                  setSelected(prev =>
                                      e.target.checked ? [...prev, item.id] : prev.filter(i => i !== item.id)
                                  )
                              }
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-brand-400 font-medium">{item.aju || '—'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-surface-300">
                            <Clock size={11} className="text-surface-500" />
                            {format(new Date(item.waktu_masuk), 'dd/MM/yyyy', { locale: id })}
                            <span className="font-mono text-surface-500">{format(new Date(item.waktu_masuk), 'HH:mm')}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                      <span className="font-mono text-xs text-surface-200">
                        {item.mawb || <span className="italic text-surface-600">—</span>}
                      </span>
                        </td>
                        <td className="py-3 px-4">
                      <span className="font-mono text-xs text-surface-200">
                        {item.hawb || <span className="italic text-surface-600">—</span>}
                      </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <p className="text-xs text-surface-200 font-medium">
                              {item.airline_code || <span className="italic text-surface-600">—</span>}
                            </p>
                            {item.ori_dest && (
                                <p className="text-[10px] text-surface-500 font-mono">{item.ori_dest}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {item.mawb && barangCountMap[item.mawb] != null
                                ? <p className="text-xs text-surface-300">{barangCountMap[item.mawb]} pcs</p>
                                : <p className="text-xs text-surface-600 italic">—</p>
                            }
                            {item.weight && (
                                <p className="text-[10px] text-surface-500">{item.weight} kg</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                              to={`/data/${item.id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-brand-900/30 text-brand-400 border border-brand-800/60 hover:bg-brand-800/40 transition-colors"
                          >
                            <Eye size={12} /> Detail
                          </Link>
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
          )}

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
