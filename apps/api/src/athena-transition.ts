export const ATHENA_ENGINE_NAME = 'Athena Transition Engine';
export const ATHENA_ENGINE_VERSION = 'athena-transition-1.0.0-rc.1';
export const ATHENA_ENGINE_MODE = 'FROZEN_PUBLIC_RC1' as const;

export const ATHENA_CLASSIFICATIONS = {
  STABLE_LEADER: 'STABLE_LEADER',
  LATE_SEPARATION: 'LATE_SEPARATION',
  DRAW_LOCK: 'DRAW_LOCK',
  CONTROLLED_CORRIDOR: 'CONTROLLED_2_TO_3_GOALS',
  HIGH_EVENT_EARLY_SEPARATION: 'HIGH_EVENT_EARLY_SEPARATION',
  FALSE_OVER_TRAP: 'FALSE_OVER_TRAP',
  SWING_GAME: 'SWING_GAME',
  MULTI_ROUTE_ADVANTAGE: 'MULTI_ROUTE_ADVANTAGE',
  CONFLICT_NO_PICK: 'CONFLICT_NO_PICK'
} as const;

export const ATHENA_MARKETS = {
  HOME_WIN_EITHER_HALF: 'HOME_WIN_EITHER_HALF',
  AWAY_WIN_EITHER_HALF: 'AWAY_WIN_EITHER_HALF',
  HOME_DNB: 'HOME_DNB',
  AWAY_DNB: 'AWAY_DNB',
  HOME_DOUBLE_CHANCE: 'HOME_OR_DRAW',
  AWAY_DOUBLE_CHANCE: 'AWAY_OR_DRAW',
  HOME_OVER_0_5: 'HOME_TEAM_OVER_0_5',
  AWAY_OVER_0_5: 'AWAY_TEAM_OVER_0_5',
  OVER_1_5: 'OVER_1_5',
  OVER_2_5: 'OVER_2_5',
  UNDER_2_5: 'UNDER_2_5',
  UNDER_3_5: 'UNDER_3_5',
  FIRST_HALF_UNDER_1_5: 'FIRST_HALF_UNDER_1_5',
  FIRST_HALF_OVER_0_5: 'FIRST_HALF_OVER_0_5',
  HALF_TIME_DRAW: 'HALF_TIME_DRAW',
  FULL_TIME_DRAW: 'FULL_TIME_DRAW',
  BTTS_YES: 'BTTS_YES',
  NO_PICK: 'NO_PICK'
} as const;

export type AthenaClassificationKey = typeof ATHENA_CLASSIFICATIONS[keyof typeof ATHENA_CLASSIFICATIONS];
export type AthenaMarketKey = typeof ATHENA_MARKETS[keyof typeof ATHENA_MARKETS];
export type AthenaSide = 'HOME' | 'AWAY' | null;

export type AthenaHtFtCounts = {
  ww: number; wd: number; wl: number;
  dw: number; dd: number; dl: number;
  lw: number; ld: number; ll: number;
};

export type AthenaGoalProfile = {
  sample: number;
  over25?: number;
  under25?: number;
  averageTotalGoals?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  last5Over25?: boolean[];
};

export type AthenaVenueEvidence = {
  scope: 'home' | 'away';
  sample: number;
};

export type AthenaTeamInput = {
  name: string;
  matchesPlayed: number;
  htft: AthenaHtFtCounts;
  goals?: AthenaGoalProfile;
  venue?: AthenaVenueEvidence | null;
};

export type AthenaFixtureInput = {
  id?: string;
  league?: string;
  kickoff?: string;
  home: AthenaTeamInput;
  away: AthenaTeamInput;
  odds?: { home?: number; draw?: number; away?: number };
};

export type AthenaConfig = {
  minMatchesForFullReliability: number;
  minBankerScore: number;
  minStrongScore: number;
  minSupportingScore: number;
  drawRateStrong: number;
  htDrawRateStrong: number;
  under25UpgradeRate: number;
  under25IdealRate: number;
  under25MaxCombinedAverage: number;
  highEventOver25Rate: number;
  highEventAverageGoals: number;
  strongRouteRate: number;
  meaningfulStateSample: number;
  matchedReversalCountStrong: number;
  marketOddsConflictRatio: number;
  useOddsAsConfirmation: boolean;
  requireVenueSplitForConflictedDirection: boolean;
  oneBankerOnly: boolean;
};

