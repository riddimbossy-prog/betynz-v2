import type { NormalizedMatch } from './types.js';
import type { EngineSignal, MarketKey, PredictionRecord, UpcomingFixture, UpcomingOdds } from './forecast-types.js';
import { sameLeague, teamKey } from './identity.js';

export const ENGINE_VERSION = 'chronos-fusion-2.5.0';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pct = (wins: number, sample: number, fallback = 0.5) => sample ? wins / sample : fallback;
const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));
const average = (values: number[], fallback = 0) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback;

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function fairThreeWay(odds: UpcomingOdds) {
  if (!odds.home || !odds.draw || !odds.away) return null;
  const raw = [1 / odds.home, 1 / odds.draw, 1 / odds.away];
  const sum = raw.reduce((a, b) => a + b, 0);
  return { home: raw[0] / sum, draw: raw[1] / sum, away: raw[2] / sum };
}

function fairPair(a?: number, b?: number) {
  if (!a) return null;
  if (!b) return clamp(1 / a, 0.02, 0.98);
  const pa = 1 / a;
  const pb = 1 / b;
  return pa / (pa + pb);
}

function outcome(match: NormalizedMatch, market: MarketKey) {
  const total = match.homeGoals + match.awayGoals;
  switch (market) {
    case 'HOME_OVER_05': return match.homeGoals >= 1;
    case 'AWAY_OVER_05': return match.awayGoals >= 1;
    case 'OVER_15': return total >= 2;
    case 'UNDER_35': return total <= 3;
    case 'OVER_25': return total >= 3;
    case 'UNDER_25': return total <= 2;
    case 'HOME_OVER_15': return match.homeGoals >= 2;
    case 'AWAY_OVER_15': return match.awayGoals >= 2;
    case 'DOUBLE_CHANCE_1X': return match.result !== 'A';
    case 'DOUBLE_CHANCE_X2': return match.result !== 'H';
    case 'HOME_DNB': return match.result === 'H';
    case 'AWAY_DNB': return match.result === 'A';
    case 'HOME_WIN': return match.result === 'H';
    case 'AWAY_WIN': return match.result === 'A';
  }
}

function openingFair(match: NormalizedMatch) {
  const { openingHome: h, openingDraw: d, openingAway: a } = match.odds;
  if (!h || !d || !a) return null;
  const raw = [1 / h, 1 / d, 1 / a];
  const sum = raw.reduce((x, y) => x + y, 0);
  return { home: raw[0] / sum, draw: raw[1] / sum, away: raw[2] / sum };
}

function poisson(lambda: number, max = 8) {
  const values: number[] = [];
  let factorial = 1;
  for (let k = 0; k <= max; k += 1) {
    if (k > 0) factorial *= k;
    values.push(Math.exp(-lambda) * (lambda ** k) / factorial);
  }
  const tail = 1 - values.reduce((a, b) => a + b, 0);
  values[max] += Math.max(0, tail);
  return values;
}

function poissonMarkets(homeXg: number, awayXg: number) {
  const home = poisson(homeXg);
  const away = poisson(awayXg);
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let under35 = 0;
  let homeOver05 = 0;
  let awayOver05 = 0;
  let homeOver15 = 0;
  let awayOver15 = 0;
  for (let h = 0; h < home.length; h += 1) {
    for (let a = 0; a < away.length; a += 1) {
      const p = home[h] * away[a];
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a >= 2) over15 += p;
      if (h + a >= 3) over25 += p;
      if (h + a <= 3) under35 += p;
      if (h >= 1) homeOver05 += p;
      if (a >= 1) awayOver05 += p;
      if (h >= 2) homeOver15 += p;
      if (a >= 2) awayOver15 += p;
    }
  }
  return {
    homeWin,
    draw,
    awayWin,
    over15,
    under35,
    over25,
    under25: 1 - over25,
    homeOver05,
    awayOver05,
    homeOver15,
    awayOver15,
    dc1x: homeWin + draw,
    dcx2: awayWin + draw
  };
}

type TeamSlice = {
  matches: NormalizedMatch[];
  ppg: number;
  gf: number;
  ga: number;
  scoreRate: number;
  concedeRate: number;
  over15: number;
  over25: number;
  under25: number;
  under35: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  cleanSheetRate: number;
  failToScoreRate: number;
  shotsOnTargetFor: number;
  shotsOnTargetAgainst: number;
};

function teamSlice(matches: NormalizedMatch[], team: string, venue: 'home' | 'away' | 'all', limit = 10): TeamSlice {
  const key = teamKey(team);
  const rows = matches
    .filter((match) => venue === 'home' ? teamKey(match.homeTeam) === key : venue === 'away' ? teamKey(match.awayTeam) === key : teamKey(match.homeTeam) === key || teamKey(match.awayTeam) === key)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  let points = 0;
  let gf = 0;
  let ga = 0;
  let scored = 0;
  let conceded = 0;
  let over15 = 0;
  let over25 = 0;
  let under25 = 0;
  let under35 = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let clean = 0;
  let failed = 0;
  const sotFor: number[] = [];
  const sotAgainst: number[] = [];

  for (const match of rows) {
    const isHome = teamKey(match.homeTeam) === key;
    const teamGoals = isHome ? match.homeGoals : match.awayGoals;
    const opponentGoals = isHome ? match.awayGoals : match.homeGoals;
    const won = teamGoals > opponentGoals;
    const drew = teamGoals === opponentGoals;
    points += won ? 3 : drew ? 1 : 0;
    gf += teamGoals;
    ga += opponentGoals;
    scored += teamGoals > 0 ? 1 : 0;
    conceded += opponentGoals > 0 ? 1 : 0;
    over15 += teamGoals + opponentGoals >= 2 ? 1 : 0;
    over25 += teamGoals + opponentGoals >= 3 ? 1 : 0;
    under25 += teamGoals + opponentGoals <= 2 ? 1 : 0;
    under35 += teamGoals + opponentGoals <= 3 ? 1 : 0;
    wins += won ? 1 : 0;
    draws += drew ? 1 : 0;
    losses += !won && !drew ? 1 : 0;
    clean += opponentGoals === 0 ? 1 : 0;
    failed += teamGoals === 0 ? 1 : 0;
    const forSot = isHome ? match.stats?.homeShotsOnTarget : match.stats?.awayShotsOnTarget;
    const againstSot = isHome ? match.stats?.awayShotsOnTarget : match.stats?.homeShotsOnTarget;
    if (typeof forSot === 'number') sotFor.push(forSot);
    if (typeof againstSot === 'number') sotAgainst.push(againstSot);
  }

  const sample = rows.length;
  return {
    matches: rows,
    ppg: sample ? points / sample : 1.25,
    gf: sample ? gf / sample : 1.2,
    ga: sample ? ga / sample : 1.2,
    scoreRate: pct(scored, sample, 0.7),
    concedeRate: pct(conceded, sample, 0.7),
    over15: pct(over15, sample, 0.72),
    over25: pct(over25, sample, 0.5),
    under25: pct(under25, sample, 0.5),
    under35: pct(under35, sample, 0.72),
    winRate: pct(wins, sample, 0.34),
    drawRate: pct(draws, sample, 0.28),
    lossRate: pct(losses, sample, 0.34),
    cleanSheetRate: pct(clean, sample, 0.25),
    failToScoreRate: pct(failed, sample, 0.25),
    shotsOnTargetFor: average(sotFor, 4),
    shotsOnTargetAgainst: average(sotAgainst, 4)
  };
}

