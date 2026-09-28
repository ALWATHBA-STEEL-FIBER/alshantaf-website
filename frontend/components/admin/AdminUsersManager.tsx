"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { Spinner, SkeletonBlock } from "./EmptyState";
import type { AdminUser } from "@/lib/types";
import { toWesternDigits } from "@/lib/arabicDigits";

const inputClass = "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

export function AdminUsersManager() {
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", name: "", password: "", phone: "", whatsapp: "" });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", whatsapp: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setUsers(await api.adminUsers());
  }

  useEffect(() => {
    let ignore = false;
    api.adminUsers().then((data) => {
      if (!ignore) {
        setUsers(data);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createAdminUser(form);
      setForm({ email: "", name: "", password: "", phone: "", whatsapp: "" });
      await load();
      showSuccess(`${form.name} ${t.admin.adminAddedAs}`);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.adminCreateFailed);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditForm({ name: user.name, phone: user.phone ?? "", whatsapp: user.whatsapp ?? "" });
  }

  async function handleSaveEdit(id: string) {
    setSavingEdit(true);
    try {
      await api.updateAdminUser(id, editForm);
      setEditingId(null);
      await load();
      showSuccess(t.admin.adminUpdated);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.adminUpdateFailed);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`${t.admin.delete} ${user.email}?`)) return;
    setDeletingId(user.id);
    try {
      await api.deleteAdminUser(user.id);
      await load();
      showSuccess(`${user.email} ${t.admin.adminRemoved}`);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.adminRemoveFailed);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-green mb-6">{t.admin.admins}</h1>

      {loading ? (
        <div className="flex flex-col gap-2 mb-6">
          {[0, 1].map((i) => (
            <SkeletonBlock key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-line divide-y divide-line mb-6">
          {users.map((user) =>
            editingId === user.id ? (
              <div key={user.id} className="p-4 flex flex-col gap-3">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>{t.admin.newAdminName}</label>
                    <input
                      className={inputClass}
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t.admin.newAdminPhone}</label>
                    <input
                      dir="ltr"
                      className={inputClass}
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: toWesternDigits(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t.admin.newAdminWhatsapp}</label>
                    <input
                      dir="ltr"
                      className={inputClass}
                      value={editForm.whatsapp}
                      onChange={(e) => setEditForm((f) => ({ ...f, whatsapp: toWesternDigits(e.target.value) }))}
                      placeholder={editForm.phone}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingId(null)} className="h-9 px-4 rounded-lg border border-line text-xs font-bold">
                    {t.admin.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(user.id)}
                    disabled={savingEdit}
                    className="h-9 px-4 rounded-lg bg-green text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingEdit && <Spinner className="w-3.5 h-3.5" />}
                    {t.admin.save}
                  </button>
                </div>
              </div>
            ) : (
              <div key={user.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <b className="block">{user.name}</b>
                  <p className="text-xs text-ink-soft truncate">{user.email}</p>
                  <p className="text-xs text-ink-soft mt-1" dir="ltr">
                    {user.phone ? `${t.admin.adminPhoneLabel}: ${user.phone}` : t.admin.adminNoContact}
                    {user.whatsapp && user.whatsapp !== user.phone ? ` · ${t.admin.adminWhatsappLabel}: ${user.whatsapp}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-soft hidden sm:inline">{new Date(user.createdAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => startEdit(user)}
                    type="button"
                    className="h-9 px-3 rounded-lg bg-surface-2 text-xs font-bold"
                  >
                    {t.admin.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    disabled={deletingId === user.id}
                    type="button"
                    className="h-9 px-3 rounded-lg bg-red-50 text-red-600 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {deletingId === user.id && <Spinner className="w-3.5 h-3.5" />}
                    {t.admin.delete}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-line p-6 flex flex-col gap-3 max-w-md">
        <b className="text-sm text-green">{t.admin.addAdmin}</b>
        <div>
          <label className={labelClass}>{t.admin.newAdminName}</label>
          <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{t.admin.newAdminEmail}</label>
          <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{t.admin.newAdminPassword}</label>
          <input type="password" className={inputClass} minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{t.admin.newAdminPhone}</label>
          <input dir="ltr" className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: toWesternDigits(e.target.value) }))} />
        </div>
        <div>
          <label className={labelClass}>{t.admin.newAdminWhatsapp}</label>
          <input
            dir="ltr"
            className={inputClass}
            value={form.whatsapp}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp: toWesternDigits(e.target.value) }))}
            placeholder={form.phone}
          />
        </div>
        <button type="submit" disabled={creating} className="h-11 rounded-full bg-green text-white font-bold self-start px-6 disabled:opacity-60 flex items-center gap-2">
          {creating && <Spinner className="w-4 h-4" />}
          {t.admin.addAdmin}
        </button>
      </form>
    </div>
  );
}
