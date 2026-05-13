import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin/sales")({
  component: AdminSales,
});

interface SalesRow { user_id: string; full_name: string; sales_code: string | null; email: string | null; role: string; }

function AdminSales() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SalesRow | null>(null);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", sales_code: "", role: "sales" });

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase.from("profiles").select("id, full_name, sales_code, email").order("sales_code", { nullsFirst: false });
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, string>();
    roles?.forEach((r) => {
      const cur = map.get(r.user_id);
      if (r.role === "admin" || !cur) map.set(r.user_id, r.role);
    });
    setRows((profs ?? []).map((p) => ({ ...p, user_id: p.id, role: map.get(p.id) ?? "sales" })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const deleteUser = async (r: SalesRow) => {
    if (!confirm(`Hapus akun ${r.full_name || r.email}? Semua data transaksinya akan tetap ada.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ user_id: r.user_id }),
    });
    const result = await res.json();
    if (!res.ok) return toast.error(result.error ?? "Gagal hapus akun");
    toast.success("Akun berhasil dihapus");
    load();
  };

  const openNew = () => { setEdit(null); setForm({ email: "", password: "", full_name: "", sales_code: "", role: "sales" }); setOpen(true); };
  const openEdit = (r: SalesRow) => { setEdit(r); setForm({ email: r.email ?? "", password: "", full_name: r.full_name, sales_code: r.sales_code ?? "", role: r.role }); setOpen(true); };

  const save = async () => {
    if (edit) {
      const { error } = await supabase.from("profiles")
        .update({ full_name: form.full_name.trim(), sales_code: form.sales_code.trim() || null })
        .eq("id", edit.user_id);
      if (error) return toast.error(error.message);
      toast.success("Profil diperbarui");
      setOpen(false);
      load();
      return;
    }
    if (!form.email || !form.password) return toast.error("Email & password wajib");
    if (form.password.length < 6) return toast.error("Password minimal 6 karakter");

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), sales_code: form.sales_code.trim() || null, role: form.role }),
    });
    const result = await res.json();
    if (!res.ok) return toast.error(result.error ?? "Gagal membuat akun");
    toast.success("Akun berhasil dibuat");
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola Sales</h1>
          <p className="text-sm text-muted-foreground">{rows.length} pengguna</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" /> Tambah Akun</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Edit Profil" : "Akun Baru"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {!edit && <>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Password (min 6)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              </>}
              <div><Label>Nama Lengkap</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Kode Sales (BP01..)</Label><Input value={form.sales_code} onChange={(e) => setForm({ ...form, sales_code: e.target.value.toUpperCase() })} placeholder="BP01" /></div>
              {!edit && <div>
                <Label>Peran</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>}
              {!edit && <p className="text-xs text-muted-foreground">⚠️ Setelah membuat akun baru, sesi Anda akan beralih ke akun baru tersebut. Anda akan diminta login ulang sebagai admin.</p>}
            </div>
            <DialogFooter><Button onClick={save} className="bg-gradient-primary">Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
        <Card className="shadow-soft"><CardContent className="p-0 divide-y">
          {rows.map((r) => (
            <div key={r.user_id} className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{r.full_name || r.email}</p>
                  {r.role === "admin" ? <Badge className="bg-primary text-primary-foreground">Admin</Badge> : <Badge variant="outline">{r.sales_code ?? "Sales"}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.email}</p>
              </div>
              <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteUser(r)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            </div>
          ))}
        </CardContent></Card>
      }
    </div>
  );
}
