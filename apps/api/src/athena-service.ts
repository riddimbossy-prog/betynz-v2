import type { NormalizedMatch } from './types.js';
import type { UpcomingFixture } from './forecast-types.js';
import type { GoalProfile, HtFtProfile, TeamStreakSnapshot } from './streak-intelligence.js';
import { sameLeague, teamKey } from './identity.js';
import {
  analyseAthenaFixture,
  ATHENA_CLASSIFICATIONS,
  ATHENA_ENGINE_MODE,
  ATHENA_ENGINE_VERSION,
  ATHENA_MARKETS,
  athenaMarketLabel,
  type AthenaGoalProfile,
  type AthenaHtFtCounts,
  type AthenaTeamInput
} from './athena-transition.js';
import type { AthenaShadowDashboard, AthenaShadowRun } from './athena-types.js';
import { listAthenaShadowRuns, sourceName } from './store.js';

const COMBINATION_KEYS: Array<[keyof AthenaHtFtCounts, string]> = [
  ['ww', 'W_W'], ['wd', 'W_D'], ['wl', 'W_L'],
  ['dw', 'D_W'], ['dd', 'D_D'], ['dl', 'D_L'],
  ['lw', 'L_W'], ['ld', 'L_D'], ['ll', 'L_L']
];

function emptyCounts(): AthenaHtFtCounts {
  return { ww: 0, wd: 0, wl: 0, dw: 0, dd: 0, dl: 0, lw: 0, ld: 0, ll: 0 };
}

function resultFromGoals(forGoals: number, againstGoals: number): 'W' | 'D' | 'L' {
  return forGoals > againstGoals ? 'W' : forGoals < againstGoals ? 'L' : 'D';
}

function teamRows(fixture: UpcomingFixture, matches: NormalizedMatch[], team: string, scope: 'overall' | 'home' | 'away', limit: number) {
  const key = teamKey(team);
  const sameSeasonRows = matches
    .filter((match) => match.date < fixture.date)
    .filter((match) => sameLeague(match.leagueName, fixture.leagueName))
    .filter((match) => !fixture.season || !match.season || match.season === fixture.season)
    .filter((match) => {
      if (scope === 'home') return teamKey(match.homeTeam) === key;
      if (scope === 'away') return teamKey(match.awayTeam) === key;
      return teamKey(match.homeTeam) === key || teamKey(match.awayTeam) === key;
    });
  const fallbackRows = sameSeasonRows.length >= 4 ? sameSeasonRows : matches
    .filter((match) => match.date < fixture.date)
    .filter((match) => sameLeague(match.leagueName, fixture.leagueName))
    .filter((match) => {
      if (scope === 'home') return teamKey(match.homeTeam) === key;
      if (scope === 'away') return teamKey(match.awayTeam) === key;
      return teamKey(match.homeTeam) === key || teamKey(match.awayTeam) === key;
    });
  return fallbackRows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

function countsFromMatches(rows: NormalizedMatch[], team: string) {
  const counts = emptyCounts();
  let sample = 0;
  for (const match of rows) {
    if (typeof match.halfTimeHomeGoals !== 'number' || typeof match.halfTimeAwayGoals !== 'number') continue;
    const home = teamKey(match.homeTeam) === teamKey(team);
    const htFor = home ? match.halfTimeHomeGoals : match.halfTimeAwayGoals;
    const htAgainst = home ? match.halfTimeAwayGoals : match.halfTimeHomeGoals;
    const ftFor = home ? match.homeGoals : match.awayGoals;
    const ftAgainst = home ? match.awayGoals : match.homeGoals;
    const ht = resultFromGoals(htFor, htAgainst).toLowerCase();
    const ft = resultFromGoals(ftFor, ftAgainst).toLowerCase();
    const key = `${ht}${ft}` as keyof AthenaHtFtCounts;
    counts[key] += 1;
    sample += 1;
  }
  return { sample, counts };
}

function largestRemainder(values: number[], total: number) {
  const floors = values.map((value) => Math.floor(value));
  let remaining = Math.max(0, total - floors.reduce((sum, value) => sum + value, 0));
  const order = values
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of order) {
    if (remaining <= 0) break;
    floors[item.index] += 1;
    remaining -= 1;
  }
  return floors;
}

