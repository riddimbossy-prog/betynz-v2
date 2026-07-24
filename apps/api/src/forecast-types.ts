import type { ConfrontationRecord, TeamStreakSnapshot } from './streak-intelligence.js';

export type MarketKey =
  | 'HOME_OVER_05'
  | 'AWAY_OVER_05'
  | 'OVER_15'
  | 'UNDER_35'
  | 'DOUBLE_CHANCE_1X'
  | 'DOUBLE_CHANCE_X2'
  | 'OVER_25'
  | 'UNDER_25'
  | 'HOME_OVER_15'
  | 'AWAY_OVER_15'
  | 'HOME_DNB'
  | 'AWAY_DNB'
  | 'HOME_WIN'
  | 'AWAY_WIN';

export type UpcomingOdds = Partial<Record<
  | 'home'
  | 'draw'
  | 'away'
  | 'over15'
  | 'under15'
  | 'over25'
  | 'under25'
  | 'over35'
  | 'under35'
  | 'homeOver05'
  | 'homeUnder05'
  | 'homeOver15'
  | 'homeUnder15'
  | 'awayOver05'
  | 'awayUnder05'
  | 'awayOver15'
  | 'awayUnder15'
  | 'dc1x'
  | 'dc12'
  | 'dcx2'
  | 'homeDnb'
  | 'awayDnb',
  number
>>;

export type UpcomingFixture = {
  provider?: 'api-football' | 'betexplorer' | 'hybrid';
  providerUrl?: string;
  oddsSource?: string;
  dataQuality?: number;
  id: string;
  providerFixtureId: number;
  leagueId: number;
  leagueCode: string;
  leagueName: string;
  country: string;
  season: string;
  kickoff: string;
  date: string;
  status: string;
  venue?: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeam: string;
  awayTeam: string;
  odds: UpcomingOdds;
  rawOdds?: unknown;
  updatedAt?: string;
};

export type EngineSignal = {
  key: 'chronos' | 'athena' | 'zeus' | 'leonidas';
  name: string;
  score: number;
  pass: boolean;
  note: string;
};

export type PredictionTier = 'full' | 'provisional';

export type PredictionRecord = {
  fixtureId: string;
  engineVersion: string;
  runAt: string;
  date: string;
  kickoff: string;
  leagueCode: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  marketKey: MarketKey;
  marketLabel: string;
  selection: string;
  odds: number;
  originalMarketKey?: MarketKey;
  originalMarketLabel?: string;
  originalOdds?: number;
  upgraded: boolean;
  probability: number;
  confidence: number;
  edge: number;
  sample: number;
  banker: boolean;
  tier: PredictionTier;
  qualification: string;
  risk: 'Low' | 'Medium';
  explanation: string[];
  summary: string;
  evidence: Record<string, string | number | boolean | null>;
  engines: EngineSignal[];
  settledStatus?: 'pending' | 'won' | 'lost' | 'void';
  settledAt?: string;
};

export type RejectedCandidate = {
  marketKey: string;
  marketLabel: string;
  odds: number | null;
  reason: string;
};

export type RejectedBattle = {
  fixtureId: string;
  engineVersion: string;
  runAt: string;
  date: string;
  kickoff: string;
  leagueCode: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  rejectionStage: 'data' | 'history' | 'zeus-competition' | 'low-odds-upgrade' | 'leonidas';
  topMarket: string | null;
  topOdds: number | null;
  reasons: string[];
  candidates: RejectedCandidate[];
  evidence: Record<string, string | number | boolean | null>;
};

export type FixtureBattleResult = {
  prediction: PredictionRecord | null;
  rejection: RejectedBattle | null;
  snapshots: TeamStreakSnapshot[];
  confrontation: ConfrontationRecord | null;
};

export type PredictionDashboard = {
  source: 'supabase' | 'demo';
  generatedAt: string;
  engineVersion: string;
  currentEngineReady: boolean;
  rebuilding: boolean;
  dataStatus: {
    at: string;
    ok: boolean;
    source: 'fresh-provider' | 'provider-rescue' | 'retained-database' | 'none';
    window: { from: string; to: string };
    fixtures: number;
    pricedFixtures: number;
    message: string;
  } | null;
  window: { from: string; to: string; days: string[] };
  metrics: {
    fixtures: number;
    picks: number;
    fullPicks: number;
    provisionalPicks: number;
    bankers: number;
    leagues: number;
    pickLeagues: number;
    lowOddsUpgrades: number;
    pricedFixtures: number;
    zeusAutoPicks: number;
    streakFavorites: number;
    aresCandidates: number;
    aresWatchlist: number;
  };
  bankers: PredictionRecord[];
  predictions: PredictionRecord[];
  zeusAutoPicks: PredictionRecord[];
  streakFavorites: PredictionRecord[];
  aresWatchlist: PredictionRecord[];
  radarFixtures: UpcomingFixture[];
};
