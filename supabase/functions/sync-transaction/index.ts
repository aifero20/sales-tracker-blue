import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_STORAGE_BYTES = 900 * 1024 * 1024;

async function getGoogleToken(sa: any, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: sa.client_email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const sigInput = `${enc(header)}.${enc(payload)}`;
  const pemKey = sa.private_key.replace(/\\n/g, "\n");
  const keyData = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", binaryKey.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(sigInput));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${sigInput}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get token: " + JSON.stringify(data));
  return data.access_token;
}

async function appendSheet(token: string, spreadsheetId: string, range: string, values: any[][]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Sheets error [${res.status}]: ${await res.text()}`);
}

async function cycleStorageIfNeeded(supabase: any): Promise<void> {
  const { data: files, error } = await supabase.storage
    .from("store-photos")
    .list("", { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
  if (error || !files || files.length === 0) return;
  const totalBytes = files.reduce((sum: number, f: any) => sum + (f.metadata?.size ?? 0), 0);
  console.log(`Storage used: ${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
  if (totalBytes < MAX_STORAGE_BYTES) return;
  let remaining = totalBytes;
  for (const file of files) {
    if (remaining < MAX_STORAGE_BYTES) break;
    const { error: delErr } = await supabase.storage.from("store-photos").remove([file.name]);
    if (!delErr) {
      remaining -= (file.metadata?.size ?? 0);
      console.log(`Deleted old photo: ${file.name}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT secret missing");
    const sa = JSON.parse(saJson);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    const sheetId = settings?.google_spreadsheet_id ?? null;

    let photoUrl: string | null = null;
    if (body.photo?.base64) {
      await cycleStorageIfNeeded(supabase);
      const bin = Uint8Array.from(atob(body.photo.base64), c => c.charCodeAt(0));
      const filename = body.photo.filename || `photo-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("store-photos")
        .upload(filename, bin, { contentType: "image/jpeg", upsert: true });
      if (upErr) {
        console.error("Storage upload error:", upErr);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("store-photos").getPublicUrl(filename);
        photoUrl = publicUrl;
      }
    }

    if (body.appendSheet && body.transaction && sheetId) {
      const token = await getGoogleToken(sa, ["https://www.googleapis.com/auth/spreadsheets"]);
      const t = body.transaction;
      const mapsLink = t.latitude && t.longitude ? `https://maps.google.com/?q=${t.latitude},${t.longitude}` : "";
      const productsSummary = (t.items || []).map((i: any) => `${i.product}×${i.qty}`).join(", ");
      await appendSheet(token, sheetId, "Transaksi!A:O", [[
        t.id, t.date, t.time, t.sequence, t.sales_code, t.sales_name,
        t.store_name, t.store_address, t.latitude ?? "", t.longitude ?? "",
        mapsLink, t.photo_url ?? photoUrl ?? "", t.total, productsSummary, t.notes,
      ]]);
      const itemRows = (t.items || []).map((i: any) => [t.id, t.date, t.sales_code, t.store_name, i.product, i.qty, i.price, i.subtotal]);
      if (itemRows.length) await appendSheet(token, sheetId, "Items!A:H", itemRows);
    }

    return new Response(JSON.stringify({ photoUrl, ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
