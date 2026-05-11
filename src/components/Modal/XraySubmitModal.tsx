import { useState, useEffect } from 'react'
import {
    X, Send, Loader2, CheckCircle2,
    AlertTriangle, Image, FileText, Plane,
} from 'lucide-react'
import {
    kirimFotoXray,
    addFotoXray,
    checkSubmissionExists,
    XrayResponse,
} from '../../lib/beacukaiService.ts'
import { Barang } from '../../lib/supabase.ts'

type Mode = 'kirim' | 'add'

type Props = {
    open: boolean
    onClose: () => void
    mode: Mode
    nomorAju: string
    nomorBlAwb: string
    tanggalBlAwb: string
    kodeKantor: string
    barangList: Barang[]
}

export default function XraySubmitModal({
                                            open, onClose, mode,
                                            nomorAju, nomorBlAwb, tanggalBlAwb, kodeKantor,
                                            barangList,
                                        }: Props) {
    const [selectedUrls, setSelectedUrls]       = useState<Set<string>>(new Set())
    const [submitting, setSubmitting]           = useState(false)
    const [response, setResponse]               = useState<XrayResponse | null>(null)
    const [alreadyExists, setAlreadyExists]     = useState<boolean | null>(null)
    const [checkingExists, setCheckingExists]   = useState(false)

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
        if (allSelected) setSelectedUrls(new Set())
        else setSelectedUrls(new Set(allUrls.map(f => f.url)))
    }

    useEffect(() => {
        if (!open || mode !== 'kirim' || !nomorBlAwb) return
        setCheckingExists(true)
        checkSubmissionExists(nomorBlAwb).then(exists => {
            setAlreadyExists(exists)
            setCheckingExists(false)
        })
    }, [open, nomorBlAwb, mode])

    useEffect(() => {
        if (open) setResponse(null)
    }, [open])

    const handleSubmit = async () => {
        if (selectedUrls.size === 0) return
        setSubmitting(true)

        const files: File[] = []
        for (const url of Array.from(selectedUrls)) {
            try {
                const res = await fetch(url)
                const blob = await res.blob()
                files.push(new File([blob], url.split('/').pop() || 'foto.jpg', { type: blob.type }))
            } catch (e) {
                console.error('Failed to fetch image:', url, e)
            }
        }

        const payload = { nomorAju, nomorBlAwb, tanggalBlAwb, kodeKantor, images: files }
        const res = mode === 'kirim' ? await kirimFotoXray(payload) : await addFotoXray(payload)

        setResponse(res)
        setSubmitting(false)
        if (res.success && mode === 'kirim') setAlreadyExists(true)
    }

    if (!open) return null

    const isKirim    = mode === 'kirim'
    const submitLabel = isKirim ? 'Kirim Foto' : 'Tambah Foto'
    const showPhotoSection = ((isKirim && !alreadyExists) || !isKirim) && !response?.success

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-2xl p-5 bg-slate-100 rounded-2xl flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-hidden">

                {/* ── Header ── */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-medium text-gray-800">Confirmation</span>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <span className="text-base font-normal text-gray-800">
        {selectedUrls.size} foto dipilih · {allUrls.length} total foto tersedia
      </span>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex flex-col gap-4 overflow-y-auto min-h-0">

                    {/* Data Pengirim card */}
                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5">
                            <Plane size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Data Pengirim</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                            {/* Left column */}
                            <div className="flex-1 min-w-0 sm:border-r sm:border-gray-300 sm:pr-4 flex flex-col gap-4">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-base font-semibold text-gray-500">Nomor AJU</span>
                                    <span className="text-lg font-semibold text-orange-500 truncate">{nomorAju || '—'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-base font-semibold text-gray-500">Tanggal AWB</span>
                                    <span className="text-lg font-semibold text-gray-800">{tanggalBlAwb || '—'}</span>
                                </div>
                            </div>
                            {/* Right column */}
                            <div className="flex-1 min-w-0 flex flex-col gap-4">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-base font-semibold text-gray-500">Nomor BL/AWB</span>
                                    <span className="text-lg font-semibold text-gray-800 truncate">{nomorBlAwb || '—'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-base font-semibold text-gray-500">Kode Kantor</span>
                                    <span className="text-lg font-semibold text-gray-800 truncate">{kodeKantor || '—'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exists / ready status banner */}
                    {isKirim && (
                        checkingExists ? (
                            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
                                <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />
                                <span className="text-base font-normal text-gray-500">Mengecek data...</span>
                            </div>
                        ) : !response?.success && alreadyExists ? (
                            <div className="p-4 bg-yellow-100 rounded-lg border border-amber-500 flex items-start gap-3">
                                <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                <div className="flex flex-col gap-1 min-w-0">
                                    <span className="text-base font-medium text-amber-600">Data sudah pernah dikirim</span>
                                    <span className="text-sm font-normal text-amber-500">
                Nomor BL/AWB ini sudah memiliki submission. Gunakan tombol "Tambah Foto" untuk menambah foto baru.
              </span>
                                </div>
                            </div>
                        ) : !response?.success && (
                            <div className="p-4 bg-emerald-100 rounded-lg border border-green-600 flex items-center gap-4">
                                <CheckCircle2 size={24} className="text-green-600 shrink-0" />
                                <span className="text-base font-normal text-green-600">
              Siap dikirim, belum pernah dikirim sebelumnya
            </span>
                            </div>
                        )
                    )}

                    {/* Response result */}
                    {response && (
                        <div className={`p-4 rounded-lg border ${
                            response.success ? 'bg-emerald-100 border-green-600' : 'bg-red-100 border-red-400'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {response.success
                                    ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                                    : <AlertTriangle size={18} className="text-red-600 shrink-0" />}
                                <span className={`text-base font-semibold ${response.success ? 'text-green-600' : 'text-red-600'}`}>
              {response.message}
            </span>
                            </div>
                            {response.data && (
                                <div className="space-y-1 mt-2">
                                    <p className="text-sm text-gray-500">
                                        Foto terupload:{' '}
                                        <span className="font-semibold text-gray-800">{response.data.jumlahFotoTerupload}</span>
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        NPWP:{' '}
                                        <span className="font-semibold text-gray-800">{response.data.npwpPemberitahu}</span>
                                    </p>
                                    <p className="text-xs text-gray-400">{response.timestamp}</p>
                                </div>
                            )}
                            {!response.success && response.code === 409 && (
                                <p className="text-sm text-amber-600 mt-2">
                                    💡 Gunakan tombol "Tambah Foto" pada masing-masing barang untuk menambah foto.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Photo selection section */}
                    {showPhotoSection && (
                        <div className="p-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-4">
                            {/* Section header */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <Image size={18} className="text-blue-900 shrink-0" />
                                    <span className="text-base font-semibold text-blue-900">Pilih Foto X-ray</span>
                                </div>
                                {allUrls.length > 0 && (
                                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            className="w-4 h-4 rounded border-2 border-blue-900 accent-blue-900 cursor-pointer"
                                        />
                                        <span className="text-sm text-gray-500">Pilih semua</span>
                                    </label>
                                )}
                            </div>

                            {/* No photos */}
                            {allUrls.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-gray-300 p-6 flex flex-col items-center justify-center gap-2">
                                    <Image size={24} className="text-gray-300 opacity-60" />
                                    <p className="text-sm text-gray-400 italic">Tidak ada foto tersedia pada barang ini</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                                    {barangList.map((barang, idx) => {
                                        const photos = [
                                            barang.foto_url_atas    ? { url: barang.foto_url_atas,    side: 'Depan'   } : null,
                                            barang.foto_url_samping ? { url: barang.foto_url_samping, side: 'Samping' } : null,
                                        ].filter(Boolean) as { url: string; side: string }[]

                                        if (photos.length === 0) return null

                                        return (
                                            <div key={barang.id} className="rounded-lg border border-gray-300 bg-gray-50 p-3 flex flex-col gap-3">
                                                <p className="text-sm font-medium text-gray-600">
                                                    Barang {idx + 1}
                                                    <span className="font-semibold text-blue-900 ml-1.5">{barang.id_barang}</span>
                                                </p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {photos.map(photo => {
                                                        const checked = selectedUrls.has(photo.url)
                                                        return (
                                                            <label
                                                                key={photo.url}
                                                                className={`cursor-pointer rounded-lg border overflow-hidden transition-all ${
                                                                    checked
                                                                        ? 'border-blue-900 ring-1 ring-blue-900'
                                                                        : 'border-gray-300 hover:border-gray-400'
                                                                }`}
                                                            >
                                                                <div className="relative">
                                                                    <img
                                                                        src={photo.url}
                                                                        alt={photo.side}
                                                                        className="w-full h-24 object-cover"
                                                                    />
                                                                    <div className={`absolute inset-0 transition-colors ${checked ? 'bg-blue-900/10' : 'bg-transparent'}`} />
                                                                    <div className="absolute top-1.5 left-1.5">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            onChange={() => toggleUrl(photo.url)}
                                                                            className="w-4 h-4 rounded border-2 border-blue-900 accent-blue-900 cursor-pointer"
                                                                        />
                                                                    </div>
                                                                    {checked && (
                                                                        <div className="absolute top-1.5 right-1.5">
                                                                            <CheckCircle2 size={16} className="text-blue-900" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="px-2 py-1.5 bg-white border-t border-gray-300">
                                                                    <p className="text-xs font-semibold text-blue-900">Foto {photo.side}</p>
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
                                <p className="text-sm text-blue-900 font-medium">{selectedUrls.size} foto dipilih</p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer buttons ── */}
                <div className="flex items-center gap-2">
                    {!response?.success && (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || selectedUrls.size === 0 || (isKirim && alreadyExists === true)}
                            className="flex-1 p-4 bg-green-600 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex justify-center items-center gap-2.5 hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {submitting
                                ? <Loader2 size={18} className="text-slate-100 animate-spin shrink-0" />
                                : <Send size={18} className="text-slate-100 shrink-0" />}
                            <span className="text-base font-semibold text-slate-100 whitespace-nowrap">
            {submitting ? 'Mengirim...' : `${submitLabel} (${selectedUrls.size} Foto)`}
          </span>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="flex-1 p-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-red-600 flex justify-center items-center gap-2.5 hover:bg-red-50 transition-colors"
                    >
        <span className="text-base font-semibold text-red-600">
          {response?.success ? 'Tutup' : 'Batal'}
        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}