# Job Mailer Builder

React + Vite app that converts LinkedIn email JSON exports into ready-to-import n8n workflow files.

## Features

- Drop multiple LinkedIn JSON files at once
- Automatic deduplication via `localStorage` (persists across sessions)
- Auto-batching into 400-email files
- Category detection (finance, hr, analyst, operations, marketing, sales, content, management)
- Role-specific email subjects and HTML bodies
- Editable profile (name, email, LinkedIn, resume link, etc.)

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

The production bundle is emitted to `dist/`.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.
3. Vercel auto-detects Vite — leave defaults and click **Deploy**.

`vercel.json` is already configured (build → `dist`, SPA rewrite to `index.html`).

### Or via Vercel CLI

```bash
npm install -g vercel
vercel
```

## How to use

1. Click **Profile** — verify pre-filled details (name, email, LinkedIn, resume link).
2. Drop LinkedIn email JSON files into the dropzone.
3. Review stats (total / new / duplicates / category breakdown).
4. Click **Generate workflow** — downloads importable n8n JSON file(s).
5. In n8n: import the JSON, connect a Gmail SMTP credential, click Execute.

## Storage

Dedup history is stored in `localStorage` under the key `job_mailer_sent_emails`. Use **Clear history** to reset.
