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
    filteredTx.forEach((r) => {
      if (!m.has(r.sales_code || "—")) m.set(r.sales_code || "—", {});
    });
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

  const totalPenjualan = useMemo(() => filteredTx.reduce((s, r) => s + (r.total_amount || 0), 0), [filteredTx]);

  // Daftar semua produk dari cigarette_products (statis sesuai GSheet)
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
          if (prodList.includes(produk.toLowerCase())) {
            tokoAda.push(storeName);
          } else {
            tokoTidakAda.push(storeName);
          }
        }
      });
      return { produk, ada: tokoAda.length, tokoAda, tokoTidakAda };
    });
  }, [filteredTx]);

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
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Sales</span>
                <select value={salesCode} onChange={e => setSalesCode(e.target.value)}
                  className="h-8 text-sm border rounded px-2 bg-background text-foreground">
                  <option value="">Semua</option>
                  {allSalesCodes.map(c => <option key={c} value={c === "—" ? "" : c}>{c}</option>)}
                </select>
              </div>
              {(fromDate !== today || toDate !== today || salesCode !== "") && (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive"
                  onClick={() => { setFromDate(today); setToDate(today); setSalesCode(""); }}>
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
              <BarChart data={bySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}`} />
                <Tooltip
                  formatter={(v: any, name: string) => [`${v} pcs`, name]}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "hsl(var(--foreground))" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>{value}</span>} />
                {allProducts.map((prod) => (
                  <Bar key={prod} dataKey={prod} stackId="a" fill={productColorMap[prod] ?? "#888"}
                    radius={allProducts.indexOf(prod) === allProducts.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                  </Bar>
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
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Distribusi Stok Rokok per Toko</CardTitle>
          <p className="text-xs text-muted-foreground">Berdasarkan stok yang dilaporkan sales saat kunjungan</p>
        </CardHeader>
        <CardContent>
          {filteredTx.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data untuk filter ini</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium text-xs text-muted-foreground w-6">No</th>
                    <th className="text-left py-2 pr-3 font-medium text-xs text-muted-foreground">Nama Rokok</th>
                    <th className="text-center py-2 pr-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Jml Toko<br/>(Stok Tersedia)</th>
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
  );
}