export const ATHENA_DEFAULT_CONFIG: Readonly<AthenaConfig> = Object.freeze({
  minMatchesForFullReliability: 20,
  minBankerScore: 80,
  minStrongScore: 70,
  minSupportingScore: 60,
  drawRateStrong: 0.35,
  htDrawRateStrong: 0.45,
  under25UpgradeRate: 0.65,
  under25IdealRate: 0.70,
  under25MaxCombinedAverage: 2.2,
  highEventOver25Rate: 0.60,
  highEventAverageGoals: 2.8,
  strongRouteRate: 0.25,
  meaningfulStateSample: 3,
  matchedReversalCountStrong: 2,
  marketOddsConflictRatio: 1.35,
  useOddsAsConfirmation: true,
  requireVenueSplitForConflictedDirection: true,
  oneBankerOnly: true
});

export type AthenaTeamMetrics = {
  name: string;
  matchesPlayed: number;
  htft: AthenaHtFtCounts;
  htLead: number;
  htDraw: number;
  htTrail: number;
  leadWinRate: number;
  leadHoldRate: number;
  leadCollapseRate: number;
  htDrawRate: number;
  drawToWinRate: number;
  drawStaysDrawRate: number;
  drawToLossRate: number;
  comebackWinRate: number;
  comebackSaveRate: number;
  stayLostRate: number;
  ftDrawCount: number;
  ftDrawRate: number;
  sampleFactor: number;
  goalSample: number;
  over25Rate: number | null;
  under25Rate: number | null;
  averageTotalGoals: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  recentOver25: number | null;
  venue: AthenaVenueEvidence | null;
};

export type AthenaRoute = {
  aRate: number;
  bRate: number;
  raw: number;
  adjusted: number;
  bottleneckCount: number;
};

export type AthenaRoutes = {
  homeWW: AthenaRoute;
  homeWD: AthenaRoute;
  homeWL: AthenaRoute;
  homeDW: AthenaRoute;
  dd: AthenaRoute;
  awayDW: AthenaRoute;
  awayWW: AthenaRoute;
  awayWD: AthenaRoute;
  awayWL: AthenaRoute;
  homeLW: AthenaRoute;
  awayLW: AthenaRoute;
};

export type AthenaClassification = {
  type: AthenaClassificationKey;
  side: AthenaSide;
  combinedOver25: number | null;
  combinedUnder25: number | null;
  combinedAvgGoals: number | null;
  warnings: string[];
};

export type AthenaMarketCandidate = {
  market: AthenaMarketKey;
  score: number;
  reasons: string[];
  warnings: string[];
  fatal: boolean;
};

export type AthenaOddsConflict = {
  conflict: boolean;
  favorite: AthenaSide;
  ratio: number | null;
};

export type AthenaAnalysis = {
  engine: { name: string; version: string; mode: typeof ATHENA_ENGINE_MODE };
  fixture: { id: string | null; league: string | null; kickoff: string | null; home: string; away: string };
  classification: AthenaClassification;
  story: string;
  banker: AthenaMarketCandidate;
  secondary: AthenaMarketCandidate[];
  topMarkets: AthenaMarketCandidate[];
  oddsConflict: AthenaOddsConflict;
  metrics: { home: AthenaTeamMetrics; away: AthenaTeamMetrics };
  routes: AthenaRoutes;
  audit: {
    generatedAt: string;
    config: AthenaConfig;
    frozenRules: true;
    disclaimer: string;
  };
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const safeRate = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;
const finiteOrNull = (value: unknown) => Number.isFinite(value) ? Number(value) : null;

function validateTeam(team: AthenaTeamInput, path: string) {
  if (!team || typeof team !== 'object') throw new TypeError(`${path} must be an object`);
  if (!team.name || typeof team.name !== 'string') throw new TypeError(`${path}.name is required`);
  if (!Number.isFinite(team.matchesPlayed) || team.matchesPlayed < 0) throw new TypeError(`${path}.matchesPlayed must be non-negative`);
  const keys: Array<keyof AthenaHtFtCounts> = ['ww', 'wd', 'wl', 'dw', 'dd', 'dl', 'lw', 'ld', 'll'];
  const total = keys.reduce((sum, key) => {
    const value = team.htft[key];
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`${path}.htft.${key} must be non-negative`);
    return sum + value;
  }, 0);
  if (Math.abs(total - team.matchesPlayed) > 0.001) {
    throw new RangeError(`${path}.htft counts (${total}) must equal matchesPlayed (${team.matchesPlayed})`);
  }
  if (team.goals) {
    if (!Number.isFinite(team.goals.sample) || team.goals.sample < 0) throw new TypeError(`${path}.goals.sample must be non-negative`);
    const over = team.goals.over25;
    const under = team.goals.under25;
    if (over !== undefined && under !== undefined && Math.abs(over + under - team.goals.sample) > 0.001) {
      throw new RangeError(`${path}.goals over25 + under25 must equal goals.sample`);
    }
  }
}

export function validateAthenaFixture(input: AthenaFixtureInput) {
  if (!input || typeof input !== 'object') throw new TypeError('fixture input must be an object');
  validateTeam(input.home, 'home');
  validateTeam(input.away, 'away');
  return true;
}

