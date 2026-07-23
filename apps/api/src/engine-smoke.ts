import assert from 'node:assert/strict';
import demoMatches from '../data/demo-matches.json' with { type: 'json' };
import { analyzeFixture } from './engine.js';
import type { UpcomingFixture } from './forecast-types.js';
import type { NormalizedMatch } from './types.js';

const fixture: UpcomingFixture = {
  id: 'smoke-liverpool-arsenal',
  providerFixtureId: 999999,
  leagueId: 39,
  leagueCode: '39',
  leagueName: 'Premier League',
  country: 'England',
  season: '2026',
  kickoff: '2026-07-24T18:00:00Z',
  date: '2026-07-24',
  status: 'NS',
  homeTeam: 'Liverpool',
  awayTeam: 'Arsenal',
  odds: {
    home: 2.15, draw: 3.6, away: 3.2,
    over15: 1.2, under15: 4.1,
    over25: 1.73, under25: 2.08,
    over35: 2.7, under35: 1.45,
    homeOver05: 1.2, homeUnder05: 3.8,
    homeOver15: 1.9, homeUnder15: 1.8,
    awayOver05: 1.28, awayUnder05: 3.2,
    awayOver15: 2.2, awayUnder15: 1.6,
    dc1x: 1.35, dcx2: 1.65,
    homeDnb: 1.58, awayDnb: 2.25
  }
};

const prediction = analyzeFixture(fixture, demoMatches as NormalizedMatch[]);
if (!prediction) throw new Error('Expected the smoke-test fixture to produce a qualified prediction.');
assert(prediction.odds >= 1.19, 'Published odds must never be below 1.19.');
assert(prediction.engines.filter((engine) => engine.pass).length >= 3, 'At least three engines must approve the selection.');
assert(prediction.explanation.length >= 3, 'Simple-English statistical reasons are required.');
console.log(JSON.stringify({ ok: true, selection: prediction.selection, odds: prediction.odds, confidence: prediction.confidence }, null, 2));
