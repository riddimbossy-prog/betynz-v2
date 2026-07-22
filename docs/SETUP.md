# Betynz Fresh Start setup

## 1. Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

- Website: `http://localhost:5173`
- API health: `http://localhost:8787/api/v1/health`

The API automatically uses bundled demo data until Supabase variables are configured.

## 2. Create the database

1. Open Supabase SQL Editor.
2. Run `supabase/migrations/001_schema.sql`.
3. Copy `.env.example` to `.env`.
4. Add `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
5. Never put the service-role key in the frontend or GitHub source.

## 3. Import the two uploaded EPL seasons

```bash
npm run import:local -- --file="/path/to/E0 (1).csv" --season=2024-25 --leagueName="English Premier League"
npm run import:local -- --file="/path/to/E0.csv" --season=2025-26 --leagueName="English Premier League"
```

## 4. Connect the website

Set this in `apps/web/.env.production`:

```env
VITE_API_BASE_URL=https://api.betynz.com
```

## 5. Deploy

- Deploy `apps/api` to Render using `deploy/render.yaml`.
- Deploy `apps/web` to Cloudflare Pages, Vercel or Netlify.
- Point `api.betynz.com` to the Render service.
- Point `betynz.com` and `www.betynz.com` to the frontend.
- Add GitHub secrets used by `.github/workflows/import-football-data.yml`.

## 6. Important source rule

Use the direct CSV URLs published by Football-Data rather than scraping the visible HTML page. Keep the API private and review the source's current terms before republishing or reselling its full dataset.
