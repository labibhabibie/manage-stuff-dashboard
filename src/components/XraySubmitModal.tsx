import { useState, useEffect } from 'react'
import {
    X, Upload, Send, Loader2, CheckCircle2,
    AlertTriangle, Image, FileText,
} from 'lucide-react'
import {
    kirimFotoXray,
    addFotoXray,
    checkSubmissionExists,
    XrayResponse,
} from '../lib/beacukaiService'
import { Barang } from '../lib/supabase'

type Mode = 'kirim' | 'add'

type Props = {
    open: boolean
    onClose: () => void
    mode: Mode
    nomorAju: string
    nomorBlAwb: string
    tanggalBlAwb: string
    kodeKantor: string
    barangList: Barang[]   // ← add this
}

export default function XraySubmitModal({
                                            open, onClose, mode,
                                            nomorAju, nomorBlAwb, tanggalBlAwb, kodeKantor,
                                            barangList,
                                        }: Props) {
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
    const [submitting, setSubmitting] = useState(false)
    const [response, setResponse] = useState<XrayResponse | null>(null)
    const [alreadyExists, setAlreadyExists] = useState<boolean | null>(null)
    const [checkingExists, setCheckingExists] = useState(false)

    const toggleUrl = (url: string) => {
        setSelectedUrls(prev => {
            const next = new Set(prev)
            next.has(url) ? next.delete(url) : next.add(url)
            return next
        })
    }

    const allUrls = barangList.flatMap(b => [
        b.foto_url_atas    ? { url: b.foto_url_atas,    label: `${b.id_barang} — Atas`    } : null,
        b.foto_url_samping ? { url: b.foto_url_samping, label: `${b.id_barang} — Samping` } : null,
    ]).filter(Boolean) as { url: string; label: string }[]

    const allSelected = allUrls.length > 0 && allUrls.every(f => selectedUrls.has(f.url))

    const toggleAll = () => {
        if (allSelected) {
            setSelectedUrls(new Set())
        } else {
            setSelectedUrls(new Set(allUrls.map(f => f.url)))
        }
    }

    // When opening in 'kirim' mode, check if submission already exists
    useEffect(() => {
        if (!open || mode !== 'kirim' || !nomorBlAwb) return
        setCheckingExists(true)
        checkSubmissionExists(nomorBlAwb).then(exists => {
            setAlreadyExists(exists)
            setCheckingExists(false)
        })
    }, [open, nomorBlAwb, mode])

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            // setImages(preselectedImages)
            setResponse(null)
        }
    }, [open])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        // setImages(prev => [...prev, ...files])
    }

    const removeImage = (idx: number) => {
        // setImages(prev => prev.filter((_, i) => i !== idx))
    }

    const handleSubmit = async () => {
        if (selectedUrls.size === 0) return
        setSubmitting(true)

        // Fetch each selected URL and convert to File
        const files: File[] = []
        for (const url of Array.from(selectedUrls)) {
            try {
                const res = await fetch(url)
                const blob = await res.blob()
                const name = url.split('/').pop() || 'foto.jpg'
                files.push(new File([blob], name, { type: blob.type }))
            } catch (e) {
                console.error('Failed to fetch image:', url, e)
            }
        }

        const payload = { nomorAju, nomorBlAwb, tanggalBlAwb, kodeKantor, images: files }
        const res = mode === 'kirim'
            ? await kirimFotoXray(payload)
            : await addFotoXray(payload)

        setResponse(res)
        setSubmitting(false)
        if (res.success && mode === 'kirim') setAlreadyExists(true)
    }

    if (!open) return null

    const isKirim = mode === 'kirim'
    const title = isKirim ? 'Kirim Foto X-Ray ke Bea Cukai' : 'Tambah Foto X-Ray Bea Cukai'
    const submitLabel = isKirim ? 'Kirim Foto' : 'Tambah Foto'

    return (
        <div className="inset-0 z-50 flex justify-center fixed top-0 p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg shadow-2xl h-fit">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-surface-700">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isKirim ? 'bg-emerald-900/40 text-emerald-400' : 'bg-brand-900/40 text-brand-400'}`}>
                            <Send size={16} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white text-sm">{title}</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Mock API — data disimpan ke Supabase</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-4">

                    {/* Pre-filled data summary */}
                    <div className="bg-surface-800/50 rounded-xl p-4 space-y-2 border border-surface-700">
                        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <FileText size={11} /> Data Pengiriman
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {[
                                { label: 'Nomor AJU',    value: nomorAju },
                                { label: 'Nomor BL/AWB', value: nomorBlAwb },
                                { label: 'Tanggal AWB',  value: tanggalBlAwb },
                                { label: 'Kode Kantor',  value: kodeKantor },
                            ].map(f => (
                                <div key={f.label}>
                                    <p className="text-[10px] text-surface-500">{f.label}</p>
                                    <p className="text-xs font-mono text-surface-200">{f.value || <span className="italic text-surface-600">—</span>}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Exists warning for kirim mode */}
                    {isKirim && (
                        checkingExists ? (
                            <div className="flex items-center gap-2 text-xs text-surface-400">
                                <Loader2 size={12} className="animate-spin" /> Mengecek data...
                            </div>
                        ) : !response?.success && alreadyExists ? (
                            <div className="flex items-start gap-2.5 p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg">
                                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-medium text-amber-400">Data sudah pernah dikirim</p>
                                    <p className="text-[11px] text-amber-500/80 mt-0.5">
                                        Nomor BlAwb ini sudah memiliki submission. Gunakan tombol "Tambah Foto" untuk menambah foto baru.
                                    </p>
                                </div>
                            </div>
                        ) : !response?.success && (
                            <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
                                <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                                <p className="text-xs text-green-400">Siap dikirim — belum ada data sebelumnya</p>
                            </div>
                        )
                    )}

                    {/* Response result */}
                    {response && (
                        <div className={`p-4 rounded-xl border ${
                            response.success
                                ? 'bg-green-900/20 border-green-800/50'
                                : 'bg-red-900/20 border-red-800/50'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {response.success
                                    ? <CheckCircle2 size={14} className="text-green-400" />
                                    : <AlertTriangle size={14} className="text-red-400" />
                                }
                                <p className={`text-xs font-semibold ${response.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {response.message}
                                </p>
                            </div>
                            {response.data && (
                                <div className="space-y-1 mt-2">
                                    <p className="text-[10px] text-surface-400">
                                        Foto terupload: <span className="text-white font-mono">{response.data.jumlahFotoTerupload}</span>
                                    </p>
                                    <p className="text-[10px] text-surface-400">
                                        NPWP: <span className="text-white font-mono">{response.data.npwpPemberitahu}</span>
                                    </p>
                                    <p className="text-[10px] text-surface-500">{response.timestamp}</p>
                                </div>
                            )}
                            {!response.success && response.code === 409 && (
                                <p className="text-[11px] text-amber-400/80 mt-2">
                                    💡 Gunakan tombol "Tambah Foto" pada masing-masing barang untuk menambah foto.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Image upload — hide after success */}
                    { ((isKirim && !alreadyExists) || !isKirim) && !response?.success && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Image size={11} /> Pilih Foto X-Ray
                                </p>
                                {allUrls.length > 0 && (
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            className="rounded border-surface-600 bg-surface-800 text-brand-500 cursor-pointer"
                                        />
                                        <span className="text-xs text-surface-400">Pilih semua</span>
                                    </label>
                                )}
                            </div>

                            {allUrls.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-surface-700 p-6 text-center">
                                    <Image size={20} className="mx-auto mb-2 text-surface-600 opacity-40" />
                                    <p className="text-xs text-surface-500 italic">Tidak ada foto tersedia pada barang ini</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                                    {barangList.map((barang, idx) => {
                                        const photos = [
                                            barang.foto_url_atas    ? { url: barang.foto_url_atas,    side: 'Atas'    } : null,
                                            barang.foto_url_samping ? { url: barang.foto_url_samping, side: 'Samping' } : null,
                                        ].filter(Boolean) as { url: string; side: string }[]

                                        if (photos.length === 0) return null

                                        return (
                                            <div key={barang.id} className="rounded-xl border border-surface-700 bg-surface-800/30 p-3">
                                                <p className="text-xs font-medium text-surface-300 mb-2">
                                                    Barang {idx + 1}
                                                    <span className="font-mono text-brand-400 ml-1.5">{barang.id_barang}</span>
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {photos.map(photo => {
                                                        const checked = selectedUrls.has(photo.url)
                                                        return (
                                                            <label
                                                                key={photo.url}
                                                                className={`cursor-pointer rounded-lg border overflow-hidden transition-all ${
                                                                    checked
                                                                        ? 'border-brand-500 ring-1 ring-brand-500'
                                                                        : 'border-surface-700 hover:border-surface-500'
                                                                }`}
                                                            >
                                                                <div className="relative">
                                                                    <img
                                                                        src={photo.url}
                                                                        alt={photo.side}
                                                                        className="w-full h-24 object-cover"
                                                                    />
                                                                    {/* Overlay checkbox */}
                                                                    <div className={`absolute inset-0 transition-colors ${
                                                                        checked ? 'bg-brand-500/20' : 'bg-transparent'
                                                                    }`} />
                                                                    <div className="absolute top-1.5 left-1.5">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            onChange={() => toggleUrl(photo.url)}
                                                                            className="rounded border-surface-600 bg-surface-800/80 text-brand-500 cursor-pointer"
                                                                        />
                                                                    </div>
                                                                    {checked && (
                                                                        <div className="absolute top-1.5 right-1.5">
                                                                            <CheckCircle2 size={14} className="text-brand-400" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="px-2 py-1.5 bg-surface-800/60">
                                                                    <p className="text-[10px] text-surface-400">Foto {photo.side}</p>
                                                                </div>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {selectedUrls.size > 0 && (
                                <p className="text-[11px] text-brand-400 mt-2">
                                    {selectedUrls.size} foto dipilih
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-surface-700">
                    <button onClick={onClose} className="btn-secondary">
                        {response?.success ? 'Tutup' : 'Batal'}
                    </button>

                    {!response?.success && (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || selectedUrls.size === 0 || (isKirim && alreadyExists === true)}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${isKirim
                                ? 'bg-emerald-600 hover:bg-emerald-500'
                                : 'bg-brand-600 hover:bg-brand-500'
                            }`}
                        >
                            {submitting
                                ? <><Loader2 size={14} className="animate-spin" /> Mengirim...</>
                                : <><Send size={14} /> {submitLabel} ({selectedUrls.size} foto)</>
                            }
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}