function deriveTeamMetrics(team: AthenaTeamInput, config: AthenaConfig): AthenaTeamMetrics {
  const h = team.htft;
  const htLead = h.ww + h.wd + h.wl;
  const htDraw = h.dw + h.dd + h.dl;
  const htTrail = h.lw + h.ld + h.ll;
  const sampleFactor = Math.min(1, team.matchesPlayed / config.minMatchesForFullReliability);
  const goals = team.goals;
  const goalSample = goals?.sample ?? 0;

  return {
    name: team.name,
    matchesPlayed: team.matchesPlayed,
    htft: { ...h },
    htLead,
    htDraw,
    htTrail,
    leadWinRate: safeRate(h.ww, htLead),
    leadHoldRate: safeRate(h.ww + h.wd, htLead),
    leadCollapseRate: safeRate(h.wl, htLead),
    htDrawRate: safeRate(htDraw, team.matchesPlayed),
    drawToWinRate: safeRate(h.dw, htDraw),
    drawStaysDrawRate: safeRate(h.dd, htDraw),
    drawToLossRate: safeRate(h.dl, htDraw),
    comebackWinRate: safeRate(h.lw, htTrail),
    comebackSaveRate: safeRate(h.lw + h.ld, htTrail),
    stayLostRate: safeRate(h.ll, htTrail),
    ftDrawCount: h.wd + h.dd + h.ld,
    ftDrawRate: safeRate(h.wd + h.dd + h.ld, team.matchesPlayed),
    sampleFactor,
    goalSample,
    over25Rate: goals?.over25 === undefined ? null : safeRate(goals.over25, goalSample),
    under25Rate: goals?.under25 === undefined ? null : safeRate(goals.under25, goalSample),
    averageTotalGoals: finiteOrNull(goals?.averageTotalGoals),
    goalsFor: finiteOrNull(goals?.goalsFor),
    goalsAgainst: finiteOrNull(goals?.goalsAgainst),
    recentOver25: Array.isArray(goals?.last5Over25) ? goals.last5Over25.filter(Boolean).length : null,
    venue: team.venue ?? null
  };
}

function routeSupport(aCount: number, aDenom: number, bCount: number, bDenom: number, sampleFactor = 1): AthenaRoute {
  const aRate = safeRate(aCount, aDenom);
  const bRate = safeRate(bCount, bDenom);
  return {
    aRate,
    bRate,
    raw: Math.min(aRate, bRate),
    adjusted: Math.min(aRate, bRate) * sampleFactor,
    bottleneckCount: Math.min(aCount, bCount)
  };
}

function buildCompatibleRoutes(home: AthenaTeamMetrics, away: AthenaTeamMetrics): AthenaRoutes {
  const reliability = Math.min(home.sampleFactor, away.sampleFactor);
  const H = home.htft;
  const A = away.htft;
  return {
    homeWW: routeSupport(H.ww, home.matchesPlayed, A.ll, away.matchesPlayed, reliability),
    homeWD: routeSupport(H.wd, home.matchesPlayed, A.ld, away.matchesPlayed, reliability),
    homeWL: routeSupport(H.wl, home.matchesPlayed, A.lw, away.matchesPlayed, reliability),
    homeDW: routeSupport(H.dw, home.matchesPlayed, A.dl, away.matchesPlayed, reliability),
    dd: routeSupport(H.dd, home.matchesPlayed, A.dd, away.matchesPlayed, reliability),
    awayDW: routeSupport(A.dw, away.matchesPlayed, H.dl, home.matchesPlayed, reliability),
    awayWW: routeSupport(A.ww, away.matchesPlayed, H.ll, home.matchesPlayed, reliability),
    awayWD: routeSupport(A.wd, away.matchesPlayed, H.ld, home.matchesPlayed, reliability),
    awayWL: routeSupport(A.wl, away.matchesPlayed, H.lw, home.matchesPlayed, reliability),
    homeLW: routeSupport(H.lw, home.matchesPlayed, A.wl, away.matchesPlayed, reliability),
    awayLW: routeSupport(A.lw, away.matchesPlayed, H.wl, home.matchesPlayed, reliability)
  };
}

function averageNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => Number.isFinite(value));
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

