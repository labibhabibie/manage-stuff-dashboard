import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ArrowLeft, Clock, Image, Edit2, Save, X, AlertTriangle,
    Loader2, CheckCircle2, Plane, Package2, Phone,
    User, Send, Upload, Building2, ChevronLeft, ChevronRight, ChevronDown,
    GitBranch, Layers, ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase, InspeksiBarang, Barang, logActivity } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useGudangForItem } from '../hooks/useGudangData';
import XraySubmitModal from '../components/Modal/XraySubmitModal.tsx'
import { checkSubmissionExists } from '../lib/beacukaiService.ts'

const BARANG_PAGE_SIZE = 5

type ItemKind = 'standalone' | 'house'

function getItemKind(item: InspeksiBarang): ItemKind {
    return item.hawb && item.hawb.trim() !== '' ? 'house' : 'standalone'
}

// ─── Helper sub-components ───────────────────────────────────────────────────

const InfoCell = ({ label, children, borderRight = true }: {
    label: string; children: React.ReactNode; borderRight?: boolean
}) => (
    <div className={`flex-1 h-28 pl-4 pr-6 pt-4 pb-5 flex flex-col gap-0.5 ${borderRight ? 'border-r border-gray-300' : ''}`}>
        <div className="h-6 p-0.5 flex items-center">
            <span className="text-base font-semibold text-gray-500">{label}</span>
        </div>
        <div className="h-6 p-0.5 flex items-center">{children}</div>
    </div>
)

