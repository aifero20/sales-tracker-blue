import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Package, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { formatRupiah, formatDateID } from "@/lib/constants";

export const Route = createFileRoute("/_app/sales/history")({
  component: HistoryPage,
});

interface Tx {
  id: string;
  transaction_date: string;
  transaction_time: string;
  sequence_number: number;
  total_amount: number;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  stores: { name: string; address: string } | null;
  transaction_items: { product_name: string; quantity: number; subtotal: number; unit_price: number }[];
}

function HistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [storeName, setStoreName] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("sales_transactions")
        .select("id, transaction_date, transaction_time, sequence_number, total_amount, notes, latitude, longitude, photo_url, stores(name, address), transaction_items(product_name, quantity, subtotal, unit_price)")
        .eq("sales_user_id", user.id)
        .gte("transaction_date", dateFrom)
        .lte("transaction_date", dateTo)
        .order("transaction_date", { ascending: false })
        .order("transaction_time", { ascending: false });
      const { data, error } = await q;
      let result = (data as any) ?? [];
      if (storeName.trim()) {
        result = result.filter((r: Tx) =>
          r.stores?.name?.toLowerCase().includes(storeName.trim().toLowerCase())
        );
      }
      if (!error) setRows(result);
      setLoading(false);
    })();
  }, [user, dateFrom, dateTo, storeName]);

  const isDefaultFilter = dateFrom === today && dateTo === today && storeName === "";
  const resetFilter = () => { setDateFrom(today); setDateTo(today); setStoreName(""); };

  const totalAll = rows.reduce((s, r) => s + r.total_amount, 0);
  const labelPeriode = dateFrom === dateTo
    ? formatDateID(dateFrom)
    : `${formatDateID(dateFrom)} – ${formatDateID(dateTo)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Penjualan</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} transaksi · {formatRupiah(totalAll)} · {labelPeriode}
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
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Nama Toko</p>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)}
                placeholder="Cari nama toko..." />
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
          <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Tidak ada transaksi pada periode ini
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const isOpen = open === r.id;
            return (
              <Card key={r.id} className="shadow-soft overflow-hidden">
                <button className="w-full p-4 text-left" onClick={() => setOpen(isOpen ? null : r.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{r.sequence_number}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateID(r.transaction_date)} · {r.transaction_time.slice(0,5)}</span>
                      </div>
                      <p className="mt-1 font-semibold truncate">{r.stores?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.stores?.address ?? ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatRupiah(r.total_amount)}</p>
                      {isOpen ? <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t pt-3 space-y-3 bg-muted/20">
                    {r.photo_url && (
                      <a href={r.photo_url} target="_blank" rel="noreferrer" className="block">
                        <img src={r.photo_url} alt="Foto toko" className="w-full h-40 object-cover rounded-md border" />
                      </a>
                    )}
                    {r.latitude && r.longitude && (
                      <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer"
                        className="text-xs text-primary inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
                      </a>
                    )}
                    <div className="space-y-1">
                      {r.transaction_items.map((it, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{it.product_name} × {it.quantity}</span>
                          <span className="tabular-nums">{formatRupiah(it.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                    {r.notes && <div className="text-xs text-muted-foreground bg-card p-2 rounded border">{r.notes}</div>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
