# Betynz Zeus Streak Intelligence v2.7 — Implementation Rulebook

This document describes the rules implemented in `apps/api/src/engine.ts` and `apps/api/src/streak-intelligence.ts`.

## 1. Input layers

Each upcoming fixture can use:

1. complete visible fixture odds;
2. settled historical results and odds from Betynz;
3. recent team form and home/away splits;
4. league scoring and table context;
5. BetExplorer-rendered streak and HT/FT snapshots when team and competition matching succeeds;
6. computed streak and HT/FT snapshots as the fallback.

A BetExplorer snapshot never replaces historical results. It supplies current streak state, while the historical database supplies opponent PPG, odds neighbours, league context and model calibration.

## 2. Streaks

For overall, home and away scopes, the engine measures the current consecutive run of:

- wins;
- draws;
- losses;
- no win;
- no draw;
- unbeaten;
- Over 2.5;
- Under 2.5.

Only the current uninterrupted run is counted. The first non-matching result ends the run.

## 3. Opponent adjustment

Recent opponent strength is the average points per game of the opponents faced in the relevant run window.

```text
multiplier = clamp(opponent average PPG / 1.35, 0.75, 1.25)
adjusted streak = raw streak × multiplier
```

This prevents a long streak against consistently weak opponents from receiving the same weight as a similar streak against strong opponents.

## 4. HT/FT profile

The engine stores the nine half-time/full-time combinations from the perspective of the team:

```text
W/W, W/D, W/L
D/W, D/D, D/L
L/W, L/D, L/L
```

It derives:

- first-half lead rate;
- first-half draw rate;
- first-half trail rate;
- lead-to-win rate;
- draw-to-win rate;
- trail-to-avoid-loss rate.

The home fixture side uses its home profile, the away fixture side uses its away profile, and overall profiles are retained for context and persistence.

## 5. Confrontation signals

The engine compares the two sides and can create these signals:

- home unbeaten vs away no-win;
- away unbeaten vs home no-win;
- home wins vs away losses;
- away wins vs home losses;
- both teams avoid draws;
- both teams are drawing;
- both teams are on Over 2.5 runs;
- both teams are on Under 2.5 runs;
- home side protects first-half leads while the away side struggles to recover.

Each signal receives:

- a score from 0 to 100;
- a compatibility flag;
- a market direction: home, away, draw, Over 2.5, Under 2.5 or neutral;
- a simple-English note.

Compatible signals add market bias. Contradictory signals subtract bias and increase the Leonidas penalty.

## 6. Chronos historical-odds comparison

Chronos finds the closest settled matches by fair-price distance. The current 1X2 and goal-market shape is compared with historical odds profiles. The output includes:

- neighbour sample;
- historical hit rate;
- average odds distance.

A full candidate needs at least 60 similar historical matches. Strict eligibility needs at least 80.

## 7. Candidate probability

For each available market, the implemented blend is:

```text
probability =
  team model × 0.23
  + league rate × 0.11
  + Poisson rate × 0.21
  + venue signal × 0.15
  + historical-neighbour hit rate × 0.18
  + streak confirmation × 0.12
```

The result is clamped between 4% and 96%.

```text
edge = model probability − market fair probability
```

## 8. The four engines

### Chronos

Passes when:

```text
historical neighbour sample ≥ 60
Chronos score ≥ 66
```

### Athena

Checks team form, venue data, O/U 2.5 streaks and HT/FT splits. It passes when:

```text
Athena score ≥ 68
home and away streak samples ≥ 4
home and away HT/FT samples ≥ 4
```

### Zeus

Ranks eligible candidates by the implemented battle score:

```text
Zeus battle score =
  confidence
  + edge × 70
  + Zeus score × 0.12
  + confrontation compatibility × 0.04
  − contradiction × 0.08
```

Only the highest-ranked surviving market becomes the fixture selection.

### Leonidas

Passes when:

```text
contradiction ≤ 34
data completeness ≥ 0.55
streak contradiction penalty ≤ 22
```

Leonidas can reject the complete fixture when the available markets do not survive the gate.

## 9. General eligibility

Normal eligibility requires:

```text
probability ≥ market-specific minimum
edge ≥ 1.5 percentage points
historical sample ≥ 60
contradiction ≤ 36
data completeness ≥ 0.50
at least 3 of 4 engines pass
```

Strict eligibility requires:

```text
probability ≥ market-specific minimum + 3 percentage points
edge ≥ 3 percentage points
historical sample ≥ 80
contradiction ≤ 24
data completeness ≥ 0.70
4 of 4 engines pass
```

## 10. Banker gate

A Banker must be a full prediction and pass every condition:

```text
strict eligibility = true
confidence ≥ 82
all 4 engines pass
published odds ≥ 1.19
confrontation compatibility ≥ 68
streak contradiction penalty ≤ 14
home streak sample ≥ 6
away streak sample ≥ 6
```

Provisional picks can never become Bankers.

## 11. The 1.19 rule

When the winning candidate is below 1.19:

1. test the mapped stronger related market;
2. require odds of at least 1.19;
3. require strict eligibility;
4. publish the upgrade only when all strict checks pass;
5. otherwise search for a similarly confident eligible alternative at 1.19 or higher;
6. reject the fixture when no valid alternative exists.

The original market and odds are saved when an upgrade is published.

## 12. Rejected-battles audit

A rejected fixture records:

- rejection stage;
- reasons;
- visible candidate markets and odds;
- league and team history counts;
- data quality;
- confrontation compatibility;
- contradiction penalty;
- strongest confrontation.

The log is private and available only through the admin-token endpoint.

## 13. Provisional fallback

When local history is not deep enough for full Chronos, a fixture can still receive a provisional 1X2 pick only when its complete 1X2 prices have a strong global historical match. Provisional selections:

- are medium risk;
- cannot enter Zeus Auto Picks;
- cannot become Bankers;
- remain clearly labelled on the website.
