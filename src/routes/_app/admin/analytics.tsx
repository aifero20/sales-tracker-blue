import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { formatRupiah } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_app/admin/analytics")({
  component: Analytics,
});

const COLORS = ["#1f6feb", "#3b82f6", "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#a855f7"];

function Analytics() {
  const [items, setItems] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: i }, { data: t }] = await Promise.all([
        supabase.from("transaction_items").select("product_name, quantity, subtotal, transaction_id"),
        supabase.from("sales_transactions").select("id, transaction_date, total_amount, sales_code"),
      ]);
      setItems(i ?? []);
      setTx(t ?? []);
      setLoading(false);
    })();
  }, []);

  const bySales = useMemo(() => {
    const m = new Map<string, number>();
    tx.forEach((r) => m.set(r.sales_code || "—", (m.get(r.sales_code || "—") ?? 0) + (r.total_amount || 0)));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [tx]);

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    tx.forEach((r) => m.set(r.transaction_date, (m.get(r.transaction_date) ?? 0) + (r.total_amount || 0)));
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date: date.slice(5), total }));
  }, [tx]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { qty: number; value: number }>();
    items.forEach((it) => {
      const cur = m.get(it.product_name) ?? { qty: 0, value: 0 };
      m.set(it.product_name, { qty: cur.qty + (it.quantity || 0), value: cur.value + (it.subtotal || 0) });
    });
    return Array.from(m.entries()).map(([name, v]) => ({ name, qty: v.qty, value: v.value })).sort((a, b) => b.value - a.value);
  }, [items]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Analitik Penjualan</h1>
        <p className="text-sm text-muted-foreground">Visualisasi data penjualan seluruh sales</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Penjualan per Tanggal</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDate}>
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatRupiah(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="#1f6feb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Penjualan per Sales</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySales}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatRupiah(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="#1f6feb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Distribusi Produk Terjual (Pcs)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byProduct} dataKey="qty" nameKey="name" outerRadius={90} label={(e: any) => `${e.name} (${e.qty})`}>
                  {byProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Top Produk (Nilai Penjualan)</CardTitle></CardHeader>
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
  );
}
