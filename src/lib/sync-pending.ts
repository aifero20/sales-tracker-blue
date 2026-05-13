import { supabase } from "@/integrations/supabase/client";
import { getPendingTransactions, deletePendingTransaction } from "./offline-queue";

export async function syncPendingTransactions(): Promise<{ success: number; failed: number }> {
  const pending = await getPendingTransactions();
  let success = 0;
  let failed = 0;

  for (const record of pending) {
    try {
      const { localId, savedAt, ...data } = record;

      // 1. Find or create store
      let storeId: string;
      const { data: existingStores } = await supabase
        .from("stores").select("id, name").ilike("name", data.storeName.trim());
      const existing = existingStores?.find(
        (s: any) => s.name.toLowerCase() === data.storeName.trim().toLowerCase()
      );
      if (existing) {
        storeId = existing.id;
      } else {
        const { data: ns, error: se } = await supabase.from("stores").insert({
          name: data.storeName.trim(),
          address: data.storeAddress.trim(),
          created_by: data.userId,
        }).select("id").single();
        if (se) throw se;
        storeId = ns.id;
      }

      // 2. Sequence number
      const { count } = await supabase
        .from("sales_transactions")
        .select("id", { count: "exact", head: true })
        .eq("sales_user_id", data.userId)
        .eq("transaction_date", data.dateStr);
      const sequence = (count ?? 0) + 1;

      // 3. Upload photo
      let photoUrl = null;
      if (data.photoBase64) {
        const syncRes = await supabase.functions.invoke("sync-transaction", {
          body: {
            photo: { base64: data.photoBase64, mime: data.photoMime,
              filename: `${data.salesCode || "BP"}-${data.dateStr}-${sequence}.jpg` },
          },
        });
        photoUrl = (syncRes.data as any)?.photoUrl ?? null;
      }

      // 4. Insert transaction
      const { data: tx, error: te } = await supabase.from("sales_transactions").insert({
        sales_user_id: data.userId,
        sales_code: data.salesCode ?? null,
        store_id: storeId,
        transaction_date: data.dateStr,
        transaction_time: data.timeStr,
        sequence_number: sequence,
        latitude: data.lat ?? null,
        longitude: data.lng ?? null,
        photo_url: photoUrl,
        total_amount: data.grandTotal,
        notes: data.stockNotesValue,
      }).select("id").single();
      if (te) throw te;

      // 5. Insert items
      const itemRows = data.items.map((it: any) => ({
        transaction_id: tx.id,
        product_id: it.id,
        product_name: it.name,
        quantity: it.quantity,
        unit_price: it.price_per_pcs,
        subtotal: it.subtotal,
      }));
      const { error: ie } = await supabase.from("transaction_items").insert(itemRows);
      if (ie) throw ie;

      // 6. Sync GSheet (background)
      supabase.functions.invoke("sync-transaction", {
        body: {
          appendSheet: true,
          transaction: {
            id: tx.id, date: data.dateStr, time: data.timeStr, sequence,
            sales_code: data.salesCode ?? "", sales_name: data.salesName ?? "",
            store_name: data.storeName.trim(), store_address: data.storeAddress.trim(),
            latitude: data.lat ?? null, longitude: data.lng ?? null,
            photo_url: photoUrl, total: data.grandTotal, notes: data.stockNotesValue,
            items: itemRows.map((r: any) => ({ product: r.product_name, qty: r.quantity, price: r.unit_price, subtotal: r.subtotal })),
          },
        },
      }).catch((e: any) => console.warn("Sheet sync failed:", e));

      await deletePendingTransaction(localId);
      success++;
    } catch (err) {
      console.error("Sync failed for", record.localId, err);
      failed++;
    }
  }

  return { success, failed };
}