function normalizeSnapshotCounts(profile?: HtFtProfile): { sample: number; counts: AthenaHtFtCounts } | null {
  if (!profile || profile.sample <= 0) return null;
  const rawValues = COMBINATION_KEYS.map(([, external]) => Number(profile.combinations?.[external] ?? 0));
  const sum = rawValues.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  let normalized: number[];
  if (Math.abs(sum - profile.sample) <= 0.6) normalized = rawValues.map((value) => Math.round(value));
  else normalized = largestRemainder(rawValues.map((value) => value / sum * profile.sample), profile.sample);
  const counts = emptyCounts();
  COMBINATION_KEYS.forEach(([internal], index) => { counts[internal] = Math.max(0, normalized[index] ?? 0); });
  return { sample: Object.values(counts).reduce((a, b) => a + b, 0), counts };
}

function goalProfileFromRows(rows: NormalizedMatch[], team: string): AthenaGoalProfile | undefined {
  if (!rows.length) return undefined;
  let over25 = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const last5Over25: boolean[] = [];
  for (const match of rows) {
    const home = teamKey(match.homeTeam) === teamKey(team);
    const scored = home ? match.homeGoals : match.awayGoals;
    const conceded = home ? match.awayGoals : match.homeGoals;
    const isOver = scored + conceded >= 3;
    goalsFor += scored;
    goalsAgainst += conceded;
    if (isOver) over25 += 1;
    if (last5Over25.length < 5) last5Over25.push(isOver);
  }
  return {
    sample: rows.length,
    over25,
    under25: rows.length - over25,
    goalsFor,
    goalsAgainst,
    averageTotalGoals: Number(((goalsFor + goalsAgainst) / rows.length).toFixed(2)),
    last5Over25
  };
}

function goalProfileFromSnapshot(profile?: GoalProfile): AthenaGoalProfile | undefined {
  if (!profile || profile.sample <= 0 || profile.over25 + profile.under25 <= 0) return undefined;
  const total = profile.over25 + profile.under25;
  const sample = Math.max(profile.sample, total);
  return {
    sample,
    over25: profile.over25,
    under25: profile.under25,
    goalsFor: profile.goalsFor,
    goalsAgainst: profile.goalsAgainst,
    averageTotalGoals: profile.averageTotalGoals,
    last5Over25: profile.last5Over25
  };
}

function findSnapshot(snapshots: TeamStreakSnapshot[], team: string, scope: 'overall' | 'home' | 'away') {
  const key = teamKey(team);
  return snapshots
    .filter((snapshot) => snapshot.scope === scope && teamKey(snapshot.team) === key)
    .sort((a, b) => Number(b.source === 'betexplorer') - Number(a.source === 'betexplorer') || b.htft.sample - a.htft.sample)[0];
}

function buildTeamInput(
  fixture: UpcomingFixture,
  historicalMatches: NormalizedMatch[],
  snapshots: TeamStreakSnapshot[],
  team: string,
  venueScope: 'home' | 'away'
) {
  const historyLimit = Math.max(12, Math.min(40, Number(process.env.ATHENA_HISTORY_LIMIT || 24)));
  const rows = teamRows(fixture, historicalMatches, team, 'overall', historyLimit);
  const localHtFt = countsFromMatches(rows, team);
  const overallSnapshot = findSnapshot(snapshots, team, 'overall');
  const externalHtFt = overallSnapshot?.source === 'betexplorer' ? normalizeSnapshotCounts(overallSnapshot.htft) : null;
  const chosenHtFt = externalHtFt && externalHtFt.sample >= localHtFt.sample ? externalHtFt : localHtFt;

  const externalGoals = overallSnapshot?.source === 'betexplorer' ? goalProfileFromSnapshot(overallSnapshot.goalProfile) : undefined;
  const localGoals = goalProfileFromRows(rows, team);
  const goals = externalGoals && externalGoals.sample >= (localGoals?.sample ?? 0) ? externalGoals : localGoals;

  const venueSnapshot = findSnapshot(snapshots, team, venueScope);
  const venueRows = teamRows(fixture, historicalMatches, team, venueScope, 12);
  const venueSample = Math.max(venueSnapshot?.htft.sample ?? 0, countsFromMatches(venueRows, team).sample);
  const venue = venueSample >= 5 ? { scope: venueScope, sample: venueSample } as const : null;

  const input: AthenaTeamInput = {
    name: team,
    matchesPlayed: chosenHtFt.sample,
    htft: chosenHtFt.counts,
    goals,
    venue
  };
  return {
    input,
    htftSource: externalHtFt && externalHtFt.sample >= localHtFt.sample ? 'betexplorer' as const : 'computed-history' as const,
    goalsSource: externalGoals && externalGoals.sample >= (localGoals?.sample ?? 0)
      ? 'betexplorer' as const
      : localGoals ? 'computed-history' as const : 'missing' as const,
    venueSample
  };
}

