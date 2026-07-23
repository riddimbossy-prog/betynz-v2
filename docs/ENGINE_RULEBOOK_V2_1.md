# Chronos Fusion v2.1 — production rulebook

## Prediction window

The engine processes today plus five future dates. The public board shows one best market per fixture and permits `NO PICK`.

## Initial markets

- Home team over 0.5
- Away team over 0.5
- Over 1.5
- Under 3.5
- Double Chance 1X / X2
- Over 2.5
- Under 2.5

Upgrade markets:

- Team over 1.5
- Over 2.5
- Under 2.5
- Draw No Bet
- Straight win

## Four-engine consensus

- **Chronos:** nearest historical odds profiles
- **Athena:** team form, scoring, defending, shots and venue splits
- **Zeus:** model probability versus fair market probability
- **Leonidas:** sample size, data completeness and contradiction rejection

A regular pick needs at least 3/4 engines. A banker needs 4/4.

## 1.19 low-odds rule

When the best candidate is below 1.19, the engine tests exactly one stronger related market first. The stronger market needs:

- odds of at least 1.19;
- a stricter probability buffer;
- positive market edge of at least three percentage points;
- at least 80 similar historical matches;
- all four engines passing;
- a contradiction score of 24 or lower.

When the upgrade fails, the original low price is not published.

## Banker definition

A banker requires:

- all four engines passing;
- confidence of 82 or higher;
- market odds of 1.19 or higher;
- strict probability threshold plus a three-point buffer;
- market edge of at least three percentage points;
- at least 80 historical neighbors;
- low contradiction and strong data completeness.

The public section displays the best three bankers per selected day. Banker does not mean guaranteed.

## Simple-English explanation

Every selection stores:

- recent scoring or conceding counts;
- home/away points per game;
- league type;
- historical sample and hit rate;
- table position when available;
- expected goals;
- market edge;
- each engine’s pass/fail reason;
- low-odds upgrade explanation when used.
