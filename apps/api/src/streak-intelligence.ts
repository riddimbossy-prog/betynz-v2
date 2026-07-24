import type { NormalizedMatch } from './types.js';
import type { UpcomingFixture } from './forecast-types.js';
import { sameLeague, teamKey } from './identity.js';

export type StreakScope = 'overall' | 'home' | 'away';

export type StreakValues = {
  wins: number;
  draws: number;
  losses: number;
  noWin: number;
  noDraw: number;
  unbeaten: number;
  over25: number;
  under25: number;
};

export type HtFtProfile = {
  sample: number;
  firstHalfLeadRate: number;
  firstHalfDrawRate: number;
  firstHalfTrailRate: number;
  leadToWinRate: number;
  drawToWinRate: number;
  trailToAvoidLossRate: number;
  combinations: Record<string, number>;
};

export type OpponentAdjustedStreaks = StreakValues & {
  opponentStrength: number;
};

export type TeamStreakSnapshot = {
  snapshotDate: string;
  source: 'computed-history' | 'betexplorer';
  providerUrl?: string;
  leagueCode: string;
  leagueName: string;
  country: string;
  season: string;
  team: string;
  scope: StreakScope;
  sample: number;
  streaks: StreakValues;
  adjusted: OpponentAdjustedStreaks;
  htft: HtFtProfile;
};

export type ConfrontationSignal = {
  key: string;
  label: string;
  score: number;
  compatible: boolean;
  marketBias: 'home' | 'away' | 'draw' | 'over25' | 'under25' | 'neutral';
  note: string;
};

export type FixtureStreakIntelligence = {
  home: TeamStreakSnapshot;
  away: TeamStreakSnapshot;
  homeOverall: TeamStreakSnapshot;
  awayOverall: TeamStreakSnapshot;
  signals: ConfrontationSignal[];
  strongestSignal: ConfrontationSignal | null;
  compatibility: number;
  contradictionPenalty: number;
  biases: {
    home: number;
    away: number;
    draw: number;
    over25: number;
    under25: number;
  };
};

export type ConfrontationRecord = {
  fixtureId: string;
  engineVersion: string;
  generatedAt: string;
  matchDate: string;
  leagueCode: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  strongestSignal: string | null;
  score: number;
  compatible: boolean;
  signals: ConfrontationSignal[];
  homeSnapshot: Record<string, unknown>;
  awaySnapshot: Record<string, unknown>;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));
const average = (values: number[], fallback = 0) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback;

function teamResult(match: NormalizedMatch, team: string) {
  const home = teamKey(match.homeTeam) === teamKey(team);
  const goalsFor = home ? match.homeGoals : match.awayGoals;
  const goalsAgainst = home ? match.awayGoals : match.homeGoals;
  return goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
}

function halfTimeResult(match: NormalizedMatch, team: string) {
  if (typeof match.halfTimeHomeGoals !== 'number' || typeof match.halfTimeAwayGoals !== 'number') return null;
  const home = teamKey(match.homeTeam) === teamKey(team);
  const goalsFor = home ? match.halfTimeHomeGoals : match.halfTimeAwayGoals;
  const goalsAgainst = home ? match.halfTimeAwayGoals : match.halfTimeHomeGoals;
  return goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
}

function opponentName(match: NormalizedMatch, team: string) {
  return teamKey(match.homeTeam) === teamKey(team) ? match.awayTeam : match.homeTeam;
}