type LeagueProfile = {
  sample: number;
  homeGoals: number;
  awayGoals: number;
  over15: number;
  over25: number;
  under25: number;
  under35: number;
  homeScore: number;
  awayScore: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  tag: string;
};

function leagueProfile(matches: NormalizedMatch[], leagueName: string): LeagueProfile {
  const rows = matches.filter((match) => sameLeague(match.leagueName, leagueName)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 500);
  const sample = rows.length;
  const homeGoals = average(rows.map((m) => m.homeGoals), 1.4);
  const awayGoals = average(rows.map((m) => m.awayGoals), 1.1);
  const over25Rate = pct(rows.filter((m) => m.homeGoals + m.awayGoals >= 3).length, sample, 0.5);
  const drawRate = pct(rows.filter((m) => m.result === 'D').length, sample, 0.28);
  const homeWinRate = pct(rows.filter((m) => m.result === 'H').length, sample, 0.42);
  const avgGoals = homeGoals + awayGoals;
  const tag = avgGoals >= 2.8 && over25Rate >= 0.55 ? 'high-scoring' : avgGoals <= 2.4 ? 'low-scoring' : drawRate >= 0.3 ? 'draw-heavy' : homeWinRate >= 0.46 ? 'home-leaning' : 'balanced';
  return {
    sample,
    homeGoals,
    awayGoals,
    over15: pct(rows.filter((m) => m.homeGoals + m.awayGoals >= 2).length, sample, 0.72),
    over25: over25Rate,
    under25: pct(rows.filter((m) => m.homeGoals + m.awayGoals <= 2).length, sample, 0.5),
    under35: pct(rows.filter((m) => m.homeGoals + m.awayGoals <= 3).length, sample, 0.72),
    homeScore: pct(rows.filter((m) => m.homeGoals >= 1).length, sample, 0.78),
    awayScore: pct(rows.filter((m) => m.awayGoals >= 1).length, sample, 0.66),
    homeWin: homeWinRate,
    draw: drawRate,
    awayWin: pct(rows.filter((m) => m.result === 'A').length, sample, 0.3),
    tag
  };
}

type TableEntry = { team: string; played: number; points: number; gf: number; ga: number; wins: number; draws: number; losses: number };

function seasonMatchesForFixture(matches: NormalizedMatch[], fixture: UpcomingFixture) {
  const year = fixture.season.slice(0, 4);
  return matches.filter((match) => sameLeague(match.leagueName, fixture.leagueName) && (match.season === fixture.season || match.season.startsWith(year)) && match.date < fixture.date);
}

