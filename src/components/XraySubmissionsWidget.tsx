import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Image, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
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

export default function XraySubmissionsWidget() {
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading] = useState(true)
    const [totalFoto, setTotalFoto] = useState(0)

    useEffect(() => {
        fetchSubmissions()
    }, [])

    const fetchSubmissions = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('beacukai_xray_submissions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        setSubmissions(data || [])
        setTotalFoto((data || []).reduce((sum, s) => sum + (s.total_foto || 0), 0))
        setLoading(false)
    }

    if (loading) return (
        <div className="card p-5">
            <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        </div>
    )

    return (
        <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-surface-200">Pengiriman X-Ray ke Bea Cukai</h3>
                    <p className="text-xs text-surface-400 mt-0.5">
                        <span className="font-mono text-emerald-400">{submissions.length}</span> submission ·{' '}
                        <span className="font-mono text-brand-400">{totalFoto}</span> total foto
                    </p>
                </div>
                <button
                    onClick={fetchSubmissions}
                    className="text-xs text-surface-400 hover:text-surface-200 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {submissions.length === 0 ? (
                <div className="text-center py-8">
                    <AlertTriangle size={24} className="text-surface-600 mx-auto mb-2" />
                    <p className="text-xs text-surface-500">Belum ada data pengiriman X-Ray</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-surface-700">
                            {['Nomor AJU', 'BL/AWB', 'Tanggal AWB', 'Kode Kantor', 'Foto', 'Dikirim'].map(h => (
                                <th key={h} className="text-left py-2 px-3 text-xs font-medium text-surface-400 uppercase tracking-wider">
                                    {h}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-800">
                        {submissions.map(s => (
                            <tr key={s.id} className="hover:bg-surface-800/50 transition-colors">
                                <td className="py-2.5 px-3">
                                    <span className="font-mono text-xs text-brand-400">{s.nomor_aju}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                    <span className="font-mono text-xs text-surface-300">{s.nomor_blawb}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                    <span className="text-xs text-surface-300">{s.tanggal_blawb}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                    <span className="text-xs text-surface-300">{s.kode_kantor}</span>
                                </td>
                                <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 text-xs text-surface-300">
                      <Image size={11} className="text-surface-500" />
                        {s.total_foto}
                    </span>
                                </td>
                                <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1 text-xs text-surface-400">
                                        <Clock size={10} className="text-surface-600" />
                                        {format(new Date(s.created_at), 'dd/MM/yy HH:mm', { locale: id })}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Status badge summary */}
            <div className="mt-4 pt-4 border-t border-surface-700 flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <p className="text-xs text-surface-400">
                    Semua data disimpan ke tabel <span className="font-mono text-surface-300">beacukai_xray_submissions</span> &{' '}
                    <span className="font-mono text-surface-300">beacukai_xray_images</span>
                </p>
            </div>
        </div>
    )
}