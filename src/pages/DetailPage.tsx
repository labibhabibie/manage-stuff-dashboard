import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Atom,
  Leaf,
  Droplets,
  Zap,
  Clock,
  Image,
  FileText,
  Edit2,
  Save,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase, InspeksiBarang, logActivity } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

export default function DetailPage() {
  const { id: recordId } = useParams<{ id: string }>();
  const [item, setItem] = useState<InspeksiBarang | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editData, setEditData] = useState({
    catatan: "",
    logam: false,
    organik: false,
    cairan: false,
    sintetis: false,
  });
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDetail();
  }, [recordId]);

  const fetchDetail = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inspeksi_barang")
      .select("*, profiles!created_by(full_name, email)")
      .eq("id", recordId!)
      .single();
    if (data) {
      setItem(data as InspeksiBarang);
      setEditData({
        catatan: data.catatan || "",
        logam: data.logam,
        organik: data.organik,
        cairan: data.cairan,
        sintetis: data.sintetis,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!item || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("inspeksi_barang")
      .update({ ...editData, updated_by: user.id })
      .eq("id", item.id);
    setSaving(false);
    if (!error) {
      await logActivity(user.id, "update", {
        targetTable: "inspeksi_barang",
        targetId: item.id,
        description: `Update data inspeksi ${item.id_barang}`,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setEditing(false);
      fetchDetail();
    }
  };

  const typeConfig = [
    {
      key: "logam",
      label: "Logam",
      Icon: Atom,
      cls: "badge-logam",
      desc: "Terdeteksi kandungan logam",
    },
    {
      key: "organik",
      label: "Organik",
      Icon: Leaf,
      cls: "badge-organik",
      desc: "Terdeteksi bahan organik",
    },
    {
      key: "cairan",
      label: "Cairan",
      Icon: Droplets,
      cls: "badge-cairan",
      desc: "Terdeteksi kandungan cairan",
    },
    {
      key: "sintetis",
      label: "Sintetis",
      Icon: Zap,
      cls: "badge-sintetis",
      desc: "Terdeteksi material sintetis",
    },
  ];

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
        <Link to="/data" className="btn-secondary mt-4 inline-flex">
          Kembali
        </Link>
      </div>
    );

  const activeTypes = typeConfig.filter(
    (t) => item[t.key as keyof InspeksiBarang] as boolean,
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
                <span className="font-mono text-brand-400">
                  {item.id_barang}
                </span>
              </h2>
              {saved && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 size={14} /> Tersimpan
                </span>
              )}
            </div>
            <p className="text-xs text-surface-400 mt-0.5">
              Dibuat{" "}
              {format(new Date(item.created_at), "dd MMMM yyyy, HH:mm", {
                locale: id,
              })}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="btn-secondary"
                >
                  <X size={14} />
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Simpan
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="btn-primary">
                <Edit2 size={14} />
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Basic info card */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4">
              Informasi Dasar
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="label">ID Barang</p>
                <p className="font-mono text-brand-400 text-sm font-medium">
                  {item.id_barang}
                </p>
              </div>
              <div>
                <p className="label">Waktu Masuk</p>
                <div className="flex items-center gap-1.5 text-sm text-surface-200">
                  <Clock size={13} className="text-surface-400" />
                  {format(new Date(item.waktu_masuk), "dd MMM yyyy HH:mm", {
                    locale: id,
                  })}
                </div>
              </div>
              <div>
                <p className="label">Dibuat Oleh</p>
                <p className="text-sm text-surface-200">
                  {(item.profiles as { full_name?: string; email?: string })
                    ?.full_name ||
                    (item.profiles as { full_name?: string; email?: string })
                      ?.email ||
                    "—"}
                </p>
              </div>
              <div>
                <p className="label">Terakhir Diubah</p>
                <p className="text-sm text-surface-300">
                  {item.updated_at
                    ? format(new Date(item.updated_at), "dd MMM yyyy HH:mm", {
                        locale: id,
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Detection results */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4">
              Hasil Deteksi
            </h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                {typeConfig.map((t) => {
                  const Icon = t.Icon;
                  const val = editData[
                    t.key as keyof typeof editData
                  ] as boolean;
                  return (
                    <label
                      key={t.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                      ${val ? "border-brand-600 bg-brand-900/20" : "border-surface-700 bg-surface-800/30 hover:border-surface-600"}`}
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) =>
                          setEditData((d) => ({
                            ...d,
                            [t.key]: e.target.checked,
                          }))
                        }
                        className="sr-only"
                      />
                      <div
                        className={`p-2 rounded-lg ${val ? "bg-brand-900/50" : "bg-surface-700"}`}
                      >
                        <Icon
                          size={16}
                          className={
                            val ? "text-brand-400" : "text-surface-400"
                          }
                        />
                      </div>
                      <div>
                        <p
                          className={`text-sm font-medium ${val ? "text-white" : "text-surface-400"}`}
                        >
                          {t.label}
                        </p>
                        <p className="text-xs text-surface-500">
                          {val ? "Terdeteksi" : "Tidak terdeteksi"}
                        </p>
                      </div>
                      {val && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {typeConfig.map((t) => {
                  const Icon = t.Icon;
                  const detected = item[
                    t.key as keyof InspeksiBarang
                  ] as boolean;
                  return (
                    <div
                      key={t.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border
                      ${detected ? "border-brand-700/60 bg-brand-900/20" : "border-surface-800 bg-surface-800/20"}`}
                    >
                      <div
                        className={`p-2 rounded-lg ${detected ? "bg-brand-900/50" : "bg-surface-800"}`}
                      >
                        <Icon
                          size={16}
                          className={
                            detected ? "text-brand-400" : "text-surface-600"
                          }
                        />
                      </div>
                      <div>
                        <p
                          className={`text-sm font-medium ${detected ? "text-white" : "text-surface-500"}`}
                        >
                          {t.label}
                        </p>
                        <p
                          className={`text-xs ${detected ? "text-brand-400" : "text-surface-600"}`}
                        >
                          {detected ? "● Terdeteksi" : "○ Tidak terdeteksi"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText size={12} /> Catatan
            </h3>
            {editing ? (
              <textarea
                className="input h-28 resize-none"
                placeholder="Tambahkan catatan inspeksi..."
                value={editData.catatan}
                onChange={(e) =>
                  setEditData((d) => ({ ...d, catatan: e.target.value }))
                }
              />
            ) : (
              <p className="text-sm text-surface-300 leading-relaxed">
                {item.catatan || (
                  <span className="italic text-surface-600">
                    Tidak ada catatan
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
              Status
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-green-900/30 text-green-400 border border-green-800/50">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Selesai Diinspeksi
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-surface-400">Tipe terdeteksi:</p>
              {activeTypes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeTypes.map((t) => (
                    <span key={t.key} className={t.cls}>
                      <t.Icon size={11} />
                      {t.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-surface-600 italic">
                  Tidak ada tipe terdeteksi
                </p>
              )}
            </div>
          </div>

          {/* Foto */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Image size={12} />
              Foto Barang
            </h3>
            {item.foto_url ? (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={item.foto_url}
                  alt={item.id_barang}
                  className="w-full h-40 object-cover"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-surface-700 h-32 flex flex-col items-center justify-center text-surface-600">
                <Image size={24} className="mb-2 opacity-40" />
                <p className="text-xs">Tidak ada foto</p>
              </div>
            )}
          </div>

          {/* Raw Stats */}
          {item.raw_stats && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                Raw Stats
              </h3>
              <pre className="text-xs font-mono text-surface-300 overflow-auto max-h-40 bg-surface-950 rounded-lg p-3">
                {JSON.stringify(item.raw_stats, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
