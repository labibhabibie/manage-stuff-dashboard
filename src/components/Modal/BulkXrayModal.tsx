import { useState, useEffect } from 'react'
import {
    X, Send, Loader2, CheckCircle2, AlertTriangle,
    FileText, Image,
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { supabase, InspeksiBarang } from '../../lib/supabase.ts'
import { kirimFotoXray, addFotoXray, checkSubmissionExists } from '../../lib/beacukaiService.ts'

type ItemStatus = 'pending' | 'checking' | 'sending' | 'success' | 'skipped' | 'error'

type BulkItem = {
    inspeksi: InspeksiBarang
    barangCount: number
    imageUrls: string[]
    blawb: string
    tanggalAwb: string
    nomorAju: string
    kodeKantor: string
    status: ItemStatus
    message: string | null
    alreadyExists: boolean
}

type Props = {
    open: boolean
    onClose: () => void
    selectedIds: string[]
    onDone?: () => void
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, message }: { status: ItemStatus; message: string | null }) {
    const map: Record<ItemStatus, { bg: string; dot: string; text: string; label: string }> = {
        pending:  { bg: 'bg-stone-300',  dot: 'bg-gray-600',  text: 'text-gray-600',  label: 'Menunggu' },
        checking: { bg: 'bg-amber-200',  dot: 'bg-amber-500', text: 'text-amber-600', label: 'Mengecek' },
        sending:  { bg: 'bg-blue-200',   dot: 'bg-blue-600',  text: 'text-blue-600',  label: 'Mengirim' },
        success:  { bg: 'bg-green-300',  dot: 'bg-green-600', text: 'text-green-600', label: 'Selesai'  },
        skipped:  { bg: 'bg-amber-200',  dot: 'bg-amber-500', text: 'text-amber-600', label: 'Ditambah' },
        error:    { bg: 'bg-red-200',    dot: 'bg-red-600',   text: 'text-red-600',   label: 'Gagal'    },
    }
    const { bg, dot, text, label } = map[status]
    return (
        <div className="flex flex-col items-start gap-1 py-1">
            <div className={`px-2 py-1 ${bg} rounded-full flex justify-center items-center gap-1`}>
                <div className="flex items-center">
                    {(status === 'checking' || status === 'sending')
                        ? <Loader2 size={12} className={`${text} animate-spin`} />
                        : <div className={`w-2.5 h-2.5 ${dot} rounded-full`} />
                    }
                </div>
                <span className={`text-xs font-semibold ${text} leading-none`}>{label}</span>
            </div>
            {message && (
                <p className="text-[10px] text-gray-400 max-w-[160px] leading-tight">{message}</p>
            )}
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkXrayModal({ open, onClose, selectedIds, onDone }: Props) {
    const [items, setItems]     = useState<BulkItem[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [done, setDone]       = useState(false)

    const sentCount    = items.filter(i => i.status === 'success').length
    const skippedCount = items.filter(i => i.status === 'skipped').length
    const errorCount   = items.filter(i => i.status === 'error').length
    const totalImages  = items.reduce((s, i) => s + i.imageUrls.length, 0)
    const missingPhoto = items.filter(i => i.imageUrls.length === 0).length
    const readyCount   = items.filter(i => i.imageUrls.length > 0).length

    useEffect(() => {
        if (!open || selectedIds.length === 0) return
        setDone(false)
        setSending(false)
        loadItems()
    }, [open, selectedIds])

    const loadItems = async () => {
        setLoading(true)

        const { data: inspeksiRows } = await supabase
            .from('inspeksi_barang_v3').select('*').in('id', selectedIds)
        if (!inspeksiRows) { setLoading(false); return }

        const mawbList = inspeksiRows.map(r => r.mawb).filter(Boolean)
        const hawbList = inspeksiRows.map(r => r.hawb).filter(Boolean)

        const orConditions = [
            ...mawbList.map(m => `mawb.eq.${m}`),
            ...hawbList.map(h => `hawb.eq.${h}`),
        ]

        const { data: allBarang } = orConditions.length > 0
            ? await supabase.from('barang_v2').select('*').or(orConditions.join(','))
            : { data: [] }

        const built: BulkItem[] = inspeksiRows.map(inspeksi => {
            const related = (allBarang || []).filter(b =>
                (inspeksi.mawb && b.mawb === inspeksi.mawb) ||
                (inspeksi.hawb && b.hawb === inspeksi.hawb)
            )

            const imageUrls = related.flatMap(b =>
                [b.foto_url_atas, b.foto_url_samping].filter(Boolean)
            ) as string[]

            const blawb = (inspeksi.hawb && inspeksi.hawb.trim() !== '')
                ? inspeksi.hawb
                : (inspeksi.mawb || '')

            const firstBarang = related[0]
            const nomorAju  = inspeksi.aju        || firstBarang?.aju        || 'FHAN26044069'
            const kodeKantor = inspeksi.kode_kantor || firstBarang?.kode_kantor || 'BGD'
            const tanggalAwb = inspeksi.tanggal_awb || firstBarang?.tanggal_awb || new Date().toISOString().split('T')[0]

            return {
                inspeksi,
                barangCount: related.length,
                imageUrls,
                blawb,
                tanggalAwb,
                nomorAju,
                kodeKantor,
                status: 'pending' as ItemStatus,
                message: null,
                alreadyExists: false,
            }
        })

        const checked = await Promise.all(built.map(async item => {
            if (!item.blawb) return item
            const exists = await checkSubmissionExists(item.blawb)
            return { ...item, alreadyExists: exists }
        }))

        const sorted = checked.sort((a, b) => {
            const tA = a.inspeksi.waktu_masuk ? new Date(a.inspeksi.waktu_masuk).getTime() : 0
            const tB = b.inspeksi.waktu_masuk ? new Date(b.inspeksi.waktu_masuk).getTime() : 0
            return tB - tA
        })

        setItems(sorted)
        setLoading(false)
    }

    const updateItem = (idx: number, patch: Partial<BulkItem>) =>
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))

    const handleSendAll = async () => {
        setSending(true)
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.imageUrls.length === 0) {
                updateItem(i, { status: 'error', message: 'Tidak ada foto tersedia' })
                continue
            }
            if (!item.blawb) {
                updateItem(i, { status: 'error', message: 'BL/AWB tidak ditemukan' })
                continue
            }

            updateItem(i, { status: 'checking' })

            const files: File[] = []
            for (const url of item.imageUrls) {
                try {
                    const res = await fetch(url)
                    const blob = await res.blob()
                    files.push(new File([blob], url.split('/').pop() || 'foto.jpg', { type: blob.type }))
                } catch {
                }
            }
            if (files.length === 0) {
                updateItem(i, { status: 'error', message: 'Gagal mengambil foto' })
                continue
            }

            updateItem(i, { status: 'sending' })

            const payload = {
                nomorAju:    item.nomorAju,
                nomorBlAwb:  item.blawb,
                tanggalBlAwb: item.tanggalAwb,
                kodeKantor:  item.kodeKantor,
                images: files,
            }

            const res = item.alreadyExists
                ? await addFotoXray(payload)
                : await kirimFotoXray(payload)

            if (res.success) {
                updateItem(i, {
                    status: item.alreadyExists ? 'skipped' : 'success',
                    message: item.alreadyExists
                        ? `Ditambahkan ke submission yang ada (${res.data?.jumlahFotoTerupload} foto)`
                        : `${res.data?.jumlahFotoTerupload} foto terkirim`,
                })
            } else {
                updateItem(i, { status: 'error', message: res.message })
            }
        }
        setSending(false)
        setDone(true)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!sending ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative w-full max-w-4xl p-5 bg-slate-100 rounded-2xl flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-hidden">

                {/* ── Header ── */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-medium text-gray-800">Confirmation</span>
                        {!sending && (
                            <button
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors shrink-0"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <span className="text-base font-normal text-gray-800">
                        {selectedIds.length} data inspeksi dipilih · {totalImages} total foto
                    </span>
                </div>

                {/* ── Body (scrollable) ── */}
                <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-7 h-7 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-gray-400">Memuat data inspeksi...</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary done stats */}
                            {done && (
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Terkirim', value: sentCount,    bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-600' },
                                        { label: 'Ditambah', value: skippedCount, bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-600' },
                                        { label: 'Gagal',    value: errorCount,   bg: 'bg-red-100',   border: 'border-red-300',   text: 'text-red-600'  },
                                    ].map(s => (
                                        <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg} ${s.border}`}>
                                            <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
                                            <p className={`text-xs mt-0.5 ${s.text}`}>{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Table */}
                            <div className="flex flex-col">
                                {/* Column headers */}
                                <div className="h-16 px-4 bg-slate-100 rounded-tl-lg rounded-tr-lg border border-gray-300 flex items-center gap-3">
                                    <div className="flex-[2] min-w-[100px] flex items-center">
                                        <span className="text-base font-semibold text-gray-800">NO. AJU</span>
                                    </div>
                                    <div className="flex-[2] min-w-[100px] flex items-center">
                                        <span className="text-base font-semibold text-gray-800">WAKTU MASUK</span>
                                    </div>
                                    <div className="flex-[2] min-w-[90px] flex items-center">
                                        <span className="text-base font-semibold text-gray-800">BL/AWB</span>
                                    </div>
                                    <div className="flex-[2] min-w-[90px] flex items-center">
                                        <span className="text-base font-semibold text-gray-800">KODE KANTOR</span>
                                    </div>
                                    <div className="flex-1 min-w-[70px] flex items-center">
                                        <span className="text-base font-semibold text-gray-800">FOTO</span>
                                    </div>
                                    {/* FIX #4: wider status column so badge has room */}
                                    <div className="flex-[2.5] min-w-[110px] flex items-center">
                                        <span className="text-base font-semibold text-gray-800">STATUS</span>
                                    </div>
                                </div>

                                {/* Rows */}
                                {items.map((item, idx) => {
                                    const isLast = idx === items.length - 1
                                    const rowBg =
                                        item.status === 'success'  ? 'bg-green-50' :
                                            item.status === 'error'    ? 'bg-red-50'   :
                                                item.status === 'sending' || item.status === 'checking' ? 'bg-blue-50' :
                                                    'bg-slate-100 hover:bg-gray-50'

                                    return (
                                        <div
                                            key={item.inspeksi.id}
                                            className={`min-h-[56px] py-2 px-4 ${rowBg} border-l border-r border-b border-gray-300 flex items-center gap-3 transition-colors ${isLast ? 'rounded-bl-lg rounded-br-lg' : ''}`}
                                        >
                                            {/* NO. AJU — FIX #1: use nomorAju field */}
                                            <div className="flex-[2] min-w-[100px] min-w-0 flex items-center">
                                                <span className="text-sm font-semibold text-blue-900 truncate">
                                                    {item.nomorAju || '—'}
                                                </span>
                                            </div>

                                            {/* WAKTU MASUK */}
                                            <div className="flex-[2] min-w-[100px] min-w-0 flex flex-wrap items-center gap-1">
                                                <span className="text-sm font-semibold text-gray-600 shrink-0">
                                                    {item.inspeksi.waktu_masuk
                                                        ? format(new Date(item.inspeksi.waktu_masuk), 'dd/MM/yyyy', { locale: id })
                                                        : '—'}
                                                </span>
                                                <span className="text-sm font-normal text-gray-600 shrink-0">
                                                    {item.inspeksi.waktu_masuk
                                                        ? format(new Date(item.inspeksi.waktu_masuk), 'HH:mm')
                                                        : ''}
                                                </span>
                                            </div>

                                            {/* BL/AWB — FIX #2: hawb-first */}
                                            <div className="flex-[2] min-w-[90px] min-w-0 flex items-center gap-1.5">
                                                <span className="text-sm font-semibold text-gray-600 truncate">
                                                    {item.blawb || '—'}
                                                </span>
                                                {item.alreadyExists && !done && (
                                                    <span className="text-[9px] text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full shrink-0">
                                                        ada data
                                                    </span>
                                                )}
                                            </div>

                                            {/* KODE KANTOR — FIX #1: use kodeKantor field */}
                                            <div className="flex-[2] min-w-[90px] min-w-0 flex items-center">
                                                <span className="text-sm font-semibold text-gray-600 truncate">
                                                    {item.kodeKantor || <span className="italic text-gray-400">—</span>}
                                                </span>
                                            </div>

                                            {/* FOTO */}
                                            <div className="flex-1 min-w-[70px] min-w-0 flex items-center gap-1">
                                                <Image size={12} className="text-gray-400 shrink-0" />
                                                <span className={`text-sm font-semibold truncate ${item.imageUrls.length === 0 ? 'text-gray-400 italic' : 'text-gray-600'}`}>
                                                    {item.imageUrls.length === 0 ? 'Tidak ada' : `${item.imageUrls.length} Foto`}
                                                </span>
                                            </div>

                                            {/* STATUS — FIX #4: wider column */}
                                            <div className="flex-[2.5] min-w-[110px] min-w-0 flex items-center">
                                                <StatusBadge status={item.status} message={item.message} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Warning: missing photos */}
                            {missingPhoto > 0 && (
                                <div className="px-4 py-3 bg-yellow-100 rounded-lg border border-amber-500 flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                                    <span className="text-base font-normal text-amber-500">
                                        {missingPhoto} Data tidak memiliki foto dan akan dilewati saat pengiriman
                                    </span>
                                </div>
                            )}

                            {/* Confirmation note (pre-send only) */}
                            {!done && !sending && (
                                <div className="flex items-start gap-2.5 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                                    <FileText size={14} className="text-gray-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-sm text-gray-700">
                                            Yakin ingin mengirim{' '}
                                            <span className="font-semibold">{readyCount} data</span> ke Bea Cukai?
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Data yang sudah memiliki submission sebelumnya akan otomatis menggunakan "Tambah Foto".
                                            {missingPhoto > 0 && ` ${missingPhoto} data tanpa foto akan dilewati.`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Done summary */}
                            {done && (sentCount > 0 || skippedCount > 0) && (
                                <div className="flex items-center gap-1.5 text-sm text-green-600 p-0.5">
                                    <CheckCircle2 size={16} className="shrink-0" />
                                    <span>Selesai — {sentCount + skippedCount} berhasil, {errorCount} gagal</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Footer buttons ── */}
                <div className="flex items-center gap-2">
                    {!done && (
                        <button
                            onClick={handleSendAll}
                            disabled={sending || loading || readyCount === 0}
                            className="flex-1 p-4 bg-green-600 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex justify-center items-center gap-2.5 hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {sending
                                ? <Loader2 size={18} className="text-slate-100 animate-spin shrink-0" />
                                : <Send size={18} className="text-slate-100 shrink-0" />
                            }
                            <span className="text-base font-semibold text-slate-100 whitespace-nowrap">
                                {sending ? 'Mengirim...' : `Kirim ${readyCount} Data ke Bea Cukai`}
                            </span>
                        </button>
                    )}
                    <button
                        onClick={() => { onClose(); if (done && onDone) onDone() }}
                        disabled={sending}
                        className="flex-1 p-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-red-600 flex justify-center items-center gap-2.5 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                        <span className="text-base font-semibold text-red-600">
                            {done ? 'Tutup' : 'Batal'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}