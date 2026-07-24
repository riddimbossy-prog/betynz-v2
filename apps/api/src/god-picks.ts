import type { AthenaShadowRun } from './athena-types.js';
import { ATHENA_MARKETS } from './athena-transition.js';
import type { GodKey, GodPublicPick, PredictionRecord, UpcomingFixture } from './forecast-types.js';
import { OLYMPIAN_ENGINE_VERSION, ZEUS_MAX_ODDS_EXCLUSIVE } from './olympian-version.js';

export { OLYMPIAN_ENGINE_VERSION, ZEUS_MAX_ODDS_EXCLUSIVE } from './olympian-version.js';

const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : null;
}

function chronosStatsLine(prediction: PredictionRecord) {
  const hit = percent(prediction.evidence.historicalHitRate);
  const sample = Number(prediction.sample);
  const parts: string[] = [];
  if (hit) parts.push(`History ${hit}`);
  if (Number.isFinite(sample) && sample > 0) parts.push(`${sample} matches`);
  return parts.join(' · ') || 'Historical pattern';
}

export function buildChronosPicks(predictions: PredictionRecord[]) {
  return predictions
    .filter((prediction) => prediction.tier === 'full')
    .filter((prediction) => prediction.engines.some((engine) => engine.key === 'chronos' && engine.pass))
    .filter((prediction) => prediction.sample >= 60 && Number(prediction.evidence.historicalHitRate ?? 0) >= 54)
    .map<GodPublicPick>((prediction) => {
      const chronos = prediction.engines.find((engine) => engine.key === 'chronos');
      const score = chronos?.score ?? prediction.confidence;
      const banker = Boolean(prediction.banker)
        || (score >= 78 && prediction.confidence >= 78 && prediction.sample >= 80 && prediction.edge >= 1.5);
      return {
        fixtureId: prediction.fixtureId,
        engineVersion: OLYMPIAN_ENGINE_VERSION,
        god: 'chronos',
        date: prediction.date,
        kickoff: prediction.kickoff,
        leagueCode: prediction.leagueCode,
        leagueName: prediction.leagueName,
        country: prediction.country,
        homeTeam: prediction.homeTeam,
        awayTeam: prediction.awayTeam,
        selection: prediction.selection,
        marketKey: prediction.marketKey,
        score: round(score),
        banker,
        odds: Number.isFinite(prediction.odds) ? round(prediction.odds, 2) : undefined,
        statsLine: chronosStatsLine(prediction),
        sourceGods: ['chronos'],
        settledStatus: prediction.settledStatus
      };
    });
}

function athenaStatsLine(run: AthenaShadowRun) {
  const home = run.metrics?.home;
  const away = run.metrics?.away;
  const parts: string[] = [];
  if (Number.isFinite(Number(home?.under25Rate)) && Number.isFinite(Number(away?.under25Rate))) {
    parts.push(`U2.5 ${Math.round(Number(home.under25Rate) * 100)}% / ${Math.round(Number(away.under25Rate) * 100)}%`);
  }
  if (Number.isFinite(Number(home?.htDrawRate)) && Number.isFinite(Number(away?.htDrawRate))) {
    parts.push(`HT draw ${Math.round(Number(home.htDrawRate) * 100)}% / ${Math.round(Number(away.htDrawRate) * 100)}%`);
  }
  if (!parts.length && Number.isFinite(Number(home?.averageTotalGoals)) && Number.isFinite(Number(away?.averageTotalGoals))) {
    parts.push(`Avg goals ${Number(home.averageTotalGoals).toFixed(1)} / ${Number(away.averageTotalGoals).toFixed(1)}`);
  }
  return parts.slice(0, 1).join('') || 'HT/FT transition';
}

function athenaOdd(run: AthenaShadowRun, fixture?: UpcomingFixture) {
  if (!fixture) return undefined;
  const odds = fixture.odds;
  const map: Record<string, number | undefined> = {
    HOME_DNB: odds.homeDnb,
    AWAY_DNB: odds.awayDnb,
    HOME_OR_DRAW: odds.dc1x,
    AWAY_OR_DRAW: odds.dcx2,
    HOME_TEAM_OVER_0_5: odds.homeOver05,
    AWAY_TEAM_OVER_0_5: odds.awayOver05,
    OVER_1_5: odds.over15,
    OVER_2_5: odds.over25,
    UNDER_2_5: odds.under25,
    UNDER_3_5: odds.under35,
    FULL_TIME_DRAW: odds.draw,
    HOME_WIN_EITHER_HALF: undefined,
    AWAY_WIN_EITHER_HALF: undefined,
    FIRST_HALF_UNDER_1_5: undefined,
    FIRST_HALF_OVER_0_5: undefined,
    HALF_TIME_DRAW: undefined,
    BTTS_YES: undefined
  };
  const value = map[run.marketKey];
  return value && Number.isFinite(value) && value > 1 ? round(value, 2) : undefined;
}

export function buildAthenaPicks(runs: AthenaShadowRun[], fixtures: UpcomingFixture[]) {
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  return runs
    .filter((run) => run.marketKey !== ATHENA_MARKETS.NO_PICK)
    .map<GodPublicPick>((run) => ({
      fixtureId: run.fixtureId,
      engineVersion: OLYMPIAN_ENGINE_VERSION,
      god: 'athena',
      date: run.date,
      kickoff: run.kickoff,
      leagueCode: run.leagueCode,
      leagueName: run.leagueName,
      country: run.country,
      homeTeam: run.homeTeam,
      awayTeam: run.awayTeam,
      selection: run.marketLabel,
      marketKey: run.marketKey,
      score: round(run.score),
      banker: run.banker,
      odds: athenaOdd(run, fixtureById.get(run.fixtureId)),
      statsLine: athenaStatsLine(run),
      sourceGods: ['athena'],
      settledStatus: run.settledStatus
    }));
}