function classifyMatch(home: AthenaTeamMetrics, away: AthenaTeamMetrics, routes: AthenaRoutes, config: AthenaConfig): AthenaClassification {
  const combinedOver25 = averageNullable([home.over25Rate, away.over25Rate]);
  const combinedUnder25 = averageNullable([home.under25Rate, away.under25Rate]);
  const combinedAvgGoals = averageNullable([home.averageTotalGoals, away.averageTotalGoals]);
  const bothHighHtDraw = home.htDrawRate >= config.htDrawRateStrong && away.htDrawRate >= 0.40;
  const bothHighFtDraw = home.ftDrawRate >= config.drawRateStrong && away.ftDrawRate >= config.drawRateStrong;
  const highEvent = combinedOver25 !== null && combinedAvgGoals !== null
    && combinedOver25 >= config.highEventOver25Rate && combinedAvgGoals >= config.highEventAverageGoals;

  const strongHomeLead = routes.homeWW.adjusted >= config.strongRouteRate;
  const strongAwayLead = routes.awayWW.adjusted >= config.strongRouteRate;
  const strongHomeLate = routes.homeDW.adjusted >= config.strongRouteRate;
  const strongAwayLate = routes.awayDW.adjusted >= config.strongRouteRate;
  const homeReversalStrong = routes.homeLW.bottleneckCount >= config.matchedReversalCountStrong;
  const awayReversalStrong = routes.awayLW.bottleneckCount >= config.matchedReversalCountStrong;
  const anyStrongReversal = homeReversalStrong || awayReversalStrong;
  const homeWinningRoutes = [strongHomeLead, strongHomeLate, routes.homeLW.adjusted >= 0.08].filter(Boolean).length;
  const awayWinningRoutes = [strongAwayLead, strongAwayLate, routes.awayLW.adjusted >= 0.08].filter(Boolean).length;

  if (homeWinningRoutes === 3 || awayWinningRoutes === 3) {
    return {
      type: ATHENA_CLASSIFICATIONS.MULTI_ROUTE_ADVANTAGE,
      side: homeWinningRoutes === 3 ? 'HOME' : 'AWAY',
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: anyStrongReversal ? ['MATCHED_REVERSAL_PRESENT'] : []
    };
  }

  if (anyStrongReversal && highEvent) {
    return {
      type: ATHENA_CLASSIFICATIONS.SWING_GAME,
      side: homeReversalStrong ? 'HOME' : 'AWAY',
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: ['HIGH_VOLATILITY']
    };
  }

  const balancedLateRoutes = Math.abs(routes.homeDW.adjusted - routes.awayDW.adjusted) < 0.06;

  if (bothHighHtDraw && bothHighFtDraw && combinedUnder25 !== null && combinedUnder25 >= 0.62 && routes.dd.adjusted >= 0.10) {
    return {
      type: ATHENA_CLASSIFICATIONS.DRAW_LOCK,
      side: null,
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: []
    };
  }

  if (bothHighHtDraw && balancedLateRoutes && !anyStrongReversal && highEvent) {
    return {
      type: ATHENA_CLASSIFICATIONS.FALSE_OVER_TRAP,
      side: null,
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: ['HISTORICAL_OVER_WITH_LOCKED_STRUCTURE']
    };
  }

  if (bothHighHtDraw && (strongHomeLate || strongAwayLate)) {
    const side: AthenaSide = routes.homeDW.adjusted > routes.awayDW.adjusted ? 'HOME' : 'AWAY';
    return {
      type: ATHENA_CLASSIFICATIONS.LATE_SEPARATION,
      side,
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: balancedLateRoutes ? ['BALANCED_LATE_ROUTES'] : []
    };
  }

  if (highEvent && (!bothHighHtDraw || strongHomeLead || strongAwayLead)) {
    let side: AthenaSide = null;
    if (Math.abs(routes.homeWW.adjusted - routes.awayWW.adjusted) >= 0.06) {
      side = routes.homeWW.adjusted > routes.awayWW.adjusted ? 'HOME' : 'AWAY';
    }
    return {
      type: ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION,
      side,
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: side === null ? ['DIRECTIONAL_CONFLICT'] : []
    };
  }

  if (strongHomeLead || strongAwayLead || strongHomeLate || strongAwayLate) {
    const homeScore = routes.homeWW.adjusted + routes.homeDW.adjusted;
    const awayScore = routes.awayWW.adjusted + routes.awayDW.adjusted;
    return {
      type: ATHENA_CLASSIFICATIONS.STABLE_LEADER,
      side: homeScore > awayScore ? 'HOME' : 'AWAY',
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: Math.abs(homeScore - awayScore) < 0.08 ? ['DIRECTIONAL_CONFLICT'] : []
    };
  }

  if (combinedAvgGoals !== null && combinedAvgGoals <= 2.8 && !anyStrongReversal) {
    return {
      type: ATHENA_CLASSIFICATIONS.CONTROLLED_CORRIDOR,
      side: null,
      combinedOver25,
      combinedUnder25,
      combinedAvgGoals,
      warnings: []
    };
  }

  return {
    type: ATHENA_CLASSIFICATIONS.CONFLICT_NO_PICK,
    side: null,
    combinedOver25,
    combinedUnder25,
    combinedAvgGoals,
    warnings: ['NO_CLEAR_SHARED_MARKET']
  };
}

