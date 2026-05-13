import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, History, TrendingUp, ShoppingCart, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatRupiah } from "@/lib/constants";

export const Route = createFileRoute("/_app/sales/")({
  component: SalesHome,
});

function SalesHome() {
  const { user, profile } = useAuth();
  const now = new Date();
  const [filterDate, setFilterDate] = useState(now.toISOString().slice(0, 10));
  const [showCal, setShowCal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [stats, setStats] = useState({ today: 0, todayValue: 0, total: 0, totalValue: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = filterDate;
      const { data: t } = await supabase
        .from("sales_transactions")
        .select("total_amount, transaction_date")
        .eq("sales_user_id", user.id);
      if (!t) return;

      const todayRows = t.filter((r) => r.transaction_date === today);
      const monthStr = String(selectedMonth + 1).padStart(2, "0");
      const prefix = `${selectedYear}-${monthStr}`;
      const monthRows = t.filter((r) => r.transaction_date?.startsWith(prefix));

      setStats({
        today: todayRows.length,
        todayValue: todayRows.reduce((s, r) => s + (r.total_amount || 0), 0),
        total: monthRows.length,
        totalValue: monthRows.reduce((s, r) => s + (r.total_amount || 0), 0),
      });
    })();
  }, [user, selectedMonth, selectedYear, filterDate]);

  const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Halo,</p>
        <h1 className="text-2xl font-bold">{profile?.full_name || "Sales"}</h1>
        <p className="text-sm text-muted-foreground">Kode Sales: <span className="font-medium text-foreground">{profile?.sales_code ?? "—"}</span></p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periode Harian</p>
        <div className="relative">
          <button onClick={() => setShowCal(c => !c)} className="p-1 rounded hover:bg-muted">
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </button>
          {showCal && (
            <div className="absolute right-0 top-7 z-50 bg-popover border rounded-lg shadow-lg p-2">
              <input type="date" value={filterDate} max={now.toISOString().slice(0,10)}
                onChange={(e) => { setFilterDate(e.target.value); setShowCal(false); }}
                className="text-sm border rounded px-2 py-1" />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={`Transaksi ${filterDate === now.toISOString().slice(0,10) ? "Hari Ini" : filterDate}`} value={stats.today.toString()} icon={ShoppingCart} accent />
        <StatCard label={`Nilai ${filterDate === now.toISOString().slice(0,10) ? "Hari Ini" : filterDate}`} value={formatRupiah(stats.todayValue)} icon={TrendingUp} accent />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periode Bulanan</p>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold min-w-[80px] text-center">{monthNames[selectedMonth]} {selectedYear}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1 rounded hover:bg-muted disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Transaksi" value={stats.total.toString()} icon={ShoppingCart} />
        <StatCard label="Nilai Total" value={formatRupiah(stats.totalValue)} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 gap-3">

      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent = false }: { label: string; value: string; icon: any; accent?: boolean }) {
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
