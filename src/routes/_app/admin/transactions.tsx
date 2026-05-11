import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { formatRupiah, formatDateID } from "@/lib/constants";

export const Route = createFileRoute("/_app/admin/transactions")({
  component: AdminTx,
});

function AdminTx() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sales_transactions")
        .select("id, transaction_date, transaction_time, sequence_number, total_amount, sales_code, latitude, longitude, photo_url, notes, profiles!sales_transactions_sales_user_id_fkey(full_name), stores(name, address), transaction_items(product_name, quantity, subtotal)")
        .order("transaction_date", { ascending: false })
        .order("transaction_time", { ascending: false })
        .limit(500);
      // profiles join may not exist via fk shortcut; fallback fetch
      let final = (data as any) ?? [];
      if (!data) {
        const { data: simple } = await supabase
          .from("sales_transactions")
          .select("id, transaction_date, transaction_time, sequence_number, total_amount, sales_code, sales_user_id, latitude, longitude, photo_url, notes, stores(name, address), transaction_items(product_name, quantity, subtotal)")
          .order("transaction_date", { ascending: false })
          .limit(500);
        final = simple ?? [];
      }
      setRows(final);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      (r.sales_code || "").toLowerCase().includes(f) ||
      (r.stores?.name || "").toLowerCase().includes(f) ||
      (r.transaction_date || "").includes(f)
    );
  });
  const total = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Semua Transaksi</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} baris · {formatRupiah(total)}</p>
      </div>
      <Input placeholder="Filter: kode sales, nama toko, atau tanggal (YYYY-MM-DD)…" value={filter} onChange={(e) => setFilter(e.target.value)} />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
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