function assessOddsConflict(input: AthenaFixtureInput, classification: AthenaClassification, config: AthenaConfig): AthenaOddsConflict {
  if (!config.useOddsAsConfirmation || !input.odds || !classification.side) {
    return { conflict: false, favorite: null, ratio: null };
  }
  const { home, away } = input.odds;
  if (!Number.isFinite(home) || !Number.isFinite(away) || Number(home) <= 1 || Number(away) <= 1) {
    return { conflict: false, favorite: null, ratio: null };
  }
  const favorite: AthenaSide = Number(home) < Number(away) ? 'HOME' : 'AWAY';
  const ratio = classification.side === 'HOME' ? Number(away) / Number(home) : Number(home) / Number(away);
  return { conflict: favorite !== classification.side && ratio >= config.marketOddsConflictRatio, favorite, ratio };
}

function addCandidate(
  candidates: AthenaMarketCandidate[],
  market: AthenaMarketKey,
  score: number,
  reasons: string[] = [],
  warnings: string[] = [],
  fatal = false
) {
  candidates.push({ market, score: Math.max(0, Math.min(100, Math.round(score))), reasons, warnings, fatal });
}

function teamMarket(side: AthenaSide, homeMarket: AthenaMarketKey, awayMarket: AthenaMarketKey) {
  return side === 'HOME' ? homeMarket : awayMarket;
}

