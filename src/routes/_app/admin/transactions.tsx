import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { formatRupiah, formatDateID } from "@/lib/constants";

export const Route = createFileRoute("/_app/admin/transactions")({
  component: AdminTx,
});

function AdminTx() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [storeName, setStoreName] = useState("");
  const [salesCode, setSalesCode] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales_transactions")
        .select("id, transaction_date, transaction_time, sequence_number, total_amount, sales_code, latitude, longitude, photo_url, notes, stores(name, address), transaction_items(product_name, quantity, subtotal)")
        .gte("transaction_date", dateFrom)
        .lte("transaction_date", dateTo)
        .order("transaction_date", { ascending: false })
        .order("transaction_time", { ascending: false })
        .limit(500);
      let result = (data as any[]) ?? [];
      if (storeName.trim()) {
        result = result.filter((r) =>
          (r.stores?.name || "").toLowerCase().includes(storeName.trim().toLowerCase())
        );
      }
      if (salesCode.trim()) {
        result = result.filter((r) =>
          (r.sales_code || "").toLowerCase().includes(salesCode.trim().toLowerCase())
        );
      }
      setRows(result);
      setLoading(false);
    })();
  }, [dateFrom, dateTo, storeName, salesCode]);

  const isDefaultFilter = dateFrom === today && dateTo === today && storeName === "" && salesCode === "";
  const resetFilter = () => { setDateFrom(today); setDateTo(today); setStoreName(""); setSalesCode(""); };

  const total = rows.reduce((s, r) => s + (r.total_amount || 0), 0);
  const labelPeriode = dateFrom === dateTo
    ? formatDateID(dateFrom)
    : `${formatDateID(dateFrom)} – ${formatDateID(dateTo)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Semua Transaksi</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} transaksi · {formatRupiah(total)} · {labelPeriode}
            {salesCode && ` · Sales: ${salesCode}`}
            {storeName && ` · "${storeName}"`}
          </p>
        </div>
        <Button size="sm" variant={showFilter ? "default" : "outline"} className="shrink-0 mt-1"
          onClick={() => setShowFilter(v => !v)}>
          <Search className="h-4 w-4 mr-1" /> Filter
        </Button>
      </div>

      {showFilter && (
        <Card className="shadow-soft">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Kode Sales</p>
                <Input value={salesCode} onChange={e => setSalesCode(e.target.value)}
                  placeholder="Cth: BP01" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Nama Toko</p>
                <Input value={storeName} onChange={e => setStoreName(e.target.value)}
                  placeholder="Cari nama toko..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Dari Tanggal</p>
                <Input type="date" value={dateFrom} max={dateTo}
                  onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Sampai Tanggal</p>
                <Input type="date" value={dateTo} min={dateFrom} max={today}
                  onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            {!isDefaultFilter && (
              <Button size="sm" variant="ghost" className="text-destructive w-full" onClick={resetFilter}>
                <X className="h-4 w-4 mr-1" /> Reset ke Hari Ini
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="shadow-soft"><CardContent className="p-8 text-center text-muted-foreground">
          Tidak ada transaksi pada periode ini
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary text-primary-foreground">{r.sales_code || "—"}</Badge>
                      <Badge variant="outline">#{r.sequence_number}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateID(r.transaction_date)} · {(r.transaction_time||"").slice(0,5)}</span>
                    </div>
                    <p className="mt-2 font-semibold">{r.stores?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.stores?.address ?? ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.transaction_items?.map((it: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[11px]">{it.product_name}×{it.quantity}</Badge>
                      ))}
                    </div>
                    {r.latitude && r.longitude && (
                      <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                        <MapPin className="h-3 w-3" /> Lihat lokasi
                      </a>
                    )}
                    {r.notes && <p className="mt-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded">{r.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary whitespace-nowrap">{formatRupiah(r.total_amount)}</p>
                    {r.photo_url && (
                      <a href={r.photo_url} target="_blank" rel="noreferrer" className="block mt-2">
                        <img src={r.photo_url} alt="" className="w-20 h-20 object-cover rounded border" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
