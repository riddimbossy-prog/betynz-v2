# Ares Streak Favorite Engine v2.8

## Purpose

Identify a home or away team as the match winner when it is the clear 1X2 favorite below 1.60 and the two teams' current streaks point toward the same result.

## Price gate

- Allowed favorite odds: `1.19 <= odds < 1.60`.
- Exactly `1.60` is rejected.
- Odds below `1.19` remain blocked by the existing Betynz publication minimum.
- The lower of the home and away 1X2 prices must be unique.

## Positive confirmations

Ares counts these independent confirmations:

1. Favorite venue wins of roughly 2+ or an unbeaten venue run of roughly 4+.
2. Opponent venue losses of roughly 2+ or a no-win venue run of roughly 4+.
3. A compatible home/away confrontation signal scoring at least 50.
4. Favorite HT/FT sample of at least 4 with lead-to-win rate of at least 62%.
5. Both teams on no-draw runs of 3+ while the positive streak direction belongs to the favorite.

At least two confirmations are required. One core confrontation must exist: favorite positive plus opponent negative, or a directional signal plus one of those two sides.

## Rejection conditions

Reject when any of the following dominates:

- favorite losses are roughly 2+;
- favorite no-win run is roughly 3+;
- opponent wins are roughly 2+;
- opponent unbeaten run is roughly 4+;
- a stronger opposite directional signal exists;
- streak samples are below 4 per venue side;
- streak compatibility is below 55%;
- streak contradiction penalty exceeds 22;
- historical odds sample is below 60;
- modeled win probability is below 59%;
- confidence is below 66;
- edge is worse than -1.5%;
- candidate contradiction exceeds 38;
- data completeness is below 50%;
- fewer than three of Chronos, Athena, Zeus and Leonidas pass.

## Output

- Market: `HOME_WIN` or `AWAY_WIN`.
- Qualification: `ARES_STREAK_FAVOURITE`.
- Evidence includes Ares score, confirmations, favorite win/unbeaten streaks, opponent loss/no-win streaks, favorite side, favorite price and strongest directional signal.
- Ares selections can become Bankers only if the existing strict four-engine Banker rules also pass.


## Provisional fallback

When local league history is below the 120-match full Chronos requirement, Ares may still publish a provisional favorite only when:

- both venue streak samples contain at least 4 matches;
- at least two streak confirmations and a core favorite-versus-opponent agreement exist;
- global 1X2 historical-neighbor sample is at least 120;
- the historical side hit rate is at least 56%;
- average price-profile distance is no more than 0.16;
- fixture data quality is at least 75;
- all four provisional checks pass.

This output keeps `ARES_STREAK_FAVOURITE` but uses tier `provisional`, medium risk, and `banker: false`.