function scoreMarkets(args: {
  home: AthenaTeamMetrics;
  away: AthenaTeamMetrics;
  routes: AthenaRoutes;
  classification: AthenaClassification;
  oddsConflict: AthenaOddsConflict;
  config: AthenaConfig;
}) {
  const { home, away, routes, classification, oddsConflict, config } = args;
  const candidates: AthenaMarketCandidate[] = [];
  const side = classification.side;
  const isHome = side === 'HOME';
  const selected = isHome ? home : away;
  const opponent = isHome ? away : home;
  const leadRoute = isHome ? routes.homeWW : routes.awayWW;
  const lateRoute = isHome ? routes.homeDW : routes.awayDW;
  const reversalRoute = isHome ? routes.homeLW : routes.awayLW;

  const teamEitherHalf = teamMarket(side, ATHENA_MARKETS.HOME_WIN_EITHER_HALF, ATHENA_MARKETS.AWAY_WIN_EITHER_HALF);
  const teamDnb = teamMarket(side, ATHENA_MARKETS.HOME_DNB, ATHENA_MARKETS.AWAY_DNB);
  const teamDc = teamMarket(side, ATHENA_MARKETS.HOME_DOUBLE_CHANCE, ATHENA_MARKETS.AWAY_DOUBLE_CHANCE);
  const teamOver05 = teamMarket(side, ATHENA_MARKETS.HOME_OVER_0_5, ATHENA_MARKETS.AWAY_OVER_0_5);
  const routeScore = (leadRoute?.adjusted ?? 0) * 100 + (lateRoute?.adjusted ?? 0) * 90 + (reversalRoute?.adjusted ?? 0) * 70;
  const selectedLeadSafety = selected?.leadHoldRate ?? 0;
  const opponentComebackWeakness = opponent ? 1 - opponent.comebackSaveRate : 0;

  if (side) {
    let eitherHalfScore = 55 + routeScore * 0.65 + selectedLeadSafety * 12 + opponentComebackWeakness * 8;
    if (classification.type === ATHENA_CLASSIFICATIONS.MULTI_ROUTE_ADVANTAGE) eitherHalfScore += 12;
    if (classification.type === ATHENA_CLASSIFICATIONS.STABLE_LEADER) eitherHalfScore += 8;
    if (classification.type === ATHENA_CLASSIFICATIONS.LATE_SEPARATION) eitherHalfScore += 7;
    const missingVenueConfirmation = oddsConflict.conflict && config.requireVenueSplitForConflictedDirection && !selected.venue;
    if (missingVenueConfirmation) eitherHalfScore -= 18;
    const directionWarnings = [
      ...(oddsConflict.conflict ? ['ODDS_DIRECTION_CONFLICT'] : []),
      ...(missingVenueConfirmation ? ['HOME_AWAY_CONFIRMATION_REQUIRED'] : [])
    ];
    addCandidate(candidates, teamEitherHalf, eitherHalfScore,
      ['Compatible winning routes', 'Lead protection vs opponent comeback'],
      directionWarnings,
      missingVenueConfirmation);
    addCandidate(candidates, teamDnb, eitherHalfScore - 6, ['Directional protection'], directionWarnings, missingVenueConfirmation);
    addCandidate(candidates, teamDc, eitherHalfScore - 10, ['Directional protection with draw cover'], directionWarnings, missingVenueConfirmation);

    let teamGoalScore = 58 + Math.min(20, routeScore * 0.35);
    if (selected.goalsFor !== null && selected.goalSample > 0 && selected.goalsFor / selected.goalSample >= 1.2) teamGoalScore += 10;
    addCandidate(candidates, teamOver05, teamGoalScore, ['Winning routes support at least one team goal']);
  }

  const avgGoals = classification.combinedAvgGoals;
  const o25 = classification.combinedOver25;
  const u25 = classification.combinedUnder25;
  const matchedReversalStrong = Math.max(routes.homeLW.bottleneckCount, routes.awayLW.bottleneckCount) >= config.matchedReversalCountStrong;

  let over15Score = 55;
  if (avgGoals !== null) over15Score += Math.min(24, Math.max(0, (avgGoals - 1.6) * 14));
  if (o25 !== null) over15Score += o25 * 12;
  if (classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION || classification.type === ATHENA_CLASSIFICATIONS.SWING_GAME || classification.type === ATHENA_CLASSIFICATIONS.MULTI_ROUTE_ADVANTAGE) over15Score += 8;
  if (classification.type === ATHENA_CLASSIFICATIONS.FALSE_OVER_TRAP) over15Score -= 20;
  addCandidate(candidates, ATHENA_MARKETS.OVER_1_5, over15Score, ['Goal average', 'Match structure']);

  let over25Score = 42;
  if (o25 !== null) over25Score += o25 * 35;
  if (avgGoals !== null) over25Score += Math.max(0, (avgGoals - 2.3) * 12);
  if (classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION || classification.type === ATHENA_CLASSIFICATIONS.SWING_GAME) over25Score += 10;
  if (classification.type === ATHENA_CLASSIFICATIONS.FALSE_OVER_TRAP) over25Score -= 24;
  if (classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK) over25Score -= 18;
  addCandidate(candidates, ATHENA_MARKETS.OVER_2_5, over25Score, ['Aligned Over 2.5 profile', 'Structural capacity for goals']);

  let under35Score = 54;
  if (avgGoals !== null) under35Score += Math.max(0, (3.2 - avgGoals) * 12);
  if (u25 !== null) under35Score += u25 * 16;
  if (classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK || classification.type === ATHENA_CLASSIFICATIONS.CONTROLLED_CORRIDOR || classification.type === ATHENA_CLASSIFICATIONS.FALSE_OVER_TRAP) under35Score += 10;
  if (matchedReversalStrong) under35Score -= 25;
  if (classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION || classification.type === ATHENA_CLASSIFICATIONS.SWING_GAME || classification.type === ATHENA_CLASSIFICATIONS.MULTI_ROUTE_ADVANTAGE) under35Score -= 10;
  addCandidate(candidates, ATHENA_MARKETS.UNDER_3_5, under35Score, ['Goal ceiling', 'Volatility check'], matchedReversalStrong ? ['MATCHED_REVERSAL'] : []);

  let under25Score = 40;
  if (u25 !== null) under25Score += u25 * 42;
  if (avgGoals !== null) under25Score += Math.max(0, (2.4 - avgGoals) * 18);
  if (classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK) under25Score += 10;
  if (matchedReversalStrong || classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION) under25Score -= 22;
  addCandidate(candidates, ATHENA_MARKETS.UNDER_2_5, under25Score, ['Strong dual Under profile required']);

  const htDrawAvg = (home.htDrawRate + away.htDrawRate) / 2;
  let htDrawScore = 35 + htDrawAvg * 60;
  if (classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK || classification.type === ATHENA_CLASSIFICATIONS.LATE_SEPARATION) htDrawScore += 8;
  if (classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION) htDrawScore -= 16;
  addCandidate(candidates, ATHENA_MARKETS.HALF_TIME_DRAW, htDrawScore, ['Half-time draw frequency']);

  let ftDrawScore = 28 + ((home.ftDrawRate + away.ftDrawRate) / 2) * 80;
  if (classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK) ftDrawScore += 12;
  if (side) ftDrawScore -= 10;
  addCandidate(candidates, ATHENA_MARKETS.FULL_TIME_DRAW, ftDrawScore, ['W/D + D/D + L/D tendency']);

  let fhUnder15Score = 45 + htDrawAvg * 35;
  if (classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK || classification.type === ATHENA_CLASSIFICATIONS.FALSE_OVER_TRAP) fhUnder15Score += 8;
  if (classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION) fhUnder15Score -= 14;
  addCandidate(candidates, ATHENA_MARKETS.FIRST_HALF_UNDER_1_5, fhUnder15Score,
    ['HT draw supports caution but does not prove 0-0'], ['DIRECT_1H_GOAL_DATA_RECOMMENDED']);

  let fhOver05Score = 40;
  if (classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION) fhOver05Score += 22;
  if (home.htDrawRate < 0.25 && away.htDrawRate < 0.35) fhOver05Score += 8;
  addCandidate(candidates, ATHENA_MARKETS.FIRST_HALF_OVER_0_5, fhOver05Score,
    ['Early separation structure'], ['DIRECT_1H_GOAL_DATA_REQUIRED_FOR_BANKER']);

  const bothCanScore = home.goalsFor !== null && away.goalsFor !== null && home.goalSample > 0 && away.goalSample > 0
    && home.goalsFor / home.goalSample >= 0.9 && away.goalsFor / away.goalSample >= 0.9;
  let bttsScore = 44;
  if (bothCanScore) bttsScore += 18;
  if (avgGoals !== null) bttsScore += Math.max(0, (avgGoals - 2.2) * 8);
  if (classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK) bttsScore -= 12;
  addCandidate(candidates, ATHENA_MARKETS.BTTS_YES, bttsScore,
    ['Requires separate scoring evidence'], bothCanScore ? [] : ['INSUFFICIENT_SCORING_EVIDENCE']);

  return candidates.sort((a, b) => b.score - a.score);
}

