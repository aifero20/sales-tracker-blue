import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const [sheetId, setSheetId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").eq("id", 1).single();
      if (data) {
        setSheetId(data.google_spreadsheet_id ?? "");
        setFolderId(data.google_drive_folder_id ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({
      google_spreadsheet_id: sheetId.trim() || null,
      google_drive_folder_id: folderId.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pengaturan disimpan");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan Integrasi</h1>
        <p className="text-sm text-muted-foreground">Hubungkan ke Google Spreadsheet & Drive Anda</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Google Spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Spreadsheet ID</Label>
            <Input value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="contoh: 1AbCdEfGhIjKlMnOpQrStUvWxYz..." />
            <p className="text-xs text-muted-foreground mt-1">
              Dari URL: <code>docs.google.com/spreadsheets/d/<b>SPREADSHEET_ID</b>/edit</code>
            </p>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-3 rounded">
            <p className="font-semibold text-foreground">Cara setup:</p>
            <p>1. Buat spreadsheet baru di Google Sheets</p>
            <p>2. Buat 2 tab/sheet bernama: <code className="text-foreground">Transaksi</code> dan <code className="text-foreground">Items</code></p>
            <p>3. Bagikan ke akun Google yang Anda hubungkan ke Lovable (akses Editor)</p>
            <p>4. Salin ID dari URL ke kolom di atas</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Google Drive (Foto Toko)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Folder ID (opsional)</Label>
            <Input value={folderId} onChange={(e) => setFolderId(e.target.value)} placeholder="kosongkan untuk root Drive" />
            <p className="text-xs text-muted-foreground mt-1">
              Dari URL folder: <code>drive.google.com/drive/folders/<b>FOLDER_ID</b></code>
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="bg-gradient-primary">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Pengaturan"}
      </Button>
    </div>
  );
}
