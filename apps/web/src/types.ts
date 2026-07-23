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
  window: { from: string; to: string; days: string[] };
  metrics: {
    fixtures: number;
    picks: number;
    bankers: number;
    leagues: number;
    lowOddsUpgrades: number;
  };
  bankers: Prediction[];
  predictions: Prediction[];
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
