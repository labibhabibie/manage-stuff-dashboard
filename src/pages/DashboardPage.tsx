import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, TrendingUp, Calendar, ArrowRight, Clock
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { format, subDays, startOfDay } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase, InspeksiBarang } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGudangData } from '../hooks/useGudangData'

type Stats = {
  total: number
  today: number
  thisWeek: number
  recentData: InspeksiBarang[]
  dailyTrend: { date: string; count: number }[]
  airlineBreakdown: { name: string; value: number; color: string }[]
}

const PALETTE = ['#14b8a6', '#60a5fa', '#c084fc', '#4ade80', '#f97316', '#f43f5e', '#94a3b8']

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()
  const { getByIndex } = useGudangData()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
          .from('inspeksi_barang_v2')
          .select('*')
          .order('created_at', { ascending: false })

      if (error || !data) {
        console.error('Supabase error:', error)
        setStats({                          // ← always set stats, never leave as null
          total: 0, today: 0, thisWeek: 0,
          recentData: [], dailyTrend: [], airlineBreakdown: []
        })
        return
      }

      const now = new Date()
      const todayStart = startOfDay(now)
      const weekStart = subDays(now, 7)

      const total = data.length
      const today = data.filter(d => new Date(d.created_at) >= todayStart).length
      const thisWeek = data.filter(d => new Date(d.created_at) >= weekStart).length
      const recentData = data.slice(0, 8)

      const dailyTrend = Array.from({ length: 7 }, (_, i) => {
        const day = subDays(now, 6 - i)
        const start = startOfDay(day)
        const end = startOfDay(subDays(now, 5 - i))
        const count = data.filter(d => {
          const dt = new Date(d.created_at)
          return dt >= start && dt < end
        }).length
        return { date: format(day, 'dd MMM', { locale: id }), count }
      })

      const airlineMap: Record<string, number> = {}
      data.forEach(d => {
        const key = d.airline_code || 'Lainnya'
        airlineMap[key] = (airlineMap[key] || 0) + 1
      })
      const airlineBreakdown = Object.entries(airlineMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 7)
          .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))

      setStats({ total, today, thisWeek, recentData, dailyTrend, airlineBreakdown })  // ← now always reached
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

  if (loading) return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-surface-400 text-sm">Memuat data...</p>
        </div>
      </div>
  )

  return (
      <div className="space-y-6 max-w-7xl">
        {/* Greeting */}
        <div>
          <h2 className="text-xl font-display font-bold text-white">
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'Pengguna'} 👋
          </h2>
          <p className="text-surface-400 text-sm mt-1">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })} — Berikut ringkasan data inspeksi
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            {
              label: 'Total Inspeksi',
              value: stats?.total ?? 0,
              icon: Package,
              color: 'brand: text-brand-400 bg-brand-900/30 border-brand-800/60',
              sub: 'Semua data',
            },
            {
              label: 'Hari Ini',
              value: stats?.today ?? 0,
              icon: Calendar,
              color: 'blue: text-blue-400 bg-blue-900/30 border-blue-800/60',
              sub: 'Sejak 00:00',
            },
            {
              label: 'Minggu Ini',
              value: stats?.thisWeek ?? 0,
              icon: TrendingUp,
              color: 'green: text-green-400 bg-green-900/30 border-green-800/60',
              sub: '7 hari terakhir',
            },
          ].map(card => {
            const Icon = card.icon
            const [, cls] = card.color.split(': ')
            return (
                <div key={card.label} className="card p-5">
                  <div className={`inline-flex p-2 rounded-lg border mb-3 ${cls}`}>
                    <Icon size={18} />
                  </div>
                  <p className="text-2xl font-display font-bold text-white">
                    {card.value.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs font-medium text-surface-300 mt-0.5">{card.label}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{card.sub}</p>
                </div>
            )
          })}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Trend chart */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-surface-200 mb-4">Tren Inspeksi 7 Hari Terakhir</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats?.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#2dd4bf' }}
                />
                <Line type="monotone" dataKey="count" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6', r: 4 }} name="Inspeksi" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Airline breakdown pie */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-surface-200 mb-4">Distribusi Airline</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                    data={stats?.airlineBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={75}
                    paddingAngle={3} dataKey="value"
                >
                  {stats?.airlineBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {stats?.airlineBreakdown.map(t => (
                  <div key={t.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-surface-400">{t.name}</span>
                    </div>
                    <span className="font-mono text-surface-300">{t.value}</span>
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent data */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-200">Inspeksi Terbaru</h3>
            <Link to="/data" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
              Lihat semua <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
              <tr className="border-b border-surface-700">
                {['No AJU', 'MAWB', 'HAWB', 'Airline', 'Rute', 'Waktu Masuk', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-surface-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
              {stats?.recentData.map((item, idx) => {
                const gudang = getByIndex(idx);
                return (
                    <tr key={item.id} className="hover:bg-surface-800/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-xs text-brand-400">{item.aju || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-surface-300">{item.mawb || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-surface-300">{item.hawb || '—'}</td>
                      <td>{item.airline_code ||
                          <span className="italic text-surface-600">{gudang.airline_code}</span>}</td>
                      <td>{item.ori_dest || <span className="italic text-surface-600">{gudang.ori_dest}</span>}</td>
                      <td className="py-2.5 px-3 text-surface-300 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-surface-500"/>
                          {format(new Date(item.waktu_masuk), 'dd/MM/yy HH:mm')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900/30 text-green-400 border border-green-800/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                      Selesai
                    </span>
                      </td>
                    </tr>
                );
              })}
              {!stats?.recentData.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-surface-500 text-sm">
                      Belum ada data inspeksi
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}