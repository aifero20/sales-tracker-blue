import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { formatRupiah } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_app/admin/analytics")({
  component: Analytics,
});

const COLORS = ["#1f6feb","#3b82f6","#06b6d4","#8b5cf6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#a855f7"];

function Analytics() {
  const [items, setItems] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [showFilter, setShowFilter] = useState(false);

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

  const filteredTx = useMemo(() =>
    tx.filter((r) => r.transaction_date >= fromDate && r.transaction_date <= toDate),
    [tx, fromDate, toDate]);

  const filteredItems = useMemo(() => {
    const ids = new Set(filteredTx.map((r) => r.id));
    return items.filter((it) => ids.has(it.transaction_id));
  }, [items, filteredTx]);

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
    filteredTx.forEach((r) => {
      if (!m.has(r.sales_code || "—")) m.set(r.sales_code || "—", {});
    });
    filteredItems.forEach((it) => {
      const txRow = filteredTx.find((r) => r.id === it.transaction_id);
      if (!txRow) return;
      const key = txRow.sales_code || "—";
      const entry = m.get(key) ?? {};
      entry[it.product_name] = (entry[it.product_name] ?? 0) + (it.subtotal || 0);
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

  const totalPenjualan = useMemo(() => filteredTx.reduce((s, r) => s + (r.total_amount || 0), 0), [filteredTx]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Analitik Penjualan</h1>
          <p className="text-sm text-muted-foreground">
            {filteredTx.length} transaksi · {formatRupiah(totalPenjualan)}
          </p>
        </div>
        <Button size="sm" variant={showFilter ? "default" : "outline"} className="shrink-0 mt-1"
          onClick={() => setShowFilter(v => !v)}>
          <Search className="h-4 w-4 mr-1" /> Filter
        </Button>
      </div>

      {showFilter && (
        <Card className="shadow-soft">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Dari</span>
                <Input type="date" value={fromDate} max={toDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="h-8 text-sm w-36" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Sampai</span>
                <Input type="date" value={toDate} min={fromDate}
                  onChange={e => setToDate(e.target.value)}
                  className="h-8 text-sm w-36" />
              </div>
              {(fromDate !== today || toDate !== today) && (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive"
                  onClick={() => { setFromDate(today); setToDate(today); }}>
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Penjualan per Tanggal</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDate}>
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
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
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySales}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any, name: string) => [formatRupiah(v), name]}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {allProducts.map((prod) => (
                  <Bar key={prod} dataKey={prod} stackId="a" fill={productColorMap[prod] ?? "#888"}
                    radius={allProducts.indexOf(prod) === allProducts.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
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