function chooseBanker(candidates: AthenaMarketCandidate[], classification: AthenaClassification, config: AthenaConfig): AthenaMarketCandidate {
  if (classification.type === ATHENA_CLASSIFICATIONS.CONFLICT_NO_PICK) {
    return { market: ATHENA_MARKETS.NO_PICK, score: 0, reasons: ['No clear shared market'], warnings: ['SHADOW_TEST_NO_PICK'], fatal: false };
  }
  const acceptable = candidates.filter((candidate) => !candidate.fatal && candidate.score >= config.minSupportingScore);
  const byMarket = new Map(acceptable.map((item) => [item.market, item]));
  const teamEitherHalfMarkets = [ATHENA_MARKETS.HOME_WIN_EITHER_HALF, ATHENA_MARKETS.AWAY_WIN_EITHER_HALF];
  const teamProtectionMarkets = [ATHENA_MARKETS.HOME_DNB, ATHENA_MARKETS.AWAY_DNB, ATHENA_MARKETS.HOME_DOUBLE_CHANCE, ATHENA_MARKETS.AWAY_DOUBLE_CHANCE];
  let priority: AthenaMarketKey[] = [];

  switch (classification.type) {
    case ATHENA_CLASSIFICATIONS.MULTI_ROUTE_ADVANTAGE:
    case ATHENA_CLASSIFICATIONS.STABLE_LEADER:
    case ATHENA_CLASSIFICATIONS.LATE_SEPARATION:
      priority = [...teamEitherHalfMarkets, ...teamProtectionMarkets, ATHENA_MARKETS.OVER_1_5, ATHENA_MARKETS.UNDER_3_5];
      break;
    case ATHENA_CLASSIFICATIONS.DRAW_LOCK:
      priority = [ATHENA_MARKETS.UNDER_2_5, ATHENA_MARKETS.UNDER_3_5, ATHENA_MARKETS.HALF_TIME_DRAW, ATHENA_MARKETS.FULL_TIME_DRAW, ATHENA_MARKETS.FIRST_HALF_UNDER_1_5];
      break;
    case ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION:
      priority = classification.side && !classification.warnings.includes('DIRECTIONAL_CONFLICT')
        ? [...teamEitherHalfMarkets, ATHENA_MARKETS.OVER_2_5, ATHENA_MARKETS.OVER_1_5]
        : [ATHENA_MARKETS.OVER_2_5, ATHENA_MARKETS.OVER_1_5, ...teamEitherHalfMarkets];
      break;
    case ATHENA_CLASSIFICATIONS.SWING_GAME:
      priority = [ATHENA_MARKETS.OVER_1_5, ATHENA_MARKETS.OVER_2_5, ...teamEitherHalfMarkets];
      break;
    case ATHENA_CLASSIFICATIONS.FALSE_OVER_TRAP:
      priority = [ATHENA_MARKETS.FIRST_HALF_UNDER_1_5, ATHENA_MARKETS.HALF_TIME_DRAW, ATHENA_MARKETS.UNDER_3_5];
      break;
    case ATHENA_CLASSIFICATIONS.CONTROLLED_CORRIDOR:
      priority = [ATHENA_MARKETS.UNDER_3_5, ATHENA_MARKETS.OVER_1_5, ATHENA_MARKETS.UNDER_2_5];
      break;
  }

  for (const market of priority) {
    const candidate = byMarket.get(market);
    if (candidate && candidate.score >= config.minBankerScore) return candidate;
  }
  const fallback = acceptable.find((candidate) => candidate.score >= config.minBankerScore);
  if (fallback) return fallback;
  return {
    market: ATHENA_MARKETS.NO_PICK,
    score: 0,
    reasons: ['No market cleared the frozen banker threshold'],
    warnings: ['SHADOW_TEST_NO_PICK'],
    fatal: false
  };
}