function rowsForScope(matches: NormalizedMatch[], team: string, scope: StreakScope, limit = 12) {
  const key = teamKey(team);
  return matches
    .filter((match) => {
      if (scope === 'home') return teamKey(match.homeTeam) === key;
      if (scope === 'away') return teamKey(match.awayTeam) === key;
      return teamKey(match.homeTeam) === key || teamKey(match.awayTeam) === key;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

function currentRun<T>(rows: T[], predicate: (row: T) => boolean) {
  let run = 0;
  for (const row of rows) {
    if (!predicate(row)) break;
    run += 1;
  }
  return run;
}

function ppgByTeam(matches: NormalizedMatch[]) {
  const map = new Map<string, { points: number; played: number }>();
  const touch = (team: string) => {
    const key = teamKey(team);
    const value = map.get(key) ?? { points: 0, played: 0 };
    map.set(key, value);
    return value;
  };
  for (const match of matches) {
    const home = touch(match.homeTeam);
    const away = touch(match.awayTeam);
    home.played += 1;
    away.played += 1;
    if (match.result === 'H') home.points += 3;
    else if (match.result === 'A') away.points += 3;
    else { home.points += 1; away.points += 1; }
  }
  return new Map([...map.entries()].map(([key, value]) => [key, value.played ? value.points / value.played : 1.25]));
}

function streakValues(rows: NormalizedMatch[], team: string): StreakValues {
  return {
    wins: currentRun(rows, (match) => teamResult(match, team) === 'W'),
    draws: currentRun(rows, (match) => teamResult(match, team) === 'D'),
    losses: currentRun(rows, (match) => teamResult(match, team) === 'L'),
    noWin: currentRun(rows, (match) => teamResult(match, team) !== 'W'),
    noDraw: currentRun(rows, (match) => teamResult(match, team) !== 'D'),
    unbeaten: currentRun(rows, (match) => teamResult(match, team) !== 'L'),
    over25: currentRun(rows, (match) => match.homeGoals + match.awayGoals >= 3),
    under25: currentRun(rows, (match) => match.homeGoals + match.awayGoals <= 2)
  };
}

function htftProfile(rows: NormalizedMatch[], team: string): HtFtProfile {
  const combinations: Record<string, number> = {};
  let sample = 0;
  let halfLead = 0;
  let halfDraw = 0;
  let halfTrail = 0;
  let leadWins = 0;
  let drawWins = 0;
  let trailAvoidLoss = 0;

  for (const match of rows) {
    const ht = halfTimeResult(match, team);
    if (!ht) continue;
    const ft = teamResult(match, team);
    sample += 1;
    combinations[`${ht}_${ft}`] = (combinations[`${ht}_${ft}`] || 0) + 1;
    if (ht === 'W') { halfLead += 1; if (ft === 'W') leadWins += 1; }
    if (ht === 'D') { halfDraw += 1; if (ft === 'W') drawWins += 1; }
    if (ht === 'L') { halfTrail += 1; if (ft !== 'L') trailAvoidLoss += 1; }
  }

  const rates = Object.fromEntries(Object.entries(combinations).map(([key, value]) => [key, round(value / Math.max(sample, 1) * 100)]));
  return {
    sample,
    firstHalfLeadRate: round(halfLead / Math.max(sample, 1) * 100),
    firstHalfDrawRate: round(halfDraw / Math.max(sample, 1) * 100),
    firstHalfTrailRate: round(halfTrail / Math.max(sample, 1) * 100),
    leadToWinRate: round(leadWins / Math.max(halfLead, 1) * 100),
    drawToWinRate: round(drawWins / Math.max(halfDraw, 1) * 100),
    trailToAvoidLossRate: round(trailAvoidLoss / Math.max(halfTrail, 1) * 100),
    combinations: rates
  };
}

function adjustedStreaks(rows: NormalizedMatch[], team: string, values: StreakValues, leagueMatches: NormalizedMatch[]): OpponentAdjustedStreaks {
  const ppg = ppgByTeam(leagueMatches);
  const opponentStrength = average(rows.slice(0, Math.max(values.unbeaten, values.noWin, values.over25, values.under25, 3)).map((match) => ppg.get(teamKey(opponentName(match, team))) ?? 1.25), 1.25);
  const multiplier = clamp(opponentStrength / 1.35, 0.75, 1.25);
  return {
    wins: round(values.wins * multiplier, 2),
    draws: round(values.draws * multiplier, 2),
    losses: round(values.losses * multiplier, 2),
    noWin: round(values.noWin * multiplier, 2),
    noDraw: round(values.noDraw * multiplier, 2),
    unbeaten: round(values.unbeaten * multiplier, 2),
    over25: round(values.over25 * multiplier, 2),
    under25: round(values.under25 * multiplier, 2),
    opponentStrength: round(opponentStrength, 2)
  };
}

export function buildTeamStreakSnapshot(
  fixture: UpcomingFixture,
  historicalMatches: NormalizedMatch[],
  team: string,
  scope: StreakScope
): TeamStreakSnapshot {
  const prior = historicalMatches.filter((match) => match.date < fixture.date);
  const leagueMatches = prior.filter((match) => sameLeague(match.leagueName, fixture.leagueName));
  const rows = rowsForScope(leagueMatches, team, scope, scope === 'overall' ? 12 : 10);
  const streaks = streakValues(rows, team);
  return {
    snapshotDate: fixture.date,
    source: 'computed-history',
    leagueCode: fixture.leagueCode,
    leagueName: fixture.leagueName,
    country: fixture.country,
    season: fixture.season,
    team,
    scope,
    sample: rows.length,
    streaks,
    adjusted: adjustedStreaks(rows, team, streaks, leagueMatches),
    htft: htftProfile(rows, team)
  };
}

function signal(
  key: string,
  label: string,
  score: number,
  compatible: boolean,
  marketBias: ConfrontationSignal['marketBias'],
  note: string
): ConfrontationSignal {
  return { key, label, score: round(clamp(score, 0, 100)), compatible, marketBias, note };
}


function latestExternalSnapshot(
  fixture: UpcomingFixture,
  snapshots: TeamStreakSnapshot[],
  team: string,
  scope: StreakScope
) {
  const teamId = teamKey(team);
  const countryId = teamKey(fixture.country || '');
  return snapshots
    .filter((snapshot) => snapshot.source === 'betexplorer'
      && snapshot.scope === scope
      && snapshot.snapshotDate <= fixture.date
      && teamKey(snapshot.team) === teamId
      && (sameLeague(snapshot.leagueName, fixture.leagueName)
        || (countryId && teamKey(snapshot.country || '') === countryId)))
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)
      || Number(b.leagueCode === fixture.leagueCode) - Number(a.leagueCode === fixture.leagueCode)
      || b.sample - a.sample)[0];
}

function mergeExternalSnapshot(computed: TeamStreakSnapshot, external?: TeamStreakSnapshot): TeamStreakSnapshot {
  if (!external) return computed;
  const multiplier = clamp(computed.adjusted.opponentStrength / 1.35, 0.75, 1.25);
  const adjusted = {
    wins: round(external.streaks.wins * multiplier, 2),
    draws: round(external.streaks.draws * multiplier, 2),
    losses: round(external.streaks.losses * multiplier, 2),
    noWin: round(external.streaks.noWin * multiplier, 2),
    noDraw: round(external.streaks.noDraw * multiplier, 2),
    unbeaten: round(external.streaks.unbeaten * multiplier, 2),
    over25: round(external.streaks.over25 * multiplier, 2),
    under25: round(external.streaks.under25 * multiplier, 2),
    opponentStrength: computed.adjusted.opponentStrength
  };
  return {
    ...computed,
    source: 'betexplorer',
    providerUrl: external.providerUrl,
    sample: Math.max(external.sample, computed.sample),
    streaks: external.streaks,
    adjusted,
    htft: external.htft.sample > 0 ? external.htft : computed.htft
  };
}

export function buildFixtureStreakIntelligence(
  fixture: UpcomingFixture,
  historicalMatches: NormalizedMatch[],
  externalSnapshots: TeamStreakSnapshot[] = []
): FixtureStreakIntelligence {
  const home = mergeExternalSnapshot(
    buildTeamStreakSnapshot(fixture, historicalMatches, fixture.homeTeam, 'home'),
    latestExternalSnapshot(fixture, externalSnapshots, fixture.homeTeam, 'home')
  );
  const away = mergeExternalSnapshot(
    buildTeamStreakSnapshot(fixture, historicalMatches, fixture.awayTeam, 'away'),
    latestExternalSnapshot(fixture, externalSnapshots, fixture.awayTeam, 'away')
  );
  const homeOverall = mergeExternalSnapshot(
    buildTeamStreakSnapshot(fixture, historicalMatches, fixture.homeTeam, 'overall'),
    latestExternalSnapshot(fixture, externalSnapshots, fixture.homeTeam, 'overall')
  );
  const awayOverall = mergeExternalSnapshot(
    buildTeamStreakSnapshot(fixture, historicalMatches, fixture.awayTeam, 'overall'),
    latestExternalSnapshot(fixture, externalSnapshots, fixture.awayTeam, 'overall')
  );
  const signals: ConfrontationSignal[] = [];

  const homeUnbeaten = Math.max(home.adjusted.unbeaten, homeOverall.adjusted.unbeaten * 0.8);
  const awayNoWin = Math.max(away.adjusted.noWin, awayOverall.adjusted.noWin * 0.8);
  const awayUnbeaten = Math.max(away.adjusted.unbeaten, awayOverall.adjusted.unbeaten * 0.8);
  const homeNoWin = Math.max(home.adjusted.noWin, homeOverall.adjusted.noWin * 0.8);

  if (homeUnbeaten >= 2 || awayNoWin >= 2) {
    const score = (homeUnbeaten + awayNoWin) * 10 + (home.adjusted.opponentStrength + away.adjusted.opponentStrength) * 8;
    signals.push(signal(
      'home-unbeaten-v-away-no-win',
      'Home unbeaten vs away no-win',
      score,
      !(away.adjusted.wins >= 2),
      'home',
      `${fixture.homeTeam} are unbeaten for ${home.streaks.unbeaten} home games while ${fixture.awayTeam} are without an away win for ${away.streaks.noWin}.`
    ));
  }

  if (awayUnbeaten >= 2 || homeNoWin >= 2) {
    const score = (awayUnbeaten + homeNoWin) * 10 + (home.adjusted.opponentStrength + away.adjusted.opponentStrength) * 8;
    signals.push(signal(
      'away-unbeaten-v-home-no-win',
      'Away unbeaten vs home no-win',
      score,
      !(home.adjusted.wins >= 2),
      'away',
      `${fixture.awayTeam} are unbeaten for ${away.streaks.unbeaten} away games while ${fixture.homeTeam} are without a home win for ${home.streaks.noWin}.`
    ));
  }

  if (home.adjusted.wins >= 2 || away.adjusted.losses >= 2) {
    signals.push(signal(
      'home-win-v-away-loss',
      'Home wins vs away losses',
      (home.adjusted.wins + away.adjusted.losses) * 13,
      away.adjusted.unbeaten < 2,
      'home',
      `${fixture.homeTeam} have ${home.streaks.wins} straight home wins and ${fixture.awayTeam} have ${away.streaks.losses} straight away losses.`
    ));
  }

  if (away.adjusted.wins >= 2 || home.adjusted.losses >= 2) {
    signals.push(signal(
      'away-win-v-home-loss',
      'Away wins vs home losses',
      (away.adjusted.wins + home.adjusted.losses) * 13,
      home.adjusted.unbeaten < 2,
      'away',
      `${fixture.awayTeam} have ${away.streaks.wins} straight away wins and ${fixture.homeTeam} have ${home.streaks.losses} straight home losses.`
    ));
  }

  if (home.adjusted.noDraw >= 3 && away.adjusted.noDraw >= 3) {
    signals.push(signal(
      'mutual-no-draw',
      'Both teams avoid draws',
      (home.adjusted.noDraw + away.adjusted.noDraw) * 8,
      !(home.adjusted.draws >= 2 || away.adjusted.draws >= 2),
      'neutral',
      `Neither side has drawn recently: ${fixture.homeTeam} ${home.streaks.noDraw} home games, ${fixture.awayTeam} ${away.streaks.noDraw} away games.`
    ));
  }

  if (home.adjusted.draws >= 2 && away.adjusted.draws >= 2) {
    signals.push(signal(
      'mutual-draw',
      'Both teams are drawing',
      (home.adjusted.draws + away.adjusted.draws) * 14,
      !(home.adjusted.noDraw >= 3 || away.adjusted.noDraw >= 3),
      'draw',
      `Both teams are on draw runs: ${fixture.homeTeam} ${home.streaks.draws}, ${fixture.awayTeam} ${away.streaks.draws}.`
    ));
  }

  if (home.adjusted.over25 >= 2 && away.adjusted.over25 >= 2) {
    signals.push(signal(
      'mutual-over25',
      'Both teams are on Over 2.5 runs',
      (home.adjusted.over25 + away.adjusted.over25) * 13,
      !(home.adjusted.under25 >= 2 || away.adjusted.under25 >= 2),
      'over25',
      `${home.streaks.over25} recent ${fixture.homeTeam} home games and ${away.streaks.over25} recent ${fixture.awayTeam} away games went over 2.5.`
    ));
  }

  if (home.adjusted.under25 >= 2 && away.adjusted.under25 >= 2) {
    signals.push(signal(
      'mutual-under25',
      'Both teams are on Under 2.5 runs',
      (home.adjusted.under25 + away.adjusted.under25) * 13,
      !(home.adjusted.over25 >= 2 || away.adjusted.over25 >= 2),
      'under25',
      `${home.streaks.under25} recent ${fixture.homeTeam} home games and ${away.streaks.under25} recent ${fixture.awayTeam} away games stayed under 2.5.`
    ));
  }

  const htHomeScore = home.htft.sample >= 4 ? home.htft.leadToWinRate : 0;
  const htAwayScore = away.htft.sample >= 4 ? 100 - away.htft.trailToAvoidLossRate : 0;
  if (htHomeScore >= 65 && htAwayScore >= 55) {
    signals.push(signal(
      'htft-home-control',
      'Home side protects first-half leads',
      htHomeScore * 0.55 + htAwayScore * 0.45,
      true,
      'home',
      `${fixture.homeTeam} convert ${home.htft.leadToWinRate}% of home half-time leads, while ${fixture.awayTeam} rarely recover after trailing away.`
    ));
  }

  const biases = { home: 0, away: 0, draw: 0, over25: 0, under25: 0 };
  for (const item of signals) {
    const direction = item.compatible ? 1 : -0.55;
    const weight = direction * clamp(item.score / 100, 0, 1) * 0.055;
    if (item.marketBias !== 'neutral') biases[item.marketBias] += weight;
  }
  for (const key of Object.keys(biases) as Array<keyof typeof biases>) biases[key] = clamp(biases[key], -0.08, 0.10);

  signals.sort((a, b) => b.score - a.score);
  const compatibleScores = signals.filter((item) => item.compatible).map((item) => item.score);
  const conflictScores = signals.filter((item) => !item.compatible).map((item) => item.score);
  const compatibility = clamp(50 + average(compatibleScores, 0) * 0.45 - average(conflictScores, 0) * 0.55, 0, 100);
  const contradictionPenalty = clamp(average(conflictScores, 0) * 0.45, 0, 40);

  return {
    home,
    away,
    homeOverall,
    awayOverall,
    signals,
    strongestSignal: signals[0] || null,
    compatibility: round(compatibility),
    contradictionPenalty: round(contradictionPenalty),
    biases
  };
}

export function toConfrontationRecord(
  fixture: UpcomingFixture,
  engineVersion: string,
  intelligence: FixtureStreakIntelligence
): ConfrontationRecord {
  return {
    fixtureId: fixture.id,
    engineVersion,
    generatedAt: new Date().toISOString(),
    matchDate: fixture.date,
    leagueCode: fixture.leagueCode,
    leagueName: fixture.leagueName,
    country: fixture.country,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    strongestSignal: intelligence.strongestSignal?.label ?? null,
    score: intelligence.strongestSignal?.score ?? 0,
    compatible: intelligence.compatibility >= 60 && intelligence.contradictionPenalty <= 18,
    signals: intelligence.signals,
    homeSnapshot: {
      scope: intelligence.home.scope,
      sample: intelligence.home.sample,
      streaks: intelligence.home.streaks,
      adjusted: intelligence.home.adjusted,
      htft: intelligence.home.htft
    },
    awaySnapshot: {
      scope: intelligence.away.scope,
      sample: intelligence.away.sample,
      streaks: intelligence.away.streaks,
      adjusted: intelligence.away.adjusted,
      htft: intelligence.away.htft
    }
  };
}
