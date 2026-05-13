import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString();

  const { error: itemsError, count: itemsCount } = await supabase
    .from("transaction_items")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  const { error: txError, count: txCount } = await supabase
    .from("sales_transactions")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (itemsError || txError) {
    return Response.json({ error: itemsError || txError }, { status: 500 });
  }

  console.log(`Cleanup selesai: ${txCount} transaksi, ${itemsCount} items dihapus`);
  return Response.json({
    success: true,
    deleted_transactions: txCount,
    deleted_items: itemsCount,
    cutoff_date: cutoff,
  });
});
