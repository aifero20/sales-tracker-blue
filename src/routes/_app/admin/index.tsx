import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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

  useEffect(() => {
    (async () => {
      const today = filterDate;
      const monthStr = `${filterYear}-${String(filterMonth + 1).padStart(2, "0")}`;
      const [{ data: tx }, { data: allTx }, { count: salesCount }, { count: prodCount }] = await Promise.all([
        supabase.from("sales_transactions").select("total_amount, transaction_date")
          .gte("transaction_date", `${monthStr}-01`)
          .lte("transaction_date", `${monthStr}-31`),
        supabase.from("sales_transactions").select("total_amount, transaction_date")
          .eq("transaction_date", today),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "sales"),
        supabase.from("cigarette_products").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      const filtered = tx ?? [];
      const todayRows = allTx ?? [];
      setS({
        tx: filtered.length,
        value: filtered.reduce((a, b) => a + (b.total_amount || 0), 0),
        sales: salesCount ?? 0,
        products: prodCount ?? 0,
        today: todayRows.length,
        todayValue: todayRows.reduce((a, b) => a + (b.total_amount || 0), 0),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <p className="text-sm text-muted-foreground">Ringkasan seluruh aktivitas penjualan</p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periode Harian</p>
        <div className="relative">
          <button onClick={() => setShowCal(c => !c)} className="p-1 rounded hover:bg-muted">
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </button>
          {showCal && (
            <div className="absolute right-0 top-7 z-50 bg-popover border rounded-lg shadow-lg p-2">
              <input type="date" value={filterDate} max={now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" })}
                onChange={(e) => { setFilterDate(e.target.value); setShowCal(false); }}
                className="text-sm border rounded px-2 py-1" />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label={`Transaksi ${filterDate === now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }) ? "Hari Ini" : filterDate}`} value={s.today.toString()} icon={ShoppingCart} accent />
        <Stat label={`Nilai ${filterDate === now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }) ? "Hari Ini" : filterDate}`} value={formatRupiah(s.todayValue)} icon={TrendingUp} accent />
        <Stat label="Total Sales" value={s.sales.toString()} icon={Users} />
        <div className="col-span-2 md:col-span-3">
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
      </div>

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