import type { GodPublicPick, UpcomingFixture } from './forecast-types.js';
import { OLYMPIAN_ENGINE_VERSION } from './olympian-version.js';
import type { NormalizedMatch } from './types.js';
import {
  buildFixtureStreakIntelligence,
  type ConfrontationSignal,
  type FixtureStreakIntelligence,
  type TeamStreakSnapshot
} from './streak-intelligence.js';

export const ARES_ENGINE_VERSION = 'ares-streak-value-1.0.0';

const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));
const safeOdd = (value: number | undefined) => value && Number.isFinite(value) && value > 1 ? value : undefined;

function pickOdd(fixture: UpcomingFixture, key: string) {
  const odds = fixture.odds;
  const map: Record<string, number | undefined> = {
    HOME_WIN: odds.home,
    AWAY_WIN: odds.away,
    HOME_DNB: odds.homeDnb,
    AWAY_DNB: odds.awayDnb,
    DOUBLE_CHANCE_1X: odds.dc1x,
    DOUBLE_CHANCE_X2: odds.dcx2,
    OVER_15: odds.over15,
    OVER_25: odds.over25,
    UNDER_25: odds.under25,
    UNDER_35: odds.under35
  };
  return safeOdd(map[key]);
}

function selectionLabel(fixture: UpcomingFixture, key: string) {
  const labels: Record<string, string> = {
    HOME_WIN: `${fixture.homeTeam} to win`,
    AWAY_WIN: `${fixture.awayTeam} to win`,
    HOME_DNB: `${fixture.homeTeam} draw no bet`,
    AWAY_DNB: `${fixture.awayTeam} draw no bet`,
    DOUBLE_CHANCE_1X: `${fixture.homeTeam} or draw`,
    DOUBLE_CHANCE_X2: `${fixture.awayTeam} or draw`,
    OVER_15: 'Over 1.5 goals',
    OVER_25: 'Over 2.5 goals',
    UNDER_25: 'Under 2.5 goals',
    UNDER_35: 'Under 3.5 goals'
  };
  return labels[key] || key;
}

function directionMarket(fixture: UpcomingFixture, side: 'home' | 'away') {
  const winKey = side === 'home' ? 'HOME_WIN' : 'AWAY_WIN';
  const dnbKey = side === 'home' ? 'HOME_DNB' : 'AWAY_DNB';
  const dcKey = side === 'home' ? 'DOUBLE_CHANCE_1X' : 'DOUBLE_CHANCE_X2';
  const winOdd = pickOdd(fixture, winKey);
  const oppositeOdd = side === 'home' ? fixture.odds.away : fixture.odds.home;
  if (winOdd && winOdd <= 2.55 && (!oppositeOdd || winOdd <= oppositeOdd)) return winKey;
  if (pickOdd(fixture, dnbKey)) return dnbKey;
  if (pickOdd(fixture, dcKey)) return dcKey;
  return winOdd ? winKey : null;
}

function statsLineForSignal(signal: ConfrontationSignal, intelligence: FixtureStreakIntelligence) {
  const home = intelligence.home.streaks;
  const away = intelligence.away.streaks;
  switch (signal.key) {
    case 'home-unbeaten-v-away-no-win': return `Unbeaten ${home.unbeaten} · No win ${away.noWin}`;
    case 'away-unbeaten-v-home-no-win': return `Unbeaten ${away.unbeaten} · No win ${home.noWin}`;
    case 'home-win-v-away-loss': return `Wins ${home.wins} · Losses ${away.losses}`;
    case 'away-win-v-home-loss': return `Wins ${away.wins} · Losses ${home.losses}`;
    case 'mutual-over25': return `O2.5 streaks ${home.over25} / ${away.over25}`;
    case 'mutual-under25': return `U2.5 streaks ${home.under25} / ${away.under25}`;
    default: return `Streak score ${Math.round(signal.score)}%`;
  }
}

function goalProfileRate(snapshot: TeamStreakSnapshot, side: 'over' | 'under') {
  const profile = snapshot.goalProfile;
  if (!profile?.sample) return 0;
  return (side === 'over' ? profile.over25 : profile.under25) / profile.sample;
}

function chooseSignal(intelligence: FixtureStreakIntelligence) {
  const allowed = new Set([
    'home-unbeaten-v-away-no-win',
    'away-unbeaten-v-home-no-win',
    'home-win-v-away-loss',
    'away-win-v-home-loss',
    'mutual-over25',
    'mutual-under25'
  ]);
  return intelligence.signals
    .filter((signal) => signal.compatible && allowed.has(signal.key))
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

export function buildAresPick(
  fixture: UpcomingFixture,
  historicalMatches: NormalizedMatch[],
  externalSnapshots: TeamStreakSnapshot[] = []
): GodPublicPick | null {
  const intelligence = buildFixtureStreakIntelligence(fixture, historicalMatches, externalSnapshots);
  const signal = chooseSignal(intelligence);
  if (!signal) return null;
  if (intelligence.home.sample < 4 || intelligence.away.sample < 4) return null;
  if (intelligence.compatibility < 60 || intelligence.contradictionPenalty > 22 || signal.score < 58) return null;

  let marketKey: string | null = null;
  if (signal.marketBias === 'home') marketKey = directionMarket(fixture, 'home');
  if (signal.marketBias === 'away') marketKey = directionMarket(fixture, 'away');
  if (signal.marketBias === 'over25') {
    const homeRate = goalProfileRate(intelligence.home, 'over');
    const awayRate = goalProfileRate(intelligence.away, 'over');
    if (homeRate >= 0.55 && awayRate >= 0.55) marketKey = pickOdd(fixture, 'OVER_25') ? 'OVER_25' : pickOdd(fixture, 'OVER_15') ? 'OVER_15' : null;
  }
  if (signal.marketBias === 'under25') {
    const homeRate = goalProfileRate(intelligence.home, 'under');
    const awayRate = goalProfileRate(intelligence.away, 'under');
    if (homeRate >= 0.55 && awayRate >= 0.55) marketKey = pickOdd(fixture, 'UNDER_25') ? 'UNDER_25' : pickOdd(fixture, 'UNDER_35') ? 'UNDER_35' : null;
  }
  if (!marketKey) return null;

  const odds = pickOdd(fixture, marketKey);
  if (!odds || odds > 3.50) return null;
  const score = Math.min(99, signal.score * 0.62 + intelligence.compatibility * 0.38 - intelligence.contradictionPenalty * 0.35);
  const banker = score >= 76
    && signal.score >= 68
    && intelligence.compatibility >= 68
    && intelligence.contradictionPenalty <= 14
    && intelligence.home.sample >= 5
    && intelligence.away.sample >= 5;

  return {
    fixtureId: fixture.id,
    engineVersion: OLYMPIAN_ENGINE_VERSION,
    god: 'ares',
    date: fixture.date,
    kickoff: fixture.kickoff,
    leagueCode: fixture.leagueCode,
    leagueName: fixture.leagueName,
    country: fixture.country,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    selection: selectionLabel(fixture, marketKey),
    marketKey,
    score: round(score),
    banker,
    odds: round(odds, 2),
    statsLine: statsLineForSignal(signal, intelligence),
    sourceGods: ['ares'],
    settledStatus: 'pending'
  };
}
