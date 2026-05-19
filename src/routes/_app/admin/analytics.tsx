import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatRupiah } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

export const Route = createFileRoute("/_app/admin/analytics")({
  component: Analytics,
});

const COLORS = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2","#db2777","#65a30d","#ea580c","#6d28d9"];

function Analytics() {
  const [items, setItems] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [showFilter, setShowFilter] = useState(false);
  const [salesCode, setSalesCode] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: i }, { data: t }] = await Promise.all([
        supabase.from("transaction_items").select("product_name, quantity, subtotal, transaction_id"),
        supabase.from("sales_transactions").select("id, transaction_date, total_amount, sales_code, notes, stores(name)"),
      ]);
      setItems(i ?? []);
      setTx(t ?? []);
      setLoading(false);
    })();
  }, []);

  const allSalesCodes = useMemo(() => {
    const s = new Set<string>();
    tx.forEach((r) => s.add(r.sales_code || "—"));
    return Array.from(s).sort();
  }, [tx]);

  const filteredTx = useMemo(() =>
    tx.filter((r) => r.transaction_date >= fromDate && r.transaction_date <= toDate && (salesCode === "" || r.sales_code === salesCode)),
    [tx, fromDate, toDate, salesCode]);

  const filteredItems = useMemo(() => {
    const ids = new Set(filteredTx.map((r) => r.id));
    return items.filter((it) => ids.has(it.transaction_id));
  }, [items, filteredTx]);

  const totalPenjualan = useMemo(() => filteredTx.reduce((s, r) => s + (r.total_amount || 0), 0), [filteredTx]);

  // ── PENJUALAN ──────────────────────────────────────────────
  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    filteredTx.forEach((r) => m.set(r.transaction_date, (m.get(r.transaction_date) ?? 0) + (r.total_amount || 0)));
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date: date.slice(5), total }));
  }, [filteredTx]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { qty: number; value: number }>();
    filteredItems.forEach((it) => {
      const cur = m.get(it.product_name) ?? { qty: 0, value: 0 };
      m.set(it.product_name, { qty: cur.qty + (it.quantity || 0), value: cur.value + (it.subtotal || 0) });
    });
    return Array.from(m.entries()).map(([name, v]) => ({ name, qty: v.qty, value: v.value })).sort((a, b) => b.value - a.value);
  }, [filteredItems]);

  const allProducts = useMemo(() => {
    const s = new Set<string>();
    filteredItems.forEach((it) => s.add(it.product_name));
    return Array.from(s).sort();
  }, [filteredItems]);

  const productColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    byProduct.forEach((p, i) => { map[p.name] = COLORS[i % COLORS.length]; });
    return map;
  }, [byProduct]);

  const bySales = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    filteredTx.forEach((r) => { if (!m.has(r.sales_code || "—")) m.set(r.sales_code || "—", {}); });
    filteredItems.forEach((it) => {
      const txRow = filteredTx.find((r) => r.id === it.transaction_id);
      if (!txRow) return;
      const key = txRow.sales_code || "—";
      const entry = m.get(key) ?? {};
      entry[it.product_name] = (entry[it.product_name] ?? 0) + (it.quantity || 0);
      m.set(key, entry);
    });
    return Array.from(m.entries())
      .map(([name, products]) => ({ name, ...products }))
      .sort((a, b) => {
        const sumA = Object.entries(a).filter(([k]) => k !== "name").reduce((s, [, v]) => s + (v as number), 0);
        const sumB = Object.entries(b).filter(([k]) => k !== "name").reduce((s, [, v]) => s + (v as number), 0);
        return sumB - sumA;
      });
  }, [filteredTx, filteredItems]);

  // ── DISTRIBUSI ─────────────────────────────────────────────
  const PRODUCT_LIST = ["Daun12","Daun16","Refill12","Sigara12","Sultan16","Inggil16","Starlet16","Angsal16","Berry16","Korek"];

  const distribusiStok = useMemo(() => {
    return PRODUCT_LIST.map((produk) => {
      const tokoAda: string[] = [];
      const tokoTidakAda: string[] = [];
      filteredTx.forEach((r) => {
        const storeName = (r.stores as any)?.name ?? "—";
        const notes: string = r.notes ?? "";
        if (notes === "Tidak ada" || notes.trim() === "") {
          tokoTidakAda.push(storeName);
        } else {
          const prodList = notes.split(",").map((s: string) => s.trim().toLowerCase());
          if (prodList.includes(produk.toLowerCase())) tokoAda.push(storeName);
          else tokoTidakAda.push(storeName);
        }
      });
      return { produk, ada: tokoAda.length, tokoAda, tokoTidakAda };
    });
  }, [filteredTx]);

  const tokoTeratas = useMemo(() => {
    const m = new Map<string, number>();
    filteredTx.forEach((r) => {
      const nama = (r.stores as any)?.name ?? "—";
      m.set(nama, (m.get(nama) ?? 0) + (r.total_amount || 0));
    });
    return Array.from(m.entries()).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filteredTx]);

  const rataRataPerKunjungan = useMemo(() => {
    const mTotal = new Map<string, number>();
    const mCount = new Map<string, number>();
    filteredTx.forEach((r) => {
      const nama = (r.stores as any)?.name ?? "—";
      mTotal.set(nama, (mTotal.get(nama) ?? 0) + (r.total_amount || 0));
      mCount.set(nama, (mCount.get(nama) ?? 0) + 1);
    });
    return Array.from(mTotal.entries())
      .map(([nama, total]) => ({ nama, rata: Math.round(total / (mCount.get(nama) ?? 1)), kunjungan: mCount.get(nama) ?? 0 }))
      .sort((a, b) => b.rata - a.rata)
      .slice(0, 10);
  }, [filteredTx]);

  const tokoNilaiTurun = useMemo(() => {
    // Hitung periode sebelumnya (same length before fromDate)
    const periodLen = Math.max(1, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1);
    const prevTo = new Date(new Date(fromDate).getTime() - 86400000).toLocaleDateString("sv-SE");
    const prevFrom = new Date(new Date(fromDate).getTime() - periodLen * 86400000).toLocaleDateString("sv-SE");
    const prevTx = tx.filter((r) => r.transaction_date >= prevFrom && r.transaction_date <= prevTo && (salesCode === "" || r.sales_code === salesCode));

    const mCur = new Map<string, number>();
    const mPrev = new Map<string, number>();
    filteredTx.forEach((r) => { const n = (r.stores as any)?.name ?? "—"; mCur.set(n, (mCur.get(n) ?? 0) + (r.total_amount || 0)); });
    prevTx.forEach((r) => { const n = (r.stores as any)?.name ?? "—"; mPrev.set(n, (mPrev.get(n) ?? 0) + (r.total_amount || 0)); });

    return Array.from(mCur.entries())
      .filter(([nama]) => mPrev.has(nama))
      .map(([nama, cur]) => { const prev = mPrev.get(nama) ?? 0; return { nama, cur, prev, selisih: cur - prev, persen: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : 0 }; })
      .filter((t) => t.selisih < 0)
      .sort((a, b) => a.persen - b.persen)
      .slice(0, 8);
  }, [filteredTx, tx, fromDate, toDate, salesCode]);

  // ── MANAJEMEN SALES ────────────────────────────────────────
  const peringkatSales = useMemo(() => {
    const m = new Map<string, { total: number; transaksi: number; totalItem: number }>();
    filteredTx.forEach((r) => {
      const k = r.sales_code || "—";
      const cur = m.get(k) ?? { total: 0, transaksi: 0, totalItem: 0 };
      m.set(k, { total: cur.total + (r.total_amount || 0), transaksi: cur.transaksi + 1, totalItem: cur.totalItem });
    });
    filteredItems.forEach((it) => {
      const txRow = filteredTx.find((r) => r.id === it.transaction_id);
      if (!txRow) return;
      const k = txRow.sales_code || "—";
      const cur = m.get(k);
      if (cur) m.set(k, { ...cur, totalItem: cur.totalItem + (it.quantity || 0) });
    });
    return Array.from(m.entries()).map(([kode, v]) => ({ kode, ...v })).sort((a, b) => b.total - a.total);
  }, [filteredTx, filteredItems]);

  const frekuensiToko = useMemo(() => {
    const m = new Map<string, number>();
    filteredTx.forEach((r) => { const nama = (r.stores as any)?.name ?? "—"; m.set(nama, (m.get(nama) ?? 0) + 1); });
    const totalHari = Math.max(1, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1);
    const mingguan = totalHari / 7;
    return Array.from(m.entries())
      .map(([nama, kunjungan]) => {
        const perMinggu = kunjungan / Math.max(1, mingguan);
        const kategori = perMinggu >= 3 ? "Loyal" : perMinggu >= 1 ? "Reguler" : "Pasif";
        return { nama, kunjungan, kategori };
      })
      .sort((a, b) => b.kunjungan - a.kunjungan);
  }, [filteredTx, fromDate, toDate]);

  const produkPerSales = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    filteredItems.forEach((it) => {
      const txRow = filteredTx.find((r) => r.id === it.transaction_id);
      if (!txRow) return;
      const k = txRow.sales_code || "—";
      if (!m.has(k)) m.set(k, new Map());
      const prodMap = m.get(k)!;
      prodMap.set(it.product_name, (prodMap.get(it.product_name) ?? 0) + (it.quantity || 0));
    });
    return Array.from(m.entries()).map(([kode, prodMap]) => ({
      kode,
      produk: Array.from(prodMap.entries()).map(([nama, qty]) => ({ nama, qty })).sort((a, b) => b.qty - a.qty),
    })).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [filteredTx, filteredItems]);

  // ── NARASI ANALISA OTOMATIS ────────────────────────────────
  const narasiAnalisa = useMemo(() => {
    if (filteredTx.length === 0) return null;

    const parts: string[] = [];
    const periodeLabel = fromDate === toDate ? `tanggal ${fromDate}` : `periode ${fromDate} s/d ${toDate}`;

    // Penjualan
    const totalTx = filteredTx.length;
    const topSales = peringkatSales[0];
    const bottomSales = peringkatSales[peringkatSales.length - 1];
    const topProduk = byProduct[0];
    const omzetRataHari = byDate.length > 0 ? Math.round(totalPenjualan / byDate.length) : totalPenjualan;
    parts.push(`Pada ${periodeLabel}, total penjualan mencapai ${formatRupiah(totalPenjualan)} dari ${totalTx} transaksi di ${new Set(filteredTx.map(r => (r.stores as any)?.name)).size} toko. Rata-rata omzet per hari sebesar ${formatRupiah(omzetRataHari)}.`);

    // Top produk
    if (topProduk) {
      const produkLemah = byProduct[byProduct.length - 1];
      parts.push(`Produk terlaris adalah ${topProduk.name} dengan ${topProduk.qty} pcs terjual senilai ${formatRupiah(topProduk.value)}${produkLemah && produkLemah.name !== topProduk.name ? `, sementara ${produkLemah.name} menjadi produk dengan penjualan terendah (${produkLemah.qty} pcs)` : ""}.`);
    }

    // Manajemen sales
    if (topSales) {
      parts.push(`Di sisi kinerja sales, ${topSales.kode} memimpin dengan ${formatRupiah(topSales.total)} dari ${topSales.transaksi} kunjungan toko${peringkatSales.length > 1 ? `, diikuti ${peringkatSales[1]?.kode} dengan ${formatRupiah(peringkatSales[1]?.total)}` : ""}.${bottomSales && bottomSales.kode !== topSales.kode ? ` Perlu perhatian untuk ${bottomSales.kode} yang baru mencapai ${formatRupiah(bottomSales.total)} dari ${bottomSales.transaksi} kunjungan.` : ""}`);
    }

    // Distribusi toko
    const tokoLoyalCount = frekuensiToko.filter(t => t.kategori === "Loyal").length;
    const tokoPasifCount = frekuensiToko.filter(t => t.kategori === "Pasif").length;
    const tokoPasifList = frekuensiToko.filter(t => t.kategori === "Pasif").slice(0, 3).map(t => t.nama).join(", ");
    if (tokoLoyalCount > 0 || tokoPasifCount > 0) {
      parts.push(`Dari sisi kunjungan toko, terdapat ${tokoLoyalCount} toko loyal yang rutin dikunjungi${tokoPasifCount > 0 ? ` dan ${tokoPasifCount} toko yang mulai jarang dikunjungi${tokoPasifList ? ` (${tokoPasifList})` : ""}. Toko-toko pasif ini perlu mendapat kunjungan prioritas segera` : ""}.`);
    }

    // Toko nilai turun
    if (tokoNilaiTurun.length > 0) {
      const tokoTurunList = tokoNilaiTurun.slice(0, 2).map(t => `${t.nama} (turun ${Math.abs(t.persen)}%)`).join(" dan ");
      parts.push(`⚠️ Perlu diwaspadai: ${tokoTurunList} menunjukkan penurunan nilai belanja dibanding periode sebelumnya. Sales yang bertanggung jawab di wilayah ini perlu melakukan pendekatan lebih intensif.`);
    }

    // Rekomendasi briefing
    parts.push(`Rekomendasi untuk briefing: fokuskan arahan pada peningkatan penjualan ${byProduct[byProduct.length - 1]?.name ?? "produk lemah"}, optimalkan kunjungan ke toko-toko pasif, dan dorong sales dengan kinerja rendah untuk mengejar ketertinggalan.`);

    return parts;
  }, [filteredTx, totalPenjualan, byDate, byProduct, peringkatSales, frekuensiToko, tokoNilaiTurun, fromDate, toDate]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Analitik Penjualan</h1>
          <p className="text-sm text-muted-foreground">{filteredTx.length} transaksi · {formatRupiah(totalPenjualan)}</p>
        </div>
        <Button size="sm" variant={showFilter ? "default" : "outline"} className="shrink-0 mt-1" onClick={() => setShowFilter(v => !v)}>
          <Search className="h-4 w-4 mr-1" /> Filter
        </Button>
      </div>

      {/* FILTER */}
      {showFilter && (
        <Card className="shadow-soft">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Dari</span>
                <Input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-sm w-36" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Sampai</span>
                <Input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} className="h-8 text-sm w-36" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Sales</span>
                <select value={salesCode} onChange={e => setSalesCode(e.target.value)} className="h-8 text-sm border rounded px-2 bg-background text-foreground">
                  <option value="">Semua</option>
                  {allSalesCodes.map(c => <option key={c} value={c === "—" ? "" : c}>{c}</option>)}
                </select>
              </div>
              {(fromDate !== today || toDate !== today || salesCode !== "") && (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => { setFromDate(today); setToDate(today); setSalesCode(""); }}>Reset</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NARASI ANALISA OTOMATIS */}
      {narasiAnalisa && (
        <Card className="shadow-soft border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🤖 Analisa Otomatis</CardTitle>
            <p className="text-xs text-muted-foreground">Ringkasan & bahan briefing pagi — diperbarui sesuai filter</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {narasiAnalisa.map((p, i) => (
              <p key={i} className="text-sm text-foreground leading-relaxed">{p}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ KATEGORI: PENJUALAN ═══ */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">📈 Penjualan</p>
        <div className="space-y-4">

          <Card className="shadow-soft">
            <CardHeader><CardTitle className="text-base">📈 Penjualan per Tanggal</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byDate}>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => formatRupiah(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader><CardTitle className="text-base">🥇 Top Produk (Nilai Penjualan)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {byProduct.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-8 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.qty} pcs</p>
                      </div>
                    </div>
                    <p className="font-semibold tabular-nums">{formatRupiah(p.value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ═══ KATEGORI: DISTRIBUSI ═══ */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">🏪 Distribusi</p>
        <div className="space-y-4">

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">🏪 Toko Paling Banyak Belanja</CardTitle>
              <p className="text-xs text-muted-foreground">10 toko dengan total pembelian tertinggi</p>
            </CardHeader>
            <CardContent>
              {tokoTeratas.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p> : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tokoTeratas} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="nama" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} />
                      <Tooltip formatter={(v: any) => [formatRupiah(v), "Total Belanja"]} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">💸 Rata-rata Nilai per Kunjungan</CardTitle>
              <p className="text-xs text-muted-foreground">Toko mana yang belanjanya paling besar tiap kunjungan?</p>
            </CardHeader>
            <CardContent>
              {rataRataPerKunjungan.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p> : (
                <div className="space-y-2">
                  {rataRataPerKunjungan.map((t, i) => (
                    <div key={t.nama} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{t.nama}</p>
                          <p className="text-xs text-muted-foreground">{t.kunjungan}x kunjungan</p>
                        </div>
                      </div>
                      <p className="font-semibold tabular-nums text-sm">{formatRupiah(t.rata)}/kunjungan</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">📉 Toko yang Nilai Belanjaannya Turun</CardTitle>
              <p className="text-xs text-muted-foreground">Dibandingkan periode sebelumnya yang sama panjangnya</p>
            </CardHeader>
            <CardContent>
              {tokoNilaiTurun.length === 0 ? (
                <p className="text-sm text-green-600 text-center py-4 font-medium">✅ Tidak ada toko yang mengalami penurunan</p>
              ) : (
                <div className="space-y-2">
                  {tokoNilaiTurun.map((t) => (
                    <div key={t.nama} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                      <div>
                        <p className="font-medium text-sm">{t.nama}</p>
                        <p className="text-xs text-muted-foreground">{formatRupiah(t.prev)} → {formatRupiah(t.cur)}</p>
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="h-4 w-4" />
                        <span className="font-bold text-sm">{Math.abs(t.persen)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">📦 Distribusi Stok Rokok per Toko</CardTitle>
              <p className="text-xs text-muted-foreground">Berdasarkan stok yang dilaporkan sales saat kunjungan</p>
            </CardHeader>
            <CardContent>
              {filteredTx.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data untuk filter ini</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3 font-medium text-xs text-muted-foreground w-6">No</th>
                        <th className="text-left py-2 pr-3 font-medium text-xs text-muted-foreground">Nama Rokok</th>
                        <th className="text-center py-2 pr-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Jml Toko<br/>(Stok Ada)</th>
                        <th className="text-left py-2 font-medium text-xs text-muted-foreground">Daftar Toko</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distribusiStok.map((row, i) => (
                        <tr key={row.produk} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                          <td className="py-2 pr-3 text-xs text-muted-foreground align-top">{i + 1}</td>
                          <td className="py-2 pr-3 font-medium align-top">{row.produk}</td>
                          <td className="py-2 pr-3 text-center align-top">
                            <span className={`font-bold text-base ${row.ada > 0 ? "text-green-600" : "text-red-500"}`}>{row.ada}</span>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground align-top">
                            {row.tokoAda.length > 0 ? row.tokoAda.join(", ") : <span className="italic">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ═══ KATEGORI: MANAJEMEN SALES ═══ */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">👥 Manajemen Sales</p>
        <div className="space-y-4">

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">🏆 Papan Peringkat Sales</CardTitle>
              <p className="text-xs text-muted-foreground">Siapa yang paling aktif di periode ini?</p>
            </CardHeader>
            <CardContent>
              {peringkatSales.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p> : (
                <div className="space-y-2">
                  {peringkatSales.map((s, i) => (
                    <div key={s.kode} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-600" : "bg-muted-foreground"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{s.kode}</p>
                        <p className="text-xs text-muted-foreground">{s.transaksi} toko dikunjungi · {s.totalItem} pcs terjual</p>
                      </div>
                      <p className="font-bold text-sm text-primary">{formatRupiah(s.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader><CardTitle className="text-base">📊 Penjualan per Sales (Produk)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      formatter={(v: any, name: string) => [`${v} pcs`, name]}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: "hsl(var(--foreground))" }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>{value}</span>} />
                    {allProducts.map((prod) => (
                      <Bar key={prod} dataKey={prod} stackId="a" fill={productColorMap[prod] ?? "#888"}
                        radius={allProducts.indexOf(prod) === allProducts.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        label={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">🔄 Frekuensi Kunjungan Toko</CardTitle>
              <p className="text-xs text-muted-foreground">Toko mana yang sering dikunjungi, mana yang mulai jarang?</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-lg font-bold text-green-600">{frekuensiToko.filter(t => t.kategori === "Loyal").length}</p>
                  <p className="text-xs text-green-700 font-medium">🟢 Loyal</p>
                  <p className="text-xs text-muted-foreground">≥3x/minggu</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="text-lg font-bold text-yellow-600">{frekuensiToko.filter(t => t.kategori === "Reguler").length}</p>
                  <p className="text-xs text-yellow-700 font-medium">🟡 Reguler</p>
                  <p className="text-xs text-muted-foreground">1-2x/minggu</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-lg font-bold text-red-600">{frekuensiToko.filter(t => t.kategori === "Pasif").length}</p>
                  <p className="text-xs text-red-700 font-medium">🔴 Pasif</p>
                  <p className="text-xs text-muted-foreground">&lt;4x/bulan</p>
                </div>
              </div>
              {frekuensiToko.filter(t => t.kategori === "Pasif").length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-red-600 mb-1">⚠️ Toko yang perlu perhatian:</p>
                  <div className="space-y-1">
                    {frekuensiToko.filter(t => t.kategori === "Pasif").slice(0, 5).map(t => (
                      <div key={t.nama} className="flex justify-between text-xs p-1.5 rounded bg-red-50">
                        <span className="font-medium">{t.nama}</span>
                        <span className="text-muted-foreground">{t.kunjungan}x kunjungan</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">🔍 Produk Terlaris per Sales</CardTitle>
              <p className="text-xs text-muted-foreground">Produk andalan masing-masing sales</p>
            </CardHeader>
            <CardContent>
              {produkPerSales.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p> : (
                <div className="space-y-3">
                  {produkPerSales.map((s) => (
                    <div key={s.kode} className="p-3 rounded-lg border bg-muted/10">
                      <p className="font-semibold text-sm mb-2">{s.kode}</p>
                      <div className="flex flex-wrap gap-1">
                        {s.produk.slice(0, 3).map((p, i) => (
                          <span key={p.nama} className={`text-xs px-2 py-0.5 rounded-full font-medium ${i === 0 ? "bg-primary text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {p.nama} ({p.qty} pcs)
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

    </div>
  );
}
