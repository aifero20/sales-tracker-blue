import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, History, TrendingUp, ShoppingCart } from "lucide-react";
import { formatRupiah } from "@/lib/constants";

export const Route = createFileRoute("/_app/sales/")({
  component: SalesHome,
});

function SalesHome() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ today: 0, todayValue: 0, total: 0, totalValue: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: t } = await supabase.from("sales_transactions").select("total_amount, transaction_date").eq("sales_user_id", user.id);
      if (!t) return;
      const todayRows = t.filter((r) => r.transaction_date === today);
      setStats({
        today: todayRows.length,
        todayValue: todayRows.reduce((s, r) => s + (r.total_amount || 0), 0),
        total: t.length,
        totalValue: t.reduce((s, r) => s + (r.total_amount || 0), 0),
      });
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Halo,</p>
        <h1 className="text-2xl font-bold">{profile?.full_name || "Sales"}</h1>
        <p className="text-sm text-muted-foreground">Kode Sales: <span className="font-medium text-foreground">{profile?.sales_code ?? "—"}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Transaksi Hari Ini" value={stats.today.toString()} icon={ShoppingCart} accent />
        <StatCard label="Nilai Hari Ini" value={formatRupiah(stats.todayValue)} icon={TrendingUp} accent />
        <StatCard label="Total Transaksi" value={stats.total.toString()} icon={ShoppingCart} />
        <StatCard label="Nilai Total" value={formatRupiah(stats.totalValue)} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/sales/input"><Button className="w-full h-14 bg-gradient-primary hover:opacity-90"><PlusCircle className="h-5 w-5 mr-2" /> Input Penjualan</Button></Link>
        <Link to="/sales/history"><Button variant="outline" className="w-full h-14"><History className="h-5 w-5 mr-2" /> Lihat Riwayat</Button></Link>
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