function standings(matches: NormalizedMatch[]) {
  const map = new Map<string, TableEntry>();
  const touch = (team: string) => {
    const key = teamKey(team);
    const current = map.get(key) ?? { team, played: 0, points: 0, gf: 0, ga: 0, wins: 0, draws: 0, losses: 0 };
    map.set(key, current);
    return current;
  };
  for (const match of matches) {
    const home = touch(match.homeTeam);
    const away = touch(match.awayTeam);
    home.played += 1; away.played += 1;
    home.gf += match.homeGoals; home.ga += match.awayGoals;
    away.gf += match.awayGoals; away.ga += match.homeGoals;
    if (match.result === 'H') { home.points += 3; home.wins += 1; away.losses += 1; }
    else if (match.result === 'A') { away.points += 3; away.wins += 1; home.losses += 1; }
    else { home.points += 1; away.points += 1; home.draws += 1; away.draws += 1; }
  }
  return [...map.values()].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

function motivation(table: TableEntry[], team: string) {
  const key = teamKey(team);
  const index = table.findIndex((entry) => teamKey(entry.team) === key);
  if (index < 0 || table.length < 8) return { label: 'normal', adjustment: 0, position: null as number | null, points: null as number | null };
  const entry = table[index];
  const maxMatches = Math.max(1, (table.length - 1) * 2);
  const progress = entry.played / maxMatches;
  if (progress < 0.65) return { label: 'normal', adjustment: 0, position: index + 1, points: entry.points };
  const leader = table[0];
  const safetyIndex = Math.max(0, table.length - 3 - 1);
  const safety = table[safetyIndex];
  if (leader.points - entry.points <= 6 && index <= 2) return { label: 'title pressure', adjustment: 0.018, position: index + 1, points: entry.points };
  if (index >= table.length - 3 && safety.points - entry.points <= 6) return { label: 'relegation pressure', adjustment: 0.012, position: index + 1, points: entry.points };
  return { label: 'normal', adjustment: 0, position: index + 1, points: entry.points };
}

function historicalNeighbors(matches: NormalizedMatch[], fixture: UpcomingFixture, market: MarketKey) {
  const target = fairThreeWay(fixture.odds);
  const targetO25 = fairPair(fixture.odds.over25, fixture.odds.under25);
  const rows = matches
    .filter((match) => sameLeague(match.leagueName, fixture.leagueName) && openingFair(match))
    .map((match) => {
      const fair = openingFair(match)!;
      const o25 = match.odds.openingOver25 && match.odds.openingUnder25
        ? fairPair(match.odds.openingOver25, match.odds.openingUnder25)
        : null;
      const threeWayDistance = target
        ? Math.abs(target.home - fair.home) + Math.abs(target.draw - fair.draw) + Math.abs(target.away - fair.away)
        : 0.35;
      const totalDistance = targetO25 && o25 ? Math.abs(targetO25 - o25) : 0.08;
      return { match, distance: threeWayDistance * 0.75 + totalDistance * 0.25 };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 160);
  const wins = rows.filter((row) => outcome(row.match, market)).length;
  return { sample: rows.length, hitRate: pct(wins, rows.length, 0.5), averageDistance: average(rows.map((row) => row.distance), 0.3) };
}

function expectedGoals(league: LeagueProfile, homeVenue: TeamSlice, awayVenue: TeamSlice, homeRecent: TeamSlice, awayRecent: TeamSlice) {
  const homeAttack = clamp(homeVenue.gf / Math.max(league.homeGoals, 0.5), 0.35, 2.4);
  const awayDefenceWeakness = clamp(awayVenue.ga / Math.max(league.homeGoals, 0.5), 0.35, 2.4);
  const awayAttack = clamp(awayVenue.gf / Math.max(league.awayGoals, 0.4), 0.35, 2.4);
  const homeDefenceWeakness = clamp(homeVenue.ga / Math.max(league.awayGoals, 0.4), 0.35, 2.4);
  const recentHomeFactor = clamp((homeRecent.gf + 0.35) / Math.max(homeVenue.gf + 0.35, 0.35), 0.8, 1.2);
  const recentAwayFactor = clamp((awayRecent.gf + 0.35) / Math.max(awayVenue.gf + 0.35, 0.35), 0.8, 1.2);
  const home = clamp(league.homeGoals * Math.sqrt(homeAttack * awayDefenceWeakness) * recentHomeFactor, 0.2, 3.4);
  const away = clamp(league.awayGoals * Math.sqrt(awayAttack * homeDefenceWeakness) * recentAwayFactor, 0.15, 3.0);
  return { home, away };
}

function marketOdd(odds: UpcomingOdds, market: MarketKey) {
  switch (market) {
    case 'HOME_OVER_05': return odds.homeOver05;
    case 'AWAY_OVER_05': return odds.awayOver05;
    case 'OVER_15': return odds.over15;
    case 'UNDER_35': return odds.under35;
    case 'DOUBLE_CHANCE_1X': return odds.dc1x;
    case 'DOUBLE_CHANCE_X2': return odds.dcx2;
    case 'OVER_25': return odds.over25;
    case 'UNDER_25': return odds.under25;
    case 'HOME_OVER_15': return odds.homeOver15;
    case 'AWAY_OVER_15': return odds.awayOver15;
    case 'HOME_DNB': return odds.homeDnb;
    case 'AWAY_DNB': return odds.awayDnb;
    case 'HOME_WIN': return odds.home;
    case 'AWAY_WIN': return odds.away;
  }
}

function marketFair(odds: UpcomingOdds, market: MarketKey) {
  const oneXtwo = fairThreeWay(odds);
  switch (market) {
    case 'HOME_OVER_05': return fairPair(odds.homeOver05, odds.homeUnder05);
    case 'AWAY_OVER_05': return fairPair(odds.awayOver05, odds.awayUnder05);
    case 'OVER_15': return fairPair(odds.over15, odds.under15);
    case 'UNDER_35': return fairPair(odds.under35, odds.over35);
    case 'OVER_25': return fairPair(odds.over25, odds.under25);
    case 'UNDER_25': return fairPair(odds.under25, odds.over25);
    case 'HOME_OVER_15': return fairPair(odds.homeOver15, odds.homeUnder15);
    case 'AWAY_OVER_15': return fairPair(odds.awayOver15, odds.awayUnder15);
    case 'DOUBLE_CHANCE_1X': return odds.dc1x ? clamp(1 / odds.dc1x) : oneXtwo ? oneXtwo.home + oneXtwo.draw : null;
    case 'DOUBLE_CHANCE_X2': return odds.dcx2 ? clamp(1 / odds.dcx2) : oneXtwo ? oneXtwo.away + oneXtwo.draw : null;
    case 'HOME_DNB': return fairPair(odds.homeDnb, odds.awayDnb);
    case 'AWAY_DNB': return fairPair(odds.awayDnb, odds.homeDnb);
    case 'HOME_WIN': return oneXtwo?.home ?? null;
    case 'AWAY_WIN': return oneXtwo?.away ?? null;
  }
}

function label(market: MarketKey, fixture: UpcomingFixture) {
  switch (market) {
    case 'HOME_OVER_05': return `${fixture.homeTeam} over 0.5 team goals`;
    case 'AWAY_OVER_05': return `${fixture.awayTeam} over 0.5 team goals`;
    case 'OVER_15': return 'Over 1.5 total goals';
    case 'UNDER_35': return 'Under 3.5 total goals';
    case 'DOUBLE_CHANCE_1X': return `${fixture.homeTeam} or draw`;
    case 'DOUBLE_CHANCE_X2': return `${fixture.awayTeam} or draw`;
    case 'OVER_25': return 'Over 2.5 total goals';
    case 'UNDER_25': return 'Under 2.5 total goals';
    case 'HOME_OVER_15': return `${fixture.homeTeam} over 1.5 team goals`;
    case 'AWAY_OVER_15': return `${fixture.awayTeam} over 1.5 team goals`;
    case 'HOME_DNB': return `${fixture.homeTeam} draw no bet`;
    case 'AWAY_DNB': return `${fixture.awayTeam} draw no bet`;
    case 'HOME_WIN': return `${fixture.homeTeam} to win`;
    case 'AWAY_WIN': return `${fixture.awayTeam} to win`;
  }
}

function marketName(market: MarketKey) {
  const names: Record<MarketKey, string> = {
    HOME_OVER_05: 'Home team goal', AWAY_OVER_05: 'Away team goal', OVER_15: 'Over 1.5', UNDER_35: 'Under 3.5',
    DOUBLE_CHANCE_1X: 'Double Chance 1X', DOUBLE_CHANCE_X2: 'Double Chance X2', OVER_25: 'Over 2.5', UNDER_25: 'Under 2.5',
    HOME_OVER_15: 'Home team over 1.5', AWAY_OVER_15: 'Away team over 1.5', HOME_DNB: 'Home DNB', AWAY_DNB: 'Away DNB', HOME_WIN: 'Home win', AWAY_WIN: 'Away win'
  };
  return names[market];
}

const minimumProbability: Record<MarketKey, number> = {
  HOME_OVER_05: 0.80, AWAY_OVER_05: 0.80, OVER_15: 0.80, UNDER_35: 0.76,
  DOUBLE_CHANCE_1X: 0.74, DOUBLE_CHANCE_X2: 0.74, OVER_25: 0.66, UNDER_25: 0.66,
  HOME_OVER_15: 0.68, AWAY_OVER_15: 0.68, HOME_DNB: 0.69, AWAY_DNB: 0.69, HOME_WIN: 0.62, AWAY_WIN: 0.62
};

const upgradeMap: Partial<Record<MarketKey, MarketKey>> = {
  HOME_OVER_05: 'HOME_OVER_15',
  AWAY_OVER_05: 'AWAY_OVER_15',
  OVER_15: 'OVER_25',
  UNDER_35: 'UNDER_25',
  DOUBLE_CHANCE_1X: 'HOME_DNB',
  DOUBLE_CHANCE_X2: 'AWAY_DNB',
  HOME_DNB: 'HOME_WIN',
  AWAY_DNB: 'AWAY_WIN'
};

type Candidate = {
  market: MarketKey;
  probability: number;
  components: number[];
  odd: number;
  fair: number;
  edge: number;
  neighborRate: number;
  sample: number;
  confidence: number;
  contradiction: number;
  dataCompleteness: number;
  teamConfirmation: number;
  explanation: string[];
  evidence: Record<string, string | number | boolean | null>;
  engines: EngineSignal[];
};

function evaluateMarket(
  market: MarketKey,
  fixture: UpcomingFixture,
  matches: NormalizedMatch[],
  league: LeagueProfile,
  homeRecent: TeamSlice,
  awayRecent: TeamSlice,
  homeVenue: TeamSlice,
  awayVenue: TeamSlice,
  poisson: ReturnType<typeof poissonMarkets>,
  homeMotivation: ReturnType<typeof motivation>,
  awayMotivation: ReturnType<typeof motivation>
): Candidate | null {
  const odd = marketOdd(fixture.odds, market);
  const fair = marketFair(fixture.odds, market);
  if (!odd || !fair) return null;

  const neighbors = historicalNeighbors(matches, fixture, market);
  let teamModel = 0.5;
  let leagueRate = 0.5;
  let poissonRate = 0.5;
  let venueSignal = 0.5;
  let explanation: string[] = [];

  switch (market) {
    case 'HOME_OVER_05':
      teamModel = homeRecent.scoreRate * 0.55 + awayRecent.concedeRate * 0.45;
      leagueRate = league.homeScore;
      poissonRate = poisson.homeOver05;
      venueSignal = homeVenue.scoreRate * 0.55 + awayVenue.concedeRate * 0.45;
      explanation = [
        `${fixture.homeTeam} scored in ${Math.round(homeRecent.scoreRate * 10)} of their last ${homeRecent.matches.length || 10} matches.`,
        `${fixture.awayTeam} conceded in ${Math.round(awayVenue.concedeRate * 10)} of their recent away matches.`
      ];
      break;
    case 'AWAY_OVER_05':
      teamModel = awayRecent.scoreRate * 0.55 + homeRecent.concedeRate * 0.45;
      leagueRate = league.awayScore;
      poissonRate = poisson.awayOver05;
      venueSignal = awayVenue.scoreRate * 0.55 + homeVenue.concedeRate * 0.45;
      explanation = [
        `${fixture.awayTeam} scored in ${Math.round(awayRecent.scoreRate * 10)} of their last ${awayRecent.matches.length || 10} matches.`,
        `${fixture.homeTeam} conceded in ${Math.round(homeVenue.concedeRate * 10)} of their recent home matches.`
      ];
      break;
    case 'OVER_15':
      teamModel = (homeRecent.over15 + awayRecent.over15) / 2;
      leagueRate = league.over15;
      poissonRate = poisson.over15;
      venueSignal = (homeVenue.over15 + awayVenue.over15) / 2;
      explanation = [
        `${Math.round(homeRecent.over15 * 10)} of ${homeRecent.matches.length || 10} recent ${fixture.homeTeam} matches had at least two goals.`,
        `${Math.round(awayRecent.over15 * 10)} of ${awayRecent.matches.length || 10} recent ${fixture.awayTeam} matches also reached two goals.`
      ];
      break;
    case 'UNDER_35':
      teamModel = (homeRecent.under35 + awayRecent.under35) / 2;
      leagueRate = league.under35;
      poissonRate = poisson.under35;
      venueSignal = (homeVenue.under35 + awayVenue.under35) / 2;
      explanation = [
        `${Math.round(homeRecent.under35 * 10)} of ${homeRecent.matches.length || 10} recent ${fixture.homeTeam} matches stayed below four goals.`,
        `${Math.round(awayRecent.under35 * 10)} of ${awayRecent.matches.length || 10} recent ${fixture.awayTeam} matches did the same.`
      ];
      break;
    case 'OVER_25':
      teamModel = (homeRecent.over25 + awayRecent.over25) / 2;
      leagueRate = league.over25;
      poissonRate = poisson.over25;
      venueSignal = (homeVenue.over25 + awayVenue.over25) / 2;
      explanation = [
        `The two teams' recent matches produced over 2.5 goals at a combined rate of ${Math.round(teamModel * 100)}%.`,
        `The goal model projects about ${round(Number((poissonRate * 4).toFixed(2)), 2)} strength units for this market.`
      ];
      break;
    case 'UNDER_25':
      teamModel = (homeRecent.under25 + awayRecent.under25) / 2;
      leagueRate = league.under25;
      poissonRate = poisson.under25;
      venueSignal = (homeVenue.under25 + awayVenue.under25) / 2;
      explanation = [
        `The two teams' recent matches stayed under 2.5 goals at a combined rate of ${Math.round(teamModel * 100)}%.`,
        `The league is currently classed as ${league.tag}.`
      ];
      break;
    case 'HOME_OVER_15':
      teamModel = pct(homeRecent.matches.filter((m) => teamKey(m.homeTeam) === teamKey(fixture.homeTeam) ? m.homeGoals >= 2 : m.awayGoals >= 2).length, homeRecent.matches.length, 0.4) * 0.6 + pct(awayVenue.matches.filter((m) => m.homeGoals >= 2).length, awayVenue.matches.length, 0.4) * 0.4;
      leagueRate = pct(matches.filter((m) => sameLeague(m.leagueName, fixture.leagueName) && m.homeGoals >= 2).length, matches.filter((m) => sameLeague(m.leagueName, fixture.leagueName)).length, 0.42);
      poissonRate = poisson.homeOver15;
      venueSignal = pct(homeVenue.matches.filter((m) => m.homeGoals >= 2).length, homeVenue.matches.length, 0.45);
      explanation = [
        `${fixture.homeTeam} average ${homeVenue.gf.toFixed(2)} goals in their recent home sample.`,
        `${fixture.awayTeam} concede ${awayVenue.ga.toFixed(2)} goals per recent away match.`
      ];
      break;
    case 'AWAY_OVER_15':
      teamModel = pct(awayRecent.matches.filter((m) => teamKey(m.homeTeam) === teamKey(fixture.awayTeam) ? m.homeGoals >= 2 : m.awayGoals >= 2).length, awayRecent.matches.length, 0.32) * 0.6 + pct(homeVenue.matches.filter((m) => m.awayGoals >= 2).length, homeVenue.matches.length, 0.32) * 0.4;
      leagueRate = pct(matches.filter((m) => sameLeague(m.leagueName, fixture.leagueName) && m.awayGoals >= 2).length, matches.filter((m) => sameLeague(m.leagueName, fixture.leagueName)).length, 0.32);
      poissonRate = poisson.awayOver15;
      venueSignal = pct(awayVenue.matches.filter((m) => m.awayGoals >= 2).length, awayVenue.matches.length, 0.35);
      explanation = [
        `${fixture.awayTeam} average ${awayVenue.gf.toFixed(2)} goals in their recent away sample.`,
        `${fixture.homeTeam} concede ${homeVenue.ga.toFixed(2)} goals per recent home match.`
      ];
      break;
    case 'DOUBLE_CHANCE_1X':
      teamModel = 1 - awayRecent.winRate;
      leagueRate = league.homeWin + league.draw;
      poissonRate = poisson.dc1x;
      venueSignal = 1 - homeVenue.lossRate;
      teamModel = clamp(teamModel + homeMotivation.adjustment - awayMotivation.adjustment);
      explanation = [
        `${fixture.homeTeam} collect ${homeVenue.ppg.toFixed(2)} points per recent home match.`,
        `${fixture.awayTeam} win only ${Math.round(awayVenue.winRate * 100)}% of their recent away matches.`
      ];
      break;
    case 'HOME_DNB': {
      const teamDecisive = homeRecent.winRate + homeRecent.lossRate;
      const leagueDecisive = league.homeWin + league.awayWin;
      const poissonDecisive = poisson.homeWin + poisson.awayWin;
      const venueDecisive = homeVenue.winRate + homeVenue.lossRate;
      teamModel = teamDecisive ? homeRecent.winRate / teamDecisive : 0.5;
      leagueRate = leagueDecisive ? league.homeWin / leagueDecisive : 0.5;
      poissonRate = poissonDecisive ? poisson.homeWin / poissonDecisive : 0.5;
      venueSignal = venueDecisive ? homeVenue.winRate / venueDecisive : 0.5;
      teamModel = clamp(teamModel + homeMotivation.adjustment - awayMotivation.adjustment);
      explanation = [
        `${fixture.homeTeam} collect ${homeVenue.ppg.toFixed(2)} points per recent home match.`,
        `The draw is protected, so the engine compares only decisive home and away outcomes.`
      ];
      break;
    }
    case 'HOME_WIN':
      teamModel = homeRecent.winRate;
      leagueRate = league.homeWin;
      poissonRate = poisson.homeWin;
      venueSignal = homeVenue.winRate;
      teamModel = clamp(teamModel + homeMotivation.adjustment - awayMotivation.adjustment);
      explanation = [
        `${fixture.homeTeam} win ${Math.round(homeVenue.winRate * 100)}% of their recent home matches.`,
        `${fixture.awayTeam} lose ${Math.round(awayVenue.lossRate * 100)}% of their recent away matches.`
      ];
      break;
    case 'DOUBLE_CHANCE_X2':
      teamModel = 1 - homeRecent.winRate;
      leagueRate = league.awayWin + league.draw;
      poissonRate = poisson.dcx2;
      venueSignal = 1 - awayVenue.lossRate;
      teamModel = clamp(teamModel + awayMotivation.adjustment - homeMotivation.adjustment);
      explanation = [
        `${fixture.awayTeam} collect ${awayVenue.ppg.toFixed(2)} points per recent away match.`,
        `${fixture.homeTeam} win ${Math.round(homeVenue.winRate * 100)}% of their recent home matches.`
      ];
      break;
    case 'AWAY_DNB': {
      const teamDecisive = awayRecent.winRate + awayRecent.lossRate;
      const leagueDecisive = league.homeWin + league.awayWin;
      const poissonDecisive = poisson.homeWin + poisson.awayWin;
      const venueDecisive = awayVenue.winRate + awayVenue.lossRate;
      teamModel = teamDecisive ? awayRecent.winRate / teamDecisive : 0.5;
      leagueRate = leagueDecisive ? league.awayWin / leagueDecisive : 0.5;
      poissonRate = poissonDecisive ? poisson.awayWin / poissonDecisive : 0.5;
      venueSignal = venueDecisive ? awayVenue.winRate / venueDecisive : 0.5;
      teamModel = clamp(teamModel + awayMotivation.adjustment - homeMotivation.adjustment);
      explanation = [
        `${fixture.awayTeam} collect ${awayVenue.ppg.toFixed(2)} points per recent away match.`,
        `The draw is protected, so the engine compares only decisive home and away outcomes.`
      ];
      break;
    }
    case 'AWAY_WIN':
      teamModel = awayRecent.winRate;
      leagueRate = league.awayWin;
      poissonRate = poisson.awayWin;
      venueSignal = awayVenue.winRate;
      teamModel = clamp(teamModel + awayMotivation.adjustment - homeMotivation.adjustment);
      explanation = [
        `${fixture.awayTeam} win ${Math.round(awayVenue.winRate * 100)}% of their recent away matches.`,
        `${fixture.homeTeam} lose ${Math.round(homeVenue.lossRate * 100)}% of their recent home matches.`
      ];
      break;
  }

  const components = [teamModel, leagueRate, poissonRate, venueSignal, neighbors.hitRate];
  const probability = clamp(teamModel * 0.27 + leagueRate * 0.13 + poissonRate * 0.23 + venueSignal * 0.17 + neighbors.hitRate * 0.20, 0.04, 0.96);
  const edge = probability - fair;
  const disagreement = standardDeviation(components);
  const contradiction = clamp(disagreement * 210 + (edge < 0 ? Math.abs(edge) * 120 : 0), 0, 100);
  const dataCompleteness = clamp((homeRecent.matches.length + awayRecent.matches.length + homeVenue.matches.length + awayVenue.matches.length) / 32, 0, 1);
  const teamConfirmation = clamp((teamModel + venueSignal + poissonRate) / 3);
  const confidence = clamp(
    probability * 48
    + neighbors.hitRate * 16
    + (1 - disagreement) * 10
    + dataCompleteness * 10
    + teamConfirmation * 10
    + clamp(edge + 0.05, 0, 0.15) / 0.15 * 6
    - contradiction * 0.12,
    0,
    99
  );

  const chronosScore = clamp(neighbors.hitRate * 70 + (1 - neighbors.averageDistance) * 30, 0, 100);
  const athenaScore = clamp(teamConfirmation * 100, 0, 100);
  const zeusScore = clamp((probability * 0.65 + clamp(edge + 0.12, 0, 0.24) / 0.24 * 0.35) * 100, 0, 100);
  const leonidasScore = clamp(100 - contradiction + dataCompleteness * 8, 0, 100);
  const engines: EngineSignal[] = [
    { key: 'chronos', name: 'Chronos', score: round(chronosScore), pass: neighbors.sample >= 60 && chronosScore >= 66, note: `${neighbors.sample} similar historical matches` },
    { key: 'athena', name: 'Athena', score: round(athenaScore), pass: athenaScore >= 68, note: 'Team form and venue statistics' },
    { key: 'zeus', name: 'Zeus', score: round(zeusScore), pass: edge >= 0.015 && zeusScore >= 66, note: `Market edge ${edge >= 0 ? '+' : ''}${round(edge * 100)}%` },
    { key: 'leonidas', name: 'Leonidas', score: round(leonidasScore), pass: contradiction <= 34 && dataCompleteness >= 0.55, note: contradiction <= 22 ? 'Strict filter clear' : 'Some conflicting signals' }
  ];

  explanation.push(`In ${neighbors.sample} similar historical odds profiles, this market landed ${Math.round(neighbors.hitRate * 100)}% of the time.`);
  if (homeMotivation.label !== 'normal' || awayMotivation.label !== 'normal') {
    const pressureTeam = homeMotivation.label !== 'normal' ? fixture.homeTeam : fixture.awayTeam;
    const pressure = homeMotivation.label !== 'normal' ? homeMotivation.label : awayMotivation.label;
    explanation.push(`${pressureTeam} have ${pressure}, but Chronos gives that only a small weighting.`);
  }

  return {
    market,
    probability,
    components,
    odd,
    fair,
    edge,
    neighborRate: neighbors.hitRate,
    sample: neighbors.sample,
    confidence,
    contradiction,
    dataCompleteness,
    teamConfirmation,
    explanation,
    evidence: {
      leagueType: league.tag,
      leagueSample: league.sample,
      homeRecentPpg: round(homeRecent.ppg, 2),
      awayRecentPpg: round(awayRecent.ppg, 2),
      homeVenuePpg: round(homeVenue.ppg, 2),
      awayVenuePpg: round(awayVenue.ppg, 2),
      homePosition: homeMotivation.position,
      awayPosition: awayMotivation.position,
      homeMotivation: homeMotivation.label,
      awayMotivation: awayMotivation.label,
      historicalHitRate: round(neighbors.hitRate * 100),
      modelProbability: round(probability * 100),
      marketFairProbability: round(fair * 100),
      contradictionScore: round(contradiction)
    },
    engines
  };
}

function eligible(candidate: Candidate, strict = false) {
  const passedEngines = candidate.engines.filter((engine) => engine.pass).length;
  const probabilityBuffer = strict ? 0.03 : 0;
  return candidate.probability >= minimumProbability[candidate.market] + probabilityBuffer
    && candidate.edge >= (strict ? 0.03 : 0.015)
    && candidate.sample >= (strict ? 80 : 60)
    && candidate.contradiction <= (strict ? 24 : 36)
    && candidate.dataCompleteness >= (strict ? 0.7 : 0.5)
    && passedEngines >= (strict ? 4 : 3);
}

function analyzeFullFixture(fixture: UpcomingFixture, allHistoricalMatches: NormalizedMatch[]): PredictionRecord | null {
  const matches = allHistoricalMatches.filter((match) => match.date < fixture.date);
  const leagueMatches = matches.filter((match) => sameLeague(match.leagueName, fixture.leagueName));
  if (leagueMatches.length < 120) return null;

  const league = leagueProfile(matches, fixture.leagueName);
  const homeRecent = teamSlice(matches, fixture.homeTeam, 'all', 10);
  const awayRecent = teamSlice(matches, fixture.awayTeam, 'all', 10);
  const homeVenue = teamSlice(matches, fixture.homeTeam, 'home', 10);
  const awayVenue = teamSlice(matches, fixture.awayTeam, 'away', 10);
  if (homeRecent.matches.length < 8 || awayRecent.matches.length < 8 || homeVenue.matches.length < 4 || awayVenue.matches.length < 4) return null;

  const expected = expectedGoals(league, homeVenue, awayVenue, homeRecent, awayRecent);
  const goalModel = poissonMarkets(expected.home, expected.away);
  const currentSeason = seasonMatchesForFixture(matches, fixture);
  const table = standings(currentSeason);
  const homeMotivation = motivation(table, fixture.homeTeam);
  const awayMotivation = motivation(table, fixture.awayTeam);

  const baseMarkets: MarketKey[] = [
    'HOME_OVER_05', 'AWAY_OVER_05', 'OVER_15', 'UNDER_35',
    'DOUBLE_CHANCE_1X', 'DOUBLE_CHANCE_X2', 'OVER_25', 'UNDER_25',
    'HOME_WIN', 'AWAY_WIN'
  ];
  const allNeeded = new Set<MarketKey>([...baseMarkets, ...Object.values(upgradeMap).filter(Boolean) as MarketKey[]]);
  const candidates = new Map<MarketKey, Candidate>();
  for (const market of allNeeded) {
    const candidate = evaluateMarket(market, fixture, matches, league, homeRecent, awayRecent, homeVenue, awayVenue, goalModel, homeMotivation, awayMotivation);
    if (candidate) candidates.set(market, candidate);
  }

  const ranked = baseMarkets
    .map((market) => candidates.get(market))
    .filter((candidate): candidate is Candidate => Boolean(candidate) && eligible(candidate!))
    .sort((a, b) => (b.confidence + b.edge * 65) - (a.confidence + a.edge * 65));

  let chosen = ranked[0];
  if (!chosen) return null;
  let original: Candidate | undefined;

  if (chosen.odd < 1.19) {
    original = chosen;
    const upgradeMarket = upgradeMap[chosen.market];
    const upgrade = upgradeMarket ? candidates.get(upgradeMarket) : undefined;
    if (upgrade && upgrade.odd >= 1.19 && eligible(upgrade, true)) {
      chosen = upgrade;
      chosen.explanation = [
        `${marketName(original.market)} was priced at ${original.odd.toFixed(2)}, below the 1.19 minimum.`,
        `Chronos upgraded it to ${marketName(chosen.market)} only after the stronger market passed every strict check.`,
        ...chosen.explanation
      ];
    } else {
      const alternative = ranked.find((candidate) => candidate.odd >= 1.19 && candidate.market !== original?.market && candidate.confidence >= original!.confidence - 3);
      if (!alternative) return null;
      chosen = alternative;
      original = undefined;
    }
  }

  const passedEngines = chosen.engines.filter((engine) => engine.pass).length;
  const banker = eligible(chosen, true) && chosen.confidence >= 82 && passedEngines === 4 && chosen.odd >= 1.19;
  const risk: 'Low' | 'Medium' = banker || (chosen.confidence >= 80 && chosen.contradiction <= 25) ? 'Low' : 'Medium';
  const selection = label(chosen.market, fixture);
  const summary = `${selection} is preferred because team form, venue numbers and ${chosen.sample} similar historical odds profiles point in the same direction.`;

  return {
    fixtureId: fixture.id,
    engineVersion: ENGINE_VERSION,
    runAt: new Date().toISOString(),
    date: fixture.date,
    kickoff: fixture.kickoff,
    leagueCode: fixture.leagueCode,
    leagueName: fixture.leagueName,
    country: fixture.country,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    marketKey: chosen.market,
    marketLabel: marketName(chosen.market),
    selection,
    odds: round(chosen.odd, 2),
    originalMarketKey: original?.market,
    originalMarketLabel: original ? marketName(original.market) : undefined,
    originalOdds: original ? round(original.odd, 2) : undefined,
    upgraded: Boolean(original),
    probability: round(chosen.probability * 100),
    confidence: round(chosen.confidence),
    edge: round(chosen.edge * 100),
    sample: chosen.sample,
    banker,
    tier: 'full',
    qualification: 'FULL_CHRONOS',
    risk,
    explanation: chosen.explanation.slice(0, 5),
    summary,
    evidence: {
      ...chosen.evidence,
      expectedHomeGoals: round(expected.home, 2),
      expectedAwayGoals: round(expected.away, 2),
      enginesPassed: passedEngines,
      lowOddsUpgrade: Boolean(original),
      fixtureProvider: fixture.provider ?? 'unknown',
      oddsSource: fixture.oddsSource ?? fixture.provider ?? 'unknown',
      dataQuality: fixture.dataQuality ?? 60
    },
    engines: chosen.engines,
    settledStatus: 'pending'
  };
}

function provisionalHistoricalNeighbors(matches: NormalizedMatch[], fixture: UpcomingFixture, market: 'HOME_WIN' | 'AWAY_WIN') {
  const target = fairThreeWay(fixture.odds);
  if (!target) return { sample: 0, hitRate: 0, averageDistance: 1 };
  const rows = matches
    .map((match) => {
      const fair = openingFair(match);
      if (!fair) return null;
      const distance = Math.abs(target.home - fair.home) + Math.abs(target.draw - fair.draw) + Math.abs(target.away - fair.away);
      return { match, distance };
    })
    .filter((row): row is { match: NormalizedMatch; distance: number } => Boolean(row))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 180);
  return {
    sample: rows.length,
    hitRate: pct(rows.filter((row) => outcome(row.match, market)).length, rows.length, 0.5),
    averageDistance: average(rows.map((row) => row.distance), 1)
  };
}

function countTeamHistory(matches: NormalizedMatch[], team: string) {
  const key = teamKey(team);
  return matches.filter((match) => teamKey(match.homeTeam) === key || teamKey(match.awayTeam) === key).length;
}

function analyzeProvisionalFixture(fixture: UpcomingFixture, allHistoricalMatches: NormalizedMatch[]): PredictionRecord | null {
  const matches = allHistoricalMatches.filter((match) => match.date < fixture.date && openingFair(match));
  const fair = fairThreeWay(fixture.odds);
  if (!fair || !fixture.odds.home || !fixture.odds.draw || !fixture.odds.away) return null;

  const market: 'HOME_WIN' | 'AWAY_WIN' = fair.home >= fair.away ? 'HOME_WIN' : 'AWAY_WIN';
  const selectedFair = market === 'HOME_WIN' ? fair.home : fair.away;
  const selectedOdd = market === 'HOME_WIN' ? fixture.odds.home : fixture.odds.away;
  if (!selectedOdd || selectedOdd < 1.19 || selectedOdd > 1.85 || selectedFair < 0.58) return null;

  const neighbors = provisionalHistoricalNeighbors(matches, fixture, market);
  if (neighbors.sample < 120 || neighbors.hitRate < 0.54 || neighbors.averageDistance > 0.18) return null;

  const similarity = clamp(1 - neighbors.averageDistance / 0.22);
  const probability = clamp(selectedFair * 0.65 + neighbors.hitRate * 0.35, 0.05, 0.90);
  const dataQuality = fixture.dataQuality ?? 60;
  if (dataQuality < 75) return null;

  const confidence = clamp(
    20
    + selectedFair * 42
    + neighbors.hitRate * 32
    + similarity * 18,
    0,
    86
  );
  if (confidence < 72) return null;

  const homeHistory = countTeamHistory(matches, fixture.homeTeam);
  const awayHistory = countTeamHistory(matches, fixture.awayTeam);
  const leagueHistory = matches.filter((match) => sameLeague(match.leagueName, fixture.leagueName)).length;
  const selection = market === 'HOME_WIN' ? `${fixture.homeTeam} to win` : `${fixture.awayTeam} to win`;
  const favorite = market === 'HOME_WIN' ? fixture.homeTeam : fixture.awayTeam;
  const fairPercent = round(selectedFair * 100);
  const hitPercent = round(neighbors.hitRate * 100);
  const patternFit = round(similarity * 100);

  const engines: EngineSignal[] = [
    {
      key: 'chronos',
      name: 'Historical odds pattern',
      score: round(neighbors.hitRate * 100),
      pass: neighbors.sample >= 120 && neighbors.hitRate >= 0.54,
      note: `${neighbors.sample} closest historical 1X2 price profiles won this side ${hitPercent}% of the time.`
    },
    {
      key: 'athena',
      name: 'Local team intelligence',
      score: 35,
      pass: false,
      note: `Local league and team history is not deep enough yet, so this pick is provisional and cannot be a Banker.`
    },
    {
      key: 'zeus',
      name: 'Market strength and value',
      score: round(clamp((selectedFair - 0.50) * 300 + similarity * 45, 0, 100)),
      pass: selectedFair >= 0.58 && similarity >= 0.18,
      note: `The market makes ${favorite} the clear side at about ${fairPercent}% fair probability and the historical price shape is a ${patternFit}% match.`
    },
    {
      key: 'leonidas',
      name: 'Provisional safety gate',
      score: round(clamp((1 - neighbors.averageDistance / 0.25) * 70 + dataQuality * 0.30, 0, 100)),
      pass: selectedOdd >= 1.19 && neighbors.averageDistance <= 0.18 && dataQuality >= 75,
      note: `Complete 1X2 odds passed the 1.19 minimum and the closest historical prices were sufficiently similar.`
    }
  ];

  if (engines.filter((engine) => engine.pass).length < 3) return null;

  return {
    fixtureId: fixture.id,
    engineVersion: ENGINE_VERSION,
    runAt: new Date().toISOString(),
    date: fixture.date,
    kickoff: fixture.kickoff,
    leagueCode: fixture.leagueCode,
    leagueName: fixture.leagueName,
    country: fixture.country,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    marketKey: market,
    marketLabel: market === 'HOME_WIN' ? 'Home win' : 'Away win',
    selection,
    odds: round(selectedOdd, 2),
    upgraded: false,
    probability: round(probability * 100),
    confidence: round(confidence),
    edge: 0,
    sample: neighbors.sample,
    banker: false,
    tier: 'provisional',
    qualification: 'PROVISIONAL_GLOBAL_ODDS',
    risk: 'Medium',
    explanation: [
      `BetExplorer prices make ${favorite} the clear favourite at ${selectedOdd.toFixed(2)}.`,
      `${neighbors.sample} closely matched historical 1X2 price profiles produced this result ${hitPercent}% of the time.`,
      `The blended market-and-history probability is ${round(probability * 100)}%, with a ${patternFit}% price-pattern fit.`,
      `This is provisional because Betynz does not yet have enough local ${fixture.leagueName} and team history.`,
      `Provisional picks are never promoted to the Banker section.`
    ],
    summary: `Provisional odds pick: ${selection} is supported by ${neighbors.sample} similar historical 1X2 price profiles, but local league and team history is still limited.`,
    evidence: {
      tier: 'provisional',
      historicalHitRate: hitPercent,
      marketFairProbability: fairPercent,
      oddsPatternFit: patternFit,
      marketEdgeAvailable: false,
      averageOddsDistance: round(neighbors.averageDistance, 3),
      localLeagueMatches: leagueHistory,
      homeTeamHistory: homeHistory,
      awayTeamHistory: awayHistory,
      fixtureProvider: fixture.provider ?? 'unknown',
      oddsSource: fixture.oddsSource ?? fixture.provider ?? 'unknown',
      dataQuality,
      lowOddsUpgrade: false
    },
    engines,
    settledStatus: 'pending'
  };
}

export function analyzeFixture(fixture: UpcomingFixture, allHistoricalMatches: NormalizedMatch[]): PredictionRecord | null {
  return analyzeFullFixture(fixture, allHistoricalMatches) ?? analyzeProvisionalFixture(fixture, allHistoricalMatches);
}
