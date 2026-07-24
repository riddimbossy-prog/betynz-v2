import type { GodPublicPick, UpcomingFixture } from './forecast-types.js';
import { OLYMPIAN_ENGINE_VERSION } from './olympian-version.js';
import { sameLeague, teamKey } from './identity.js';
import type { NormalizedMatch } from './types.js';

export const CHRONOS_ENGINE_VERSION = 'chronos-historical-pattern-1.0.0';

type ChronosMarket = 'HOME_WIN' | 'AWAY_WIN' | 'OVER_25' | 'UNDER_25';

type Candidate = {
  marketKey: ChronosMarket;
  odds: number;
  hitRate: number;
  sample: number;
  similarity: number;
  teamRate: number;
  score: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const average = (values: number[], fallback = 0) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));

function fairThreeWay(home?: number, draw?: number, away?: number) {
  if (!home || !draw || !away) return null;
  const raw = [1 / home, 1 / draw, 1 / away];
  const sum = raw.reduce((a, b) => a + b, 0);
  return { home: raw[0] / sum, draw: raw[1] / sum, away: raw[2] / sum };
}

function fairPair(over?: number, under?: number) {
  if (!over || !under) return null;
  const a = 1 / over;
  const b = 1 / under;
  return { over: a / (a + b), under: b / (a + b) };
}

function currentOdd(fixture: UpcomingFixture, market: ChronosMarket) {
  const map: Record<ChronosMarket, number | undefined> = {
    HOME_WIN: fixture.odds.home,
    AWAY_WIN: fixture.odds.away,
    OVER_25: fixture.odds.over25,
    UNDER_25: fixture.odds.under25
  };
  const value = map[market];
  return value && Number.isFinite(value) && value > 1 ? value : undefined;
}

function historicalOdd(match: NormalizedMatch, market: ChronosMarket) {
  const map: Record<ChronosMarket, number | undefined> = {
    HOME_WIN: match.odds.openingHome ?? match.odds.closingHome,
    AWAY_WIN: match.odds.openingAway ?? match.odds.closingAway,
    OVER_25: match.odds.openingOver25 ?? match.odds.closingOver25,
    UNDER_25: match.odds.openingUnder25 ?? match.odds.closingUnder25
  };
  return map[market];
}

function landed(match: NormalizedMatch, market: ChronosMarket) {
  if (market === 'HOME_WIN') return match.result === 'H';
  if (market === 'AWAY_WIN') return match.result === 'A';
  const total = match.homeGoals + match.awayGoals;
  return market === 'OVER_25' ? total >= 3 : total <= 2;
}

function targetShape(fixture: UpcomingFixture, market: ChronosMarket) {
  if (market === 'HOME_WIN' || market === 'AWAY_WIN') {
    const fair = fairThreeWay(fixture.odds.home, fixture.odds.draw, fixture.odds.away);
    if (!fair) return null;
    return market === 'HOME_WIN' ? fair.home : fair.away;
  }
  const fair = fairPair(fixture.odds.over25, fixture.odds.under25);
  if (!fair) return null;
  return market === 'OVER_25' ? fair.over : fair.under;
}

function historicalShape(match: NormalizedMatch, market: ChronosMarket) {
  if (market === 'HOME_WIN' || market === 'AWAY_WIN') {
    const fair = fairThreeWay(
      match.odds.openingHome ?? match.odds.closingHome,
      match.odds.openingDraw ?? match.odds.closingDraw,
      match.odds.openingAway ?? match.odds.closingAway
    );
    if (!fair) return null;
    return market === 'HOME_WIN' ? fair.home : fair.away;
  }
  const fair = fairPair(
    match.odds.openingOver25 ?? match.odds.closingOver25,
    match.odds.openingUnder25 ?? match.odds.closingUnder25
  );
  if (!fair) return null;
  return market === 'OVER_25' ? fair.over : fair.under;
}

function resultForTeam(match: NormalizedMatch, team: string) {
  const home = teamKey(match.homeTeam) === teamKey(team);
  const scored = home ? match.homeGoals : match.awayGoals;
  const conceded = home ? match.awayGoals : match.homeGoals;
  return scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
}

