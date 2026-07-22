import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { allMatches, listMatches, sourceName } from './store.js';
import { buildOddsBands } from './patterns.js';
import { importFootballDataUrl } from './importer.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((v) => v.trim());

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: origins, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health', (_req, res) => res.json({ ok: true, service: 'betynz-api', source: sourceName(), time: new Date().toISOString() }));

app.get('/api/v1/matches', async (req, res, next) => {
  try {
    const query = z.object({ limit: z.coerce.number().min(1).max(200).default(50), offset: z.coerce.number().min(0).default(0), league: z.string().optional(), season: z.string().optional() }).parse(req.query);
    const matches = await listMatches(query.limit, query.offset, query.league, query.season);
    res.json({ source: sourceName(), count: matches.length, matches });
  } catch (error) { next(error); }
});

app.get('/api/v1/leagues', async (_req, res, next) => {
  try {
    const matches = await allMatches();
    const map = new Map<string, { code: string; name: string; seasons: Set<string>; matches: number }>();
    for (const match of matches) {
      const entry = map.get(match.leagueCode) ?? { code: match.leagueCode, name: match.leagueName, seasons: new Set<string>(), matches: 0 };
      entry.seasons.add(match.season); entry.matches += 1; map.set(match.leagueCode, entry);
    }
    res.json({ source: sourceName(), leagues: [...map.values()].map((v) => ({ ...v, seasons: [...v.seasons].sort() })) });
  } catch (error) { next(error); }
});

app.get('/api/v1/patterns/odds-bands', async (_req, res, next) => {
  try { const matches = await allMatches(); res.json({ source: sourceName(), bands: buildOddsBands(matches) }); }
  catch (error) { next(error); }
});

app.get('/api/v1/dashboard', async (_req, res, next) => {
  try {
    const matches = await allMatches();
    const leagues = new Set(matches.map((m) => m.leagueCode)).size;
    const bands = buildOddsBands(matches);
    res.json({
      source: sourceName(),
      lastUpdated: new Date().toISOString(),
      metrics: { matches: matches.length, leagues, patterns: bands.length, validated: bands.filter((b) => b.sample >= 80 && b.hitRate >= 70).length },
      recentMatches: matches.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 16),
      oddsBands: bands
    });
  } catch (error) { next(error); }
});

app.post('/api/v1/admin/import', async (req, res, next) => {
  try {
    if (!process.env.ADMIN_IMPORT_TOKEN || req.header('x-admin-token') !== process.env.ADMIN_IMPORT_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
    const body = z.object({ url: z.string().url().refine((url) => new URL(url).hostname.endsWith('football-data.co.uk'), 'Only football-data.co.uk is allowed'), season: z.string().min(4), leagueName: z.string().optional() }).parse(req.body);
    const result = await importFootballDataUrl(body.url, body.season, body.leagueName);
    res.json({ imported: result.imported });
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(400).json({ error: message });
});

app.listen(port, '0.0.0.0', () => console.log(`Betynz API listening on http://localhost:${port}`));
