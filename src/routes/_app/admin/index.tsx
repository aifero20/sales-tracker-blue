import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Users, Package } from "lucide-react";
import { formatRupiah } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [s, setS] = useState({ tx: 0, value: 0, sales: 0, products: 0, today: 0, todayValue: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: tx }, { count: salesCount }, { count: prodCount }] = await Promise.all([
        supabase.from("sales_transactions").select("total_amount, transaction_date"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "sales"),
        supabase.from("cigarette_products").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      const all = tx ?? [];
      const todayRows = all.filter((r) => r.transaction_date === today);
      setS({
        tx: all.length,
        value: all.reduce((a, b) => a + (b.total_amount || 0), 0),
        sales: salesCount ?? 0,
        products: prodCount ?? 0,
        today: todayRows.length,
        todayValue: todayRows.reduce((a, b) => a + (b.total_amount || 0), 0),
      });
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <p className="text-sm text-muted-foreground">Ringkasan seluruh aktivitas penjualan</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Transaksi Hari Ini" value={s.today.toString()} icon={ShoppingCart} accent />
        <Stat label="Nilai Hari Ini" value={formatRupiah(s.todayValue)} icon={TrendingUp} accent />
        <Stat label="Total Sales" value={s.sales.toString()} icon={Users} />
        <Stat label="Total Transaksi" value={s.tx.toString()} icon={ShoppingCart} />
        <Stat label="Total Nilai" value={formatRupiah(s.value)} icon={TrendingUp} />
        <Stat label="Produk Aktif" value={s.products.toString()} icon={Package} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/admin/transactions"><Button variant="outline" className="w-full h-12">Semua Transaksi</Button></Link>
        <Link to="/admin/analytics"><Button variant="outline" className="w-full h-12">Analitik</Button></Link>
        <Link to="/admin/products"><Button variant="outline" className="w-full h-12">Kelola Produk</Button></Link>
        <Link to="/admin/sales"><Button variant="outline" className="w-full h-12">Kelola Sales</Button></Link>
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
