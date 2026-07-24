import type { NormalizedMatch } from './types.js';
import type { MarketKey, PredictionRecord } from './forecast-types.js';
import { listPendingPredictions, updatePredictionSettlement } from './store.js';
import { sameLeague, teamKey } from './identity.js';

function settleMarket(prediction: PredictionRecord, match: NormalizedMatch): 'won' | 'lost' | 'void' {
  const total = match.homeGoals + match.awayGoals;
  const market = prediction.marketKey as MarketKey;
  switch (market) {
    case 'HOME_OVER_05': return match.homeGoals >= 1 ? 'won' : 'lost';
    case 'AWAY_OVER_05': return match.awayGoals >= 1 ? 'won' : 'lost';
    case 'OVER_15': return total >= 2 ? 'won' : 'lost';
    case 'UNDER_35': return total <= 3 ? 'won' : 'lost';
    case 'OVER_25': return total >= 3 ? 'won' : 'lost';
    case 'UNDER_25': return total <= 2 ? 'won' : 'lost';
    case 'HOME_OVER_15': return match.homeGoals >= 2 ? 'won' : 'lost';
    case 'AWAY_OVER_15': return match.awayGoals >= 2 ? 'won' : 'lost';
    case 'DOUBLE_CHANCE_1X': return match.result === 'A' ? 'lost' : 'won';
    case 'DOUBLE_CHANCE_X2': return match.result === 'H' ? 'lost' : 'won';
    case 'HOME_DNB': return match.result === 'D' ? 'void' : match.result === 'H' ? 'won' : 'lost';
    case 'AWAY_DNB': return match.result === 'D' ? 'void' : match.result === 'A' ? 'won' : 'lost';
    case 'HOME_WIN': return match.result === 'H' ? 'won' : 'lost';
    case 'AWAY_WIN': return match.result === 'A' ? 'won' : 'lost';
  }
}

export async function settlePredictionsFromMatches(matches: NormalizedMatch[]) {
  if (!matches.length) return 0;
  const dates = matches.map((match) => match.date).sort();
  const pending = await listPendingPredictions(dates[0], dates[dates.length - 1]);
  let settled = 0;
  for (const prediction of pending) {
    const match = matches.find((candidate) =>
      candidate.date === prediction.date
      && sameLeague(candidate.leagueName, prediction.leagueName)
      && teamKey(candidate.homeTeam) === teamKey(prediction.homeTeam)
      && teamKey(candidate.awayTeam) === teamKey(prediction.awayTeam)
    );
    if (!match) continue;
    await updatePredictionSettlement(prediction.fixtureId, settleMarket(prediction, match));
    settled += 1;
  }
  return settled;
}
