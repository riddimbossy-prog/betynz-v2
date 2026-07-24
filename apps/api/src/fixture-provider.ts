import { fetchUpcomingFixtures as fetchApiFootballFixtures } from './football-api.js';
import { betExplorerConfiguration, fetchBetExplorerFixtures, type BetExplorerSyncReport } from './betexplorer.js';
import { fetchOddsApiFixtures, oddsApiConfiguration } from './odds-api.js';
import type { UpcomingFixture, UpcomingOdds } from './forecast-types.js';
import { teamKey } from './identity.js';

export type FixtureProviderMode = 'api-football' | 'betexplorer' | 'hybrid';
export type ProviderSyncReport = {
  mode: FixtureProviderMode;
  fixtures: number;
  apiFootball: { enabled: boolean; fixtures: number; error?: string };
  betExplorer: BetExplorerSyncReport;
  oddsApi: { enabled: boolean; usedAsFallback: boolean; fixtures: number; fixturesWith1X2: number; requests: number; error?: string; warnings: string[]; triggerReasons: string[]; primaryCoverage: number; extendedCoverage: number; matchedToPrimary: number; unmatched: number; addedUnmatched: number; includeUnmatched: boolean };
  matchedAcrossProviders: number;
  unmatchedBetExplorer: number;
  unmatchedApiFootball: number;
  warnings: string[];
};

let lastReport: ProviderSyncReport | null = null;

function mode(): FixtureProviderMode {
  const value = String(process.env.FIXTURE_PROVIDER || 'api-football').toLowerCase();
  return value === 'betexplorer' || value === 'api-football' ? value : 'hybrid';
}

