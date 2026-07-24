
export type UpcomingFixture = {
  id: string;
  provider?: 'api-football' | 'betexplorer' | 'hybrid';
  providerUrl?: string;
  oddsSource?: string;
  dataQuality?: number;
  leagueCode: string;
  leagueName: string;
  country: string;
  season: string;
  kickoff: string;
  date: string;
  status: string;
  venue?: string;
  homeTeam: string;
  awayTeam: string;
  odds: {
    home?: number;
    draw?: number;
    away?: number;
    [key: string]: number | undefined;
  };
};

export type EngineSignal = {
  key: 'chronos' | 'athena' | 'zeus' | 'leonidas';
  name: string;
  score: number;
  pass: boolean;
  note: string;
};

export type Prediction = {
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
  marketKey: string;
  marketLabel: string;
  selection: string;
  odds: number;
  originalMarketKey?: string;
  originalMarketLabel?: string;
  originalOdds?: number;
  upgraded: boolean;
  probability: number;
  confidence: number;
  edge: number;
  sample: number;
  banker: boolean;
  tier: 'full' | 'provisional';
  qualification: string;
  risk: 'Low' | 'Medium';
  explanation: string[];
  summary: string;
  evidence: Record<string, string | number | boolean | null>;
  engines: EngineSignal[];
  settledStatus?: 'pending' | 'won' | 'lost' | 'void';
};

export type PredictionDashboard = {
  source: 'supabase' | 'demo' | 'offline';
  generatedAt: string;
  engineVersion: string;
  currentEngineReady: boolean;
  rebuilding: boolean;
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
    athenaShadowRuns: number;
    athenaShadowPicks: number;
    athenaShadowBankers: number;
  };
  bankers: Prediction[];
  predictions: Prediction[];
  zeusAutoPicks: Prediction[];
  radarFixtures: UpcomingFixture[];
};

export type HistoricalDashboard = {
  source: 'supabase' | 'demo';
  lastUpdated: string;
  engineVersion?: string;
  metrics: {
    matches: number;
    leagues: number;
    patterns: number;
    validated: number;
    upcomingFixtures?: number;
    futurePicks?: number;
    bankers?: number;
  };
};
