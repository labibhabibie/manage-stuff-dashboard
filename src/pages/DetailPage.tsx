import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Atom, Leaf, Droplets, Zap, Clock,
  Image, FileText, Edit2, Save, X, AlertTriangle,
  Loader2, CheckCircle2, Plane, Package2, Phone,
  User, Send, Upload,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase, InspeksiBarang, Barang, logActivity } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useGudangForItem } from '../hooks/useGudangData';

// ─── Outside component to prevent remount/focus loss ────────────────────────

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="label">{label}</p>
      <p className="text-sm text-surface-200">
        {value || <span className="italic text-surface-600">—</span>}
      </p>
    </div>
);

const EditField = ({
                     label, field, type = "text", placeholder = "", value, onChange,
                   }: {
  label: string;
  field: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (field: string, value: string) => void;
}) => (
    <div>
      <label className="label">{label}</label>
      <input
          type={type}
          className="input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
      />
    </div>
);

const MockField = ({ label, value, mock }: {
  label: string
  value: string | null | undefined
  mock: string
}) => (
    <div>
      <p className="label">{label}</p>
      {value
          ? <p className="text-sm text-surface-200">{value}</p>
          : <p className="text-sm text-surface-600 italic">{mock}</p>
      }
    </div>
)

// ────────────────────────────────────────────────────────────────────────────