function recentRows(matches: NormalizedMatch[], team: string, venue: 'home' | 'away' | 'all', limit = 10) {
  const key = teamKey(team);
  return matches
    .filter((match) => venue === 'home'
      ? teamKey(match.homeTeam) === key
      : venue === 'away'
        ? teamKey(match.awayTeam) === key
        : teamKey(match.homeTeam) === key || teamKey(match.awayTeam) === key)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

function teamAlignment(matches: NormalizedMatch[], fixture: UpcomingFixture, market: ChronosMarket) {
  const homeRows = recentRows(matches, fixture.homeTeam, 'home');
  const awayRows = recentRows(matches, fixture.awayTeam, 'away');
  if (homeRows.length < 4 || awayRows.length < 4) return 0.5;
  if (market === 'HOME_WIN') {
    const homeWins = homeRows.filter((match) => resultForTeam(match, fixture.homeTeam) === 'W').length / homeRows.length;
    const awayLosses = awayRows.filter((match) => resultForTeam(match, fixture.awayTeam) === 'L').length / awayRows.length;
    return (homeWins + awayLosses) / 2;
  }
  if (market === 'AWAY_WIN') {
    const awayWins = awayRows.filter((match) => resultForTeam(match, fixture.awayTeam) === 'W').length / awayRows.length;
    const homeLosses = homeRows.filter((match) => resultForTeam(match, fixture.homeTeam) === 'L').length / homeRows.length;
    return (awayWins + homeLosses) / 2;
  }
  const rate = (rows: NormalizedMatch[]) => rows.filter((match) => {
    const total = match.homeGoals + match.awayGoals;
    return market === 'OVER_25' ? total >= 3 : total <= 2;
  }).length / rows.length;
  return (rate(homeRows) + rate(awayRows)) / 2;
}

function evaluate(fixture: UpcomingFixture, matches: NormalizedMatch[], market: ChronosMarket): Candidate | null {
  const odds = currentOdd(fixture, market);
  const target = targetShape(fixture, market);
  if (!odds || target == null || odds > 3.60) return null;

  const prior = matches.filter((match) => match.date < fixture.date && historicalOdd(match, market));
  const sameLeagueRows = prior.filter((match) => sameLeague(match.leagueName, fixture.leagueName));
  const pool = sameLeagueRows.length >= 80 ? sameLeagueRows : prior;
  const rows = pool
    .map((match) => {
      const shape = historicalShape(match, market);
      if (shape == null) return null;
      const leaguePenalty = sameLeague(match.leagueName, fixture.leagueName) ? 0 : 0.03;
      return { match, distance: Math.abs(target - shape) + leaguePenalty };
    })
    .filter((row): row is { match: NormalizedMatch; distance: number } => Boolean(row))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 140);
  if (rows.length < 60) return null;

  const hitRate = rows.filter((row) => landed(row.match, market)).length / rows.length;
  const averageDistance = average(rows.map((row) => row.distance), 1);
  const similarity = clamp(1 - averageDistance / 0.22);
  const teamRate = teamAlignment(prior, fixture, market);
  const score = hitRate * 55 + teamRate * 25 + similarity * 20;
  if (hitRate < 0.54 || similarity < 0.28 || score < 64) return null;
  return { marketKey: market, odds, hitRate, sample: rows.length, similarity, teamRate, score };
}

function selection(fixture: UpcomingFixture, market: ChronosMarket) {
  if (market === 'HOME_WIN') return `${fixture.homeTeam} to win`;
  if (market === 'AWAY_WIN') return `${fixture.awayTeam} to win`;
  if (market === 'OVER_25') return 'Over 2.5 goals';
  return 'Under 2.5 goals';
}

export function buildChronosPick(fixture: UpcomingFixture, historicalMatches: NormalizedMatch[]): GodPublicPick | null {
  const candidates = (['HOME_WIN', 'AWAY_WIN', 'OVER_25', 'UNDER_25'] as ChronosMarket[])
    .map((market) => evaluate(fixture, historicalMatches, market))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || b.hitRate - a.hitRate);
  const chosen = candidates[0];
  if (!chosen) return null;
  const banker = chosen.score >= 77
    && chosen.hitRate >= 0.59
    && chosen.teamRate >= 0.54
    && chosen.similarity >= 0.50
    && chosen.sample >= 80;
  return {
    fixtureId: fixture.id,
    engineVersion: OLYMPIAN_ENGINE_VERSION,
    god: 'chronos',
    date: fixture.date,
    kickoff: fixture.kickoff,
    leagueCode: fixture.leagueCode,
    leagueName: fixture.leagueName,
    country: fixture.country,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    selection: selection(fixture, chosen.marketKey),
    marketKey: chosen.marketKey,
    score: round(chosen.score),
    banker,
    odds: round(chosen.odds, 2),
    statsLine: `History ${Math.round(chosen.hitRate * 100)}% · ${chosen.sample} matches`,
    sourceGods: ['chronos'],
    settledStatus: 'pending'
  };
}
