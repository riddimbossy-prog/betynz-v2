# Betynz Multi-League Chronos Fusion v2.2 setup

Use `UPGRADE_TO_V2_2.md` for the existing live Betynz deployment and `BETEXPLORER_MULTI_LEAGUE_SETUP.md` for provider configuration.

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://localhost:8787`
- Health: `http://localhost:8787/api/v1/health`

## Database order

Run the migrations once, in order:

```text
supabase/migrations/001_schema.sql
supabase/migrations/002_prediction_engine.sql
supabase/migrations/003_multileague_providers.sql
```

Migration 001 stores settled historical results. Migration 002 stores upcoming fixtures and predictions. Migration 003 adds provider, source URL and data-quality metadata.

## Render API

Build command:

```bash
npm install && npm run build -w apps/api
```

Start command:

```bash
npm run start -w apps/api
```

Health path:

```text
/api/v1/health
```

Required environment variables are listed in `.env.example`.

## Render Static Site

Build command:

```bash
npm install && npm run build -w apps/web
```

Publish directory:

```text
apps/web/dist
```

Frontend environment variable:

```env
VITE_API_BASE_URL=https://betynz-v2.onrender.com
```

Add a rewrite from `/*` to `/index.html`.

## Automatic jobs

- `Import football-data CSV`: updates settled historical results.
- `Test BetExplorer fixture feed`: checks the current public fixture parser without saving data.
- `Sync upcoming Betynz predictions`: collects today plus the next five days and rebuilds predictions every four hours.
