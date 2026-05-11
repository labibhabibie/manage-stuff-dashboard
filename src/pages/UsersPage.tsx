import { useEffect, useState } from "react";
import {
  Plus, Edit2, Shield, Check, X, Loader2, AlertCircle,
  UserCheck, UserX, Mail, RefreshCw, Key,
} from "lucide-react";
import { supabase, Profile, Role, logActivity } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { format } from "date-fns";
import { id } from "date-fns/locale";

type ModalMode = "create" | "edit" | null;

// ── Role badge config ──────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: 'bg-yellow-100',  text: 'text-yellow-600', label: 'Super Admin' },
  admin:       { bg: 'bg-blue-100',    text: 'text-blue-600',   label: 'Admin'       },
  operator:    { bg: 'bg-violet-200',  text: 'text-blue-600',   label: 'Operator'    },
  viewer:      { bg: 'bg-gray-100',    text: 'text-gray-500',   label: 'Viewer'      },
}
const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', operator: 'Operator', viewer: 'Viewer',
}

export default function UsersPage() {
  const [users, setUsers]               = useState<Profile[]>([]);
  const [roles, setRoles]               = useState<Role[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");
  const { user: currentUser, isSuperAdmin } = useAuth();

  const [form, setForm] = useState({
    email: "", full_name: "", password: "", role_id: "", is_active: true,
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: usersData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*, roles(*)").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("name"),
    ]);
    setUsers((usersData as Profile[]) || []);
    setRoles((rolesData as Role[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setForm({ email: "", full_name: "", password: "", role_id: roles[0]?.id || "", is_active: true });
    setError(""); setModal("create");
  };

  const openEdit = (u: Profile) => {
    setSelectedUser(u);
    setForm({ email: u.email, full_name: u.full_name || "", password: "", role_id: u.role_id || "", is_active: u.is_active });
    setError(""); setModal("edit");
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.role_id) { setError("Email, password, dan role wajib diisi"); return; }
    setSaving(true); setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: form.email, password: form.password, email_confirm: true,
        user_metadata: { full_name: form.full_name },
      });
      if (authError) { setError(authError.message); setSaving(false); return; }
      if (authData.user) {
        await supabase.from("profiles").update({ full_name: form.full_name, role_id: form.role_id, is_active: form.is_active }).eq("id", authData.user.id);
        if (currentUser) await logActivity(currentUser.id, "create", { targetTable: "profiles", targetId: authData.user.id, description: `Membuat user baru: ${form.email}` });
        setSuccess(`User ${form.email} berhasil dibuat`);
        setTimeout(() => setSuccess(""), 3000);
        setModal(null); fetchData();
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Terjadi kesalahan"); }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!selectedUser || !form.role_id) { setError("Role wajib dipilih"); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("profiles")
        .update({ full_name: form.full_name, role_id: form.role_id, is_active: form.is_active })
        .eq("id", selectedUser.id);
    if (err) { setError(err.message); setSaving(false); return; }
    if (currentUser) await logActivity(currentUser.id, "update", { targetTable: "profiles", targetId: selectedUser.id, description: `Update user: ${selectedUser.email}` });
    setSuccess(`User ${selectedUser.email} berhasil diperbarui`);
    setTimeout(() => setSuccess(""), 3000);
    setModal(null); fetchData(); setSaving(false);
  };

  const toggleActive = async (u: Profile) => {
    await supabase.from("profiles").update({ is_active: !u.is_active }).eq("id", u.id);
    if (currentUser) await logActivity(currentUser.id, "update", { targetTable: "profiles", targetId: u.id, description: `${u.is_active ? "Nonaktifkan" : "Aktifkan"} user: ${u.email}` });
    fetchData();
  };

  return (
      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap justify-between items-end gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xl font-bold text-gray-600 drop-shadow-sm">Management User</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-semibold text-gray-600 drop-shadow-sm">{users.length}</span>
              <span className="text-base font-normal text-gray-600 drop-shadow-sm">Pengguna terdaftar</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {isSuperAdmin && (
                <button
                    onClick={openCreate}
                    className="h-11 px-4 bg-blue-900 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 hover:bg-blue-800 transition-colors"
                >
                  <Plus size={20} className="text-slate-100 shrink-0" />
                  <span className="text-base font-semibold text-slate-100 whitespace-nowrap">Tambah User</span>
                </button>
            )}
            <button
                onClick={fetchData}
                className="h-11 px-4 bg-slate-100 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] border border-gray-300 flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={18} className="text-blue-900 shrink-0" />
              <span className="text-base font-semibold text-blue-900">Refresh</span>
            </button>
          </div>
        </div>

        {/* Success banner */}
        {success && (
            <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 text-sm">
              <Check size={15} className="shrink-0" /> {success}
            </div>
        )}

        {/* ── Table ── */}
        <div className="flex flex-col shadow-[0px_2px_2px_0px_rgba(0,0,0,0.12)]">

          {/* Column headers */}
          <div className="h-16 px-4 bg-slate-100 rounded-tl-lg rounded-tr-lg border border-gray-300 flex items-center gap-2">
            <div className="flex-[3] min-w-[140px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">PENGGUNA</span>
            </div>
            <div className="flex-[1.5] min-w-[80px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">ROLE</span>
            </div>
            <div className="flex-[1.5] min-w-[80px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">STATUS</span>
            </div>
            <div className="flex-[2] min-w-[120px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">BERGABUNG</span>
            </div>
            <div className="flex-1 min-w-[70px] h-6 p-0.5 flex items-center">
              <span className="text-base font-semibold text-gray-800">AKSI</span>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
              <div className="flex justify-center items-center py-16 bg-slate-100 border-l border-r border-b border-gray-300 rounded-bl-lg rounded-br-lg">
                <div className="w-7 h-7 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
              </div>
          ) : users.map((u, idx) => {
            const rName         = (u.roles as { name?: string })?.name || ""
            const badge         = ROLE_BADGE[rName] || ROLE_BADGE.viewer
            const isCurrentUser = u.id === currentUser?.id
            const isLast        = idx === users.length - 1
            const initial       = (u.full_name || u.email || "?").charAt(0).toUpperCase()

            return (
                <div
                    key={u.id}
                    className={`h-14 px-4 bg-slate-100 border-l border-r border-b border-gray-300 flex items-center gap-2 transition-colors hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''} ${isLast ? 'rounded-bl-lg rounded-br-lg' : ''}`}
                >
                  {/* PENGGUNA */}
                  <div className="flex-[3] min-w-[140px] min-w-0 flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-base font-semibold text-slate-100">{initial}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-gray-600 truncate">
                {u.email}
                {isCurrentUser && <span className="ml-1.5 text-[10px] text-blue-600">(Anda)</span>}
              </span>
                    </div>
                  </div>

                  {/* ROLE */}
                  <div className="flex-[1.5] min-w-[80px] min-w-0 flex items-center">
                    <div className={`h-6 px-1.5 py-0.5 ${badge.bg} rounded-full shadow-[2px_2px_10px_0px_rgba(0,0,0,0.20)] border border-gray-300 inline-flex items-center gap-0.5 shrink-0`}>
                      <Shield size={12} className={`${badge.text} shrink-0`} />
                      <span className={`text-xs font-medium ${badge.text} whitespace-nowrap`}>{badge.label}</span>
                    </div>
                  </div>

                  {/* STATUS */}
                  <div className="flex-[1.5] min-w-[80px] min-w-0 flex items-center">
                    {u.is_active ? (
                        <div className="h-6 px-1.5 py-0.5 bg-emerald-100 rounded-full shadow-[2px_2px_10px_0px_rgba(0,0,0,0.20)] border border-gray-300 inline-flex items-center gap-0.5 shrink-0">
                          <UserCheck size={12} className="text-green-600 shrink-0" />
                          <span className="text-xs font-medium text-green-600">Aktif</span>
                        </div>
                    ) : (
                        <div className="h-6 px-1.5 py-0.5 bg-red-100 rounded-full shadow-[2px_2px_10px_0px_rgba(0,0,0,0.20)] border border-gray-300 inline-flex items-center gap-0.5 shrink-0">
                          <UserX size={12} className="text-red-600 shrink-0" />
                          <span className="text-xs font-medium text-red-600">Nonaktif</span>
                        </div>
                    )}
                  </div>

                  {/* BERGABUNG */}
                  <div className="flex-[2] min-w-[120px] min-w-0 flex items-center">
            <span className="text-sm font-normal text-gray-600 truncate">
              {format(new Date(u.created_at), "dd MMMM yyyy", { locale: id })}
            </span>
                  </div>

                  {/* AKSI */}
                  <div className="flex-1 min-w-[70px] min-w-0 flex items-center">
                    {!isCurrentUser && (
                        <div className="flex items-center gap-2">
                          <button
                              onClick={() => openEdit(u)}
                              className="p-1 hover:opacity-70 transition-opacity"
                              title="Edit user"
                          >
                            <Edit2 size={18} className="text-green-600" />
                          </button>
                          <button
                              onClick={() => toggleActive(u)}
                              className="p-1 hover:opacity-70 transition-opacity"
                              title={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {u.is_active
                                ? <UserX size={20} className="text-red-600" />
                                : <UserCheck size={20} className="text-green-600" />
                            }
                          </button>
                        </div>
                    )}
                  </div>
                </div>
            )
          })}
        </div>

        {/* ── Modal ── */}
        {modal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-100 border border-gray-300 rounded-2xl p-6 w-full max-w-md shadow-2xl">

                {/* Modal header */}
                <div className="flex items-center justify-between mb-5">
          <span className="text-xl font-bold text-gray-800">
            {modal === "create" ? "Tambah User Baru" : "Edit User"}
          </span>
                  <button
                      onClick={() => setModal(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal fields */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-500">Nama Lengkap</label>
                    <input
                        type="text"
                        className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-600"
                        placeholder="John Doe"
                        value={form.full_name}
                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-500">
                      Email{" "}
                      {modal === "edit" && <span className="text-gray-400 font-normal">(tidak dapat diubah)</span>}
                    </label>
                    <input
                        type="email"
                        className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-600 disabled:bg-gray-100 disabled:text-gray-400"
                        placeholder="email@domain.com"
                        value={form.email}
                        disabled={modal === "edit"}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>

                  {modal === "create" && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-gray-500 flex items-center gap-1">
                          <Key size={12} /> Password
                        </label>
                        <input
                            type="password"
                            className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-600"
                            placeholder="Min. 8 karakter"
                            value={form.password}
                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        />
                      </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-500">Role</label>
                    <select
                        className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-600"
                        value={form.role_id}
                        onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                    >
                      <option value="">Pilih role...</option>
                      {roles
                          .filter((r) => isSuperAdmin ? true : r.name !== "super_admin")
                          .map((r) => (
                              <option key={r.id} value={r.id}>{roleLabels[r.name] || r.name}</option>
                          ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={form.is_active}
                          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      />
                      <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-blue-900 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                    <span className="text-sm text-gray-600">User Aktif</span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs">
                      <AlertCircle size={13} className="shrink-0" /> {error}
                    </div>
                )}

                {/* Modal actions */}
                <div className="mt-5 flex gap-3 justify-end">
                  <button
                      onClick={() => setModal(null)}
                      className="h-11 px-4 bg-slate-100 rounded-lg border border-gray-300 text-base font-semibold text-blue-900 hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                      onClick={modal === "create" ? handleCreate : handleEdit}
                      disabled={saving}
                      className="h-11 px-4 bg-blue-900 rounded-lg shadow-[2px_2px_12px_0px_rgba(0,0,0,0.12)] flex items-center gap-1.5 text-base font-semibold text-slate-100 hover:bg-blue-800 transition-colors disabled:opacity-60"
                  >
                    {saving
                        ? <Loader2 size={16} className="animate-spin shrink-0" />
                        : <Check size={16} className="shrink-0" />}
                    {modal === "create" ? "Buat User" : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}