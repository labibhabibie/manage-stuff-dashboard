import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, AlertTriangle, TrendingUp, Calendar,
  Atom, Leaf, Droplets, Zap, ArrowRight, Clock
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { format, subDays, startOfDay } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase, InspeksiBarang } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Stats = {
  total: number
  today: number
  thisWeek: number
  logam: number
  organik: number
  cairan: number
  sintetis: number
  recentData: InspeksiBarang[]
  dailyTrend: { date: string; count: number }[]
  typeBreakdown: { name: string; value: number; color: string }[]
}

const COLORS = {
  logam: '#94a3b8', organik: '#4ade80', cairan: '#60a5fa', sintetis: '#c084fc'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('inspeksi_barang')
        .select('*')
        .order('created_at', { ascending: false })

      if (!data) return

      const now = new Date()
      const todayStart = startOfDay(now)
      const weekStart = subDays(now, 7)

      const total = data.length
      const today = data.filter(d => new Date(d.created_at) >= todayStart).length
      const thisWeek = data.filter(d => new Date(d.created_at) >= weekStart).length
      const logam = data.filter(d => d.logam).length
      const organik = data.filter(d => d.organik).length
      const cairan = data.filter(d => d.cairan).length
      const sintetis = data.filter(d => d.sintetis).length

      // Daily trend last 7 days
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

      setStats({
        total, today, thisWeek, logam, organik, cairan, sintetis,
        recentData: data.slice(0, 5),
        dailyTrend,
        typeBreakdown: [
          { name: 'Logam', value: logam, color: COLORS.logam },
          { name: 'Organik', value: organik, color: COLORS.organik },
          { name: 'Cairan', value: cairan, color: COLORS.cairan },
          { name: 'Sintetis', value: sintetis, color: COLORS.sintetis },
        ]
      })
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Inspeksi', value: stats?.total ?? 0, icon: Package, color: 'brand', sub: 'Semua data' },
          { label: 'Hari Ini', value: stats?.today ?? 0, icon: Calendar, color: 'blue', sub: 'Sejak 00:00' },
          { label: 'Minggu Ini', value: stats?.thisWeek ?? 0, icon: TrendingUp, color: 'green', sub: '7 hari terakhir' },
          { label: 'Perlu Perhatian', value: (stats?.logam ?? 0) + (stats?.sintetis ?? 0), icon: AlertTriangle, color: 'amber', sub: 'Logam + Sintetis' },
        ].map(card => {
          const Icon = card.icon
          const colorMap: Record<string, string> = {
            brand: 'text-brand-400 bg-brand-900/30 border-brand-800/60',
            blue: 'text-blue-400 bg-blue-900/30 border-blue-800/60',
            green: 'text-green-400 bg-green-900/30 border-green-800/60',
            amber: 'text-amber-400 bg-amber-900/30 border-amber-800/60',
          }
          return (
            <div key={card.label} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg border ${colorMap[card.color]}`}>
                  <Icon size={18} />
                </div>
              </div>
              <p className="text-2xl font-display font-bold text-white">{card.value.toLocaleString('id-ID')}</p>
              <p className="text-xs font-medium text-surface-300 mt-0.5">{card.label}</p>
              <p className="text-xs text-surface-500 mt-0.5">{card.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Type stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Logam', value: stats?.logam ?? 0, icon: Atom, color: '#94a3b8', cls: 'badge-logam' },
          { label: 'Organik', value: stats?.organik ?? 0, icon: Leaf, color: '#4ade80', cls: 'badge-organik' },
          { label: 'Cairan', value: stats?.cairan ?? 0, icon: Droplets, color: '#60a5fa', cls: 'badge-cairan' },
          { label: 'Sintetis', value: stats?.sintetis ?? 0, icon: Zap, color: '#c084fc', cls: 'badge-sintetis' },
        ].map(t => {
          const Icon = t.icon
          const pct = stats?.total ? Math.round((t.value / stats.total) * 100) : 0
          return (
            <div key={t.label} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={t.cls}><Icon size={12} />{t.label}</span>
                <span className="text-xs font-mono text-surface-400">{pct}%</span>
              </div>
              <p className="text-xl font-bold font-display" style={{ color: t.color }}>{t.value}</p>
              <div className="mt-2 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: t.color }} />
              </div>
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

        {/* Pie chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Distribusi Tipe</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={stats?.typeBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {stats?.typeBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {stats?.typeBreakdown.map(t => (
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
                {['ID Barang', 'Waktu Masuk', 'Tipe Terdeteksi', 'Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-surface-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {stats?.recentData.map(item => (
                <tr key={item.id} className="hover:bg-surface-800/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs text-brand-400">{item.id_barang}</td>
                  <td className="py-2.5 px-3 text-surface-300 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} className="text-surface-500" />
                      {format(new Date(item.waktu_masuk), 'dd/MM/yy HH:mm')}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex gap-1 flex-wrap">
                      {item.logam && <span className="badge-logam"><Atom size={10} />Logam</span>}
                      {item.organik && <span className="badge-organik"><Leaf size={10} />Organik</span>}
                      {item.cairan && <span className="badge-cairan"><Droplets size={10} />Cairan</span>}
                      {item.sintetis && <span className="badge-sintetis"><Zap size={10} />Sintetis</span>}
                      {!item.logam && !item.organik && !item.cairan && !item.sintetis && (
                        <span className="text-xs text-surface-500 italic">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900/30 text-green-400 border border-green-800/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Selesai
                    </span>
                  </td>
                </tr>
              ))}
              {!stats?.recentData.length && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-surface-500 text-sm">
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
