import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Loader2, Plus, Minus, Save, X, Map } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/constants";
import { savePendingTransaction } from "@/lib/offline-queue";
import { syncPendingTransactions } from "@/lib/sync-pending";

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
  const [showMap, setShowMap] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [photoBase64, setPhotoBase64] = useState<string | null>(() => sessionStorage.getItem("pendingPhoto"));
  const [photoMime, setPhotoMime] = useState<string>("image/jpeg");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [stockChecks, setStockChecks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [stockError, setStockError] = useState(false);

  // Auto-sync saat online
  useEffect(() => {
    const handleOnline = async () => {
      const { getPendingCount } = await import("@/lib/offline-queue");
      const pending = await getPendingCount();
      if (pending > 0) {
        toast.info(`Mengirim ${pending} transaksi offline...`);
        const result = await syncPendingTransactions();
        if (result.success > 0) toast.success(`${result.success} transaksi berhasil dikirim`);
        if (result.failed > 0) toast.error(`${result.failed} transaksi gagal dikirim`);
      }
    };
    window.addEventListener("online", handleOnline);
    if (navigator.onLine) handleOnline();
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Init stockChecks saat products loaded (hanya untuk produk baru, tidak timpa yg sudah ada)
  useEffect(() => {
    if (products.length > 0) {
      setStockChecks(prev => {
        const init: Record<string, boolean> = { ...prev };
        products.forEach(p => {
          if (!(p.id in init)) init[p.id] = false;
        });
        return init;
      });
    }
  }, [products]);

  console.log("stockChecks:", stockChecks, "products:", products.map(p => p.id));
  const stockNotesValue = (() => {
    const checked = products.filter(p => stockChecks[p.id]).map(p => p.name);
    return checked.length > 0 ? checked.join(", ") : "Tidak ada";
  })();

  const now = new Date();
  const dateStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const timeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });

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
    toast.info("Mendeteksi lokasi...", { duration: 3000 });

    // Tahap 1: GPS satelit presisi tinggi, tanpa cache, timeout 8 detik
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
        toast.success("Lokasi berhasil dideteksi");
      },
      () => {
        // Tahap 2: Pakai cache 3 menit jika ada, lalu cari satelit lagi hingga 15 detik
        toast.info("Mencoba ulang dengan cache...", { duration: 2000 });
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGpsLoading(false);
            toast.success("Lokasi berhasil dideteksi");
          },
          () => {
            // Tahap 3: Fallback triangulasi BTS/WiFi
            toast.info("Sinyal GPS lemah, mencoba jaringan...", { duration: 3000 });
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setGpsLoading(false);
                toast.success("Lokasi dideteksi (perkiraan jaringan)", {
                  description: "Gunakan tombol Peta untuk koreksi jika perlu",
                  duration: 4000,
                });
              },
              () => {
                // Tahap 4: Semua gagal
                setGpsLoading(false);
                toast.warning("GPS tidak tersedia — lokasi tidak akan disimpan", {
                  description: "Gunakan tombol Peta untuk atur lokasi manual",
                  duration: 5000,
                });
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 180000 }
            );
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 180000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const onPhoto = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Foto terlalu besar (maks 20MB)");
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxSize = 800;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      const b64 = dataUrl.split(",")[1] ?? null;
      if (b64) sessionStorage.setItem("pendingPhoto", b64);
      setPhotoBase64(b64);
      setPhotoMime("image/jpeg");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Init Leaflet map saat showMap berubah jadi true
  useEffect(() => {
    if (!showMap || !mapContainerRef.current) return;
    // Destroy map lama jika ada
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    // Default center: Kabupaten Madiun, Jawa Timur
    const defaultLat = coords?.lat ?? -7.6298;
    const defaultLng = coords?.lng ?? 111.5239;
    const zoom = coords ? 16 : 12;

    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (!mapContainerRef.current) return;
      const map = L.default.map(mapContainerRef.current).setView([defaultLat, defaultLng], zoom);
      L.default.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Custom icon
      const icon = L.default.divIcon({
        html: `<div style="background:#2563eb;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 20],
        className: "",
      });

      const marker = L.default.marker([defaultLat, defaultLng], { icon, draggable: true }).addTo(map);
      marker.bindPopup("Geser pin ke lokasi toko").openPopup();

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
      });

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMap]);

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
    const hasStock = Object.values(stockChecks).some(Boolean);
    if (!hasStock) {
      setStockError(true);
      return toast.error("Stok di toko wajib diisi", { description: "Pilih minimal satu produk yang ada di toko" });
    }
    setStockError(false);
    if (!coords) toast.warning("Transaksi disimpan tanpa koordinat GPS", { duration: 3000 });
    if (items.length === 0) return toast.error("Minimal satu produk harus diisi");

    if (!navigator.onLine) {
      try {
        await savePendingTransaction({
          userId: user.id,
          salesCode: profile?.sales_code ?? null,
          salesName: profile?.full_name ?? null,
          storeName, storeAddress, dateStr, timeStr,
          lat: coords?.lat ?? null, lng: coords?.lng ?? null,
          photoBase64, photoMime, grandTotal, stockNotesValue,
          items: items.map(it => ({ id: it.id, name: it.name, quantity: it.quantity, price_per_pcs: it.price_per_pcs, subtotal: it.subtotal })),
        });
        sessionStorage.removeItem("pendingPhoto");
        toast.success("Tersimpan offline", { description: "Akan otomatis dikirim saat ada sinyal" });
        navigate({ to: "/sales/history" });
      } catch (err: any) {
        toast.error("Gagal menyimpan offline", { description: err.message });
      }
      return;
    }
    


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
        notes: stockNotesValue,
      }).select("id").single();
      if (te) throw te;

      // 5. Insert items
      const itemRows = items.map((it) => ({
        transaction_id: tx.id,
        product_id: it.id,
        product_name: it.name,
        sales_code: profile?.sales_code ?? null,
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
            notes: stockNotesValue,
            items: itemRows.map((r) => ({ product: r.product_name, qty: r.quantity, price: r.unit_price, subtotal: r.subtotal })),
          },
        },
      }).catch((e) => console.warn("Sheet sync failed (non-blocking):", e));

      sessionStorage.removeItem('pendingPhoto');
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
        <CardHeader className="pb-3"><CardTitle className="text-base">Foto Toko & Lokasi <span className="text-xs font-normal text-muted-foreground">(opsional)</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!photoBase64 && (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-md cursor-pointer bg-background hover:bg-accent overflow-hidden">
              <div className="flex flex-col items-center gap-2 pointer-events-none">
                <Camera className="h-6 w-6 text-primary" />
                <span className="text-sm">Ambil Foto Toko</span>
              </div>
            <input
              ref={(el) => {
                (cameraInputRef as any).current = el;
                if (el && !el.dataset.bound) {
                  el.dataset.bound = "1";
                  el.addEventListener("change", () => {
                    const f = el.files?.[0];
                    if (f) onPhoto(f);
                    el.value = "";
                  });
                }
              }}
              type="file" accept="image/*" capture="environment" className="hidden" />
          </label>
          )}
          {photoBase64 && (
            <div className="relative">
              <img src={`data:image/jpeg;base64,${photoBase64}`} alt="Toko" className="w-full h-48 object-cover rounded-lg border" onError={(e) => console.error("img error", e)} />
              <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={() => { setPhotoBase64(null); sessionStorage.removeItem('pendingPhoto'); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              {gpsLoading ? "Mendeteksi GPS…" : coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "GPS belum tersedia"}
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={requestGps} disabled={gpsLoading}>
                {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
              <Button type="button" size="sm" variant={showMap ? "default" : "outline"}
                onClick={() => setShowMap(v => !v)}
                className="flex items-center gap-1">
                <Map className="h-3 w-3" />
                <span className="text-xs">{showMap ? "Tutup" : "Peta"}</span>
              </Button>
            </div>
          </div>
          {showMap && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Ketuk peta atau geser pin biru untuk atur lokasi toko</p>
              <div ref={mapContainerRef} className="w-full rounded-lg border overflow-hidden" style={{ height: 280 }} />
              {coords && (
                <p className="text-xs text-center text-primary font-medium">
                  ✅ Lokasi dipilih: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </p>
              )}
            </div>
          )}
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

      {/* Stok di Toko */}
      <Card className={`shadow-soft ${stockError ? "border-destructive border-2" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stok di Toko <span className="text-destructive text-sm">*</span></CardTitle>
          {stockError && <p className="text-xs text-destructive mt-1">Pilih minimal satu produk yang ada di toko</p>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer py-1" onClick={() => setStockError(false)}>
                <input
                  type="checkbox"
                  checked={stockChecks[p.id] ?? false}
                  onChange={(e) => setStockChecks(prev => ({ ...prev, [p.id]: e.target.checked }))}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className={`text-sm truncate ${stockChecks[p.id] ?? false ? "" : "line-through text-muted-foreground"}`}>{p.name}</span>
              </label>
            ))}
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
                  <input
                    type="number"
                    min={0}
                    value={q === 0 ? "" : q}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setQty(prev => ({ ...prev, [p.id]: isNaN(val) || val < 0 ? 0 : val }));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-12 text-center font-semibold tabular-nums text-sm border rounded-md h-8 bg-background focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
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
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={submitting} className="w-full h-12 bg-gradient-primary hover:opacity-90 shadow-glow">
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> Simpan Transaksi</>}
      </Button>
    </div>
  );
}