export function buildAthenaShadowRun(
  fixture: UpcomingFixture,
  historicalMatches: NormalizedMatch[],
  snapshots: TeamStreakSnapshot[]
): AthenaShadowRun {
  const home = buildTeamInput(fixture, historicalMatches, snapshots, fixture.homeTeam, 'home');
  const away = buildTeamInput(fixture, historicalMatches, snapshots, fixture.awayTeam, 'away');
  const minSample = Math.max(3, Number(process.env.ATHENA_MIN_HTFT_SAMPLE || 6));
  const insufficient = home.input.matchesPlayed < minSample || away.input.matchesPlayed < minSample;

  const analysis = analyseAthenaFixture({
    id: fixture.id,
    league: fixture.leagueName,
    kickoff: fixture.kickoff,
    home: home.input,
    away: away.input,
    odds: { home: fixture.odds.home, draw: fixture.odds.draw, away: fixture.odds.away }
  });

  if (insufficient) {
    analysis.classification = {
      ...analysis.classification,
      type: ATHENA_CLASSIFICATIONS.CONFLICT_NO_PICK,
      side: null,
      warnings: [...analysis.classification.warnings, 'INSUFFICIENT_HTFT_SAMPLE']
    };
    analysis.story = `Athena withheld the pick because the HT/FT sample is below ${minSample} for one or both teams.`;
    analysis.banker = {
      market: ATHENA_MARKETS.NO_PICK,
      score: 0,
      reasons: ['Insufficient HT/FT sample'],
      warnings: ['INSUFFICIENT_HTFT_SAMPLE'],
      fatal: false
    };
  }

  const marketLabel = athenaMarketLabel(analysis.banker.market, fixture.homeTeam, fixture.awayTeam);
  return {
    fixtureId: fixture.id,
    engineVersion: ATHENA_ENGINE_VERSION,
    runAt: analysis.audit.generatedAt,
    date: fixture.date,
    kickoff: fixture.kickoff,
    leagueCode: fixture.leagueCode,
    leagueName: fixture.leagueName,
    country: fixture.country,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    classification: analysis.classification.type,
    side: analysis.classification.side,
    story: analysis.story,
    marketKey: analysis.banker.market,
    marketLabel,
    score: analysis.banker.score,
    banker: analysis.banker.market !== ATHENA_MARKETS.NO_PICK && analysis.banker.score >= 80,
    reasons: analysis.banker.reasons,
    warnings: [...new Set([...analysis.classification.warnings, ...analysis.banker.warnings])],
    secondary: analysis.secondary,
    topMarkets: analysis.topMarkets,
    routes: analysis.routes,
    metrics: analysis.metrics,
    oddsConflict: analysis.oddsConflict,
    inputSource: {
      homeHtFt: home.htftSource,
      awayHtFt: away.htftSource,
      homeGoals: home.goalsSource,
      awayGoals: away.goalsSource,
      homeVenueSample: home.venueSample,
      awayVenueSample: away.venueSample
    },
    settledStatus: analysis.banker.market === ATHENA_MARKETS.NO_PICK ? 'void' : 'pending'
  };
}

export async function getAthenaShadowDashboard(from: string, to: string, limit = 500): Promise<AthenaShadowDashboard> {
  const runs = await listAthenaShadowRuns(from, to, limit);
  const picks = runs.filter((run) => run.marketKey !== ATHENA_MARKETS.NO_PICK);
  const won = picks.filter((run) => run.settledStatus === 'won').length;
  const lost = picks.filter((run) => run.settledStatus === 'lost').length;
  const voided = runs.filter((run) => run.settledStatus === 'void').length;
  const settled = won + lost;
  return {
    source: sourceName(),
    generatedAt: new Date().toISOString(),
    engineVersion: ATHENA_ENGINE_VERSION,
    mode: ATHENA_ENGINE_MODE,
    window: { from, to },
    metrics: {
      fixtures: runs.length,
      picks: picks.length,
      noPicks: runs.length - picks.length,
      bankers: picks.filter((run) => run.banker).length,
      settled,
      won,
      lost,
      void: voided,
      pending: picks.filter((run) => (run.settledStatus ?? 'pending') === 'pending').length,
      hitRate: settled ? Number((won / settled * 100).toFixed(1)) : null
    },
    runs
  };
}
