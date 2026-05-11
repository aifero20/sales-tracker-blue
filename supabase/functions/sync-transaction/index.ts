// Edge function: upload photo to Google Drive + append rows to Google Sheets
// Uses Lovable connector gateway (no token refresh needed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GW = "https://connector-gateway.lovable.dev";

async function uploadToDrive(base64: string, mime: string, filename: string, folderId: string | null): Promise<string | null> {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE || !DRIVE_KEY) {
    console.warn("Drive secrets missing, skipping upload");
    return null;
  }
  const metadata: Record<string, unknown> = { name: filename, mimeType: mime };
  if (folderId) metadata.parents = [folderId];

  const boundary = "lov" + Math.random().toString(36).slice(2);
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bin.length + tail.length);
  body.set(head, 0);
  body.set(bin, head.length);
  body.set(tail, head.length + bin.length);

  const res = await fetch(`${GW}/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": DRIVE_KEY,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    console.error("Drive upload failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const fileId = data.id;
  // Make readable via link (best-effort; ignore failures)
  await fetch(`${GW}/google_drive/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": DRIVE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  }).catch(() => {});
  return `https://drive.google.com/uc?id=${fileId}`;
}

async function appendSheet(spreadsheetId: string, range: string, values: any[][]): Promise<void> {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const SHEETS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!LOVABLE || !SHEETS_KEY) throw new Error("Sheets secrets missing");

  const url = `${GW}/google_sheets/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": SHEETS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets append failed [${res.status}]: ${t}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load settings
    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    const folderId = settings?.google_drive_folder_id ?? null;
    const sheetId = settings?.google_spreadsheet_id ?? null;

    let photoUrl: string | null = null;
    if (body.photo) {
      try {
        photoUrl = await uploadToDrive(body.photo.base64, body.photo.mime || "image/jpeg", body.photo.filename || `photo-${Date.now()}.jpg`, folderId);
      } catch (e) {
        console.error("upload err:", e);
      }
    }

    if (body.appendSheet && body.transaction && sheetId) {
      const t = body.transaction;
      const mapsLink = t.latitude && t.longitude ? `https://maps.google.com/?q=${t.latitude},${t.longitude}` : "";
      const productsSummary = (t.items || []).map((i: any) => `${i.product}×${i.qty}`).join(", ");

      try {
        await appendSheet(sheetId, "Transaksi!A:N", [[
          t.id, t.date, t.time, t.sequence, t.sales_code, t.sales_name,
          t.store_name, t.store_address, t.latitude ?? "", t.longitude ?? "",
          mapsLink, t.photo_url ?? "", t.total, productsSummary, t.notes,
        ]]);
        const itemRows = (t.items || []).map((i: any) => [t.id, t.date, t.sales_code, t.store_name, i.product, i.qty, i.price, i.subtotal]);
        if (itemRows.length) await appendSheet(sheetId, "Items!A:H", itemRows);
      } catch (e) {
        console.error("sheet err:", e);
        return new Response(JSON.stringify({ photoUrl, sheetError: String(e) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ photoUrl, ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