function family(marketKey: string) {
  if (/^HOME_(WIN|DNB)/.test(marketKey) || marketKey === 'DOUBLE_CHANCE_1X' || marketKey === 'HOME_OR_DRAW') return 'home';
  if (/^AWAY_(WIN|DNB)/.test(marketKey) || marketKey === 'DOUBLE_CHANCE_X2' || marketKey === 'AWAY_OR_DRAW') return 'away';
  if (marketKey.startsWith('OVER_')) return 'over';
  if (marketKey.startsWith('UNDER_')) return 'under';
  if (marketKey === 'FULL_TIME_DRAW') return 'draw';
  return 'other';
}

function hasConflict(picks: GodPublicPick[]) {
  const families = new Set(picks.map((pick) => family(pick.marketKey)));
  if (families.has('home') && families.has('away')) return true;
  if (families.has('over') && families.has('under')) return true;
  if (families.has('draw') && (families.has('home') || families.has('away'))) return true;
  return false;
}

function godName(god: GodKey) {
  return god.charAt(0).toUpperCase() + god.slice(1);
}

function normalizeForZeus(pick: GodPublicPick, fixture?: UpcomingFixture): GodPublicPick | null {
  if (typeof pick.odds === 'number' && pick.odds > 1) return pick;
  if (!fixture) return null;
  if (pick.marketKey === 'HOME_WIN_EITHER_HALF') {
    if (fixture.odds.homeDnb && fixture.odds.homeDnb > 1) {
      return { ...pick, marketKey: 'HOME_DNB', selection: `${pick.homeTeam} draw no bet`, odds: round(fixture.odds.homeDnb, 2) };
    }
    if (fixture.odds.dc1x && fixture.odds.dc1x > 1) {
      return { ...pick, marketKey: 'HOME_OR_DRAW', selection: `${pick.homeTeam} or draw`, odds: round(fixture.odds.dc1x, 2) };
    }
  }
  if (pick.marketKey === 'AWAY_WIN_EITHER_HALF') {
    if (fixture.odds.awayDnb && fixture.odds.awayDnb > 1) {
      return { ...pick, marketKey: 'AWAY_DNB', selection: `${pick.awayTeam} draw no bet`, odds: round(fixture.odds.awayDnb, 2) };
    }
    if (fixture.odds.dcx2 && fixture.odds.dcx2 > 1) {
      return { ...pick, marketKey: 'AWAY_OR_DRAW', selection: `${pick.awayTeam} or draw`, odds: round(fixture.odds.dcx2, 2) };
    }
  }
  return null;
}

export function buildZeusAutoPicks(input: GodPublicPick[], fixtures: UpcomingFixture[] = []) {
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const eligible = input.filter((pick) => pick.god !== 'zeus')
    .filter((pick) => pick.banker)
    .map((pick) => normalizeForZeus(pick, fixtureById.get(pick.fixtureId)))
    .filter((pick): pick is GodPublicPick => Boolean(pick))
    .filter((pick) => typeof pick.odds === 'number' && pick.odds > 1 && pick.odds < ZEUS_MAX_ODDS_EXCLUSIVE);
  const byFixture = new Map<string, GodPublicPick[]>();
  for (const pick of eligible) {
    const rows = byFixture.get(pick.fixtureId) ?? [];
    rows.push(pick);
    byFixture.set(pick.fixtureId, rows);
  }

  const output: GodPublicPick[] = [];
  for (const rows of byFixture.values()) {
    if (hasConflict(rows)) continue;
    const exact = new Map<string, GodPublicPick[]>();
    for (const row of rows) {
      const key = `${row.marketKey}|${row.selection.toLowerCase()}`;
      const group = exact.get(key) ?? [];
      group.push(row);
      exact.set(key, group);
    }
    const ranked = [...exact.values()].sort((a, b) => {
      const support = b.length - a.length;
      if (support) return support;
      const scoreA = a.reduce((sum, item) => sum + item.score, 0) / a.length;
      const scoreB = b.reduce((sum, item) => sum + item.score, 0) / b.length;
      return scoreB - scoreA;
    });
    const winners = ranked[0];
    if (!winners?.length) continue;
    const base = [...winners].sort((a, b) => b.score - a.score)[0];
    const sourceGods = [...new Set(winners.map((pick) => pick.god).filter((god): god is Exclude<GodKey, 'zeus'> => god !== 'zeus'))];
    const averageScore = winners.reduce((sum, pick) => sum + pick.score, 0) / winners.length;
    const score = Math.min(99, averageScore + Math.max(0, sourceGods.length - 1) * 7);
    const statsLine = sourceGods.length > 1
      ? `${sourceGods.length} gods agree`
      : `${godName(sourceGods[0] ?? base.god)} banker`;
    output.push({
      ...base,
      engineVersion: OLYMPIAN_ENGINE_VERSION,
      god: 'zeus',
      score: round(score),
      banker: true,
      statsLine,
      sourceGods
    });
  }
  return output.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}