export default function DetailPage() {
  const { id: recordId } = useParams<{ id: string }>();
  const [item, setItem] = useState<InspeksiBarang | null>(null);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { gudang } = useGudangForItem(recordId)

  // Per-barang file state: { [barang_id]: { atas?: File, samping?: File } }
  const [fotoFiles, setFotoFiles] = useState<
      Record<string, { atas?: File; samping?: File }>
  >({});

  const [editData, setEditData] = useState({
    aju: "",
    mawb: "",
    hawb: "",
    tanggal_awb: "",
    kode_kantor: "",
    airline_code: "",
    ori_dest: "",
    weight: "",
    note_handling: "",
    shipper_pic_name: "",
    shipper_pic_number: "",
  });

  const { user, isAdmin } = useAuth();

  useEffect(() => {
    fetchDetail();
  }, [recordId]);

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
        aju: data.aju || "",
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

      // Fetch related barang rows
      const { data: barangData } = await supabase
          .from("barang")
          .select("*")
          .or(`mawb.eq.${data.mawb},hawb.eq.${data.hawb}`)
          .order("created_at");
      setBarangList(barangData || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!item || !user) return;
    setSaving(true);

    // Upload any changed foto files per barang
    for (const barang of barangList) {
      const files = fotoFiles[barang.id];
      if (!files) continue;

      let foto_url_atas = barang.foto_url_atas;
      let foto_url_samping = barang.foto_url_samping;

      if (files.atas) {
        const { data } = await supabase.storage
            .from("inspeksi-foto")
            .upload(`${item.id}/${barang.id}/atas_${Date.now()}`, files.atas, { upsert: true });
        if (data) {
          const { data: { publicUrl } } = supabase.storage
              .from("inspeksi-foto")
              .getPublicUrl(data.path);
          foto_url_atas = publicUrl;
        }
      }

      if (files.samping) {
        const { data } = await supabase.storage
            .from("inspeksi-foto")
            .upload(`${item.id}/${barang.id}/samping_${Date.now()}`, files.samping, { upsert: true });
        if (data) {
          const { data: { publicUrl } } = supabase.storage
              .from("inspeksi-foto")
              .getPublicUrl(data.path);
          foto_url_samping = publicUrl;
        }
      }

      await supabase
          .from("barang")
          .update({ foto_url_atas, foto_url_samping })
          .eq("id", barang.id);
    }

    // Update inspeksi_barang_v2
    const payload = {
      ...editData,
      updated_by: user.id,
    };

    const { error } = await supabase
        .from("inspeksi_barang_v2")
        .update(payload)
        .eq("id", item.id);

    setSaving(false);

    if (!error) {
      await logActivity(user.id, "update", {
        targetTable: "inspeksi_barang_v2",
        targetId: item.id,
        description: `Update data inspeksi ${item.aju}`,
      });
      setSaved(true);
      setFotoFiles({});
      setTimeout(() => setSaved(false), 3000);
      setEditing(false);
      fetchDetail();
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditData((d) => ({ ...d, [field]: value }));
  };

  const setFotoFile = (barangId: string, side: "atas" | "samping", file: File) => {
    setFotoFiles((prev) => ({
      ...prev,
      [barangId]: { ...prev[barangId], [side]: file },
    }));
  };

  const clearFotoFile = (barangId: string, side: "atas" | "samping") => {
    setFotoFiles((prev) => {
      const updated = { ...prev[barangId] };
      delete updated[side];
      return { ...prev, [barangId]: updated };
    });
  };

  if (loading)
    return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

  if (!item)
    return (
        <div className="text-center py-20">
          <AlertTriangle size={40} className="text-amber-500 mx-auto mb-3" />
          <p className="text-surface-300">Data tidak ditemukan</p>
          <Link to="/data" className="btn-secondary mt-4 inline-flex">Kembali</Link>
        </div>
    );

  return (
      <div className="max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
                to="/data"
                className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-white text-lg">
                  Inspeksi:{" "}
                  <span className="font-mono text-brand-400">{item.aju}</span>
                </h2>
                {saved && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 size={14} /> Tersimpan
                </span>
                )}
              </div>
              <p className="text-xs text-surface-400 mt-0.5">
                Dibuat{" "}
                {format(new Date(item.created_at), "dd MMMM yyyy, HH:mm", { locale: id })}
              </p>
            </div>
          </div>
          {isAdmin && (
              <div className="flex gap-2">
                <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <Send size={14} /> Kirim Bea Cukai
                </button>
                {editing ? (
                    <>
                      <button onClick={() => setEditing(false)} className="btn-secondary">
                        <X size={14} /> Batal
                      </button>
                      <button onClick={handleSave} disabled={saving} className="btn-primary">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Simpan
                      </button>
                    </>
                ) : (
                    <button onClick={() => setEditing(true)} className="btn-primary">
                      <Edit2 size={14} /> Edit
                    </button>
                )}
              </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">

            {/* Basic Info */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4">
                Informasi Dasar
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Field
                    label="No AJU"
                    value={<span className="font-mono text-brand-400 text-sm font-medium">{item.aju}</span>}
                />
                <div>
                  <p className="label">Waktu Masuk</p>
                  <div className="flex items-center gap-1.5 text-sm text-surface-200">
                    <Clock size={13} className="text-surface-400" />
                    {format(new Date(item.waktu_masuk), "dd MMM yyyy HH:mm", { locale: id })}
                  </div>
                </div>
                <Field
                    label="Dibuat Oleh"
                    value={
                        (item.profiles as { full_name?: string; email?: string })?.full_name ||
                        (item.profiles as { full_name?: string; email?: string })?.email
                    }
                />
                <div>
                  <p className="label">Terakhir Diubah</p>
                  <p className="text-sm text-surface-300">
                    {item.updated_at
                        ? format(new Date(item.updated_at), "dd MMM yyyy HH:mm", { locale: id })
                        : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Shipment Info */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Plane size={12} /> Informasi Pengiriman
              </h3>
              {editing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <EditField label="MAWB"          field="mawb"          value={editData.mawb}                    onChange={handleFieldChange} placeholder="Master Air Waybill" />
                    <EditField label="HAWB"          field="hawb"          value={editData.hawb}                    onChange={handleFieldChange} placeholder="House Air Waybill" />
                    <MockField label="Airline Code" value={item.airline_code} mock={gudang.airline_code ?? '—'} />
                    <MockField label="Ori / Dest"   value={item.ori_dest}     mock={gudang.ori_dest ?? '—'} />
                    <Field
                        label="Jumlah Barang"
                        value={barangList.length > 0 ? `${barangList.length} pcs` : null}
                    />
                    <MockField label="Berat (Kg)"   value={item.weight}       mock={gudang.weight ?? '—'} />
                    <MockField label="Tanggal AWB"  value={item.tanggal_awb}  mock={gudang.tanggal_awb ?? '—'} />
                  </div>
              ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="MAWB"          value={item.mawb}          />
                    <Field label="HAWB"          value={item.hawb}          /> {/* Punya possibility ga punya hawb */}
                    <MockField label="Airline Code" value={item.airline_code} mock={gudang.airline_code ?? '—'} />
                    <MockField label="Ori / Dest"   value={item.ori_dest}     mock={gudang.ori_dest ?? '—'} />
                    <Field
                        label="Jumlah Barang"
                        value={barangList.length > 0 ? `${barangList.length} pcs` : null}
                    />
                    <MockField label="Berat (Kg)"   value={item.weight}       mock={gudang.weight ?? '—'} />
                    <MockField label="Tanggal AWB"  value={item.tanggal_awb}  mock={gudang.tanggal_awb ?? '—'} />
                  </div>
              )}
            </div>

            {/* Foto per Barang */}
            {barangList.map((barang, idx) => (
                <div key={barang.id} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                        Barang {idx + 1}
                      </h3>
                      <p className="text-xs font-mono text-brand-400 mt-0.5">{barang.id_barang}</p>
                    </div>
                    {!editing && (
                        <div className="relative group">
                          <button
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            <Upload size={11} /> Kirim Foto ke Bea Cukai
                          </button>
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 w-56">
                            <div className="bg-surface-800 border border-surface-600 text-surface-200 text-xs rounded-lg px-3 py-2 leading-relaxed shadow-lg">
                              Tambahkan foto X-Ray ini ke data bea cukai yang sudah ada.
                            </div>
                            {/* arrow */}
                            <div className="absolute top-full right-3 border-4 border-transparent border-t-surface-600" />
                          </div>
                        </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">

                    {/* Foto Atas */}
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-surface-500 mb-1.5">
                        <Image size={11} /> Foto Atas
                      </p>
                      {editing ? (
                          <div className="space-y-2">
                            {barang.foto_url_atas ? (
                                <div className="rounded-lg overflow-hidden relative group">
                                  <img
                                      src={barang.foto_url_atas}
                                      alt={`${barang.id_barang} atas`}
                                      className="w-full h-28 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white/20 hover:bg-white/30 text-white transition-colors">
                                      <Upload size={12} /> Ganti Foto
                                      <input type="file" accept="image/*" className="sr-only"
                                             onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(barang.id, "atas", f); }} />
                                    </label>
                                  </div>
                                </div>
                            ) : (
                                <label className="cursor-pointer rounded-lg border border-dashed border-brand-700 h-28 flex flex-col items-center justify-center text-surface-400 hover:border-brand-500 hover:text-surface-300 transition-colors">
                                  <Upload size={20} className="mb-1.5 opacity-60" />
                                  <p className="text-xs">Klik untuk upload</p>
                                  <input type="file" accept="image/*" className="sr-only"
                                         onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(barang.id, "atas", f); }} />
                                </label>
                            )}
                            {fotoFiles[barang.id]?.atas && (
                                <div className="rounded-lg overflow-hidden relative">
                                  <img
                                      src={URL.createObjectURL(fotoFiles[barang.id].atas!)}
                                      className="w-full h-28 object-cover"
                                      alt="preview atas"
                                  />
                                  <button
                                      onClick={() => clearFotoFile(barang.id, "atas")}
                                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                                  >
                                    <X size={10} />
                                  </button>
                                  <p className="text-[10px] text-brand-400 mt-1">● File baru dipilih</p>
                                </div>
                            )}
                          </div>
                      ) : (
                          barang.foto_url_atas ? (
                              <div className="rounded-lg overflow-hidden">
                                <img src={barang.foto_url_atas} alt={`${barang.id_barang} atas`} className="w-full h-28 object-cover" />
                              </div>
                          ) : (
                              <div className="rounded-lg border border-dashed border-surface-700 h-28 flex flex-col items-center justify-center text-surface-600">
                                <Image size={20} className="mb-1.5 opacity-40" />
                                <p className="text-xs">Tidak ada foto</p>
                              </div>
                          )
                      )}
                    </div>

                    {/* Foto Samping */}
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-surface-500 mb-1.5">
                        <Image size={11} /> Foto Samping
                      </p>
                      {editing ? (
                          <div className="space-y-2">
                            {barang.foto_url_samping ? (
                                <div className="rounded-lg overflow-hidden relative group">
                                  <img
                                      src={barang.foto_url_samping}
                                      alt={`${barang.id_barang} samping`}
                                      className="w-full h-28 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white/20 hover:bg-white/30 text-white transition-colors">
                                      <Upload size={12} /> Ganti Foto
                                      <input type="file" accept="image/*" className="sr-only"
                                             onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(barang.id, "samping", f); }} />
                                    </label>
                                  </div>
                                </div>
                            ) : (
                                <label className="cursor-pointer rounded-lg border border-dashed border-brand-700 h-28 flex flex-col items-center justify-center text-surface-400 hover:border-brand-500 hover:text-surface-300 transition-colors">
                                  <Upload size={20} className="mb-1.5 opacity-60" />
                                  <p className="text-xs">Klik untuk upload</p>
                                  <input type="file" accept="image/*" className="sr-only"
                                         onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoFile(barang.id, "samping", f); }} />
                                </label>
                            )}
                            {fotoFiles[barang.id]?.samping && (
                                <div className="rounded-lg overflow-hidden relative">
                                  <img
                                      src={URL.createObjectURL(fotoFiles[barang.id].samping!)}
                                      className="w-full h-28 object-cover"
                                      alt="preview samping"
                                  />
                                  <button
                                      onClick={() => clearFotoFile(barang.id, "samping")}
                                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                                  >
                                    <X size={10} />
                                  </button>
                                  <p className="text-[10px] text-brand-400 mt-1">● File baru dipilih</p>
                                </div>
                            )}
                          </div>
                      ) : (
                          barang.foto_url_samping ? (
                              <div className="rounded-lg overflow-hidden">
                                <img src={barang.foto_url_samping} alt={`${barang.id_barang} samping`} className="w-full h-28 object-cover" />
                              </div>
                          ) : (
                              <div className="rounded-lg border border-dashed border-surface-700 h-28 flex flex-col items-center justify-center text-surface-600">
                                <Image size={20} className="mb-1.5 opacity-40" />
                                <p className="text-xs">Tidak ada foto</p>
                              </div>
                          )
                      )}
                    </div>

                  </div>
                </div>
            ))}

            {barangList.length === 0 && (
                <div className="card p-5 text-center text-surface-500 text-sm italic">
                  Tidak ada data barang terkait
                </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="space-y-2 mb-4">
                <h3 className="text-xs font-semibold text-surface-400">Kode Kantor</h3>
                {editing ? (
                    <EditField label="" field="kode_kantor" value={editData.kode_kantor} onChange={handleFieldChange} placeholder="Kode kantor" />
                ) : (
                    <p className="text-sm">
                      {item.kode_kantor
                          ? <span className="text-surface-200">{item.kode_kantor}</span>
                          : <span className="text-surface-600 italic">BANTEN</span>
                      }
                    </p>
                )}
              </div>
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Status</h3>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-green-900/30 text-green-400 border border-green-800/50">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Selesai Diinspeksi
            </span>
            </div>

            {/* Shipper PIC */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={12} /> Shipper PIC
              </h3>
              {editing ? (
                  <div className="space-y-3">
                    <EditField label="Nama PIC"  field="shipper_pic_name"   value={editData.shipper_pic_name}   onChange={handleFieldChange} placeholder="Nama penanggung jawab" />
                    <EditField label="Nomor PIC" field="shipper_pic_number" value={editData.shipper_pic_number} onChange={handleFieldChange} placeholder="No. HP / telepon" />
                  </div>
              ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="label">Nama PIC</p>
                      <div className="flex items-center gap-1.5 text-sm">
                        <User size={13} className="text-surface-400 shrink-0" />
                        {item.shipper_pic_name
                            ? <span className="text-surface-200">{item.shipper_pic_name}</span>
                            : <span className="text-surface-600 italic">{gudang.shipper_pic_name ?? '—'}</span>
                        }
                      </div>
                    </div>
                    <div>
                      <p className="label">Nomor PIC</p>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone size={13} className="text-surface-400 shrink-0" />
                        {item.shipper_pic_number
                            ? <span className="text-surface-200">{item.shipper_pic_number}</span>
                            : <span className="text-surface-600 italic">{gudang.shipper_pic_number ?? '—'}</span>
                        }
                      </div>
                    </div>
                  </div>
              )}
            </div>

            {/* Note Handling */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Package2 size={12} /> Note Handling
              </h3>
              {editing ? (
                  <textarea
                      className="input h-24 resize-none"
                      placeholder="Instruksi penanganan..."
                      value={editData.note_handling}
                      onChange={(e) => setEditData((d) => ({ ...d, note_handling: e.target.value }))}
                  />
              ) : (
                  <p className="text-sm leading-relaxed">
                    {item.note_handling
                        ? <span className="text-surface-300">{item.note_handling}</span>
                        : <span className="text-surface-600 italic">-</span>
                    }
                  </p>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}