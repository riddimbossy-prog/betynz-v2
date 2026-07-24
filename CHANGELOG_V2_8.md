# Betynz v2.8.0 — Athena Transition Engine integration

## Added

- Athena Transition Engine v1.0-RC1 as a frozen shadow engine.
- Compatible HT/FT route matching, lead-protection, comeback, draw-lock, swing and multi-route classifications.
- Automatic Athena runs during every prediction rebuild.
- `NO_PICK` support and odds-conflict/home-away safeguards.
- Automatic Athena settlement when historical results are imported.
- Private admin endpoints for the Athena shadow dashboard and rebuilds.
- Supabase `athena_shadow_runs` storage and `goal_profile` intelligence data.
- BetExplorer Over/Under table discovery and parsing.
- Athena counts on the Betynz dashboard without exposing shadow selections publicly.

## Preserved

- Zeus, Chronos and Leonidas public prediction logic.
- Existing v2.7.1 Auto Picks hotfix behaviour.
- Current public prediction board and PWA.

## Deployment requirement

Run `supabase/migrations/006_athena_transition_shadow.sql` before the first production rebuild.
