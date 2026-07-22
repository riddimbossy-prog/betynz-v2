import type { NormalizedMatch } from './types.js';

type Band = { label: string; sample: number; hitRate: number; market: string };

function percentage(wins: number, sample: number) {
  return sample ? Number(((wins / sample) * 100).toFixed(1)) : 0;
}

export function buildOddsBands(matches: NormalizedMatch[]): Band[] {
  const favourite = matches.filter((m) => {
    const prices = [m.odds.openingHome, m.odds.openingAway].filter((v): v is number => typeof v === 'number');
    return prices.length === 2 && Math.min(...prices) >= 1.2 && Math.min(...prices) < 1.4;
  });
  const favWins = favourite.filter((m) => {
    const h = m.odds.openingHome ?? Infinity;
    const a = m.odds.openingAway ?? Infinity;
    return h < a ? m.result === 'H' : m.result === 'A';
  }).length;

  const overBand = matches.filter((m) => (m.odds.openingOver25 ?? 99) >= 1.45 && (m.odds.openingOver25 ?? 99) < 1.65);
  const overWins = overBand.filter((m) => m.homeGoals + m.awayGoals >= 3).length;

  const drawBand = matches.filter((m) => (m.odds.openingDraw ?? 99) >= 3.2 && (m.odds.openingDraw ?? 99) < 3.6);
  const drawWins = drawBand.filter((m) => m.result === 'D').length;

  return [
    { label: 'Favourite 1.20–1.39', sample: favourite.length, hitRate: percentage(favWins, favourite.length), market: 'Favourite win' },
    { label: 'O2.5 opening 1.45–1.64', sample: overBand.length, hitRate: percentage(overWins, overBand.length), market: 'Over 2.5' },
    { label: 'Draw 3.20–3.59', sample: drawBand.length, hitRate: percentage(drawWins, drawBand.length), market: 'Draw result' }
  ];
}
