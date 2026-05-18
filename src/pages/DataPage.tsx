import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, ChevronLeft, ChevronRight,
  Eye, Clock, Package,
  RefreshCw, Download, SlidersHorizontal, Send, ChevronDown, ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase, InspeksiBarang } from '../lib/supabase'
import { useGudangData } from '../hooks/useGudangData'
import BulkXrayModal from '../components/Modal/BulkXrayModal.tsx'

const PAGE_SIZE = 20

type Filters = {
  search: string
  dateFrom: string
  dateTo: string
}

type ItemKind = 'standalone' | 'house'

function getItemKind(item: InspeksiBarang): ItemKind {
  return item.hawb && item.hawb.trim() !== '' ? 'house' : 'standalone'
}

export default function DataPage() {
  const [data, setData]                     = useState<InspeksiBarang[]>([])
  const [loading, setLoading]               = useState(true)
  const [page, setPage]                     = useState(1)
  const [barangCountMap, setBarangCountMap] = useState<Record<string, number>>({})
  const [total, setTotal]                   = useState(0)
  const [showFilters, setShowFilters]       = useState(false)
  const [filters, setFilters]               = useState<Filters>({ search: '', dateFrom: '', dateTo: '' })
  const [selected, setSelected]             = useState<string[]>([])
  const selectAllRef                        = useRef<HTMLInputElement>(null)
  const [sortField, setSortField]           = useState<string>('created_at')
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('desc')
  const [bulkModal, setBulkModal]           = useState(false)
  const [collapsed, setCollapsed]           = useState<Set<string>>(new Set())
  const { getByIndex }                      = useGudangData()

  useEffect(() => { fetchData() }, [page, filters, sortField, sortDir])

  useEffect(() => {
    if (selectAllRef.current) {
      const allChecked  = data.length > 0 && data.every(d => selected.includes(d.id))
      const someChecked = data.some(d => selected.includes(d.id))
      selectAllRef.current.indeterminate = someChecked && !allChecked
    }
  }, [data, selected])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      let query = supabase
          .from('inspeksi_barang_v3')
          .select('*', { count: 'exact' })
          .order(sortField, { ascending: sortDir === 'asc' })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filters.search)
        query = query.or(
            `mawb.ilike.%${filters.search}%,hawb.ilike.%${filters.search}%,blawb.ilike.%${filters.search}%`
        )
      if (filters.dateFrom) query = query.gte('waktu_masuk', filters.dateFrom)
      if (filters.dateTo)   query = query.lte('waktu_masuk', filters.dateTo + 'T23:59:59')

      const { data: rows, count, error } = await query
      if (error) { console.error('fetchData error:', error.message); setData([]); setTotal(0); return }

      const blawbs = (rows || []).map(r => r.blawb).filter(Boolean)
      if (blawbs.length > 0) {
        const { data: barangCounts } = await supabase
            .from('barang_v2')
            .select('blawb, id')
            .in('blawb', blawbs)
        const map: Record<string, number> = {}
        barangCounts?.forEach(b => { if (b.blawb) map[b.blawb] = (map[b.blawb] || 0) + 1 })
        setBarangCountMap(map)
      } else {
        setBarangCountMap({})
      }

      setData(rows || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }

  // Build render list. Groups are keyed by mawb; standalone items render as plain rows.
  // Each group entry carries the resolved ori_dest so house rows can inherit it.
  const buildRenderList = (): Array<
      | { kind: 'standalone'; item: InspeksiBarang; dataIdx: number }
      | { kind: 'group'; mawb: string; items: InspeksiBarang[]; resolvedOriDest: string; resolvedAirlineCode: string }
  > => {
    const result: Array<
        | { kind: 'standalone'; item: InspeksiBarang; dataIdx: number }
        | { kind: 'group'; mawb: string; items: InspeksiBarang[]; resolvedOriDest: string; resolvedAirlineCode: string }
    > = []
    const seenGroups = new Set<string>()

    data.forEach((item, idx) => {
      if (getItemKind(item) === 'standalone') {
        result.push({ kind: 'standalone', item, dataIdx: (page - 1) * PAGE_SIZE + idx })
      } else {
        const mawb = item.mawb || item.id
        if (!seenGroups.has(mawb)) {
          seenGroups.add(mawb)
          const groupItems = data.filter(d => getItemKind(d) === 'house' && (d.mawb || d.id) === mawb)
          // Resolve ori_dest and airline_code: pick first non-empty value across all group items
          const resolvedOriDest     = groupItems.find(d => d.ori_dest)?.ori_dest     || ''
          const resolvedAirlineCode = groupItems.find(d => d.airline_code)?.airline_code || ''
          result.push({ kind: 'group', mawb, items: groupItems, resolvedOriDest, resolvedAirlineCode })
        }
      }
    })

    return result
  }

  const renderList = buildRenderList()

  const toggleCollapse = (mawb: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(mawb)) next.delete(mawb)
      else next.add(mawb)
      return next
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const resetFilters = () => { setFilters({ search: '', dateFrom: '', dateTo: '' }); setPage(1) }
  const setToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    setFilters(f => ({ ...f, dateFrom: today, dateTo: today }))
    setPage(1)
  }

  const activeFilterCount = [filters.dateFrom, filters.dateTo].filter(Boolean).length

  const exportCSV = () => {
    const headers = ['Tipe','MAWB','HAWB','BLAWB','Jumlah Pieces','Waktu Masuk']
    const rows = data.map(d => {
      const kind = getItemKind(d)
      const pieces = d.blawb && barangCountMap[d.blawb] != null ? barangCountMap[d.blawb] : ''
      return [
        kind === 'standalone' ? 'Master' : 'House',
        d.mawb || '',
        d.hawb || '',
        d.blawb || '',
        pieces,
        format(new Date(d.waktu_masuk), 'dd/MM/yyyy HH:mm')
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `inspeksi_${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
  }

  const SortArrows = ({ field }: { field: string }) => {
    const active = sortField === field
    return (
        <span className="inline-flex flex-col gap-[2px] ml-1">
        <span className={`w-0 h-0 border-l-[3px] border-r-[3px] border-b-[4px] border-l-transparent border-r-transparent ${active && sortDir === 'asc' ? 'border-b-blue-900' : 'border-b-gray-400'}`} />
        <span className={`w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent ${active && sortDir === 'desc' ? 'border-t-blue-900' : 'border-t-gray-400'}`} />
      </span>
    )
  }

  // ── House row — inherits oriDest/airlineCode from group ────────────────────
  const renderHouseRow = (
      item: InspeksiBarang,
      groupOriDest: string,
      groupAirlineCode: string
  ) => {
    const isChecked = selected.includes(item.id)
    const pieces    = item.blawb ? barangCountMap[item.blawb] : undefined
    // House row: use item's own ori_dest first, fall back to group-resolved value
    const oriDest     = item.ori_dest     || groupOriDest
    const airlineCode = item.airline_code || groupAirlineCode

    return (
        <div
            key={item.id}
            className={`min-h-[52px] pl-12 pr-4 border-l border-r border-b border-gray-300 flex items-center gap-2 transition-colors ${
                isChecked ? 'bg-orange-50' : 'bg-slate-50 hover:bg-orange-50/40'
            }`}
        >
          {/* Checkbox */}
          <div className="shrink-0 flex items-center justify-center w-6">
            <input
                type="checkbox"
                className="w-4 h-4 rounded-sm border-2 border-blue-900 accent-blue-900 cursor-pointer"
                checked={isChecked}
                onChange={e =>
                    setSelected(prev =>
                        e.target.checked ? [...prev, item.id] : prev.filter(i => i !== item.id)
                    )
                }
            />
          </div>

          {/* House badge */}
          <div className="w-[72px] shrink-0 flex items-center">
          <span className="shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-orange-100 text-orange-700 border border-orange-300">
            House
          </span>
          </div>

          {/* MAWB — muted */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
            <span className="text-sm text-gray-400 truncate">{item.mawb}</span>
          </div>

          {/* HAWB — highlighted */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
            <span className="text-sm font-bold text-orange-600 truncate">{item.hawb}</span>
          </div>

          {/* ORI-DEST — resolved from group */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
          <span className="text-sm font-semibold text-gray-600 truncate">
            {airlineCode && oriDest
                ? `${oriDest}`
                : oriDest || airlineCode || 'CGK-SIN'}
          </span>
          </div>

          {/* PIECES */}
          <div className="flex-1 min-w-[60px] min-w-0 flex items-center gap-1">
            {pieces != null ? (
                <>
                  <span className="text-sm font-semibold text-gray-600">{pieces}</span>
                  <span className="text-sm font-normal text-gray-500 shrink-0">Pcs</span>
                </>
            ) : null}
          </div>

          {/* WAKTU MASUK */}
          <div className="flex-[2] min-w-[130px] min-w-0 flex items-center gap-1">
            <Clock size={12} className="text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-600 shrink-0">
            {format(new Date(item.waktu_masuk), 'dd/MM/yyyy', { locale: id })}
          </span>
            <span className="text-sm text-gray-500 shrink-0">
            {format(new Date(item.waktu_masuk), 'HH:mm')}
          </span>
          </div>

          {/* AKSI */}
          <div className="flex-[1.5] min-w-[70px] min-w-0 flex items-center">
            <Link
                to={`/data/${item.id}`}
                className="h-6 px-1.5 py-0.5 bg-slate-100 rounded-md shadow-[2px_2px_10px_0px_rgba(0,0,0,0.20)] border border-gray-300 inline-flex items-center gap-0.5 hover:bg-orange-50 transition-colors shrink-0"
            >
              <Eye size={14} className="text-blue-600 shrink-0" />
              <span className="text-xs font-medium text-blue-600">Detail</span>
            </Link>
          </div>
        </div>
    )
  }

  // ── Standalone (Master) row ────────────────────────────────────────────────
  const renderStandaloneRow = (item: InspeksiBarang, dataIdx: number) => {
    const isChecked = selected.includes(item.id)
    const gudang    = getByIndex(dataIdx)
    const pieces    = item.blawb ? barangCountMap[item.blawb] : undefined
    const airlineCode = item.airline_code || gudang.airline_code || ''
    const oriDest     = item.ori_dest     || gudang.ori_dest     || ''

    return (
        <div
            key={item.id}
            className={`min-h-[56px] px-4 border-l border-r border-b border-gray-300 flex items-center gap-2 transition-colors ${
                isChecked ? 'bg-blue-50' : 'bg-slate-100 hover:bg-gray-50'
            }`}
        >
          {/* Checkbox */}
          <div className="shrink-0 flex items-center justify-center w-6">
            <input
                type="checkbox"
                className="w-4 h-4 rounded-sm border-2 border-blue-900 accent-blue-900 cursor-pointer"
                checked={isChecked}
                onChange={e =>
                    setSelected(prev =>
                        e.target.checked ? [...prev, item.id] : prev.filter(i => i !== item.id)
                    )
                }
            />
          </div>

          {/* Master badge */}
          <div className="w-[72px] shrink-0 flex items-center">
          <span className="shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-blue-100 text-blue-800 border border-blue-300">
            Master
          </span>
          </div>

          {/* MAWB — highlighted orange */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
            <span className="text-sm font-bold text-orange-600 truncate">{item.mawb}</span>
          </div>

          {/* HAWB — blank for standalone */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
            <span className="text-sm font-semibold text-gray-600 truncate">-</span>
          </div>

          {/* ORI-DEST */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
          <span className="text-sm font-semibold text-gray-600 truncate">
            {airlineCode && oriDest
                ? `${oriDest}`
                : oriDest || airlineCode || 'CGK-SIN'}
          </span>
          </div>

          {/* PIECES */}
          <div className="flex-1 min-w-[60px] min-w-0 flex items-center gap-1">
            {pieces != null ? (
                <>
                  <span className="text-sm font-semibold text-gray-600">{pieces}</span>
                  <span className="text-sm font-normal text-gray-500 shrink-0">Pcs</span>
                </>
            ) : null}
          </div>

          {/* WAKTU MASUK */}
          <div className="flex-[2] min-w-[130px] min-w-0 flex items-center gap-1">
            <Clock size={12} className="text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-600 shrink-0">
            {format(new Date(item.waktu_masuk), 'dd/MM/yyyy', { locale: id })}
          </span>
            <span className="text-sm text-gray-500 shrink-0">
            {format(new Date(item.waktu_masuk), 'HH:mm')}
          </span>
          </div>

          {/* AKSI */}
          <div className="flex-[1.5] min-w-[70px] min-w-0 flex items-center">
            <Link
                to={`/data/${item.id}`}
                className="h-6 px-1.5 py-0.5 bg-slate-100 rounded-md shadow-[2px_2px_10px_0px_rgba(0,0,0,0.20)] border border-gray-300 inline-flex items-center gap-0.5 hover:bg-blue-50 transition-colors shrink-0"
            >
              <Eye size={14} className="text-blue-600 shrink-0" />
              <span className="text-xs font-medium text-blue-600">Detail</span>
            </Link>
          </div>
        </div>
    )
  }

  // ── Group accordion header — no TIPE badge, no dashes, no waktu masuk ──────
  const renderGroupHeader = (
      mawb: string,
      items: InspeksiBarang[],
      resolvedOriDest: string,
      resolvedAirlineCode: string
  ) => {
    const isCollapsed = collapsed.has(mawb)
    const totalPieces = items.reduce((sum, item) => {
      return sum + (item.blawb ? (barangCountMap[item.blawb] ?? 0) : 0)
    }, 0)

    return (
        <div className="min-h-[52px] px-4 border-l border-r border-b border-gray-300 bg-blue-50 flex items-center gap-2">
          {/* Checkbox — select all in group */}
          <div className="shrink-0 flex items-center justify-center w-6">
            <input
                type="checkbox"
                className="w-4 h-4 rounded-sm border-2 border-blue-900 accent-blue-900 cursor-pointer"
                checked={items.every(d => selected.includes(d.id))}
                onChange={e => {
                  const ids = items.map(d => d.id)
                  setSelected(prev =>
                      e.target.checked
                          ? [...new Set([...prev, ...ids])]
                          : prev.filter(i => !ids.includes(i))
                  )
                }}
            />
          </div>

          {/* Empty TIPE column — no badge on group header */}
          <div className="w-[72px] shrink-0" />

          {/* MAWB — bold orange */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center gap-2">
            <span className="text-sm font-bold text-orange-600 truncate">{mawb}</span>
          </div>

          {/* HAWB count pill + toggle — in the HAWB column */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
            <button
                onClick={() => toggleCollapse(mawb)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 border border-orange-300 text-orange-700 text-[11px] font-bold hover:bg-orange-200 transition-colors"
            >
              {items.length} House
              {isCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>
          </div>

          {/* ORI-DEST — resolved from group */}
          <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
          <span className="text-sm font-semibold text-gray-500 truncate">
            {resolvedAirlineCode && resolvedOriDest
                ? `${resolvedAirlineCode} / ${resolvedOriDest}`
                : resolvedOriDest || resolvedAirlineCode || ''}
          </span>
          </div>

          {/* PIECES — summed */}
          <div className="flex-1 min-w-[60px] min-w-0 flex items-center gap-1">
            {totalPieces > 0 ? (
                <>
                  <span className="text-sm font-semibold text-gray-600">{totalPieces}</span>
                  <span className="text-sm font-normal text-gray-500 shrink-0">Pcs</span>
                </>
            ) : null}
          </div>

          {/* WAKTU MASUK — blank (houses may have different dates) */}
          <div className="flex-[2] min-w-[130px] min-w-0" />

          {/* AKSI — no link */}
          <div className="flex-[1.5] min-w-[70px] min-w-0" />
        </div>
    )
  }

  return (
      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap justify-between items-end gap-3 pb-4 sticky top-0 bg-[#F2F2F2] z-10">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xl font-bold text-gray-600 drop-shadow-sm">Data Inspeksi</span>
            <span className="text-base font-normal text-gray-600 drop-shadow-sm">
            Total <span className="font-semibold">{total.toLocaleString('id-ID')}</span> data yang sudah diinspeksi
          </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {selected.length > 0 && (
                <button
                    onClick={() => setSelected([])}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors px-2 shrink-0"
                >
                  Batal pilih ({selected.length})
                </button>
            )}

            {selected.length > 0 ? (
                <button
                    onClick={() => setBulkModal(true)}
                    className="h-11 px-4 bg-blue-900 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 hover:bg-blue-800 transition-colors shrink-0"
                >
                  <Send size={18} className="text-slate-100 shrink-0" />
                  <span className="text-base font-semibold text-slate-100 whitespace-nowrap">
                Kirim {selected.length} ke Bea Cukai
              </span>
                </button>
            ) : (
                <button
                    disabled
                    className="h-11 px-4 bg-blue-900/40 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 cursor-default shrink-0"
                >
                  <Send size={18} className="text-slate-300 shrink-0" />
                  <span className="text-base font-semibold text-slate-300 whitespace-nowrap">Kirim data ke Bea Cukai</span>
                </button>
            )}

            <button
                onClick={exportCSV}
                className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors shrink-0"
            >
              <Download size={18} className="text-blue-900 shrink-0" />
              <span className="text-base font-semibold text-blue-900 whitespace-nowrap">Export to CSV</span>
            </button>
          </div>
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="p-3 bg-slate-100 rounded-lg border border-gray-400 flex flex-col gap-2.5 !mt-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex-1 min-w-[180px] h-11 px-4 py-2 bg-slate-100 rounded-lg border border-gray-300 flex items-center gap-1.5">
              <Search size={20} className="text-gray-400 shrink-0" />
              <input
                  type="text"
                  className="flex-1 min-w-0 bg-transparent text-base placeholder-gray-400 text-gray-700 outline-none"
                  placeholder="Cari MAWB atau HAWB"
                  value={filters.search}
                  onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
              />
            </div>

            <button
                onClick={fetchData}
                className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors shrink-0"
            >
              <RefreshCw size={18} className="text-blue-900 shrink-0" />
              <span className="text-base font-semibold text-blue-900">Refresh</span>
            </button>

            <button
                onClick={() => setShowFilters(!showFilters)}
                className={`h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border flex items-center gap-1.5 hover:bg-gray-50 transition-colors shrink-0 ${activeFilterCount > 0 ? 'border-blue-600' : 'border-gray-300'}`}
            >
              <SlidersHorizontal size={18} className="text-blue-900 shrink-0" />
              <span className="text-base font-semibold text-blue-900">Filter</span>
              {activeFilterCount > 0 && (
                  <span className="ml-0.5 bg-blue-900 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                {activeFilterCount}
              </span>
              )}
            </button>
          </div>

          {showFilters && (
              <div className="pt-2 border-t border-gray-300 flex flex-wrap gap-3">
                <div className="flex-1 min-w-[140px] flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Dari Tanggal</label>
                  <input
                      type="date"
                      className="h-10 px-3 bg-slate-100 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-600"
                      value={filters.dateFrom}
                      onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(1) }}
                  />
                </div>
                <div className="flex-1 min-w-[140px] flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Sampai Tanggal</label>
                  <input
                      type="date"
                      className="h-10 px-3 bg-slate-100 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-600"
                      value={filters.dateTo}
                      onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(1) }}
                  />
                </div>
                <div className="flex items-end gap-2 shrink-0">
                  <button
                      onClick={setToday}
                      className="h-10 px-4 bg-slate-100 rounded-lg border border-gray-300 text-sm font-semibold text-blue-900 hover:bg-gray-50 transition-colors"
                  >
                    Hari Ini
                  </button>
                  <button
                      onClick={resetFilters}
                      className="h-10 px-4 bg-slate-100 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="flex flex-col shadow-[0px_2px_2px_0px_rgba(0,0,0,0.12)]">

          {/* Column headers */}
          <div className="h-16 px-4 bg-slate-100 rounded-tl-lg rounded-tr-lg border border-gray-300 flex items-center gap-2">
            <div className="shrink-0 flex items-center justify-center w-6">
              <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="w-4 h-4 rounded-sm border-2 border-blue-900 accent-blue-900 cursor-pointer"
                  onChange={e => {
                    const ids = data.map(d => d.id)
                    setSelected(prev => e.target.checked ? [...new Set([...prev, ...ids])] : prev.filter(i => !ids.includes(i)))
                  }}
                  checked={data.length > 0 && data.every(d => selected.includes(d.id))}
              />
            </div>

            <div className="w-[72px] shrink-0 h-6 flex items-center">
              <span className="text-base font-semibold text-gray-800">TIPE</span>
            </div>

            {[
              { label: 'NO. MAWB',    field: 'mawb',          flex: 'flex-[2] min-w-[100px]' },
              { label: 'NO. HAWB',    field: 'hawb',          flex: 'flex-[2] min-w-[100px]' },
              { label: 'ORI - DEST',  field: 'ori_dest',      flex: 'flex-[2] min-w-[100px]' },
              { label: 'PIECES',      field: 'jumlah_pieces', flex: 'flex-1 min-w-[60px]'    },
              { label: 'WAKTU MASUK', field: 'waktu_masuk',   flex: 'flex-[2] min-w-[130px]' },
            ].map(col => (
                <div
                    key={col.field}
                    className={`${col.flex} h-6 p-0.5 flex items-center gap-1 cursor-pointer select-none hover:text-blue-900 transition-colors`}
                    onClick={() => handleSort(col.field)}
                >
                  <span className="text-base font-semibold text-gray-800">{col.label}</span>
                  <SortArrows field={col.field} />
                </div>
            ))}

            <div className="flex-[1.5] min-w-[70px] h-6 flex items-center">
              <span className="text-base font-semibold text-gray-800">AKSI</span>
            </div>
          </div>

          {/* Loading / Empty */}
          {loading ? (
              <div className="flex items-center justify-center py-16 bg-slate-100 border-l border-r border-b border-gray-300">
                <div className="w-7 h-7 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
              </div>
          ) : data.length === 0 ? (
              <div className="py-12 text-center bg-slate-100 border-l border-r border-b border-gray-300">
                <Package size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Tidak ada data ditemukan</p>
              </div>
          ) : renderList.map((entry, i) => {
            if (entry.kind === 'standalone') {
              return renderStandaloneRow(entry.item, entry.dataIdx)
            }
            const isCollapsed = collapsed.has(entry.mawb)
            return (
                <div key={`group-${entry.mawb}-${i}`} className="relative">
                  {renderGroupHeader(entry.mawb, entry.items, entry.resolvedOriDest, entry.resolvedAirlineCode)}
                  {!isCollapsed && (
                      <div className="border-l-2 border-orange-200">
                        {entry.items.map(item =>
                            renderHouseRow(item, entry.resolvedOriDest, entry.resolvedAirlineCode)
                        )}
                      </div>
                  )}
                </div>
            )
          })}

          {/* Pagination Footer */}
          <div className="h-16 px-4 bg-slate-100 rounded-bl-lg rounded-br-lg border border-t-0 border-gray-300 flex justify-between items-center gap-2">
          <span className="text-base font-medium text-gray-600 truncate min-w-0">
            Menampilkan {Math.min((page - 1) * PAGE_SIZE + 1, total)} – {Math.min(page * PAGE_SIZE, total)} dari {total.toLocaleString('id-ID')} data
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

        <BulkXrayModal
            open={bulkModal}
            onClose={() => setBulkModal(false)}
            selectedIds={selected}
            onDone={() => setSelected([])}
        />
      </div>
  )
}