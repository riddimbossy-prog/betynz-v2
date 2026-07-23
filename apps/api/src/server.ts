import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { allMatches, listMatches, listUpcomingFixtures, sourceName } from './store.js';
import { buildOddsBands } from './patterns.js';
import { importFootballDataUrl } from './importer.js';
import { ENGINE_VERSION } from './engine.js';
import { getPredictionDashboard, predictionWindow, syncUpcomingPredictions } from './prediction-service.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: origins, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health', (_req: express.Request, res: express.Response) => res.json({
  ok: true,
  service: 'betynz-api',
  source: sourceName(),
  engineVersion: ENGINE_VERSION,
  predictionWindow: predictionWindow(),
  time: new Date().toISOString()
}));

app.get('/api/v1/matches', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const query = z.object({
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0),
      league: z.string().optional(),
      season: z.string().optional()
    }).parse(req.query);
    const matches = await listMatches(query.limit, query.offset, query.league, query.season);
    res.json({ source: sourceName(), count: matches.length, matches });
  } catch (error) { next(error); }
});

app.get('/api/v1/leagues', async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const matches = await allMatches();
    const map = new Map<string, { code: string; name: string; seasons: Set<string>; matches: number }>();
    for (const match of matches) {
      const entry = map.get(match.leagueCode) ?? { code: match.leagueCode, name: match.leagueName, seasons: new Set<string>(), matches: 0 };
      entry.seasons.add(match.season);
      entry.matches += 1;
      map.set(match.leagueCode, entry);
    }
    res.json({ source: sourceName(), leagues: [...map.values()].map((value) => ({ ...value, seasons: [...value.seasons].sort() })) });
  } catch (error) { next(error); }
});

app.get('/api/v1/patterns/odds-bands', async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const matches = await allMatches();
    res.json({ source: sourceName(), bands: buildOddsBands(matches) });
  } catch (error) { next(error); }
});

app.get('/api/v1/upcoming-fixtures', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const defaults = predictionWindow();
    const query = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query);
    const from = query.from || defaults.from;
    const to = query.to || defaults.to;
    const fixtures = await listUpcomingFixtures(from, to);
    res.json({ source: sourceName(), window: { from, to }, count: fixtures.length, fixtures });
  } catch (error) { next(error); }
});

app.get('/api/v1/predictions', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const query = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query);
    res.json(await getPredictionDashboard(query.from, query.to));
  } catch (error) { next(error); }
});

app.get('/api/v1/bankers', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const query = z.object({ date: z.string().optional() }).parse(req.query);
    const defaults = predictionWindow();
    const date = query.date || defaults.from;
    const dashboard = await getPredictionDashboard(date, date);
    res.json({ source: dashboard.source, generatedAt: dashboard.generatedAt, date, bankers: dashboard.bankers.slice(0, 3) });
  } catch (error) { next(error); }
});

app.get('/api/v1/dashboard', async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const [matches, predictions] = await Promise.all([allMatches(), getPredictionDashboard()]);
    const leagues = new Set(matches.map((match) => match.leagueCode)).size;
    const bands = buildOddsBands(matches);
    res.json({
      source: sourceName(),
      lastUpdated: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      metrics: {
        matches: matches.length,
        leagues,
        patterns: bands.length,
        validated: bands.filter((band) => band.sample >= 80 && band.hitRate >= 70).length,
        upcomingFixtures: predictions.metrics.fixtures,
        futurePicks: predictions.metrics.picks,
        bankers: predictions.metrics.bankers
      },
      recentMatches: matches.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 16),
      oddsBands: bands,
      predictionWindow: predictions.window
    });
  } catch (error) { next(error); }
});

function authorizeAdmin(req: express.Request, res: express.Response) {
  if (!process.env.ADMIN_IMPORT_TOKEN || req.header('x-admin-token') !== process.env.ADMIN_IMPORT_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

app.post('/api/v1/admin/import', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    if (!authorizeAdmin(req, res)) return;
    const body = z.object({
      url: z.string().url().refine((url: string) => new URL(url).hostname.endsWith('football-data.co.uk'), 'Only football-data.co.uk is allowed'),
      season: z.string().min(4),
      leagueName: z.string().optional()
    }).parse(req.body);
    const result = await importFootballDataUrl(body.url, body.season, body.leagueName);
    res.json({ imported: result.imported, settled: result.settled });
  } catch (error) { next(error); }
});

app.post('/api/v1/admin/sync-upcoming', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    if (!authorizeAdmin(req, res)) return;
    res.json(await syncUpcomingPredictions());
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(400).json({ error: message });
});

app.listen(port, '0.0.0.0', () => console.log(`Betynz API listening on http://localhost:${port}`));
