import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/admin/products")({
  component: AdminProducts,
});

interface P { id: string; name: string; price_per_pcs: number; is_active: boolean; sort_order: number; }

function AdminProducts() {
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<P | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", active: true });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cigarette_products").select("*").order("sort_order");
    setItems((data as P[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm({ name: "", price: "", active: true }); setOpen(true); };
  const openEdit = (p: P) => { setEdit(p); setForm({ name: p.name, price: String(p.price_per_pcs), active: p.is_active }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.price) return toast.error("Lengkapi data");
    const price = parseInt(form.price);
    if (isNaN(price) || price < 0) return toast.error("Harga tidak valid");
    if (edit) {
      const { error } = await supabase.from("cigarette_products").update({ name: form.name.trim(), price_per_pcs: price, is_active: form.active }).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("cigarette_products").insert({ name: form.name.trim(), price_per_pcs: price, is_active: form.active, sort_order: items.length + 1 });
      if (error) return toast.error(error.message);
    }
    toast.success("Tersimpan");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus produk ini?")) return;
    const { error } = await supabase.from("cigarette_products").delete().eq("id", id);
    if (error) return toast.error(error.message + " — coba nonaktifkan saja jika produk sudah dipakai transaksi.");
    toast.success("Dihapus");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola Produk</h1>
          <p className="text-sm text-muted-foreground">{items.length} produk</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" /> Baru</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Edit Produk" : "Produk Baru"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Harga per pcs (Rp)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="flex items-center justify-between"><Label>Aktif</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            </div>
            <DialogFooter><Button onClick={save} className="bg-gradient-primary">Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
        <Card className="shadow-soft"><CardContent className="p-0 divide-y">
          {items.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{p.name} {!p.is_active && <span className="text-xs text-muted-foreground">(non-aktif)</span>}</p>
                <p className="text-sm text-muted-foreground">{formatRupiah(p.price_per_pcs)}/pcs</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent></Card>
      }
    </div>
  );
}
