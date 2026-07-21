import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, TrendingUp, Calendar, ChevronRight, Trash2, Clock
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { format, subDays, startOfDay } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase, InspeksiBarang } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { clearAllInspectionData } from '../lib/clearAllData.ts'

type ItemKind = 'house' | 'master'

function getItemKind(item: InspeksiBarang): ItemKind {
  return item.hawb && item.hawb.trim() !== '' ? 'house' : 'master'
}

function getLastUpdated(item: InspeksiBarang): Date {
  return new Date(item.updated_at || item.created_at)
}

type Stats = {
  total: number
  today: number
  thisWeek: number
  recentData: InspeksiBarang[]
  dailyTrend: { date: string; count: number }[]
  typeBreakdown: { name: string; value: number; color: string }[]
}

const TYPE_PALETTE = {
  house:  '#f97316',
  master: '#1e3a5f',
}

const ITEMS_PER_PAGE = 12

export default function DashboardPage() {
  const [stats, setStats]               = useState<Stats | null>(null)
  const [loading, setLoading]           = useState(true)
  const [barangCountMap, setBarangCountMap] = useState<Record<string, number>>({})
  const { profile } = useAuth()

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
          .from('inspeksi_barang_v3')
          .select('*')
          .order('updated_at', { ascending: false, nullsFirst: false })

      if (error || !data) {
        console.error('Supabase error:', error)
        setStats({ total: 0, today: 0, thisWeek: 0, recentData: [], dailyTrend: [], typeBreakdown: [] })
        return
      }

      // ── Fetch barang counts by blawb ──────────────────────────────────────
      const blawbs = data.map(r => r.blawb).filter(Boolean)
      if (blawbs.length > 0) {
        const { data: barangCounts } = await supabase
            .from('barang_v2').select('blawb, id').in('blawb', blawbs)
        const map: Record<string, number> = {}
        barangCounts?.forEach(b => { if (b.blawb) map[b.blawb] = (map[b.blawb] || 0) + 1 })
        setBarangCountMap(map)
      } else {
        setBarangCountMap({})
      }

      const now        = new Date()
      const todayStart = startOfDay(now)
      const weekStart  = subDays(now, 7)

      const total    = data.length
      const today    = data.filter(d => new Date(d.created_at) >= todayStart).length
      const thisWeek = data.filter(d => new Date(d.created_at) >= weekStart).length

      // Sort by last updated for recent list
      const sortedByUpdate = [...data].sort((a, b) =>
          getLastUpdated(b).getTime() - getLastUpdated(a).getTime()
      )
      const recentData = sortedByUpdate.slice(0, ITEMS_PER_PAGE)

      const dailyTrend = Array.from({ length: 7 }, (_, i) => {
        const day   = subDays(now, 6 - i)
        const start = startOfDay(day)
        const end   = startOfDay(subDays(now, 5 - i))
        const count = data.filter(d => {
          const dt = new Date(d.created_at)
          return dt >= start && dt < end
        }).length
        return { date: format(day, 'dd MMM', { locale: id }), count }
      })

      const houseCount  = data.filter(d => getItemKind(d) === 'house').length
      const masterCount = data.filter(d => getItemKind(d) === 'master').length
      const typeBreakdown = [
        { name: 'House',  value: houseCount,  color: TYPE_PALETTE.house  },
        { name: 'Master', value: masterCount, color: TYPE_PALETTE.master },
      ].filter(t => t.value > 0)

      setStats({ total, today, thisWeek, recentData, dailyTrend, typeBreakdown })
    } finally {
      setLoading(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Selamat Pagi'
    if (h < 15) return 'Selamat Siang'
    if (h < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  const RADIAN = Math.PI / 180
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    value: number
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="normal">
          {value}
        </text>
    )
  }

  if (loading) return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Memuat data...</p>
        </div>
      </div>
  )

  const statCards = [
    { label: 'Total Inspeksi',  value: stats?.total    ?? 0, icon: Package,    iconBg: 'bg-blue-200',  iconColor: 'text-blue-900',   sub: 'Total seluruh inspeksi'          },
    { label: 'Hari Ini',        value: stats?.today    ?? 0, icon: Calendar,   iconBg: 'bg-amber-100', iconColor: 'text-orange-500', sub: 'Jumlah inspeksi hari ini'        },
    { label: '7 Hari Terakhir', value: stats?.thisWeek ?? 0, icon: TrendingUp, iconBg: 'bg-green-300', iconColor: 'text-green-700',  sub: 'Jumlah inspeksi 7 hari terakhir' },
  ]

  return (
      <div className="space-y-4">

        {/* ── Greeting ── */}
        <div className="flex items-end justify-between gap-6 min-h-16">
          <div className="flex flex-col justify-center gap-0.5">
            <h2 className="text-xl font-bold text-gray-600 drop-shadow-sm">
              {greeting()}, {profile?.full_name || profile?.email || 'Pengguna'} 👋
            </h2>
            <p className="text-sm text-gray-600 drop-shadow-sm">
              {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })} — Berikut ringkasan data inspeksi
            </p>
          </div>
          <button
              onClick={() => clearAllInspectionData({ setLoading, onSuccess: () => window.location.reload() })}
              disabled={loading}
              className="mr-4 h-11 px-5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-red-500/20 transition-all duration-200 flex items-center gap-2">
            <Trash2 size={16} />
            {loading ? 'Menghapus...' : 'Clear Semua Data'}
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="bg-slate-100 rounded-lg border border-gray-300 flex divide-x divide-gray-300">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
                <div key={card.label} className="flex-1 pl-4 pr-6 pt-4 pb-5 flex items-start gap-1.5">
                  <div className={`p-2.5 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                    <Icon size={32} className={card.iconColor} />
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="p-0.5 flex items-center">
                      <span className="text-xl font-bold text-gray-800">{card.value.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="p-0.5 flex items-center">
                      <span className="text-lg font-medium text-gray-500">{card.label}</span>
                    </div>
                    <div className="p-0.5 flex items-center">
                      <span className="text-sm font-medium text-gray-800">{card.sub}</span>
                    </div>
                  </div>
                </div>
            )
          })}
        </div>

        {/* ── Charts Row ── */}
        <div className="flex gap-4">

          {/* Trend Area Chart */}
          <div className="w-full px-6 py-5 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2.5">
            <h3 className="text-xl font-semibold text-gray-600">Tren Inspeksi 7 Hari kebelakang</h3>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={stats?.dailyTrend} margin={{ top: 8, right: 48, left: 24, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1e3a5f" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 14, fontFamily: 'Inter' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 4px rgba(0,0,0,0.25)' }}
                    labelStyle={{ color: '#4b5563' }}
                    itemStyle={{ color: '#1e3a5f' }}
                />
                <Area type="monotone" dataKey="count" stroke="#1e3a5f" strokeWidth={5} fill="url(#trendGradient)"
                      dot={{ fill: '#1e3a5f', r: 5, stroke: '#e2e8f0', strokeWidth: 2 }} activeDot={{ r: 6 }} name="Inspeksi" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Type Breakdown Pie Chart */}
          <div className="w-full p-4 bg-slate-100 rounded-lg border border-gray-300 flex items-start justify-center gap-4 relative">
            <div className="flex flex-col items-start">
              <div className="p-px mb-1 absolute top-4 left-8">
                <span className="text-xl font-semibold text-gray-600">Distribusi Tipe Barang</span>
              </div>
              <ResponsiveContainer width={384} height={384}>
                <PieChart>
                  <Pie data={stats?.typeBreakdown} cx="50%" cy="50%" innerRadius={0} outerRadius={140}
                       dataKey="value" paddingAngle={0} label={renderCustomLabel} labelLine={false}>
                    {stats?.typeBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-32 pt-20 pb-px flex flex-col gap-2">
              {stats?.typeBreakdown.map(t => (
                  <div key={t.name} className="p-px flex items-center gap-2">
                    <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: t.color }} />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-700">{t.name}</span>
                      <span className="text-xs text-gray-400">{t.value.toLocaleString('id-ID')} data</span>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Inspections Table ── */}
        <div className="w-full flex flex-col border border-gray-300 rounded-lg overflow-hidden">

          {/* Table title */}
          <div className="h-16 px-4 bg-slate-100 border-b border-gray-300 flex justify-between items-center">
            <span className="text-xl font-semibold text-gray-600">Inspeksi Terbaru</span>
            <Link to="/data" className="flex items-center gap-0.5 text-blue-900 font-medium hover:underline shrink-0">
              <span className="text-base">Lihat Semua</span>
              <ChevronRight size={20} className="text-blue-900" />
            </Link>
          </div>

          {/* Column headers */}
          <div className="h-14 px-4 bg-slate-100 border-b border-gray-300 flex items-center gap-2">
            <div className="w-[72px] shrink-0">
              <span className="text-base font-semibold text-gray-800">TIPE</span>
            </div>
            {[
              { label: 'NO. MAWB',        flex: 'flex-[2] min-w-[80px]'  },
              { label: 'NO. HAWB',        flex: 'flex-[2] min-w-[80px]'  },
              { label: 'PIECES',          flex: 'flex-1 min-w-[50px]'    },
              { label: 'WAKTU MASUK',     flex: 'flex-[2] min-w-[110px]' },
              { label: 'TERAKHIR DIUBAH', flex: 'flex-[2] min-w-[110px]' },
              { label: 'STATUS',          flex: 'flex-[1.5] min-w-[80px]'},
            ].map(col => (
                <div key={col.label} className={`${col.flex} h-6 p-0.5 flex items-center`}>
                  <span className="text-base font-semibold text-gray-800 truncate">{col.label}</span>
                </div>
            ))}
          </div>

          {/* Rows */}
          {stats?.recentData.length ? stats.recentData.map((item) => {
            const kind        = getItemKind(item)
            const isHouse     = kind === 'house'
            const lastUpdated = item.updated_at ? new Date(item.updated_at) : null
            // Pieces: count from barang_v2 via blawb, same as DataPage
            const pieces      = item.blawb ? barangCountMap[item.blawb] : undefined

            return (
                <Link key={item.id} to={`/data/${item.id}`}
                      className={`min-h-[52px] px-4 border-b border-gray-300 flex items-center gap-2 transition-colors ${isHouse ? 'bg-slate-50 hover:bg-orange-50/60' : 'bg-slate-100 hover:bg-gray-50'}`}>

                  {/* TIPE */}
                  <div className="w-[72px] shrink-0 flex items-center">
                    {isHouse
                        ? <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-orange-100 text-orange-700 border border-orange-300">House</span>
                        : <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-blue-100 text-blue-800 border border-blue-300">Master</span>
                    }
                  </div>

                  {/* NO. MAWB */}
                  <div className="flex-[2] min-w-[80px] flex items-center">
                    <span className="text-sm font-bold text-orange-600 truncate">{item.mawb || '—'}</span>
                  </div>

                  {/* NO. HAWB */}
                  <div className="flex-[2] min-w-[80px] flex items-center">
                    <span className="text-sm font-semibold text-gray-600 truncate">{item.hawb || '—'}</span>
                  </div>

                  {/* PIECES */}
                  <div className="flex-1 min-w-[50px] flex items-center gap-1">
                    {pieces != null
                        ? <><span className="text-sm font-semibold text-gray-600">{pieces}</span><span className="text-sm text-gray-500 shrink-0">Pcs</span></>
                        : <span className="text-sm text-gray-400">—</span>
                    }
                  </div>

                  {/* WAKTU MASUK */}
                  <div className="flex-[2] min-w-[110px] flex flex-wrap items-center gap-1">
                    <Clock size={12} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-600 shrink-0">{format(new Date(item.waktu_masuk), 'dd/MM/yyyy', { locale: id })}</span>
                    <span className="text-sm text-gray-500 shrink-0">{format(new Date(item.waktu_masuk), 'HH:mm')}</span>
                  </div>

                  {/* TERAKHIR DIUBAH */}
                  <div className="flex-[2] min-w-[110px] flex flex-wrap items-center gap-1">
                    {lastUpdated ? (
                        <>
                          <Clock size={12} className="text-blue-400 shrink-0" />
                          <span className="text-sm font-semibold text-gray-600 shrink-0">{format(lastUpdated, 'dd/MM/yyyy', { locale: id })}</span>
                          <span className="text-sm text-gray-500 shrink-0">{format(lastUpdated, 'HH:mm')}</span>
                        </>
                    ) : <span className="text-sm text-gray-400">—</span>}
                  </div>

                  {/* STATUS */}
                  <div className="flex-[1.5] min-w-[80px] flex items-center">
                    <div className="px-2 py-0.5 bg-green-100 border border-green-400 rounded-full inline-flex items-center gap-0.5">
                      <div className="w-2.5 h-2.5 bg-green-600 rounded-full shrink-0" />
                      <span className="text-xs font-semibold text-green-700 whitespace-nowrap">Selesai</span>
                    </div>
                  </div>
                </Link>
            )
          }) : (
              <div className="py-8 text-center text-sm text-gray-500 bg-slate-100">Belum ada data inspeksi</div>
          )}
        </div>
      </div>
  )
}