const FieldView = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex flex-col gap-0.5">
        <div className="h-6 p-0.5 flex items-center">
            <span className="text-base font-semibold text-gray-500">{label}</span>
        </div>
        <div className="h-6 p-0.5 flex items-center">
            <span className={`text-lg font-semibold ${value ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                {value || '—'}
            </span>
        </div>
    </div>
)

const FieldEdit = ({ label, field, type = "text", placeholder = "", value, onChange }: {
    label: string; field: string; type?: string; placeholder?: string;
    value: string; onChange: (field: string, value: string) => void;
}) => (
    <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-500">{label}</label>
        <input
            type={type}
            className="h-10 px-3 bg-slate-100 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-600"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(field, e.target.value)}
        />
    </div>
)

const MockFieldView = ({ label, value, mock }: { label: string; value?: string | null; mock?: string | null }) => (
    <div className="flex flex-col gap-0.5">
        <div className="h-6 p-0.5 flex items-center">
            <span className="text-base font-semibold text-gray-500">{label}</span>
        </div>
        <div className="h-6 p-0.5 flex items-center">
            {value
                ? <span className="text-lg font-semibold text-gray-800">{value}</span>
                : <span className="text-lg font-semibold text-gray-400 italic">{mock || '—'}</span>
            }
        </div>
    </div>
)

// ─── Page Dropdown ────────────────────────────────────────────────────────────

function PageDropdown({ currentPage, totalPages, onSelect }: {
    currentPage: number; totalPages: number; onSelect: (p: number) => void
}) {
    const [open, setOpen] = useState(false)
    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(v => !v)}
                className={`h-9 px-3 bg-slate-100 rounded-lg shadow-sm border flex items-center gap-1.5 transition-colors ${open ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
            >
                <span className="text-sm font-medium text-gray-600">Halaman {currentPage} / {totalPages}</span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[140px] bg-white rounded-lg border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.12)] overflow-hidden">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button
                            key={p}
                            onClick={() => { onSelect(p); setOpen(false) }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${p === currentPage ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}
                        >
                            Halaman {p}
                            {p === currentPage && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Beacukai Status Badge ────────────────────────────────────────────────────

function BeacukaiStatusBadge({ status }: { status: 'loading' | 'sent' | 'unsent' }) {
    if (status === 'loading') return (
        <div className="px-2 py-0.5 bg-gray-100 rounded-full inline-flex items-center gap-1 shrink-0">
            <Loader2 size={10} className="text-gray-400 animate-spin shrink-0" />
            <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Mengecek...</span>
        </div>
    )
    if (status === 'sent') return (
        <div className="px-2 py-0.5 bg-blue-100 rounded-full inline-flex items-center gap-1 shrink-0">
            <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0" />
            <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">Sudah kirim Beacukai</span>
        </div>
    )
    return (
        <div className="px-2 py-0.5 bg-amber-100 rounded-full inline-flex items-center gap-1 shrink-0">
            <div className="w-3 h-3 bg-amber-500 rounded-full shrink-0" />
            <span className="text-xs font-semibold text-amber-600 whitespace-nowrap">Belum kirim Beacukai</span>
        </div>
    )
}

// ─── Barang Section (per-HAWB / per-blawb) ───────────────────────────────────

function BarangSection({
                           blawb, itemId, editing, fotoFiles, setFotoFile, clearFotoFile
                       }: {
    blawb: string | null | undefined
    itemId: string
    editing: boolean
    fotoFiles: Record<string, { atas?: File; samping?: File }>
    setFotoFile: (barangId: string, side: 'atas' | 'samping', file: File) => void
    clearFotoFile: (barangId: string, side: 'atas' | 'samping') => void
}) {
    const [barangList, setBarangList] = useState<Barang[]>([])
    const [loading, setLoading]       = useState(true)
    const [barangPage, setBarangPage] = useState(1)
    const [selectedIdx, setSelectedIdx] = useState(0)

    useEffect(() => {
        if (!blawb) { setBarangList([]); setLoading(false); return }
        setLoading(true)
        supabase
            .from('barang_v2')
            .select('*')
            .eq('blawb', blawb)
            .order('created_at')
            .then(({ data }) => {
                setBarangList(data || [])
                setBarangPage(1)
                setSelectedIdx(0)
                setLoading(false)
            })
    }, [blawb])

    const totalPages   = Math.max(1, Math.ceil(barangList.length / BARANG_PAGE_SIZE))
    const paged        = barangList.slice((barangPage - 1) * BARANG_PAGE_SIZE, barangPage * BARANG_PAGE_SIZE)
    const startIdx     = (barangPage - 1) * BARANG_PAGE_SIZE
    const selectedBarang = barangList[selectedIdx]

    const handlePageChange = (p: number) => {
        setBarangPage(p)
        setSelectedIdx((p - 1) * BARANG_PAGE_SIZE)
    }

    if (loading) return (
        <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 size={16} className="text-blue-900 animate-spin" />
            <span className="text-sm text-gray-400">Memuat data barang…</span>
        </div>
    )

    return (
        <div className="flex flex-col lg:flex-row items-start gap-4">
            {/* Barang list */}
            <div className="w-full lg:flex-1 flex flex-col gap-0 min-w-0">
                <div className="flex flex-col border border-gray-300 rounded-lg overflow-hidden">
                    <div className="h-14 px-4 bg-slate-100 border-b border-gray-300 flex items-center gap-2.5">
                        <Package2 size={18} className="text-gray-800 shrink-0" />
                        <span className="text-base font-semibold text-gray-800">
                            Barang <span className="font-normal text-gray-500">({barangList.length} items)</span>
                        </span>
                    </div>
                    <div className="h-12 px-4 bg-slate-100 border-b border-gray-300 flex items-center gap-2">
                        <div className="flex-1 min-w-0"><span className="text-sm font-semibold text-gray-800">No.</span></div>
                        <div className="flex-[3] min-w-0"><span className="text-sm font-semibold text-gray-800">ID BARANG</span></div>
                        <div className="flex-[2] min-w-0"><span className="text-sm font-semibold text-gray-800">STATUS</span></div>
                    </div>

                    {barangList.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400 italic bg-slate-100">
                            Tidak ada data barang untuk HAWB ini
                        </div>
                    ) : paged.map((barang, pageIdx) => {
                        const absIdx = startIdx + pageIdx
                        return (
                            <button
                                key={barang.id}
                                onClick={() => setSelectedIdx(absIdx)}
                                className={`h-12 px-4 border-b border-gray-300 flex items-center gap-2 transition-colors w-full text-left ${
                                    selectedIdx === absIdx ? 'bg-blue-50' : 'bg-slate-100 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-semibold text-blue-900">{absIdx + 1}.</span>
                                </div>
                                <div className="flex-[3] min-w-0">
                                    <span className="text-sm font-semibold text-gray-600 truncate">
                                        {barang.id_barang || `Barang ${absIdx + 1}`}
                                    </span>
                                </div>
                                <div className="flex-[2] min-w-0">
                                    <div className="px-2 py-0.5 bg-green-300 rounded-full inline-flex items-center gap-0.5 shrink-0">
                                        <div className="w-2.5 h-2.5 bg-green-600 rounded-full shrink-0" />
                                        <span className="text-xs font-semibold text-green-600 whitespace-nowrap">Selesai</span>
                                    </div>
                                </div>
                            </button>
                        )
                    })}

                    {barangList.length > 0 && (
                        <div className="p-3 bg-slate-100 border-t border-gray-300 flex flex-col gap-2">
                            <span className="text-sm font-medium text-gray-400">
                                {startIdx + 1}–{Math.min(barangPage * BARANG_PAGE_SIZE, barangList.length)} dari {barangList.length}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handlePageChange(Math.max(1, barangPage - 1))}
                                    disabled={barangPage === 1}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-slate-100 hover:bg-gray-50 disabled:opacity-40"
                                >
                                    <ChevronLeft size={14} className="text-gray-600" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => handlePageChange(p)}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                            p === barangPage
                                                ? 'bg-blue-200 border border-blue-600 text-blue-700'
                                                : 'border border-gray-300 bg-slate-100 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => handlePageChange(Math.min(totalPages, barangPage + 1))}
                                    disabled={barangPage === totalPages}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-slate-100 hover:bg-gray-50 disabled:opacity-40"
                                >
                                    <ChevronRight size={14} className="text-gray-600" />
                                </button>
                                {totalPages > 1 && (
                                    <PageDropdown currentPage={barangPage} totalPages={totalPages} onSelect={handlePageChange} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Photo preview */}
            {barangList.length > 0 && selectedBarang && (
                <div className="w-full lg:flex-1 min-w-0">
                    <div className="px-4 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-4">
                        <div className="pb-3 border-b border-gray-300 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="text-base font-semibold text-gray-800">Preview:</span>
                                <span className="text-base font-normal text-gray-600 truncate min-w-0">
                                    {selectedBarang.id_barang || `Barang ${selectedIdx + 1}`}
                                </span>
                            </div>
                            <div className="relative group flex items-center gap-1.5 shrink-0 cursor-default">
                                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                    <span className="text-xs font-bold text-gray-500 leading-none">?</span>
                                </div>
                                <div className="absolute bottom-full right-0 mb-2 w-52 bg-gray-800 text-white text-xs font-medium rounded-lg px-3 py-2.5 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 z-10">
                                    <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-gray-800 rotate-45 rounded-sm" />
                                    Klik item barang di sebelah kiri untuk mengganti preview
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            {(['atas', 'samping'] as const).map(side => (
                                <div key={side} className="flex-1 min-w-0 p-3 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <Image size={16} className="text-blue-900 shrink-0" />
                                        <span className="text-sm font-semibold text-blue-900">
                                            {side === 'atas' ? 'Foto Depan' : 'Foto Samping'}
                                        </span>
                                    </div>
                                    {editing ? (
                                        <div className="space-y-2">
                                            {selectedBarang[`foto_url_${side}`] ? (
                                                <div className="rounded-lg overflow-hidden relative group/img">
                                                    <img src={selectedBarang[`foto_url_${side}`]!} className="w-full object-cover rounded-lg" alt={`foto ${side}`} />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white/20 hover:bg-white/30 text-white transition-colors">
                                                            <Upload size={12} /> Ganti
                                                            <input type="file" accept="image/*" className="sr-only"
                                                                   onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(selectedBarang.id, side, f) }} />
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="cursor-pointer w-full rounded-lg border border-dashed border-blue-900 h-24 flex flex-col items-center justify-center text-gray-400 hover:border-blue-600 hover:text-gray-600 transition-colors">
                                                    <Upload size={18} className="mb-1 opacity-60" />
                                                    <p className="text-xs">Upload</p>
                                                    <input type="file" accept="image/*" className="sr-only"
                                                           onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(selectedBarang.id, side, f) }} />
                                                </label>
                                            )}
                                            {fotoFiles[selectedBarang.id]?.[side] && (
                                                <div className="rounded-lg overflow-hidden relative">
                                                    <img src={URL.createObjectURL(fotoFiles[selectedBarang.id][side]!)} className="w-full h-24 object-cover" alt="preview" />
                                                    <button onClick={() => clearFotoFile(selectedBarang.id, side)} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                                                        <X size={10} />
                                                    </button>
                                                    <p className="text-[10px] text-blue-600 mt-1">● File baru dipilih</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : selectedBarang[`foto_url_${side}`] ? (
                                        <img src={selectedBarang[`foto_url_${side}`]!} className="w-full rounded-lg object-cover" alt={`foto ${side}`} />
                                    ) : (
                                        <div className="w-full h-24 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                                            <Image size={18} className="mb-1 opacity-40" />
                                            <p className="text-xs">Tidak ada foto</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DetailPage() {
    const { id: recordId } = useParams<{ id: string }>();
    const [item, setItem]           = useState<InspeksiBarang | null>(null);
    // siblings = all house items sharing same mawb (including current)
    const [siblings, setSiblings]   = useState<InspeksiBarang[]>([])
    // activeTab = blawb of the currently active house tab (or null for standalone)
    const [activeTabId, setActiveTabId] = useState<string>('')
    const [loading, setLoading]     = useState(true);
    const [editing, setEditing]     = useState(false);
    const [saving, setSaving]       = useState(false);
    const [saved, setSaved]         = useState(false);
    const { gudang } = useGudangForItem(recordId)
    const [xrayModal, setXrayModal] = useState<{ open: boolean; mode: 'kirim' | 'add' }>({ open: false, mode: 'kirim' })
    const [beacukaiStatus, setBeacukaiStatus] = useState<'loading' | 'sent' | 'unsent'>('loading')
    const [fotoFiles, setFotoFiles] = useState<Record<string, { atas?: File; samping?: File }>>({});

    const [editData, setEditData] = useState({
        aju: "", mawb: "", hawb: "", tanggal_awb: "", kode_kantor: "",
        airline_code: "", ori_dest: "", weight: "", note_handling: "",
        shipper_pic_name: "", shipper_pic_number: "",
    });

    const { user, isAdmin } = useAuth();

    useEffect(() => { fetchDetail(); }, [recordId]);

    const refreshBeacukaiStatus = (blawb: string | null | undefined) => {
        if (!blawb) { setBeacukaiStatus('unsent'); return }
        setBeacukaiStatus('loading')
        checkSubmissionExists(blawb).then(exists => setBeacukaiStatus(exists ? 'sent' : 'unsent'))
    }

    const fetchDetail = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("inspeksi_barang_v3")
            .select("*")
            .eq("id", recordId!)
            .single();

        if (data) {
            const currentItem = data as InspeksiBarang
            setItem(currentItem);
            setEditData({
                aju: data.aju || gudang.aju || "",
                mawb: data.mawb || "",
                hawb: data.hawb || "",
                airline_code: data.airline_code || gudang.airline_code || "",
                ori_dest: data.ori_dest || gudang.ori_dest || "",
                weight: data.weight || gudang.weight || "",
                tanggal_awb: data.tanggal_awb || gudang.tanggal_awb || "",
                kode_kantor: data.kode_kantor || "BANTEN",
                shipper_pic_name: data.shipper_pic_name || gudang.shipper_pic_name || "",
                shipper_pic_number: data.shipper_pic_number || gudang.shipper_pic_number || "",
                note_handling: data.note_handling || ""
            })

            refreshBeacukaiStatus(data.blawb || data.mawb || data.hawb)

            // If house type: fetch all siblings sharing same mawb
            const kind = getItemKind(currentItem)
            if (kind === 'house' && currentItem.mawb) {
                const { data: sibs } = await supabase
                    .from('inspeksi_barang_v3')
                    .select('*')
                    .eq('mawb', currentItem.mawb)
                    .not('hawb', 'is', null)
                    .neq('hawb', '')
                    .order('created_at')
                setSiblings(sibs || [])
                // default active tab = current record
                setActiveTabId(currentItem.id)
            } else {
                setSiblings([])
                setActiveTabId(currentItem.id)
            }
        }
        setLoading(false);
    };

    const handleXrayModalClose = () => {
        setXrayModal(m => ({ ...m, open: false }))
        if (item) refreshBeacukaiStatus(item.blawb || item.mawb || item.hawb)
    }

    const handleSave = async () => {
        if (!item || !user) return;
        setSaving(true);

        const { error } = await supabase.from("inspeksi_barang_v3")
            .update({ ...editData, updated_by: user.id }).eq("id", item.id);

        setSaving(false);
        if (!error) {
            await logActivity(user.id, "update", {
                targetTable: "inspeksi_barang_v3", targetId: item.id,
                description: `Update data inspeksi ${item.mawb || item.hawb}`,
            });
            setSaved(true);
            setFotoFiles({});
            setTimeout(() => setSaved(false), 3000);
            setEditing(false);
            fetchDetail();
        }
    };

    const handleFieldChange = (field: string, value: string) =>
        setEditData((d) => ({ ...d, [field]: value }));

    const setFotoFile = (barangId: string, side: "atas" | "samping", file: File) =>
        setFotoFiles((prev) => ({ ...prev, [barangId]: { ...prev[barangId], [side]: file } }));

    const clearFotoFile = (barangId: string, side: "atas" | "samping") =>
        setFotoFiles((prev) => {
            const updated = { ...prev[barangId] };
            delete updated[side];
            return { ...prev, [barangId]: updated };
        });

    const canAddFoto = beacukaiStatus === 'sent'

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!item) return (
        <div className="text-center py-20">
            <AlertTriangle size={40} className="text-amber-500 mx-auto mb-3" />
            <p className="text-gray-500">Data tidak ditemukan</p>
            <Link to="/data" className="mt-4 inline-flex h-11 px-4 bg-slate-100 border border-gray-300 rounded-lg text-blue-900 font-semibold items-center gap-2 hover:bg-gray-50 transition-colors">
                Kembali
            </Link>
        </div>
    );

    const itemKind = getItemKind(item)
    const isHouse  = itemKind === 'house'

    // The active sibling (for house type tab navigation)
    const activeSibling = isHouse
        ? (siblings.find(s => s.id === activeTabId) || item)
        : item

    // blawb to use for barang lookup = active tab's blawb
    const activeBlawb = activeSibling.blawb || activeSibling.hawb || activeSibling.mawb

    return (
        <div className="space-y-4">

            {/* ── Header ── */}
            <div className="flex flex-wrap justify-between items-end gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="pl-0.5 pr-3 py-0.5 border-r border-gray-400 flex items-center gap-0.5 shrink-0">
                        <Link to="/data" className="h-8 p-1.5 flex items-center justify-center gap-2.5">
                            <ArrowLeft size={20} className="text-blue-900" />
                            <span className="text-base font-semibold text-blue-900">Kembali</span>
                        </Link>
                    </div>
                    <div className="flex flex-col justify-center gap-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-lg font-medium text-gray-600">Detail Data:</span>
                            <span className="text-lg font-bold text-orange-600 truncate">{item.mawb || item.hawb || '—'}</span>
                            {saved && (
                                <span className="flex items-center gap-1 text-xs text-green-600 shrink-0">
                                    <CheckCircle2 size={14} /> Tersimpan
                                </span>
                            )}
                        </div>
                        <span className="text-sm font-normal text-gray-600">
                            Dibuat: {format(new Date(item.created_at), "EEEE, dd MMMM yyyy", { locale: id })}
                        </span>
                    </div>
                </div>

                {isAdmin && (
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {canAddFoto ? (
                            <button
                                onClick={() => setXrayModal({ open: true, mode: 'add' })}
                                className="h-11 px-4 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 transition-colors bg-yellow-900 hover:bg-yellow-800"
                            >
                                <Upload size={18} className="text-slate-100 shrink-0" />
                                <span className="text-base font-semibold text-slate-100 whitespace-nowrap">Tambah Foto ke Bea Cukai</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setXrayModal({ open: true, mode: 'kirim' })}
                                className="h-11 px-4 bg-blue-900 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 hover:bg-blue-800 transition-colors"
                            >
                                <Send size={18} className="text-slate-100 shrink-0" />
                                <span className="text-base font-semibold text-slate-100 whitespace-nowrap">Kirim data ke Bea Cukai</span>
                            </button>
                        )}

                        {editing ? (
                            <>
                                <button onClick={() => setEditing(false)} className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
                                    <X size={18} className="text-blue-900 shrink-0" />
                                    <span className="text-base font-semibold text-blue-900">Batal</span>
                                </button>
                                <button onClick={handleSave} disabled={saving} className="h-11 px-4 bg-blue-900 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 hover:bg-blue-800 transition-colors disabled:opacity-60">
                                    {saving ? <Loader2 size={18} className="text-slate-100 animate-spin shrink-0" /> : <Save size={18} className="text-slate-100 shrink-0" />}
                                    <span className="text-base font-semibold text-slate-100">Simpan</span>
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setEditing(true)} className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
                                <Edit2 size={18} className="text-blue-900 shrink-0" />
                                <span className="text-base font-semibold text-blue-900">Edit</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Kind Banner ── */}
            <div className={`rounded-lg border flex items-stretch overflow-hidden ${isHouse ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`w-1.5 shrink-0 ${isHouse ? 'bg-orange-500' : 'bg-blue-500'}`} />
                <div className="flex-1 px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold tracking-widest uppercase ${
                        isHouse ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                        {isHouse ? <GitBranch size={14} className="shrink-0" /> : <Layers size={14} className="shrink-0" />}
                        {isHouse ? 'House' : 'Standalone MAWB'}
                    </div>
                    <div className={`hidden sm:block w-px h-7 ${isHouse ? 'bg-orange-200' : 'bg-blue-200'}`} />
                    <div className="flex flex-col gap-0">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isHouse ? 'text-orange-400' : 'text-blue-400'}`}>
                            {isHouse ? 'Master AWB' : 'Master Air Waybill'}
                        </span>
                        <span className={`text-xl font-bold tracking-tight ${isHouse ? 'text-orange-700' : 'text-blue-700'}`}>
                            {item.mawb || '—'}
                        </span>
                    </div>
                    {isHouse && (
                        <>
                            <div className="hidden sm:block w-px h-7 bg-orange-200" />
                            {/*<div className="flex flex-col gap-0">*/}
                            {/*    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">House AWB (aktif)</span>*/}
                            {/*    <span className="text-base font-bold text-orange-600">{activeSibling.hawb || '—'}</span>*/}
                            {/*</div>*/}
                            {/*<div className="hidden sm:block w-px h-7 bg-orange-200" />*/}
                            <div className="flex flex-col gap-0">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total House</span>
                                <span className="text-base font-bold text-gray-600">{siblings.length} HAWB</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="bg-slate-100 rounded-lg border border-gray-300 flex flex-wrap divide-y md:divide-y-0 md:divide-x divide-gray-300">
                <InfoCell label="NO. AJU">
                    <span className="text-base font-medium text-gray-800">{item.aju || gudang.aju || '—'}</span>
                </InfoCell>
                <InfoCell label="RUTE PENERBANGAN">
                    <div className="flex flex-col gap-0.5 mt-4">
                        <div className="flex items-center gap-2">
                            <Plane size={18} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">
                                {item.ori_dest || gudang.ori_dest || '—'}
                            </span>
                        </div>
                        <span className="text-xs font-normal text-gray-600">
                            Airline Code: {item.airline_code || gudang.airline_code || '—'}
                        </span>
                    </div>
                </InfoCell>
                <InfoCell label="WAKTU MASUK">
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-orange-500 shrink-0" />
                        <span className="text-base font-medium text-gray-800">
                            {format(new Date(item.waktu_masuk), "dd MMMM yyyy, HH.mm", { locale: id })}
                        </span>
                    </div>
                </InfoCell>
                <InfoCell label="TERAKHIR DIUBAH">
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-orange-500 shrink-0" />
                        <span className="text-base font-medium text-gray-800">
                            {item.updated_at
                                ? format(new Date(item.updated_at), "dd MMMM yyyy, HH.mm", { locale: id })
                                : '—'}
                        </span>
                    </div>
                </InfoCell>
                <InfoCell label="STATUS" borderRight={false}>
                    <div className="flex flex-col gap-1.5 mt-8">
                        <div className="px-2 py-0.5 bg-green-300 rounded-full inline-flex items-center gap-0.5">
                            <div className="w-3 h-3 bg-green-600 rounded-full shrink-0" />
                            <span className="text-xs font-semibold text-green-600 whitespace-nowrap">Selesai diinspeksi</span>
                        </div>
                        <BeacukaiStatusBadge status={beacukaiStatus} />
                    </div>
                </InfoCell>
            </div>

            {/* ── Shared Info Row ── */}
            <div className="flex flex-col lg:flex-row items-start gap-4">
                {/* Shipment Info */}
                <div className="w-full lg:flex-1 flex flex-col gap-4 min-w-0">
                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5 border-b border-gray-200">
                            <Plane size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Informasi Pengiriman</span>
                            {isHouse && <span className="text-xs text-gray-400 italic">(sama untuk semua HAWB)</span>}
                        </div>
                        {editing ? (
                            <div className="grid grid-cols-2 gap-4">
                                <FieldEdit label="MAWB" field="mawb" value={editData.mawb} onChange={handleFieldChange} placeholder="Master Air Waybill" />
                                <FieldEdit label="HAWB" field="hawb" value={editData.hawb} onChange={handleFieldChange} placeholder="House Air Waybill (opsional)" />
                                <MockFieldView label="AIRLINE CODE" value={item.airline_code} mock={gudang.airline_code} />
                                <MockFieldView label="ORI / DEST" value={item.ori_dest} mock={gudang.ori_dest} />
                                <MockFieldView label="TOTAL BERAT" value={item.weight} mock={gudang.weight} />
                                <FieldEdit label="TANGGAL AWB" field="tanggal_awb" type="date" value={editData.tanggal_awb} onChange={handleFieldChange} />
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                <div className="flex-1 min-w-0 sm:border-r sm:border-gray-300 sm:pr-4 flex flex-col gap-4">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-base font-semibold text-gray-500">MAWB</span>
                                        <span className="text-lg font-bold text-orange-500">{item.mawb || '—'}</span>
                                    </div>
                                    <MockFieldView label="AIRLINE CODE" value={item.airline_code} mock={gudang.airline_code} />
                                    <MockFieldView label="ORI / DEST" value={item.ori_dest} mock={gudang.ori_dest} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-4">
                                    <MockFieldView label="TOTAL BERAT" value={item.weight ? `${item.weight} KG` : null} mock={gudang.weight ? `${gudang.weight} KG` : null} />
                                    <MockFieldView label="TANGGAL AWB" value={item.tanggal_awb} mock={gudang.tanggal_awb} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Kode Kantor + Shipper PIC + Note */}
                <div className="w-full lg:flex-1 flex flex-col gap-4 min-w-0">
                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5">
                            <Building2 size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Kode Kantor</span>
                        </div>
                        {editing
                            ? <FieldEdit label="" field="kode_kantor" value={editData.kode_kantor} onChange={handleFieldChange} placeholder="Kode kantor" />
                            : <span className="text-lg font-semibold text-gray-500 p-0.5">{item.kode_kantor || 'BANTEN GLOBAL DEVELOPMENT'}</span>
                        }
                    </div>

                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5">
                            <User size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Shipper PIC</span>
                        </div>
                        {editing ? (
                            <div className="grid grid-cols-2 gap-4">
                                <FieldEdit label="NAMA PIC" field="shipper_pic_name" value={editData.shipper_pic_name} onChange={handleFieldChange} placeholder="Nama penanggung jawab" />
                                <FieldEdit label="NOMOR PIC" field="shipper_pic_number" value={editData.shipper_pic_number} onChange={handleFieldChange} placeholder="No. HP / telepon" />
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5 p-0.5">
                                    <span className="text-base font-semibold text-gray-500">NAMA PIC</span>
                                    <span className="text-base font-semibold text-gray-800 truncate">
                                        {item.shipper_pic_name || gudang.shipper_pic_name || '—'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5 p-0.5">
                                    <span className="text-base font-semibold text-gray-500">NOMOR PIC</span>
                                    <div className="flex items-center gap-1.5">
                                        <Phone size={18} className="text-orange-500 shrink-0" />
                                        <span className="text-base font-semibold text-gray-800 truncate">
                                            {item.shipper_pic_number || gudang.shipper_pic_number || '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5">
                            <Package2 size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Note Handling</span>
                        </div>
                        {editing ? (
                            <textarea
                                className="h-24 px-3 py-2 bg-slate-100 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none resize-none focus:border-blue-600"
                                placeholder="Instruksi penanganan..."
                                value={editData.note_handling}
                                onChange={(e) => setEditData((d) => ({ ...d, note_handling: e.target.value }))}
                            />
                        ) : (
                            <p className="text-sm leading-relaxed text-gray-600 p-0.5">
                                {item.note_handling || <span className="text-gray-400 italic">-</span>}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Per-HAWB section (house only) — HAWB tab navbar + pieces + barang ── */}
            {isHouse && siblings.length > 0 ? (
                <div className="flex flex-col gap-0 bg-slate-100 rounded-lg border border-gray-300 overflow-hidden">
                    {/* Tab header */}
                    <div className="px-4 pt-4 pb-0 border-b border-gray-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2.5">
                            <GitBranch size={18} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Barang per House AWB</span>
                        </div>
                        {/* HAWB tab bar */}
                        <div className="flex items-end gap-0 overflow-x-auto">
                            {siblings.map(sib => {
                                const isActive = sib.id === activeTabId
                                return (
                                    <button
                                        key={sib.id}
                                        onClick={() => setActiveTabId(sib.id)}
                                        className={`flex flex-col items-start px-4 py-2.5 border-b-2 transition-colors shrink-0 min-w-0 ${
                                            isActive
                                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                : 'border-transparent hover:border-orange-200 hover:bg-orange-50/50 text-gray-500'
                                        }`}
                                    >
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">HAWB</span>
                                        <span className={`text-sm font-bold truncate max-w-[120px] ${isActive ? 'text-orange-700' : 'text-gray-600'}`}>
                                            {sib.hawb || '—'}
                                        </span>
                                        {/*{sib.id === item.id && (*/}
                                        {/*    <span className="text-[9px] text-orange-400 font-semibold">ini halaman ini</span>*/}
                                        {/*)}*/}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Active tab content: HAWB info strip + barang */}
                    <div className="p-4 flex flex-col gap-4">
                        {/* HAWB + pieces strip */}
                        <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="flex flex-col gap-0">
                                <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">House AWB Aktif</span>
                                <span className="text-base font-bold text-orange-700">{activeSibling.hawb || '—'}</span>
                            </div>
                            <div className="w-px h-8 bg-orange-200 hidden sm:block" />
                            <div className="flex flex-col gap-0">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">BLAWB</span>
                                <span className="text-sm font-semibold text-gray-600">{activeSibling.blawb || activeSibling.hawb || '—'}</span>
                            </div>
                            <div className="w-px h-8 bg-orange-200 hidden sm:block" />
                            <div className="flex flex-col gap-0">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Waktu Masuk</span>
                                <span className="text-sm font-semibold text-gray-600">
                                    {format(new Date(activeSibling.waktu_masuk), 'dd MMM yyyy, HH:mm', { locale: id })}
                                </span>
                            </div>
                        </div>

                        {/* Barang section for active HAWB */}
                        <BarangSection
                            key={activeTabId}
                            blawb={activeBlawb}
                            itemId={activeSibling.id}
                            editing={editing}
                            fotoFiles={fotoFiles}
                            setFotoFile={setFotoFile}
                            clearFotoFile={clearFotoFile}
                        />
                    </div>
                </div>
            ) : (
                // Standalone: barang section directly
                <BarangSection
                    blawb={activeBlawb}
                    itemId={item.id}
                    editing={editing}
                    fotoFiles={fotoFiles}
                    setFotoFile={setFotoFile}
                    clearFotoFile={clearFotoFile}
                />
            )}

            <XraySubmitModal
                open={xrayModal.open}
                onClose={handleXrayModalClose}
                mode={xrayModal.mode}
                nomorAju={item.aju ?? gudang.aju ?? ''}
                nomorBlAwb={item.blawb ?? item.mawb ?? item.hawb ?? ''}
                tanggalBlAwb={item.tanggal_awb ?? editData.tanggal_awb ?? gudang.tanggal_awb ?? ''}
                kodeKantor={item.kode_kantor ?? editData.kode_kantor ?? ''}
                barangList={[]}
            />
        </div>
    );
}
