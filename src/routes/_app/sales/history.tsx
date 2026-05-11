import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Package, ChevronDown, ChevronRight } from "lucide-react";
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("sales_transactions")
        .select("id, transaction_date, transaction_time, sequence_number, total_amount, notes, latitude, longitude, photo_url, stores(name, address), transaction_items(product_name, quantity, subtotal, unit_price)")
        .eq("sales_user_id", user.id)
        .order("transaction_date", { ascending: false })
        .order("transaction_time", { ascending: false });
      if (!error) setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const totalAll = rows.reduce((s, r) => s + r.total_amount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Riwayat Penjualan</h1>
        <p className="text-sm text-muted-foreground">Total {rows.length} transaksi · {formatRupiah(totalAll)}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="shadow-soft"><CardContent className="p-8 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Belum ada transaksi
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
