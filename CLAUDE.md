# Panduan untuk Claude

## Stack
- React + TypeScript + TanStack Start
- Supabase (database + auth)
- Cloudflare Workers (hosting)

## Deploy
Selalu gunakan:
npm run build && npx wrangler deploy

Rebuild dari nol:
rm -rf dist .wrangler && npm run build && npx wrangler deploy

JANGAN hapus dist tanpa langsung rebuild — build akan gagal.

## Database
- Perubahan skema → buat file di supabase/migrations/ → npx supabase db push
- Migration repair: npx supabase migration repair --status applied <timestamp>

## Penting
- wrangler.jsonc harus pakai "main": "src/server.ts" bukan dist/server/index.js
- Jangan tambah assets di wrangler.jsonc — sudah dihandle @cloudflare/vite-plugin
