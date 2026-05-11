import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Loader2, Plus, Minus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/constants";

export const Route = createFileRoute("/_app/sales/input")({
  component: SalesInputPage,
});

interface Product { id: string; name: string; price_per_pcs: number; }
interface Store { id: string; name: string; address: string; }

function SalesInputPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>("image/jpeg");
  const fileRef = useRef<HTMLInputElement>(null);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8);

  useEffect(() => {
    (async () => {
      const [{ data: prod }, { data: st }] = await Promise.all([
        supabase.from("cigarette_products").select("id, name, price_per_pcs").eq("is_active", true).order("sort_order"),
        supabase.from("stores").select("id, name, address").order("name"),
      ]);
      setProducts(prod ?? []);
      setStores(st ?? []);
    })();
    requestGps();
  }, []);

  const requestGps = () => {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung GPS");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        toast.error("Gagal mengambil GPS", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onPhoto = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Foto terlalu besar (maks 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64((reader.result as string).split(",")[1] ?? null);
      setPhotoMime(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  const filteredStores = stores.filter((s) => s.name.toLowerCase().includes(storeName.toLowerCase()) && storeName.length > 0).slice(0, 5);

  const pickStore = (s: Store) => {
    setStoreName(s.name);
    setStoreAddress(s.address);
    setShowSuggest(false);
  };

  const inc = (id: string) => setQty((q) => ({ ...q, [id]: (q[id] || 0) + 1 }));
  const dec = (id: string) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }));

  const items = products.map((p) => ({ ...p, quantity: qty[p.id] || 0, subtotal: (qty[p.id] || 0) * p.price_per_pcs })).filter((x) => x.quantity > 0);
  const grandTotal = items.reduce((s, x) => s + x.subtotal, 0);

  const submit = async () => {
    if (!user) return;
    if (!storeName.trim()) return toast.error("Nama toko wajib diisi");
    if (!storeAddress.trim()) return toast.error("Alamat toko wajib diisi");
    if (items.length === 0) return toast.error("Minimal satu produk harus diisi");
    if (!notes.trim()) return toast.error("Keterangan stok wajib diisi");
    if (!photoBase64) return toast.error("Foto toko wajib diambil");

    setSubmitting(true);
    try {
      // 1. Find or create store
      let storeId: string;
      const existing = stores.find((s) => s.name.toLowerCase() === storeName.trim().toLowerCase());
      if (existing) {
        storeId = existing.id;
      } else {
        const { data: ns, error: se } = await supabase.from("stores").insert({
          name: storeName.trim(),
          address: storeAddress.trim(),
          created_by: user.id,
        }).select("id").single();
        if (se) throw se;
        storeId = ns.id;
      }

      // 2. Compute sequence number for today
      const { count } = await supabase
        .from("sales_transactions")
        .select("id", { count: "exact", head: true })
        .eq("sales_user_id", user.id)
        .eq("transaction_date", dateStr);
      const sequence = (count ?? 0) + 1;

      // 3. Upload photo + sync sheets via edge function
      const syncRes = await supabase.functions.invoke("sync-transaction", {
        body: {
          photo: { base64: photoBase64, mime: photoMime, filename: `${profile?.sales_code || "BP"}-${dateStr}-${sequence}.jpg` },
        },
      });
      const photoUrl = (syncRes.data as any)?.photoUrl ?? null;

      // 4. Insert transaction
      const { data: tx, error: te } = await supabase.from("sales_transactions").insert({
        sales_user_id: user.id,
        sales_code: profile?.sales_code ?? null,
        store_id: storeId,
        transaction_date: dateStr,
        transaction_time: timeStr,
        sequence_number: sequence,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        photo_url: photoUrl,
        total_amount: grandTotal,
        notes: notes.trim(),
      }).select("id").single();
      if (te) throw te;

      // 5. Insert items
      const itemRows = items.map((it) => ({
        transaction_id: tx.id,
        product_id: it.id,
        product_name: it.name,
        quantity: it.quantity,
        unit_price: it.price_per_pcs,
        subtotal: it.subtotal,
      }));
      const { error: ie } = await supabase.from("transaction_items").insert(itemRows);
      if (ie) throw ie;

      // 6. Sync to Google Sheets (background, non-blocking)
      supabase.functions.invoke("sync-transaction", {
        body: {
          appendSheet: true,
          transaction: {
            id: tx.id,
            date: dateStr,
            time: timeStr,
            sequence,
            sales_code: profile?.sales_code ?? "",
            sales_name: profile?.full_name ?? "",
            store_name: storeName.trim(),
            store_address: storeAddress.trim(),
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null,
            photo_url: photoUrl,
            total: grandTotal,
            notes: notes.trim(),
            items: itemRows.map((r) => ({ product: r.product_name, qty: r.quantity, price: r.unit_price, subtotal: r.subtotal })),
          },
        },
      }).catch((e) => console.warn("Sheet sync failed (non-blocking):", e));

      toast.success("Transaksi berhasil disimpan");
      navigate({ to: "/sales/history" });
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal menyimpan", { description: err.message ?? String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Input Penjualan</h1>
        <p className="text-sm text-muted-foreground">{dateStr} · {timeStr} · Sales {profile?.sales_code ?? "—"}</p>
      </div>

      {/* Foto & GPS */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Foto Toko & Lokasi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
          {photoBase64 ? (
            <div className="relative">
              <img src={`data:${photoMime};base64,${photoBase64}`} alt="Toko" className="w-full h-48 object-cover rounded-lg border" />
              <Button size="sm" variant="secondary" className="absolute top-2 right-2"
                onClick={() => { setPhotoBase64(null); fileRef.current && (fileRef.current.value = ""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" className="w-full h-32 border-dashed" onClick={() => fileRef.current?.click()}>
              <div className="flex flex-col items-center gap-2">
                <Camera className="h-6 w-6 text-primary" />
                <span className="text-sm">Ambil Foto Toko</span>
              </div>
            </Button>
          )}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              {gpsLoading ? "Mendeteksi GPS…" : coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "GPS belum tersedia"}
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={requestGps} disabled={gpsLoading}>
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Toko */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Data Toko</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 relative">
            <Label>Nama Toko</Label>
            <Input value={storeName} onChange={(e) => { setStoreName(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              placeholder="Ketik nama toko"
              autoComplete="off" />
            {showSuggest && filteredStores.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-card max-h-48 overflow-auto">
                {filteredStores.map((s) => (
                  <button key={s.id} type="button" onClick={() => pickStore(s)}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Alamat Toko</Label>
            <Textarea value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} rows={2} placeholder="Alamat lengkap" />
          </div>
        </CardContent>
      </Card>

      {/* Produk */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Produk Terjual</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {products.map((p) => {
            const q = qty[p.id] || 0;
            const sub = q * p.price_per_pcs;
            return (
              <div key={p.id} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${q > 0 ? "bg-primary/5 border-primary/30" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatRupiah(p.price_per_pcs)}/pcs · Subtotal {formatRupiah(sub)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => dec(p.id)} disabled={q === 0}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold tabular-nums">{q}</span>
                  <Button type="button" size="icon" className="h-8 w-8 bg-gradient-primary" onClick={() => inc(p.id)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Total + Keterangan */}
      <Card className="shadow-card border-primary/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">{formatRupiah(grandTotal)}</span>
          </div>
          <div className="space-y-2">
            <Label>Keterangan Stok di Toko <span className="text-destructive">*</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Contoh: Daun12 ada, Sultan16 tidak ada, Korek tipis…" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={submitting} className="w-full h-12 bg-gradient-primary hover:opacity-90 shadow-glow">
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> Simpan Transaksi</>}
      </Button>
    </div>
  );
}