function aliases() {
  try {
    const raw = JSON.parse(process.env.TEAM_ALIASES_JSON || '{}') as Record<string, string>;
    return new Map(Object.entries(raw).map(([key, value]) => [teamKey(key), teamKey(value)]));
  } catch {
    return new Map<string, string>();
  }
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|afc|club|calcio|fk|sk|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function canonicalName(value: string, map: Map<string, string>) {
  const normalized = teamKey(value);
  return map.get(normalized) || normalized;
}

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\butd\b/g, ' united ')
    .replace(/\bst\b/g, ' saint ')
    .replace(/\b(fc|cf|sc|afc|club|calcio|fk|sk|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function variantSignature(value: string) {
  const words = normalizedWords(value);
  const age = words.find((word) => /^u\d{2}$/.test(word)) || '';
  const women = words.some((word) => ['women', 'woman', 'ladies', 'femenino', 'feminino', 'w'].includes(word)) ? 'women' : '';
  const reserve = words.some((word) => ['reserves', 'reserve', 'ii', 'b', 'youth'].includes(word)) ? 'reserve' : '';
  return [age, women, reserve].filter(Boolean).join('|');
}

function diceSimilarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const bigrams = (value: string) => {
    const output = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const pair = value.slice(index, index + 2);
      output.set(pair, (output.get(pair) || 0) + 1);
    }
    return output;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  let overlap = 0;
  for (const [pair, count] of left) overlap += Math.min(count, right.get(pair) || 0);
  const total = [...left.values()].reduce((sum, count) => sum + count, 0) + [...right.values()].reduce((sum, count) => sum + count, 0);
  return total ? (2 * overlap) / total : 0;
}

function tokenSimilarity(a: string, b: string) {
  const left = new Set(normalizedWords(a));
  const right = new Set(normalizedWords(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function teamSimilarity(a: string, b: string, map: Map<string, string>) {
  const left = canonicalName(a, map);
  const right = canonicalName(b, map);
  if (left === right) return 1;
  const containment = left.length >= 5 && right.length >= 5 && (left.includes(right) || right.includes(left))
    ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
    : 0;
  return Math.max(diceSimilarity(left, right), tokenSimilarity(a, b) * 0.96, containment * 0.94);
}

function dateDistanceDays(a: UpcomingFixture, b: UpcomingFixture) {
  const left = new Date(`${a.date}T12:00:00Z`).getTime();
  const right = new Date(`${b.date}T12:00:00Z`).getTime();
  return Math.round(Math.abs(left - right) / 86_400_000);
}

function fixtureMatchScore(a: UpcomingFixture, b: UpcomingFixture, map: Map<string, string>) {
  const variantAHome = variantSignature(a.homeTeam);
  const variantBHome = variantSignature(b.homeTeam);
  const variantAAway = variantSignature(a.awayTeam);
  const variantBAway = variantSignature(b.awayTeam);
  if ((variantAHome || variantBHome) && variantAHome !== variantBHome) return null;
  if ((variantAAway || variantBAway) && variantAAway !== variantBAway) return null;

  const days = dateDistanceDays(a, b);
  if (days > 1) return null;
  const kickoffA = new Date(a.kickoff).getTime();
  const kickoffB = new Date(b.kickoff).getTime();
  if (!Number.isFinite(kickoffA) || !Number.isFinite(kickoffB)) return null;
  const timeDifferenceMs = Math.abs(kickoffA - kickoffB);
  if (timeDifferenceMs > 18 * 60 * 60 * 1000) return null;

  const home = teamSimilarity(a.homeTeam, b.homeTeam, map);
  const away = teamSimilarity(a.awayTeam, b.awayTeam, map);
  const minimum = Math.min(home, away);
  const average = (home + away) / 2;
  if (minimum < 0.62 || average < 0.74) return null;

  const timeScore = Math.max(0, 1 - timeDifferenceMs / (18 * 60 * 60 * 1000));
  const exactDateBonus = days === 0 ? 0.035 : 0;
  const score = average * 0.82 + minimum * 0.10 + timeScore * 0.08 + exactDateBonus;
  return score >= 0.76 ? { score, timeDifferenceMs, home, away } : null;
}

function sameFixture(a: UpcomingFixture, b: UpcomingFixture, map: Map<string, string>) {
  return Boolean(fixtureMatchScore(a, b, map));
}

function mergeOdds(apiOdds: UpcomingOdds, betExplorerOdds: UpcomingOdds) {
  // BetExplorer is authoritative for the 1X2 values it exposes on its fixture listing.
  // API-Football remains the source for extended markets not present there.
  return { ...apiOdds, ...betExplorerOdds };
}

function mergeFixtures(apiFixtures: UpcomingFixture[], betFixtures: UpcomingFixture[]) {
  const aliasMap = aliases();
  const usedApi = new Set<number>();
  const output: UpcomingFixture[] = [];
  let matched = 0;

  for (const betFixture of betFixtures) {
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < apiFixtures.length; index += 1) {
      if (usedApi.has(index)) continue;
      const apiFixture = apiFixtures[index];
      if (!sameFixture(betFixture, apiFixture, aliasMap)) continue;
      const score = diceSimilarity(canonicalName(betFixture.homeTeam, aliasMap), canonicalName(apiFixture.homeTeam, aliasMap))
        + diceSimilarity(canonicalName(betFixture.awayTeam, aliasMap), canonicalName(apiFixture.awayTeam, aliasMap));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      const apiFixture = apiFixtures[bestIndex];
      usedApi.add(bestIndex);
      matched += 1;
      output.push({
        ...apiFixture,
        provider: 'hybrid',
        providerUrl: betFixture.providerUrl,
        oddsSource: 'betexplorer+api-football',
        dataQuality: Math.min(100, Math.max(apiFixture.dataQuality || 70, betFixture.dataQuality || 60) + 8),
        odds: mergeOdds(apiFixture.odds, betFixture.odds),
        rawOdds: {
          apiFootball: apiFixture.rawOdds ?? null,
          betExplorer: betFixture.rawOdds ?? null
        },
        updatedAt: new Date().toISOString()
      });
    } else {
      output.push(betFixture);
    }
  }

  for (let index = 0; index < apiFixtures.length; index += 1) {
    if (!usedApi.has(index)) output.push(apiFixtures[index]);
  }

  return {
    fixtures: output,
    matched,
    unmatchedBetExplorer: betFixtures.length - matched,
    unmatchedApiFootball: apiFixtures.length - matched
  };
}


function mergeOddsApiFallback(existingFixtures: UpcomingFixture[], oddsFixtures: UpcomingFixture[], includeUnmatched: boolean) {
  const aliasMap = aliases();
  const candidates: Array<{ existingIndex: number; fallbackIndex: number; score: number; timeDifferenceMs: number }> = [];
  for (let existingIndex = 0; existingIndex < existingFixtures.length; existingIndex += 1) {
    for (let fallbackIndex = 0; fallbackIndex < oddsFixtures.length; fallbackIndex += 1) {
      const match = fixtureMatchScore(existingFixtures[existingIndex], oddsFixtures[fallbackIndex], aliasMap);
      if (match) candidates.push({ existingIndex, fallbackIndex, score: match.score, timeDifferenceMs: match.timeDifferenceMs });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.timeDifferenceMs - b.timeDifferenceMs);

  const usedExisting = new Set<number>();
  const usedFallback = new Set<number>();
  const linked = new Map<number, number>();
  for (const candidate of candidates) {
    if (usedExisting.has(candidate.existingIndex) || usedFallback.has(candidate.fallbackIndex)) continue;
    usedExisting.add(candidate.existingIndex);
    usedFallback.add(candidate.fallbackIndex);
    linked.set(candidate.existingIndex, candidate.fallbackIndex);
  }

  const output = existingFixtures.map((existing, existingIndex) => {
    const fallbackIndex = linked.get(existingIndex);
    if (fallbackIndex == null) return existing;
    const fallback = oddsFixtures[fallbackIndex];
    return {
      ...existing,
      provider: 'hybrid' as const,
      oddsSource: `${existing.oddsSource || existing.provider || 'primary'}+odds-api`,
      dataQuality: Math.min(100, Math.max(existing.dataQuality || 60, fallback.dataQuality || 70) + 4),
      // Primary prices remain authoritative; Odds API fills the gaps.
      odds: { ...fallback.odds, ...existing.odds },
      rawOdds: { primary: existing.rawOdds ?? null, oddsApi: fallback.rawOdds ?? null },
      updatedAt: new Date().toISOString()
    };
  });
  let added = 0;
  if (includeUnmatched) {
    for (let index = 0; index < oddsFixtures.length; index += 1) {
      if (!usedFallback.has(index)) {
        output.push(oddsFixtures[index]);
        added += 1;
      }
    }
  }
  return { fixtures: output, matched: usedFallback.size, unmatched: oddsFixtures.length - usedFallback.size, added };
}

export function matchFixtureForTesting(primary: UpcomingFixture, fallback: UpcomingFixture) {
  return fixtureMatchScore(primary, fallback, aliases());
}

function filterFixtures(fixtures: UpcomingFixture[]) {
  const excludedCountries = new Set((process.env.EXCLUDED_COUNTRIES || '').split(',').map((value: string) => normalizeName(value)).filter(Boolean));
  const excludedLeagues = new Set((process.env.EXCLUDED_LEAGUE_IDS || '').split(',').map((value: string) => value.trim()).filter(Boolean));
  const includeCountries = new Set((process.env.INCLUDED_COUNTRIES || '').split(',').map((value: string) => normalizeName(value)).filter(Boolean));
  return fixtures.filter((fixture) => {
    if (excludedCountries.has(normalizeName(fixture.country))) return false;
    if (excludedLeagues.has(String(fixture.leagueId)) || excludedLeagues.has(fixture.leagueCode)) return false;
    if (includeCountries.size && !includeCountries.has(normalizeName(fixture.country))) return false;
    return true;
  });
}

export async function fetchMultiLeagueUpcomingFixtures(from: string, to: string) {
  const selectedMode = mode();
  let apiFixtures: UpcomingFixture[] = [];
  let apiError: string | undefined;
  let betExplorerResult = selectedMode === 'betexplorer' || selectedMode === 'hybrid'
    ? await fetchBetExplorerFixtures(from, to)
    : {
        fixtures: [] as UpcomingFixture[],
        report: {
          provider: 'betexplorer' as const,
          enabled: false,
          requestedPages: 0,
          parsedFixtures: 0,
          fixturesWith1X2: 0,
          pages: [],
          warnings: []
        }
      };

  if (selectedMode === 'api-football' || selectedMode === 'hybrid') {
    if (process.env.API_FOOTBALL_KEY?.trim()) {
      try {
        apiFixtures = (await fetchApiFootballFixtures(from, to)).map((fixture) => ({
          ...fixture,
          provider: 'api-football',
          oddsSource: 'api-football',
          dataQuality: Object.keys(fixture.odds).length >= 5 ? 85 : Object.keys(fixture.odds).length >= 3 ? 72 : 58
        }));
      } catch (error) {
        apiError = error instanceof Error ? error.message : String(error);
      }
    } else {
      apiError = 'API_FOOTBALL_KEY is not configured.';
    }
  }

  if (selectedMode === 'api-football') {
    betExplorerResult = { ...betExplorerResult, fixtures: [] };
  }
  if (selectedMode === 'betexplorer') {
    apiFixtures = [];
    apiError = undefined;
  }

  const merged = selectedMode === 'hybrid'
    ? mergeFixtures(apiFixtures, betExplorerResult.fixtures)
    : {
        fixtures: selectedMode === 'betexplorer' ? betExplorerResult.fixtures : apiFixtures,
        matched: 0,
        unmatchedBetExplorer: selectedMode === 'betexplorer' ? betExplorerResult.fixtures.length : 0,
        unmatchedApiFootball: selectedMode === 'api-football' ? apiFixtures.length : 0
      };

  const fallbackEnabled = String(process.env.ODDS_API_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false';
  const fallbackThreshold = Math.max(1, Number(process.env.ODDS_API_FALLBACK_MIN_FIXTURES || 80));
  const extendedThreshold = Math.max(0, Number(process.env.ODDS_API_FALLBACK_MIN_EXTENDED_FIXTURES || 30));
  const minimumPrimaryCoverage = Math.max(0, Math.min(1, Number(process.env.ODDS_API_FALLBACK_MIN_1X2_COVERAGE || 0.95)));
  const minimumExtendedCoverage = Math.max(0, Math.min(1, Number(process.env.ODDS_API_FALLBACK_MIN_EXTENDED_COVERAGE || 0.60)));
  const completePrimary = merged.fixtures.filter((fixture) => fixture.odds.home && fixture.odds.draw && fixture.odds.away).length;
  const completeExtended = merged.fixtures.filter((fixture) => fixture.odds.over25 && fixture.odds.under25).length;
  const primaryCoverage = merged.fixtures.length ? completePrimary / merged.fixtures.length : 0;
  const extendedCoverage = merged.fixtures.length ? completeExtended / merged.fixtures.length : 0;
  const requiredPrimary = Math.min(merged.fixtures.length, fallbackThreshold);
  const requiredExtended = Math.min(merged.fixtures.length, extendedThreshold);
  const triggerReasons: string[] = [];
  if (!merged.fixtures.length) triggerReasons.push('API-Football returned no fixtures.');
  if (completePrimary < requiredPrimary) triggerReasons.push(`Only ${completePrimary}/${requiredPrimary} required fixtures have complete 1X2 odds.`);
  if (completeExtended < requiredExtended) triggerReasons.push(`Only ${completeExtended}/${requiredExtended} required fixtures have complete O/U 2.5 odds.`);
  if (merged.fixtures.length && primaryCoverage < minimumPrimaryCoverage) triggerReasons.push(`1X2 coverage ${(primaryCoverage * 100).toFixed(1)}% is below ${(minimumPrimaryCoverage * 100).toFixed(0)}%.`);
  if (merged.fixtures.length && extendedCoverage < minimumExtendedCoverage) triggerReasons.push(`O/U 2.5 coverage ${(extendedCoverage * 100).toFixed(1)}% is below ${(minimumExtendedCoverage * 100).toFixed(0)}%.`);
  let oddsApiFixtures: UpcomingFixture[] = [];
  let oddsApiError: string | undefined;
  let oddsApiReport = {
    enabled: Boolean(process.env.ODDS_API_KEY?.trim()), usedAsFallback: false, fixtures: 0,
    fixturesWith1X2: 0, requests: 0, warnings: [] as string[], triggerReasons,
    primaryCoverage, extendedCoverage, matchedToPrimary: 0, unmatched: 0, addedUnmatched: 0, includeUnmatched: false
  };
  if (fallbackEnabled && process.env.ODDS_API_KEY?.trim() && triggerReasons.length > 0) {
    try {
      const result = await fetchOddsApiFixtures(from, to, true);
      oddsApiFixtures = result.fixtures;
      oddsApiReport = {
        enabled: result.report.enabled, usedAsFallback: true, fixtures: result.report.fixtures,
        fixturesWith1X2: result.report.fixturesWith1X2, requests: result.report.requests,
        warnings: result.report.warnings, triggerReasons, primaryCoverage, extendedCoverage, matchedToPrimary: 0, unmatched: result.report.fixtures, addedUnmatched: 0, includeUnmatched: false
      };
    } catch (error) {
      oddsApiError = error instanceof Error ? error.message : String(error);
      oddsApiReport = { ...oddsApiReport, usedAsFallback: true, warnings: [oddsApiError] };
    }
  }
  const includeUnmatchedFallback = merged.fixtures.length === 0
    || String(process.env.ODDS_API_INCLUDE_UNMATCHED_FIXTURES ?? 'false').toLowerCase() === 'true';
  const oddsMerged = oddsApiFixtures.length
    ? mergeOddsApiFallback(merged.fixtures, oddsApiFixtures, includeUnmatchedFallback)
    : { fixtures: merged.fixtures, matched: 0, unmatched: 0, added: 0 };
  oddsApiReport = {
    ...oddsApiReport,
    matchedToPrimary: oddsMerged.matched,
    unmatched: oddsMerged.unmatched,
    addedUnmatched: oddsMerged.added,
    includeUnmatched: includeUnmatchedFallback
  };
  const fixtures = filterFixtures(oddsMerged.fixtures)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const warnings = [...betExplorerResult.report.warnings, ...oddsApiReport.warnings];
  if (apiError) warnings.push(apiError);
  if (selectedMode === 'hybrid' && !betExplorerResult.fixtures.length) warnings.push('Hybrid mode continued with API-Football because BetExplorer returned no usable fixtures.');
  if (selectedMode === 'hybrid' && !apiFixtures.length) warnings.push('Hybrid mode continued with BetExplorer-only fixtures because API-Football returned no usable fixtures.');

  lastReport = {
    mode: selectedMode,
    fixtures: fixtures.length,
    apiFootball: { enabled: selectedMode !== 'betexplorer', fixtures: apiFixtures.length, error: apiError },
    betExplorer: betExplorerResult.report,
    oddsApi: { ...oddsApiReport, error: oddsApiError },
    matchedAcrossProviders: merged.matched + oddsMerged.matched,
    unmatchedBetExplorer: merged.unmatchedBetExplorer,
    unmatchedApiFootball: Math.max(0, apiFixtures.length - oddsMerged.matched),
    warnings
  };

  if (!fixtures.length) {
    throw new Error(`No upcoming fixtures were returned. API-Football: ${apiError || '0 fixtures'}. BetExplorer: ${betExplorerResult.report.parsedFixtures} parsed. Odds API: ${oddsApiError || oddsApiReport.fixtures + ' fixtures'}. Check /api/v1/providers/status.`);
  }

  return { fixtures, report: lastReport };
}

export function providerConfiguration() {
  return {
    mode: mode(),
    leagueMode: process.env.API_FOOTBALL_LEAGUE_IDS?.trim() ? 'selected' : 'all',
    apiFootball: {
      enabled: Boolean(process.env.API_FOOTBALL_KEY?.trim()) && mode() !== 'betexplorer',
      selectedLeagueIds: (process.env.API_FOOTBALL_LEAGUE_IDS || '').split(',').map((value: string) => value.trim()).filter(Boolean)
    },
    betExplorer: betExplorerConfiguration(),
    oddsApi: oddsApiConfiguration(),
    lastReport
  };
}
