export type Match = {
  id: string;
  leagueCode: string;
  leagueName: string;
  season: string;
  date: string;
  time?: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: 'H' | 'D' | 'A';
  odds: {
    openingHome?: number;
    openingDraw?: number;
    openingAway?: number;
    closingHome?: number;
    closingDraw?: number;
    closingAway?: number;
    openingOver25?: number;
    closingOver25?: number;
  };
};

export type DashboardResponse = {
  source: 'supabase' | 'demo';
  lastUpdated: string;
  metrics: {
    matches: number;
    leagues: number;
    patterns: number;
    validated: number;
  };
  recentMatches: Match[];
  oddsBands: Array<{
    label: string;
    sample: number;
    hitRate: number;
    market: string;
  }>;
};
