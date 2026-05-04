import { useState, useEffect } from 'react'
import {
    X, Send, Loader2, CheckCircle2, AlertTriangle,
    Clock, FileText, Image, RefreshCw,
} from 'lucide-react'
import { supabase, InspeksiBarang } from '../lib/supabase'
import { kirimFotoXray, addFotoXray, checkSubmissionExists } from '../lib/beacukaiService'

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = 'pending' | 'checking' | 'sending' | 'success' | 'skipped' | 'error'

type BulkItem = {
    inspeksi: InspeksiBarang
    barangCount: number
    imageUrls: string[]
    blawb: string
    tanggalAwb: string
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status, message }: { status: ItemStatus; message: string | null }) {
    const map: Record<ItemStatus, { cls: string; label: string }> = {
        pending:  { cls: 'bg-surface-700 text-surface-400',         label: 'Menunggu'  },
        checking: { cls: 'bg-amber-900/30 text-amber-400',          label: 'Mengecek'  },
        sending:  { cls: 'bg-brand-900/30 text-brand-400',          label: 'Mengirim'  },
        success:  { cls: 'bg-green-900/30 text-green-400',          label: 'Terkirim'  },
        skipped:  { cls: 'bg-amber-900/30 text-amber-400',          label: 'Ditambah'  },
        error:    { cls: 'bg-red-900/30 text-red-400',              label: 'Gagal'     },
    }
    const { cls, label } = map[status]
    return (
        <div className="flex flex-col items-end gap-0.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
        {status === 'checking' || status === 'sending'
            ? <Loader2 size={9} className="animate-spin" />
            : null
        }
          {status === 'success' && <CheckCircle2 size={9} />}
          {status === 'error'   && <AlertTriangle size={9} />}
          {label}
      </span>
            {message && (
                <p className="text-[9px] text-surface-500 text-right max-w-[140px] leading-tight">{message}</p>
            )}
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkXrayModal({ open, onClose, selectedIds, onDone }: Props) {
    const [items, setItems] = useState<BulkItem[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [done, setDone] = useState(false)

    const sentCount   = items.filter(i => i.status === 'success').length
    const skippedCount = items.filter(i => i.status === 'skipped').length
    const errorCount  = items.filter(i => i.status === 'error').length
    const totalImages = items.reduce((s, i) => s + i.imageUrls.length, 0)

    // ── Load & prepare items ───────────────────────────────────────────────────
    useEffect(() => {
        if (!open || selectedIds.length === 0) return
        setDone(false)
        setSending(false)
        loadItems()
    }, [open, selectedIds])

    const loadItems = async () => {
        setLoading(true)

        // 1. Fetch all selected inspeksi rows
        const { data: inspeksiRows } = await supabase
            .from('inspeksi_barang_v2')
            .select('*')
            .in('id', selectedIds)

        if (!inspeksiRows) { setLoading(false); return }

        // 2. Fetch all related barang rows in one query
        const mawbList = inspeksiRows.map(r => r.mawb).filter(Boolean)
        const hawbList = inspeksiRows.map(r => r.hawb).filter(Boolean)

        const { data: allBarang } = await supabase
            .from('barang')
            .select('*')
            .or(
                [...mawbList.map(m => `mawb.eq.${m}`), ...hawbList.map(h => `hawb.eq.${h}`)].join(',')
            )

        // 3. Build bulk items
        const built: BulkItem[] = inspeksiRows.map(inspeksi => {
            const related = (allBarang || []).filter(
                b => (inspeksi.mawb && b.mawb === inspeksi.mawb) ||
                    (inspeksi.hawb && b.hawb === inspeksi.hawb)
            )

            const imageUrls = related.flatMap(b => [
                b.foto_url_atas,
                b.foto_url_samping,
            ]).filter(Boolean) as string[]

            return {
                inspeksi,
                barangCount: related.length,
                imageUrls,
                blawb:       inspeksi.mawb || inspeksi.hawb || '',
                tanggalAwb:  inspeksi.tanggal_awb || '',
                kodeKantor:  inspeksi.kode_kantor || '',
                status:      'pending' as ItemStatus,
                message:     null,
                alreadyExists: false,
            }
        })

        // 4. Check which ones already exist
        const checked = await Promise.all(
            built.map(async item => {
                if (!item.blawb) return item
                const exists = await checkSubmissionExists(item.blawb)
                return { ...item, alreadyExists: exists }
            })
        )

        setItems(checked)
        setLoading(false)
    }

    // ── Update a single item's status ─────────────────────────────────────────
    const updateItem = (idx: number, patch: Partial<BulkItem>) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
    }

    // ── Send all ──────────────────────────────────────────────────────────────
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

            // Fetch image files
            const files: File[] = []
            for (const url of item.imageUrls) {
                try {
                    const res = await fetch(url)
                    const blob = await res.blob()
                    const name = url.split('/').pop() || 'foto.jpg'
                    files.push(new File([blob], name, { type: blob.type }))
                } catch {
                    // skip failed fetches
                }
            }

            if (files.length === 0) {
                updateItem(i, { status: 'error', message: 'Gagal mengambil foto' })
                continue
            }

            updateItem(i, { status: 'sending' })

            const payload = {
                nomorAju:     item.inspeksi.aju || '',
                nomorBlAwb:   item.blawb,
                tanggalBlAwb: item.tanggalAwb,
                kodeKantor:   item.kodeKantor,
                images:       files,
            }

            // Use kirim or add depending on whether it already exists
            const res = item.alreadyExists
                ? await addFotoXray(payload)
                : await kirimFotoXray(payload)

            if (res.success) {
                updateItem(i, {
                    status:  item.alreadyExists ? 'skipped' : 'success',
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

    const hasItems     = items.length > 0
    const allHavePhoto = items.every(i => i.imageUrls.length > 0)
    const missingPhoto = items.filter(i => i.imageUrls.length === 0).length

    return (
        <div className="fixed inset-0 z-50 flex justify-center top-0 p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!sending ? onClose : undefined} />

            {/* Modal */}
            <div className="relative bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col h-fit max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-surface-700 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-900/40 text-emerald-400">
                            <Send size={16} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white text-sm">
                                Kirim Bulk X-Ray ke Bea Cukai
                            </h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {selectedIds.length} data inspeksi dipilih · {totalImages} total foto
                            </p>
                        </div>
                    </div>
                    {!sending && (
                        <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors">
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-surface-400">Memuat data inspeksi...</p>
                        </div>
                    ) : (
                        <>
                            {/* Warning: missing photos */}
                            {missingPhoto > 0 && (
                                <div className="flex items-start gap-2.5 p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg">
                                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-400">
                                        <span className="font-semibold">{missingPhoto} data</span> tidak memiliki foto dan akan dilewati saat pengiriman.
                                    </p>
                                </div>
                            )}

                            {/* Summary stats when done */}
                            {done && (
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Terkirim',  value: sentCount,    cls: 'text-green-400 bg-green-900/20 border-green-800/50' },
                                        { label: 'Ditambah',  value: skippedCount, cls: 'text-amber-400 bg-amber-900/20 border-amber-800/50' },
                                        { label: 'Gagal',     value: errorCount,   cls: 'text-red-400 bg-red-900/20 border-red-800/50'       },
                                    ].map(s => (
                                        <div key={s.label} className={`rounded-xl border p-3 text-center ${s.cls}`}>
                                            <p className="text-xl font-bold font-display">{s.value}</p>
                                            <p className="text-xs mt-0.5">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Items table */}
                            <div className="rounded-xl border border-surface-700 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                    <tr className="bg-surface-800/60 border-b border-surface-700">
                                        {['No AJU', 'BL/AWB', 'Tgl AWB', 'Kode Kantor', 'Foto', 'Status'].map(h => (
                                            <th key={h} className="text-left py-2.5 px-3 text-[10px] font-medium text-surface-400 uppercase tracking-wider">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-800">
                                    {items.map((item, idx) => (
                                        <tr
                                            key={item.inspeksi.id}
                                            className={`transition-colors ${
                                                item.status === 'sending' || item.status === 'checking'
                                                    ? 'bg-brand-900/10'
                                                    : item.status === 'success'
                                                        ? 'bg-green-900/10'
                                                        : item.status === 'error'
                                                            ? 'bg-red-900/10'
                                                            : 'hover:bg-surface-800/40'
                                            }`}
                                        >
                                            <td className="py-3 px-3">
                                                <span className="font-mono text-brand-400">{item.inspeksi.aju || '—'}</span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className="font-mono text-surface-300">{item.blawb || '—'}</span>
                                                {item.alreadyExists && !done && (
                                                    <span className="ml-1.5 text-[9px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded-full">ada data</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-surface-400">
                                                {item.tanggalAwb || <span className="italic text-surface-600">—</span>}
                                            </td>
                                            <td className="py-3 px-3 text-surface-400">
                                                {item.kodeKantor || <span className="italic text-surface-600">—</span>}
                                            </td>
                                            <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 ${
                              item.imageUrls.length === 0 ? 'text-surface-600 italic' : 'text-surface-300'
                          }`}>
                            <Image size={10} className="text-surface-500" />
                              {item.imageUrls.length === 0 ? 'Tidak ada' : `${item.imageUrls.length} foto`}
                          </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <StatusBadge status={item.status} message={item.message} />
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Confirmation text */}
                            {!done && !sending && (
                                <div className="flex items-start gap-2.5 p-3 bg-surface-800/50 border border-surface-700 rounded-lg">
                                    <FileText size={13} className="text-surface-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-surface-300">
                                            Yakin ingin mengirim{' '}
                                            <span className="font-semibold text-white">{items.filter(i => i.imageUrls.length > 0).length} data</span>
                                            {' '}ke Bea Cukai?
                                        </p>
                                        <p className="text-[11px] text-surface-500 mt-0.5">
                                            Data yang sudah memiliki submission sebelumnya akan otomatis menggunakan "Tambah Foto".
                                            {missingPhoto > 0 && ` ${missingPhoto} data tanpa foto akan dilewati.`}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-surface-700 shrink-0">
                    <button
                        onClick={() => { onClose(); if (done && onDone) onDone() }}
                        disabled={sending}
                        className="btn-secondary disabled:opacity-40"
                    >
                        {done ? 'Tutup' : 'Batal'}
                    </button>

                    {!done && (
                        <button
                            onClick={handleSendAll}
                            disabled={sending || loading || items.filter(i => i.imageUrls.length > 0).length === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {sending
                                ? <><Loader2 size={14} className="animate-spin" /> Mengirim...</>
                                : <><Send size={14} /> Kirim {items.filter(i => i.imageUrls.length > 0).length} Data</>
                            }
                        </button>
                    )}

                    {done && (sentCount > 0 || skippedCount > 0) && (
                        <div className="flex items-center gap-1.5 text-xs text-green-400">
                            <CheckCircle2 size={14} />
                            Selesai — {sentCount + skippedCount} berhasil, {errorCount} gagal
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}