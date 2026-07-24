import type { AthenaClassificationKey, AthenaMarketCandidate, AthenaMarketKey, AthenaOddsConflict, AthenaRoutes, AthenaTeamMetrics } from './athena-transition.js';

export type AthenaSettlementStatus = 'pending' | 'won' | 'lost' | 'void';

export type AthenaShadowRun = {
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
  classification: AthenaClassificationKey;
  side: 'HOME' | 'AWAY' | null;
  story: string;
  marketKey: AthenaMarketKey;
  marketLabel: string;
  score: number;
  banker: boolean;
  reasons: string[];
  warnings: string[];
  secondary: AthenaMarketCandidate[];
  topMarkets: AthenaMarketCandidate[];
  routes: AthenaRoutes;
  metrics: { home: AthenaTeamMetrics; away: AthenaTeamMetrics };
  oddsConflict: AthenaOddsConflict;
  inputSource: {
    homeHtFt: 'betexplorer' | 'computed-history';
    awayHtFt: 'betexplorer' | 'computed-history';
    homeGoals: 'betexplorer' | 'computed-history' | 'missing';
    awayGoals: 'betexplorer' | 'computed-history' | 'missing';
    homeVenueSample: number;
    awayVenueSample: number;
  };
  settledStatus?: AthenaSettlementStatus;
  settledAt?: string;
};

export type AthenaShadowDashboard = {
  source: 'supabase' | 'demo';
  generatedAt: string;
  engineVersion: string;
  mode: 'FROZEN_PUBLIC_RC1';
  window: { from: string; to: string };
  metrics: {
    fixtures: number;
    picks: number;
    noPicks: number;
    bankers: number;
    settled: number;
    won: number;
    lost: number;
    void: number;
    pending: number;
    hitRate: number | null;
  };
  runs: AthenaShadowRun[];
};
