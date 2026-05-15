# Lead Manager

React + Vite app: unified leads CRM with Excel import, multi-field filters, Supabase cloud sync, and n8n workflow generation for email outreach.

## Features

- **Unified leads database** — every lead has email, name, designation, company, location, LinkedIn URL, phone, hiring role, categories, status, notes, source, and timestamps
- **Excel import** with auto-column-mapping (drop your existing spreadsheet, review the mapping, confirm)
- **LinkedIn JSON import** — recruiter, role, and categories auto-extracted from post text
- **Cloud sync** via Supabase (optional but recommended) — your leads follow you across browsers/devices
- **Smart filters** — search + designation + company + location + category + status + source
- **Excel export** of filtered or all leads, anytime, always reflecting current state
- **n8n workflow generation** — pick leads (selected / by-status / all), get importable n8n JSON
- Editable profile (used to build email body)
- Beautiful UI: gradient hero, animated bar charts, slide-in lead drawer

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without `.env`, the app runs in **local-only mode** (localStorage).

## Cloud sync setup (Supabase — free)

1. Sign up at https://supabase.com (free, no credit card).
2. **New project** — pick any name and region close to you. Wait ~1 minute for provisioning.
3. Open **SQL Editor** → **New query** → paste the contents of [`supabase-schema.sql`](supabase-schema.sql) → **Run**. This creates the `leads` table.
4. Go to **Project Settings → API**. Copy:
   - Project URL (e.g. `https://xxxxx.supabase.co`)
   - `anon` `public` key (long JWT-looking string)
5. Create `.env` in the project root (copy from [`.env.example`](.env.example)):
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
6. Restart `npm run dev`. The header should show **Synced just now** with a green dot. Any local leads you already have will upload automatically on first sync.

### On Vercel

Add the same two env vars under **Project → Settings → Environment Variables**, then redeploy.

### Free tier limits

Supabase's free tier gives you 500 MB database, 50k monthly active users, 5 GB egress. Plenty for a personal CRM. **Note:** projects auto-pause after 1 week of inactivity — open the Supabase dashboard and click **Resume** if that happens. Your data is preserved.

### Security note

The schema disables Row Level Security so the anon key can read/write directly from the browser. The anon key is baked into the Vercel bundle, so anyone with your app URL can read/write your leads. For a personal tool with an unguessable Vercel URL, this is usually fine. To lock it down later: enable RLS, add Supabase Auth, and create per-user policies — happy to wire that up.

## Build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push to GitHub.
2. https://vercel.com/new → import repo → **Deploy**.
3. (Optional) Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars → redeploy.

## How to use

1. **Import tab** — drop your Excel file or LinkedIn JSON. Excel: review column mapping, click **Import all sheets**. JSON: imports immediately.
2. **Leads tab** — search, filter, edit any lead inline (click **Edit**), select rows for bulk actions, **Download** Excel anytime.
3. **Generate tab** — choose Selected / By status / All → **Generate workflow** → download n8n JSON.
4. In n8n: import the JSON → connect Gmail SMTP credential → Execute.

## Storage

- **Local cache**: `localStorage` keys `job_mailer_leads_v3` (leads) and `job_mailer_profile_v1` (profile).
- **Cloud**: Supabase `leads` table (when configured). Optimistic local writes + 800ms debounced cloud diff-push.
- **Migration**: older `job_mailer_history_v2` and `job_mailer_sent_emails` formats are migrated transparently on first load.

## Project structure

```
src/
  App.jsx               UI shell + tabs + sync orchestration
  index.css             Styles + animations
  lib/
    parsers.js          Category detection, role extraction, name cleanup
    leads.js            Lead model, merge/dedup, status enum
    workflow.js         n8n workflow JSON builder
    excelImport.js      Excel → lead with auto-column-mapping
    excel.js            Lead → Excel exporter (multi-sheet)
    storage.js          localStorage cache layer
    supabase.js         Supabase client (no-op when env vars missing)
    cloudSync.js        Fetch / upsert / delete + diff calculator
supabase-schema.sql     One-shot SQL to create the leads table
```
