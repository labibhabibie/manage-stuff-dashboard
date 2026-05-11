import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ArrowLeft, Clock, Image, Edit2, Save, X, AlertTriangle,
    Loader2, CheckCircle2, Plane, Package2, Phone,
    User, Send, Upload, Building2, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase, InspeksiBarang, Barang, logActivity } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useGudangForItem } from '../hooks/useGudangData';
import XraySubmitModal from '../components/Modal/XraySubmitModal.tsx'
import { checkSubmissionExists } from '../lib/beacukaiService.ts'

const BARANG_PAGE_SIZE = 5

// ─── Helper sub-components ───────────────────────────────────────────────────

const InfoCell = ({
                      label, children, borderRight = true
                  }: {
    label: string; children: React.ReactNode; borderRight?: boolean
}) => (
    <div className={`flex-1 h-28 pl-4 pr-6 pt-4 pb-5 flex flex-col gap-0.5 ${borderRight ? 'border-r border-gray-300' : ''}`}>
        <div className="h-6 p-0.5 flex items-center">
            <span className="text-base font-semibold text-gray-500">{label}</span>
        </div>
        <div className="h-6 p-0.5 flex items-center">
            {children}
        </div>
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

const FieldEdit = ({
                       label, field, type = "text", placeholder = "", value, onChange,
                   }: {
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

const MockFieldView = ({ label, value, mock }: {
    label: string; value?: string | null; mock?: string | null
}) => (
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

function PageDropdown({
                          currentPage, totalPages, onSelect,
                      }: {
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DetailPage() {
    const { id: recordId } = useParams<{ id: string }>();
    const [item, setItem]             = useState<InspeksiBarang | null>(null);
    const [barangList, setBarangList] = useState<Barang[]>([]);
    const [loading, setLoading]       = useState(true);
    const [editing, setEditing]       = useState(false);
    const [saving, setSaving]         = useState(false);
    const [saved, setSaved]           = useState(false);
    const [selectedBarangIdx, setSelectedBarangIdx] = useState(0);
    const { gudang }  = useGudangForItem(recordId)
    const [xrayModal, setXrayModal]   = useState<{ open: boolean; mode: 'kirim' | 'add' }>({ open: false, mode: 'kirim' })

    // ── Beacukai submission status ──
    const [beacukaiStatus, setBeacukaiStatus] = useState<'loading' | 'sent' | 'unsent'>('loading')

    // ── Barang pagination ──
    const [barangPage, setBarangPage] = useState(1)

    const [fotoFiles, setFotoFiles] = useState<Record<string, { atas?: File; samping?: File }>>({});

    const [editData, setEditData] = useState({
        aju: "", mawb: "", hawb: "", tanggal_awb: "", kode_kantor: "",
        airline_code: "", ori_dest: "", weight: "", note_handling: "",
        shipper_pic_name: "", shipper_pic_number: "",
    });

    const { user, isAdmin } = useAuth();

    useEffect(() => { fetchDetail(); }, [recordId]);

    // ── Shared helper: refresh beacukai status from a blawb value ──
    const refreshBeacukaiStatus = (blawb: string | null | undefined) => {
        if (!blawb) { setBeacukaiStatus('unsent'); return }
        setBeacukaiStatus('loading')
        checkSubmissionExists(blawb).then(exists => {
            setBeacukaiStatus(exists ? 'sent' : 'unsent')
        })
    }

    const fetchDetail = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("inspeksi_barang_v2")
            .select("*, profiles!created_by(full_name, email)")
            .eq("id", recordId!)
            .single();

        if (data) {
            setItem(data as InspeksiBarang);
            setEditData({
                aju: data.aju || "", mawb: data.mawb || "", hawb: data.hawb || "",
                airline_code: data.airline_code || gudang.airline_code || "",
                ori_dest: data.ori_dest || gudang.ori_dest || "",
                weight: data.weight || gudang.weight || "",
                tanggal_awb: data.tanggal_awb || gudang.tanggal_awb || "",
                kode_kantor: data.kode_kantor || "BANTEN",
                shipper_pic_name: data.shipper_pic_name || gudang.shipper_pic_name || "",
                shipper_pic_number: data.shipper_pic_number || gudang.shipper_pic_number || "",
                note_handling: data.note_handling || ""
            })

            // Check using the same blawb logic as XraySubmitModal
            refreshBeacukaiStatus(data.mawb || data.hawb)

            const { data: barangData } = await supabase
                .from("barang").select("*")
                .or(`mawb.eq.${data.mawb},hawb.eq.${data.hawb}`)
                .order("created_at");
            setBarangList(barangData || []);
            setBarangPage(1);
        }
        setLoading(false);
    };

    // Re-check status after modal closes — user may have just sent for the first time
    const handleXrayModalClose = () => {
        setXrayModal(m => ({ ...m, open: false }))
        if (item) refreshBeacukaiStatus(item.mawb || item.hawb)
    }

    const handleSave = async () => {
        if (!item || !user) return;
        setSaving(true);

        for (const barang of barangList) {
            const files = fotoFiles[barang.id];
            if (!files) continue;
            let foto_url_atas    = barang.foto_url_atas;
            let foto_url_samping = barang.foto_url_samping;

            if (files.atas) {
                const { data } = await supabase.storage.from("inspeksi-foto")
                    .upload(`${item.id}/${barang.id}/atas_${Date.now()}`, files.atas, { upsert: true });
                if (data) {
                    const { data: { publicUrl } } = supabase.storage.from("inspeksi-foto").getPublicUrl(data.path);
                    foto_url_atas = publicUrl;
                }
            }
            if (files.samping) {
                const { data } = await supabase.storage.from("inspeksi-foto")
                    .upload(`${item.id}/${barang.id}/samping_${Date.now()}`, files.samping, { upsert: true });
                if (data) {
                    const { data: { publicUrl } } = supabase.storage.from("inspeksi-foto").getPublicUrl(data.path);
                    foto_url_samping = publicUrl;
                }
            }
            await supabase.from("barang").update({ foto_url_atas, foto_url_samping }).eq("id", barang.id);
        }

        const { error } = await supabase.from("inspeksi_barang_v2")
            .update({ ...editData, updated_by: user.id }).eq("id", item.id);

        setSaving(false);
        if (!error) {
            await logActivity(user.id, "update", {
                targetTable: "inspeksi_barang_v2", targetId: item.id,
                description: `Update data inspeksi ${item.aju}`,
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

    // ── Derived pagination values ──
    const totalBarangPages = Math.max(1, Math.ceil(barangList.length / BARANG_PAGE_SIZE))
    const pagedBarangList  = barangList.slice((barangPage - 1) * BARANG_PAGE_SIZE, barangPage * BARANG_PAGE_SIZE)
    const barangStartIdx   = (barangPage - 1) * BARANG_PAGE_SIZE

    const handleBarangPageChange = (p: number) => {
        setBarangPage(p)
        setSelectedBarangIdx((p - 1) * BARANG_PAGE_SIZE)
    }

    // "Tambah Foto" is only meaningful once the submission exists
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

    const selectedBarang = barangList[selectedBarangIdx]

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
                            <span className="text-lg font-medium text-gray-600 drop-shadow-sm">Detail Data:</span>
                            <span className="text-lg font-medium text-gray-600 drop-shadow-sm truncate">{item.aju}</span>
                            {saved && (
                                <span className="flex items-center gap-1 text-xs text-green-600 shrink-0">
                                    <CheckCircle2 size={14} /> Tersimpan
                                </span>
                            )}
                        </div>
                        <span className="text-sm font-normal text-gray-600 drop-shadow-sm">
                            Dibuat: {format(new Date(item.created_at), "EEEE, dd MMMM yyyy", { locale: id })}
                        </span>
                    </div>
                </div>

                {isAdmin && (
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        { canAddFoto ? (
                            <button
                                onClick={() => canAddFoto && setXrayModal({ open: true, mode: 'add' })}
                                className={`h-11 px-4 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 transition-colors ${
                                    canAddFoto
                                        ? 'bg-blue-900 hover:bg-blue-800 cursor-pointer'
                                        : 'bg-gray-300 cursor-not-allowed opacity-60'
                                }`}
                            >
                                <Upload size={18} className="text-slate-100 shrink-0" />
                                <span className="text-base font-semibold text-slate-100 whitespace-nowrap">
                                            Tambah Foto ke Bea Cukai
                                        </span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setXrayModal({ open: true, mode: 'kirim' })}
                                className="h-11 px-4 bg-yellow-900 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 hover:bg-yellow-800 transition-colors"
                            >
                                <Send size={18} className="text-slate-100 shrink-0" />
                                <span className="text-base font-semibold text-slate-100 whitespace-nowrap">Kirim data ke Bea Cukai</span>
                            </button>
                        )}

                        {editing ? (
                            <>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <X size={18} className="text-blue-900 shrink-0" />
                                    <span className="text-base font-semibold text-blue-900">Batal</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="h-11 px-4 bg-blue-900 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 hover:bg-blue-800 transition-colors disabled:opacity-60"
                                >
                                    {saving
                                        ? <Loader2 size={18} className="text-slate-100 animate-spin shrink-0" />
                                        : <Save size={18} className="text-slate-100 shrink-0" />}
                                    <span className="text-base font-semibold text-slate-100">Simpan</span>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setEditing(true)}
                                className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
                            >
                                <Edit2 size={18} className="text-blue-900 shrink-0" />
                                <span className="text-base font-semibold text-blue-900">Edit</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Summary Cards Row ── */}
            <div className="bg-slate-100 rounded-lg border border-gray-300 flex flex-wrap divide-y md:divide-y-0 md:divide-x divide-gray-300">
                <InfoCell label="NO. AJU">
                    <span className="text-base font-medium text-gray-800">{item.aju || '—'}</span>
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
                            Airline Code: {item.airline_code || gudang.airline_code || ''}
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

                {/* ── STATUS: inspeksi badge + beacukai badge stacked ── */}
                <InfoCell label="STATUS" borderRight={false}>
                    <div className="flex flex-col gap-1.5 mt-8">
                        {/* Inspeksi badge — unchanged */}
                        <div className="px-2 py-0.5 bg-green-300 rounded-full inline-flex items-center gap-0.5">
                            <div className="w-3 h-3 bg-green-600 rounded-full shrink-0" />
                            <span className="text-xs font-semibold text-green-600 whitespace-nowrap">Selesai diinspeksi</span>
                        </div>
                        {/* Beacukai send status */}
                        <BeacukaiStatusBadge status={beacukaiStatus} />
                    </div>
                </InfoCell>
            </div>

            {/* ── Main Content Row 1 ── */}
            <div className="flex flex-col lg:flex-row items-start gap-4">

                {/* Left: Shipment Info */}
                <div className="w-full lg:flex-1 flex flex-col gap-4 min-w-0">
                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5 border-b border-gray-200">
                            <Plane size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Informasi Pengiriman</span>
                        </div>
                        {editing ? (
                            <div className="grid grid-cols-2 gap-4">
                                <FieldEdit label="MAWB" field="mawb" value={editData.mawb} onChange={handleFieldChange} placeholder="Master Air Waybill" />
                                <FieldEdit label="HAWB" field="hawb" value={editData.hawb} onChange={handleFieldChange} placeholder="House Air Waybill" />
                                <MockFieldView label="AIRLINE CODE" value={item.airline_code} mock={gudang.airline_code} />
                                <MockFieldView label="ORI / DEST"   value={item.ori_dest}     mock={gudang.ori_dest} />
                                <FieldView label="JUMLAH PIECES" value={barangList.length > 0 ? `${barangList.length} pcs` : null} />
                                <MockFieldView label="TOTAL BERAT"  value={item.weight}       mock={gudang.weight} />
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                <div className="flex-1 min-w-0 sm:border-r sm:border-gray-300 sm:pr-4 flex flex-col gap-4">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-base font-semibold text-gray-500">MAWB</span>
                                        <span className="text-lg font-semibold text-orange-500">{item.mawb || '—'}</span>
                                    </div>
                                    <FieldView label="HAWB"         value={item.hawb} />
                                    <MockFieldView label="AIRLINE CODE" value={item.airline_code} mock={gudang.airline_code} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-4">
                                    <FieldView label="JUMLAH PIECES" value={barangList.length > 0 ? `${barangList.length} Pcs` : null} />
                                    <MockFieldView label="TOTAL BERAT" value={item.weight ? `${item.weight} KG` : null} mock={gudang.weight ? `${gudang.weight} KG` : null} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Kode Kantor + Shipper PIC + Note Handling */}
                <div className="w-full lg:flex-1 flex flex-col gap-4 min-w-0">
                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5">
                            <Building2 size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Kode Kantor</span>
                        </div>
                        {editing ? (
                            <FieldEdit label="" field="kode_kantor" value={editData.kode_kantor} onChange={handleFieldChange} placeholder="Kode kantor" />
                        ) : (
                            <span className="text-lg font-semibold text-gray-500 p-0.5">
                                {item.kode_kantor || 'BANTEN GLOBAL DEVELOPMENT'}
                            </span>
                        )}
                    </div>

                    <div className="px-5 py-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-2">
                        <div className="px-0.5 pt-0.5 pb-2 flex items-center gap-2.5">
                            <User size={20} className="text-orange-500 shrink-0" />
                            <span className="text-lg font-semibold text-gray-800">Shipper PIC</span>
                        </div>
                        {editing ? (
                            <div className="grid grid-cols-2 gap-4">
                                <FieldEdit label="NAMA PIC"  field="shipper_pic_name"   value={editData.shipper_pic_name}   onChange={handleFieldChange} placeholder="Nama penanggung jawab" />
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

            {/* ── Main Content Row 2 ── */}
            <div className="flex flex-col lg:flex-row items-start gap-4">

                {/* Barang list table */}
                <div className="w-full lg:flex-1 flex flex-col gap-4 min-w-0">
                    <div className="flex flex-col border border-gray-300 rounded-lg overflow-hidden">

                        {/* Header bar */}
                        <div className="h-20 px-4 bg-slate-100 border-b border-gray-300 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Package2 size={20} className="text-gray-800 shrink-0" />
                                <span className="text-xl font-semibold text-gray-800">
                                    Total Barang{' '}
                                    <span className="text-lg font-normal text-gray-600">({barangList.length} items)</span>
                                </span>
                            </div>
                        </div>

                        {/* Column headers */}
                        <div className="h-16 px-4 bg-slate-100 border-b border-gray-300 flex items-center gap-2">
                            <div className="flex-1 min-w-0 flex items-center">
                                <span className="text-base font-semibold text-gray-800">No.</span>
                            </div>
                            <div className="flex-[3] min-w-0 flex items-center">
                                <span className="text-base font-semibold text-gray-800">ID BARANG</span>
                            </div>
                            <div className="flex-[2] min-w-0 flex items-center">
                                <span className="text-base font-semibold text-gray-800">STATUS</span>
                            </div>
                        </div>

                        {/* Rows — paginated slice */}
                        {barangList.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-400 italic bg-slate-100">
                                Tidak ada data barang terkait
                            </div>
                        ) : pagedBarangList.map((barang, pageIdx) => {
                            const absoluteIdx = barangStartIdx + pageIdx
                            return (
                                <button
                                    key={barang.id}
                                    onClick={() => setSelectedBarangIdx(absoluteIdx)}
                                    className={`h-14 px-4 border-b border-gray-300 flex items-center gap-2 transition-colors w-full text-left ${
                                        selectedBarangIdx === absoluteIdx ? 'bg-blue-50' : 'bg-slate-100 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0 flex items-center">
                                        <span className="text-sm font-semibold text-blue-900">{absoluteIdx + 1}.</span>
                                    </div>
                                    <div className="flex-[3] min-w-0 flex items-center">
                                        <span className="text-sm font-semibold text-gray-600 truncate">
                                            {barang.id_barang || `Barang ${absoluteIdx + 1}`}
                                        </span>
                                    </div>
                                    <div className="flex-[2] min-w-0 flex items-center">
                                        <div className="px-2 py-0.5 bg-green-300 rounded-full inline-flex items-center gap-0.5 shrink-0">
                                            <div className="w-3 h-3 bg-green-600 rounded-full shrink-0" />
                                            <span className="text-xs font-semibold text-green-600 whitespace-nowrap">Selesai</span>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}

                        {/* Footer with pagination */}
                        {barangList.length > 0 && (
                            <div className="p-4 bg-slate-100 rounded-bl-lg rounded-br-lg border-t border-gray-300 flex flex-col gap-3">
                                <span className="text-base font-medium text-gray-400">
                                    Menampilkan{' '}
                                    {barangStartIdx + 1}–{Math.min(barangPage * BARANG_PAGE_SIZE, barangList.length)}{' '}
                                    dari {barangList.length} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleBarangPageChange(Math.max(1, barangPage - 1))}
                                        disabled={barangPage === 1}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 bg-slate-100 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronLeft size={16} className="text-gray-600" />
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalBarangPages }, (_, i) => i + 1).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => handleBarangPageChange(p)}
                                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                                    p === barangPage
                                                        ? 'bg-blue-200 border border-blue-600 text-blue-700'
                                                        : 'border border-gray-300 bg-slate-100 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleBarangPageChange(Math.min(totalBarangPages, barangPage + 1))}
                                        disabled={barangPage === totalBarangPages}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 bg-slate-100 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronRight size={16} className="text-gray-600" />
                                    </button>
                                    {totalBarangPages > 1 && (
                                        <PageDropdown
                                            currentPage={barangPage}
                                            totalPages={totalBarangPages}
                                            onSelect={handleBarangPageChange}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Photo Preview Panel */}
                <div className="w-full lg:flex-1 flex flex-col gap-4 min-w-0">
                    {barangList.length > 0 && selectedBarang && (
                        <div className="px-4 py-5 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-4">
                            <div className="pb-3.5 border-b border-gray-300 flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                                    <span className="text-lg font-semibold text-gray-800">Preview Gambar:</span>
                                    <span className="text-lg font-normal text-gray-800 truncate min-w-0">
                                        {selectedBarang.id_barang || `Barang ${selectedBarangIdx + 1}`}
                                    </span>
                                </div>
                                <div className="relative group flex items-center gap-1.5 shrink-0 cursor-default">
                                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                        <span className="text-xs font-bold text-gray-500 leading-none">?</span>
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 hidden sm:block">Cara ganti preview</span>
                                    <div className="
                                        absolute bottom-full right-0 mb-2 w-56
                                        bg-gray-800 text-white text-xs font-medium rounded-lg px-3 py-2.5
                                        shadow-[0_4px_16px_rgba(0,0,0,0.20)]
                                        opacity-0 pointer-events-none group-hover:opacity-100
                                        translate-y-1 group-hover:translate-y-0
                                        transition-all duration-200 ease-out z-10
                                    ">
                                        <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-gray-800 rotate-45 rounded-sm" />
                                        <div className="flex items-start gap-2">
                                            <span className="mt-0.5 shrink-0">👆</span>
                                            <span>Klik item pada daftar barang di sebelah kiri untuk mengganti preview gambar</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch gap-4">
                                {/* Foto Depan */}
                                <div className="flex-1 min-w-0 p-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-4">
                                    <div className="flex items-center gap-2.5">
                                        <Image size={18} className="text-blue-900 shrink-0" />
                                        <span className="text-base font-semibold text-blue-900">Foto Depan</span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        {editing ? (
                                            <div className="w-full space-y-2">
                                                {selectedBarang.foto_url_atas ? (
                                                    <div className="rounded-lg overflow-hidden relative group">
                                                        <img src={selectedBarang.foto_url_atas} className="w-full h-28 object-cover rounded-lg" alt="foto atas" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white/20 hover:bg-white/30 text-white transition-colors">
                                                                <Upload size={12} /> Ganti Foto
                                                                <input type="file" accept="image/*" className="sr-only"
                                                                       onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(selectedBarang.id, "atas", f); }} />
                                                            </label>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label className="cursor-pointer w-full rounded-lg border border-dashed border-blue-900 h-28 flex flex-col items-center justify-center text-gray-400 hover:border-blue-600 hover:text-gray-600 transition-colors">
                                                        <Upload size={20} className="mb-1.5 opacity-60" />
                                                        <p className="text-xs">Klik untuk upload</p>
                                                        <input type="file" accept="image/*" className="sr-only"
                                                               onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(selectedBarang.id, "atas", f); }} />
                                                    </label>
                                                )}
                                                {fotoFiles[selectedBarang.id]?.atas && (
                                                    <div className="rounded-lg overflow-hidden relative">
                                                        <img src={URL.createObjectURL(fotoFiles[selectedBarang.id].atas!)} className="w-full h-28 object-cover" alt="preview atas" />
                                                        <button onClick={() => clearFotoFile(selectedBarang.id, "atas")} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                                                            <X size={10} />
                                                        </button>
                                                        <p className="text-[10px] text-blue-600 mt-1">● File baru dipilih</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : selectedBarang.foto_url_atas ? (
                                            <img src={selectedBarang.foto_url_atas} className="w-full h-36 rounded-lg object-cover" alt="foto atas" />
                                        ) : (
                                            <div className="w-full h-28 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                                                <Image size={20} className="mb-1.5 opacity-40" />
                                                <p className="text-xs">Tidak ada foto</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Foto Samping */}
                                <div className="flex-1 min-w-0 p-4 bg-slate-100 rounded-lg border border-gray-300 flex flex-col gap-4">
                                    <div className="flex items-center gap-2.5">
                                        <Image size={18} className="text-blue-900 shrink-0" />
                                        <span className="text-base font-semibold text-blue-900">Foto Samping</span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        {editing ? (
                                            <div className="w-full space-y-2">
                                                {selectedBarang.foto_url_samping ? (
                                                    <div className="rounded-lg overflow-hidden relative group">
                                                        <img src={selectedBarang.foto_url_samping} className="w-full h-28 object-cover rounded-lg" alt="foto samping" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white/20 hover:bg-white/30 text-white transition-colors">
                                                                <Upload size={12} /> Ganti Foto
                                                                <input type="file" accept="image/*" className="sr-only"
                                                                       onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(selectedBarang.id, "samping", f); }} />
                                                            </label>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label className="cursor-pointer w-full rounded-lg border border-dashed border-blue-900 h-28 flex flex-col items-center justify-center text-gray-400 hover:border-blue-600 hover:text-gray-600 transition-colors">
                                                        <Upload size={20} className="mb-1.5 opacity-60" />
                                                        <p className="text-xs">Klik untuk upload</p>
                                                        <input type="file" accept="image/*" className="sr-only"
                                                               onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(selectedBarang.id, "samping", f); }} />
                                                    </label>
                                                )}
                                                {fotoFiles[selectedBarang.id]?.samping && (
                                                    <div className="rounded-lg overflow-hidden relative">
                                                        <img src={URL.createObjectURL(fotoFiles[selectedBarang.id].samping!)} className="w-full h-28 object-cover" alt="preview samping" />
                                                        <button onClick={() => clearFotoFile(selectedBarang.id, "samping")} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                                                            <X size={10} />
                                                        </button>
                                                        <p className="text-[10px] text-blue-600 mt-1">● File baru dipilih</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : selectedBarang.foto_url_samping ? (
                                            <img src={selectedBarang.foto_url_samping} className="w-full h-36 rounded-lg object-cover" alt="foto samping" />
                                        ) : (
                                            <div className="w-full h-28 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                                                <Image size={20} className="mb-1.5 opacity-40" />
                                                <p className="text-xs">Tidak ada foto</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <XraySubmitModal
                open={xrayModal.open}
                onClose={handleXrayModalClose}
                mode={xrayModal.mode}
                nomorAju={item.aju ?? ''}
                nomorBlAwb={item.mawb ?? item.hawb ?? ''}
                tanggalBlAwb={item.tanggal_awb ?? editData.tanggal_awb ?? ''}
                kodeKantor={item.kode_kantor ?? editData.kode_kantor ?? ''}
                barangList={barangList}
            />
        </div>
    );
}
