import assert from 'node:assert/strict';
import demoMatches from '../data/demo-matches.json' with { type: 'json' };
import { analyzeFixture } from './engine.js';
import type { UpcomingFixture } from './forecast-types.js';
import type { NormalizedMatch } from './types.js';

const fixture: UpcomingFixture = {
  id: 'smoke-man-united-forest',
  providerFixtureId: 999999,
  leagueId: 39,
  leagueCode: '39',
  leagueName: 'Premier League',
  country: 'England',
  season: '2026',
  kickoff: '2026-07-24T18:00:00Z',
  date: '2026-07-24',
  status: 'NS',
  homeTeam: 'Man United',
  awayTeam: "Nott'm Forest",
  dataQuality: 90,
  odds: {
    home: 1.55, draw: 4.1, away: 5.8,
    over15: 1.2, under15: 4.1,
    over25: 1.7, under25: 2.1,
    over35: 2.65, under35: 1.45,
    homeOver05: 1.16, homeUnder05: 4.4,
    homeOver15: 1.65, homeUnder15: 2.1,
    awayOver05: 1.55, awayUnder05: 2.25,
    awayOver15: 3.5, awayUnder15: 1.25,
    dc1x: 1.12, dcx2: 2.25,
    homeDnb: 1.22, awayDnb: 4.1
  }};

const prediction = analyzeFixture(fixture, demoMatches as NormalizedMatch[]);
if (!prediction) throw new Error('Expected the smoke-test fixture to produce a qualified prediction.');
assert(prediction.odds >= 1.19, 'Published odds must never be below 1.19.');
assert.equal(prediction.engines.filter((engine) => engine.pass).length, 4, 'Chronos, Ares, Zeus and Leonidas must all approve the smoke selection.');
assert(prediction.explanation.length >= 3, 'Simple-English statistical reasons are required.');
console.log(JSON.stringify({ ok: true, selection: prediction.selection, odds: prediction.odds, confidence: prediction.confidence }, null, 2));
