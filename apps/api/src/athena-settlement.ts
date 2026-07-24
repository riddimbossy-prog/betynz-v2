import type { NormalizedMatch } from './types.js';
import type { AthenaShadowRun, AthenaSettlementStatus } from './athena-types.js';
import { ATHENA_ENGINE_VERSION, ATHENA_MARKETS } from './athena-transition.js';
import { listPendingAthenaShadowRuns, updateAthenaShadowSettlement } from './store.js';
import { sameLeague, teamKey } from './identity.js';

function settleAthenaMarket(run: AthenaShadowRun, match: NormalizedMatch): AthenaSettlementStatus {
  const total = match.homeGoals + match.awayGoals;
  const htAvailable = typeof match.halfTimeHomeGoals === 'number' && typeof match.halfTimeAwayGoals === 'number';
  const htHome = match.halfTimeHomeGoals ?? 0;
  const htAway = match.halfTimeAwayGoals ?? 0;
  const secondHalfHome = match.homeGoals - htHome;
  const secondHalfAway = match.awayGoals - htAway;

  switch (run.marketKey) {
    case ATHENA_MARKETS.NO_PICK: return 'void';
    case ATHENA_MARKETS.HOME_WIN_EITHER_HALF:
      if (!htAvailable) return 'void';
      return htHome > htAway || secondHalfHome > secondHalfAway ? 'won' : 'lost';
    case ATHENA_MARKETS.AWAY_WIN_EITHER_HALF:
      if (!htAvailable) return 'void';
      return htAway > htHome || secondHalfAway > secondHalfHome ? 'won' : 'lost';
    case ATHENA_MARKETS.HOME_DNB: return match.result === 'D' ? 'void' : match.result === 'H' ? 'won' : 'lost';
    case ATHENA_MARKETS.AWAY_DNB: return match.result === 'D' ? 'void' : match.result === 'A' ? 'won' : 'lost';
    case ATHENA_MARKETS.HOME_DOUBLE_CHANCE: return match.result === 'A' ? 'lost' : 'won';
    case ATHENA_MARKETS.AWAY_DOUBLE_CHANCE: return match.result === 'H' ? 'lost' : 'won';
    case ATHENA_MARKETS.HOME_OVER_0_5: return match.homeGoals >= 1 ? 'won' : 'lost';
    case ATHENA_MARKETS.AWAY_OVER_0_5: return match.awayGoals >= 1 ? 'won' : 'lost';
    case ATHENA_MARKETS.OVER_1_5: return total >= 2 ? 'won' : 'lost';
    case ATHENA_MARKETS.OVER_2_5: return total >= 3 ? 'won' : 'lost';
    case ATHENA_MARKETS.UNDER_2_5: return total <= 2 ? 'won' : 'lost';
    case ATHENA_MARKETS.UNDER_3_5: return total <= 3 ? 'won' : 'lost';
    case ATHENA_MARKETS.FIRST_HALF_UNDER_1_5:
      if (!htAvailable) return 'void';
      return htHome + htAway <= 1 ? 'won' : 'lost';
    case ATHENA_MARKETS.FIRST_HALF_OVER_0_5:
      if (!htAvailable) return 'void';
      return htHome + htAway >= 1 ? 'won' : 'lost';
    case ATHENA_MARKETS.HALF_TIME_DRAW:
      if (!htAvailable) return 'void';
      return htHome === htAway ? 'won' : 'lost';
    case ATHENA_MARKETS.FULL_TIME_DRAW: return match.result === 'D' ? 'won' : 'lost';
    case ATHENA_MARKETS.BTTS_YES: return match.homeGoals >= 1 && match.awayGoals >= 1 ? 'won' : 'lost';
  }
  return 'void';
}

export async function settleAthenaShadowRunsFromMatches(matches: NormalizedMatch[]) {
  if (!matches.length) return 0;
  const dates = matches.map((match) => match.date).sort();
  const pending = await listPendingAthenaShadowRuns(dates[0], dates[dates.length - 1]);
  let settled = 0;
  for (const run of pending) {
    const match = matches.find((candidate) =>
      candidate.date === run.date
      && sameLeague(candidate.leagueName, run.leagueName)
      && teamKey(candidate.homeTeam) === teamKey(run.homeTeam)
      && teamKey(candidate.awayTeam) === teamKey(run.awayTeam)
    );
    if (!match) continue;
    await updateAthenaShadowSettlement(run.fixtureId, run.engineVersion || ATHENA_ENGINE_VERSION, settleAthenaMarket(run, match));
    settled += 1;
  }
  return settled;
}