function buildStory(classification: AthenaClassification, home: AthenaTeamMetrics, away: AthenaTeamMetrics) {
  const sideName = classification.side === 'HOME' ? home.name : classification.side === 'AWAY' ? away.name : null;
  switch (classification.type) {
    case ATHENA_CLASSIFICATIONS.MULTI_ROUTE_ADVANTAGE:
      return `${sideName} has compatible winning routes from leading, drawing and trailing half-time states.`;
    case ATHENA_CLASSIFICATIONS.STABLE_LEADER:
      return `${sideName} has the clearest control route and the opponent has limited ability to recover the result.`;
    case ATHENA_CLASSIFICATIONS.LATE_SEPARATION:
      return `A level first half is plausible, with ${sideName} holding the stronger second-half separation route.`;
    case ATHENA_CLASSIFICATIONS.DRAW_LOCK:
      return 'Both teams repeatedly convert different half-time states into full-time draws within a low-event profile.';
    case ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION:
      return 'The goal data and low half-time-draw structure support early separation and a high-event match.';
    case ATHENA_CLASSIFICATIONS.FALSE_OVER_TRAP:
      return 'Historical goal totals are high, but the transition structure can keep this matchup locked.';
    case ATHENA_CLASSIFICATIONS.SWING_GAME:
      return 'A matched comeback-collapse route creates genuine reversal volatility.';
    case ATHENA_CLASSIFICATIONS.CONTROLLED_CORRIDOR:
      return 'The matchup points to a controlled two-to-three-goal corridor without a decisive team route.';
    default:
      return 'The signals conflict and no shared market is sufficiently strong.';
  }
}

export function athenaMarketLabel(market: AthenaMarketKey, homeTeam: string, awayTeam: string) {
  const labels: Record<AthenaMarketKey, string> = {
    HOME_WIN_EITHER_HALF: `${homeTeam} to win either half`,
    AWAY_WIN_EITHER_HALF: `${awayTeam} to win either half`,
    HOME_DNB: `${homeTeam} draw no bet`,
    AWAY_DNB: `${awayTeam} draw no bet`,
    HOME_OR_DRAW: `${homeTeam} or draw`,
    AWAY_OR_DRAW: `${awayTeam} or draw`,
    HOME_TEAM_OVER_0_5: `${homeTeam} over 0.5 team goals`,
    AWAY_TEAM_OVER_0_5: `${awayTeam} over 0.5 team goals`,
    OVER_1_5: 'Over 1.5 total goals',
    OVER_2_5: 'Over 2.5 total goals',
    UNDER_2_5: 'Under 2.5 total goals',
    UNDER_3_5: 'Under 3.5 total goals',
    FIRST_HALF_UNDER_1_5: 'First half under 1.5 goals',
    FIRST_HALF_OVER_0_5: 'First half over 0.5 goals',
    HALF_TIME_DRAW: 'Half-time draw',
    FULL_TIME_DRAW: 'Full-time draw',
    BTTS_YES: 'Both teams to score',
    NO_PICK: 'No pick'
  };
  return labels[market];
}

export function analyseAthenaFixture(input: AthenaFixtureInput, overrides: Partial<AthenaConfig> = {}): AthenaAnalysis {
  validateAthenaFixture(input);
  const config: AthenaConfig = { ...ATHENA_DEFAULT_CONFIG, ...overrides };
  const home = deriveTeamMetrics(input.home, config);
  const away = deriveTeamMetrics(input.away, config);
  const routes = buildCompatibleRoutes(home, away);
  const classification = classifyMatch(home, away, routes, config);
  const oddsConflict = assessOddsConflict(input, classification, config);
  const markets = scoreMarkets({ home, away, routes, classification, oddsConflict, config });
  const banker = chooseBanker(markets, classification, config);
  const secondary = markets.filter((market) => market.market !== banker.market && market.score >= config.minSupportingScore).slice(0, 3);
  return {
    engine: { name: ATHENA_ENGINE_NAME, version: ATHENA_ENGINE_VERSION, mode: ATHENA_ENGINE_MODE },
    fixture: {
      id: input.id ?? null,
      league: input.league ?? null,
      kickoff: input.kickoff ?? null,
      home: home.name,
      away: away.name
    },
    classification,
    story: buildStory(classification, home, away),
    banker,
    secondary,
    topMarkets: markets.slice(0, 8),
    oddsConflict,
    metrics: { home, away },
    routes,
    audit: {
      generatedAt: new Date().toISOString(),
      config,
      frozenRules: true,
      disclaimer: 'Shadow-test output only. No prediction is guaranteed.'
    }
  };
}
