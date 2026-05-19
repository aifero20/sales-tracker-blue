import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Users, Package, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatRupiah } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminHome,
});

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function AdminHome() {
  const now = new Date();
  const [filterDate, setFilterDate] = useState(now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }));
  const [showCal, setShowCal] = useState(false);
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [s, setS] = useState({ tx: 0, value: 0, sales: 0, products: 0, today: 0, todayValue: 0 });
  const [monthlyTx, setMonthlyTx] = useState<any[]>([]);
  const [monthlyItems, setMonthlyItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const today = filterDate;
      const monthStr = `${filterYear}-${String(filterMonth + 1).padStart(2, "0")}`;
      const [{ data: tx }, { data: allTx }, { count: salesCount }, { count: prodCount }, { data: items }] = await Promise.all([
        supabase.from("sales_transactions").select("id, total_amount, transaction_date, sales_code, stores(name)")
          .gte("transaction_date", `${monthStr}-01`)
          .lte("transaction_date", `${monthStr}-31`),
        supabase.from("sales_transactions").select("total_amount, transaction_date")
          .eq("transaction_date", today),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "sales"),
        supabase.from("cigarette_products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("transaction_items").select("product_name, quantity, subtotal, transaction_id"),
      ]);
      const filtered = tx ?? [];
      const todayRows = allTx ?? [];
      setMonthlyTx(filtered);
      setMonthlyItems(items ?? []);
      setS({
        tx: filtered.length,
        value: filtered.reduce((a: number, b: any) => a + (b.total_amount || 0), 0),
        sales: salesCount ?? 0,
        products: prodCount ?? 0,
        today: todayRows.length,
        todayValue: todayRows.reduce((a: number, b: any) => a + (b.total_amount || 0), 0),
      });
    })();
  }, [filterMonth, filterYear, filterDate]);

  const prevMonth = () => {
    if (filterMonth === 0) { setFilterMonth(11); setFilterYear(y => y - 1); }
    else setFilterMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (filterMonth === 11) { setFilterMonth(0); setFilterYear(y => y + 1); }
    else setFilterMonth(m => m + 1);
  };

  // ── RINGKASAN AKHIR BULAN ──────────────────────────────────
  const ringkasan = useMemo(() => {
    if (monthlyTx.length === 0) return null;

    // Sales terbaik
    const salesMap = new Map<string, number>();
    monthlyTx.forEach((r: any) => {
      const k = r.sales_code || "—";
      salesMap.set(k, (salesMap.get(k) ?? 0) + (r.total_amount || 0));
    });
    const salesArr = Array.from(salesMap.entries()).sort((a, b) => b[1] - a[1]);
    const topSales = salesArr[0];

    // Produk terlaris
    const itemIds = new Set(monthlyTx.map((r: any) => r.id));
    const relItems = monthlyItems.filter((it: any) => itemIds.has(it.transaction_id));
    const prodMap = new Map<string, number>();
    relItems.forEach((it: any) => prodMap.set(it.product_name, (prodMap.get(it.product_name) ?? 0) + (it.quantity || 0)));
    const prodArr = Array.from(prodMap.entries()).sort((a, b) => b[1] - a[1]);
    const topProd = prodArr[0];
    const bottomProd = prodArr[prodArr.length - 1];

    // Toko terbanyak belanja
    const tokoMap = new Map<string, number>();
    monthlyTx.forEach((r: any) => {
      const nama = (r.stores as any)?.name ?? "—";
      tokoMap.set(nama, (tokoMap.get(nama) ?? 0) + (r.total_amount || 0));
    });
    const tokoArr = Array.from(tokoMap.entries()).sort((a, b) => b[1] - a[1]);
    const topToko = tokoArr[0];

    // Toko baru bulan ini
    const tokoKunjungan = new Map<string, number>();
    monthlyTx.forEach((r: any) => {
      const nama = (r.stores as any)?.name ?? "—";
      tokoKunjungan.set(nama, (tokoKunjungan.get(nama) ?? 0) + 1);
    });

    // Rata-rata harian
    const daysInMonth = new Set(monthlyTx.map((r: any) => r.transaction_date)).size;
    const avgPerDay = daysInMonth > 0 ? Math.round(s.value / daysInMonth) : 0;

    return { topSales, topProd, bottomProd, topToko, totalToko: tokoKunjungan.size, salesArr, daysActive: daysInMonth, avgPerDay };
  }, [monthlyTx, monthlyItems, s.value]);

  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <p className="text-sm text-muted-foreground">Ringkasan seluruh aktivitas penjualan</p>
      </div>

      {/* PERIODE HARIAN */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periode Harian</p>
        <div className="relative">
          <button onClick={() => setShowCal(c => !c)} className="p-1 rounded hover:bg-muted">
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </button>
          {showCal && (
            <div className="absolute right-0 top-7 z-50 bg-popover border rounded-lg shadow-lg p-2">
              <input type="date" value={filterDate} max={todayStr}
                onChange={(e) => { setFilterDate(e.target.value); setShowCal(false); }}
                className="text-sm border rounded px-2 py-1" />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label={`Transaksi ${filterDate === todayStr ? "Hari Ini" : filterDate}`} value={s.today.toString()} icon={ShoppingCart} accent />
        <Stat label={`Nilai ${filterDate === todayStr ? "Hari Ini" : filterDate}`} value={formatRupiah(s.todayValue)} icon={TrendingUp} accent />
        <Stat label="Total Sales" value={s.sales.toString()} icon={Users} />
      </div>

      {/* PERIODE BULANAN */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periode Bulanan</p>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[80px] text-center">{MONTHS[filterMonth]} {filterYear}</span>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Total Transaksi" value={s.tx.toString()} icon={ShoppingCart} />
          <Stat label="Total Nilai" value={formatRupiah(s.value)} icon={TrendingUp} />
          <Stat label="Produk Aktif" value={s.products.toString()} icon={Package} />
        </div>
      </div>

      {/* RINGKASAN AKHIR BULAN */}
      {ringkasan && (
        <Card className="shadow-soft border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🏁 Ringkasan Bulan {MONTHS[filterMonth]} {filterYear}</CardTitle>
            <p className="text-xs text-muted-foreground">Highlights otomatis — berubah saat bulan dipilih</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-xs text-muted-foreground mb-1">🏆 Sales Terbaik</p>
                <p className="font-bold text-sm">{ringkasan.topSales?.[0] ?? "—"}</p>
                <p className="text-xs text-primary font-semibold">{formatRupiah(ringkasan.topSales?.[1] ?? 0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-xs text-muted-foreground mb-1">🚬 Produk Terlaris</p>
                <p className="font-bold text-sm">{ringkasan.topProd?.[0] ?? "—"}</p>
                <p className="text-xs text-primary font-semibold">{ringkasan.topProd?.[1] ?? 0} pcs terjual</p>
              </div>
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-xs text-muted-foreground mb-1">🏪 Toko Terbesar</p>
                <p className="font-bold text-sm">{ringkasan.topToko?.[0] ?? "—"}</p>
                <p className="text-xs text-primary font-semibold">{formatRupiah(ringkasan.topToko?.[1] ?? 0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-xs text-muted-foreground mb-1">📊 Rata-rata per Hari</p>
                <p className="font-bold text-sm">{formatRupiah(ringkasan.avgPerDay)}</p>
                <p className="text-xs text-muted-foreground">{ringkasan.daysActive} hari aktif · {ringkasan.totalToko} toko</p>
              </div>
            </div>
            {ringkasan.bottomProd && ringkasan.bottomProd[0] !== ringkasan.topProd?.[0] && (
              <div className="p-2 rounded-lg bg-orange-50 border border-orange-100">
                <p className="text-xs text-orange-700">⚠️ Produk paling sedikit terjual bulan ini: <span className="font-semibold">{ringkasan.bottomProd[0]}</span> ({ringkasan.bottomProd[1]} pcs) — pertimbangkan strategi promosi atau evaluasi stok.</p>
              </div>
            )}
            {ringkasan.salesArr.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Peringkat Sales Bulan Ini</p>
                {ringkasan.salesArr.map(([kode, total]: [string, number], i: number) => (
                  <div key={kode} className="flex items-center justify-between text-xs p-1.5 rounded bg-white border">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs ${i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-600" : "bg-muted-foreground"}`}>{i + 1}</span>
                      <span className="font-medium">{kode}</span>
                    </div>
                    <span className="font-semibold text-primary">{formatRupiah(total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

function Stat({ label, value, icon: Icon, accent = false }: { label: string; value: string; icon: any; accent?: boolean }) {
  return (
    <Card className={accent ? "shadow-card border-primary/20" : "shadow-soft"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <p className={`mt-2 text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
