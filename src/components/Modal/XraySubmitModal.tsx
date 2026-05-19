import { useState, useEffect } from 'react'
import {
    X, Send, Loader2, CheckCircle2,
    AlertTriangle, Image, Plane, CheckCheck,
} from 'lucide-react'
import {
    kirimFotoXray,
    addFotoXray,
    getFotoXray,
    checkSubmissionExists,
    XrayResponse,
    XrayFotoDetail,
} from '../../lib/beacukaiService.ts'
import { supabase, Barang } from '../../lib/supabase.ts'

type Mode = 'kirim' | 'add'

type Props = {
    open: boolean
    onClose: () => void
    mode: Mode
    nomorAju: string
    nomorBlAwb: string
    tanggalBlAwb: string
    kodeKantor: string
    // barangList is no longer required — modal fetches internally by nomorBlAwb
}

function fileNameFromUrl(url: string): string {
    return url.split('/').pop()?.split('?')[0] || ''
}

export default function XraySubmitModal({
                                            open, onClose, mode,
                                            nomorAju, nomorBlAwb, tanggalBlAwb, kodeKantor,
                                        }: Props) {
    const [barangList, setBarangList]               = useState<Barang[]>([])
    const [loadingBarang, setLoadingBarang]         = useState(false)
    const [selectedUrls, setSelectedUrls]           = useState<Set<string>>(new Set())
    const [submitting, setSubmitting]               = useState(false)
    const [response, setResponse]                   = useState<XrayResponse | null>(null)
    const [alreadyExists, setAlreadyExists]         = useState<boolean | null>(null)
    const [checkingExists, setCheckingExists]       = useState(false)
    const [sentFileNames, setSentFileNames]         = useState<Set<string>>(new Set())
    const [loadingSentFiles, setLoadingSentFiles]   = useState(false)

    const isKirim     = mode === 'kirim'
    const submitLabel = isKirim ? 'Kirim Foto' : 'Tambah Foto'

    // ── Fetch barang by blawb whenever nomorBlAwb changes or modal opens ──────
    useEffect(() => {
        if (!open || !nomorBlAwb) {
            setBarangList([])
            return
        }
        setLoadingBarang(true)
        supabase
            .from('barang_v2')
            .select('*')
            .eq('blawb', nomorBlAwb)
            .order('created_at')
            .then(({ data }) => {
                setBarangList(data || [])
                setLoadingBarang(false)
            })
    }, [open, nomorBlAwb])

    // All photo URLs from fetched barang
    const allUrls = barangList.flatMap(b => [
        b.foto_url_atas    ? { url: b.foto_url_atas,    label: `${b.id_barang} — Atas`    } : null,
        b.foto_url_samping ? { url: b.foto_url_samping, label: `${b.id_barang} — Samping` } : null,
    ]).filter(Boolean) as { url: string; label: string }[]

    const selectableUrls = allUrls.filter(f => !sentFileNames.has(fileNameFromUrl(f.url)))
    const allSelected    = selectableUrls.length > 0 && selectableUrls.every(f => selectedUrls.has(f.url))

    const toggleUrl = (url: string) => {
        if (sentFileNames.has(fileNameFromUrl(url))) return
        setSelectedUrls(prev => {
            const next = new Set(prev)
            next.has(url) ? next.delete(url) : next.add(url)
            return next
        })
    }

    const toggleAll = () => {
        if (allSelected) setSelectedUrls(new Set())
        else setSelectedUrls(new Set(selectableUrls.map(f => f.url)))
    }

    // Check submission exists (kirim mode)
    useEffect(() => {
        if (!open || mode !== 'kirim' || !nomorBlAwb) return
        setCheckingExists(true)
        checkSubmissionExists(nomorBlAwb).then(exists => {
            setAlreadyExists(exists)
            setCheckingExists(false)
        })
    }, [open, nomorBlAwb, mode])

    // Fetch already-sent filenames (add mode)
    useEffect(() => {
        if (!open || mode !== 'add' || !nomorBlAwb) return
        setLoadingSentFiles(true)
        getFotoXray({ nomorBlAwb, tanggalBlAwb, kodeKantor }).then(res => {
            if (res.success && res.data?.detail) {
                setSentFileNames(new Set(res.data.detail.map((d: XrayFotoDetail) => d.namaFile)))
            }
            setLoadingSentFiles(false)
        })
    }, [open, nomorBlAwb, mode])

    // Reset on open / nomorBlAwb change
    useEffect(() => {
        if (open) {
            setResponse(null)
            setSelectedUrls(new Set())
            setSentFileNames(new Set())
            setAlreadyExists(null)
        }
    }, [open, nomorBlAwb])

    const handleSubmit = async () => {
        if (selectedUrls.size === 0) return
        setSubmitting(true)

        const files: File[] = []
        for (const url of Array.from(selectedUrls)) {
            try {
                const res  = await fetch(url)
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

    const showPhotoSection = ((isKirim && !alreadyExists) || !isKirim) && !response?.success

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl p-5 bg-slate-100 rounded-2xl flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-hidden">

                {/* ── Header ── */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-medium text-gray-800">Konfirmasi Kirim Foto</span>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <span className="text-base font-normal text-gray-600">
                        {loadingBarang
                            ? 'Memuat data barang...'
                            : `${selectedUrls.size} foto dipilih · ${allUrls.length} total foto`
                        }
                        {mode === 'add' && sentFileNames.size > 0 && (
                            <span className="ml-1 text-amber-600">· {sentFileNames.size} sudah terkirim</span>
                        )}
                    </span>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex flex-col gap-4 overflow-y-auto min-h-0">

                    {/* Data Pengirim */}
                    <div className="px-5 py-4 bg-white rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5 border-b border-gray-200">
                            <Plane size={18} className="text-orange-500 shrink-0" />
                            <span className="text-base font-semibold text-gray-800">Data Pengirim</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                            <div className="flex-1 min-w-0 sm:border-r sm:border-gray-200 sm:pr-4 flex flex-col gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-gray-500">Nomor AJU</span>
                                    <span className="text-base font-semibold text-orange-500 truncate">{nomorAju || '—'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-gray-500">Tanggal AWB</span>
                                    <span className="text-base font-semibold text-gray-800">{tanggalBlAwb || '—'}</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-gray-500">Nomor BL/AWB</span>
                                    <span className="text-base font-bold text-orange-600 truncate">{nomorBlAwb || '—'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-gray-500">Kode Kantor</span>
                                    <span className="text-base font-semibold text-gray-800 truncate">{kodeKantor || '—'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Barang loading state */}
                    {loadingBarang && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
                            <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-500">Memuat data barang untuk {nomorBlAwb}...</span>
                        </div>
                    )}

                    {/* Kirim mode: exists / ready banner */}
                    {isKirim && !loadingBarang && (
                        checkingExists ? (
                            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
                                <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-500">Mengecek status pengiriman...</span>
                            </div>
                        ) : !response?.success && alreadyExists ? (
                            <div className="p-4 bg-yellow-50 rounded-lg border border-amber-400 flex items-start gap-3">
                                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                                <div className="flex flex-col gap-1 min-w-0">
                                    <span className="text-sm font-semibold text-amber-600">Data sudah pernah dikirim</span>
                                    <span className="text-sm text-amber-500">
                                        Nomor BL/AWB ini sudah memiliki submission. Gunakan "Tambah Foto" untuk menambah foto baru.
                                    </span>
                                </div>
                            </div>
                        ) : !response?.success && alreadyExists === false && (
                            <div className="p-4 bg-emerald-50 rounded-lg border border-green-500 flex items-center gap-3">
                                <CheckCircle2 size={20} className="text-green-600 shrink-0" />
                                <span className="text-sm text-green-700">Siap dikirim — belum pernah dikirim sebelumnya</span>
                            </div>
                        )
                    )}

                    {/* Add mode: loading sent files */}
                    {!isKirim && loadingSentFiles && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
                            <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-500">Mengecek foto yang sudah terkirim...</span>
                        </div>
                    )}

                    {/* Add mode: already-sent summary */}
                    {!isKirim && !loadingSentFiles && sentFileNames.size > 0 && !response?.success && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-300 flex items-start gap-3">
                            <CheckCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-sm font-semibold text-blue-700">
                                    {sentFileNames.size} foto sudah terkirim sebelumnya
                                </span>
                                <span className="text-sm text-blue-600">
                                    Foto yang sudah dikirim ditandai dan tidak dapat dipilih kembali.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Response result */}
                    {response && (
                        <div className={`p-4 rounded-lg border ${
                            response.success ? 'bg-emerald-50 border-green-500' : 'bg-red-50 border-red-400'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {response.success
                                    ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                                    : <AlertTriangle size={18} className="text-red-600 shrink-0" />}
                                <span className={`text-sm font-semibold ${response.success ? 'text-green-600' : 'text-red-600'}`}>
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
                                    💡 Gunakan tombol "Tambah Foto" untuk menambah foto ke submission yang sudah ada.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Photo selection */}
                    {showPhotoSection && !loadingBarang && (
                        <div className="p-4 bg-white rounded-lg border border-gray-300 flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <Image size={18} className="text-blue-900 shrink-0" />
                                    <span className="text-base font-semibold text-blue-900">Pilih Foto X-ray</span>
                                </div>
                                {selectableUrls.length > 0 && (
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

                            {allUrls.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-gray-300 p-6 flex flex-col items-center justify-center gap-2">
                                    <Image size={24} className="text-gray-300 opacity-60" />
                                    <p className="text-sm text-gray-400 italic">Tidak ada foto tersedia untuk BLAWB ini</p>
                                    <p className="text-xs text-gray-300">{nomorBlAwb}</p>
                                </div>
                            ) : selectableUrls.length === 0 && sentFileNames.size > 0 ? (
                                <div className="rounded-lg border border-dashed border-green-300 bg-green-50 p-6 flex flex-col items-center justify-center gap-2">
                                    <CheckCheck size={24} className="text-green-500" />
                                    <p className="text-sm text-green-600 font-medium">Semua foto sudah terkirim</p>
                                    <p className="text-xs text-green-500 italic">Tidak ada foto baru untuk dikirim</p>
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
                                            <div key={barang.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex flex-col gap-3">
                                                <p className="text-sm font-medium text-gray-500">
                                                    Barang {idx + 1}
                                                    <span className="font-semibold text-blue-900 ml-1.5">{barang.id_barang}</span>
                                                </p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {photos.map(photo => {
                                                        const checked     = selectedUrls.has(photo.url)
                                                        const alreadySent = sentFileNames.has(fileNameFromUrl(photo.url))

                                                        return (
                                                            <label
                                                                key={photo.url}
                                                                className={`rounded-lg border overflow-hidden transition-all ${
                                                                    alreadySent
                                                                        ? 'border-green-400 opacity-60 cursor-not-allowed'
                                                                        : checked
                                                                            ? 'border-blue-900 ring-1 ring-blue-900 cursor-pointer'
                                                                            : 'border-gray-300 hover:border-gray-400 cursor-pointer'
                                                                }`}
                                                            >
                                                                <div className="relative">
                                                                    <img
                                                                        src={photo.url}
                                                                        alt={photo.side}
                                                                        className={`w-full h-24 object-cover ${alreadySent ? 'grayscale' : ''}`}
                                                                    />
                                                                    <div className={`absolute inset-0 transition-colors ${
                                                                        alreadySent ? 'bg-green-900/20' : checked ? 'bg-blue-900/10' : 'bg-transparent'
                                                                    }`} />
                                                                    <div className="absolute top-1.5 left-1.5">
                                                                        {alreadySent ? (
                                                                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                                                <CheckCheck size={10} className="text-white" />
                                                                            </div>
                                                                        ) : (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() => toggleUrl(photo.url)}
                                                                                className="w-4 h-4 rounded border-2 border-blue-900 accent-blue-900 cursor-pointer"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    {checked && !alreadySent && (
                                                                        <div className="absolute top-1.5 right-1.5">
                                                                            <CheckCircle2 size={16} className="text-blue-900" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={`px-2 py-1.5 border-t flex items-center justify-between gap-1 ${
                                                                    alreadySent ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
                                                                }`}>
                                                                    <p className={`text-xs font-semibold ${alreadySent ? 'text-green-600' : 'text-blue-900'}`}>
                                                                        Foto {photo.side}
                                                                    </p>
                                                                    {alreadySent && (
                                                                        <span className="text-[10px] font-medium text-green-600 bg-green-100 border border-green-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                                            Sudah terkirim
                                                                        </span>
                                                                    )}
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

                {/* ── Footer ── */}
                <div className="flex items-center gap-2">
                    {!response?.success && (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || selectedUrls.size === 0 || (isKirim && alreadyExists === true) || loadingSentFiles || loadingBarang}
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
                        className="flex-1 p-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-red-500 flex justify-center items-center gap-2.5 hover:bg-red-50 transition-colors"
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