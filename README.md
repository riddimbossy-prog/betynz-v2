# Betynz v2.8.0 — Zeus + Athena Transition Shadow Engine

This package is based on **Betynz v2.7.1 Zeus Auto Picks hotfix** and includes the fully integrated **Athena Transition Engine v1.0-RC1**.

## What is included

- Existing Zeus/Chronos/Leonidas public prediction stack.
- Athena Transition Engine in frozen shadow mode.
- HT/FT route compatibility, comeback and lead-protection analysis.
- Draw Lock, Stable Leader, Late Separation, Swing Game, High Event and Multi-Route classifications.
- One Athena banker or `NO_PICK` per fixture.
- Supabase shadow storage and automatic settlement.
- BetExplorer HT/FT plus Over/Under intelligence collection.
- Private Athena admin API and public shadow counters.

## Install

```bash
npm install
npm run build
npm run test:athena
```

Before deployment, run:

```text
supabase/migrations/006_athena_transition_shadow.sql
```

Read `docs/UPGRADE_TO_V2_8.md` and `docs/ATHENA_TRANSITION_V2_8.md` for deployment and verification.

## Important

Athena remains hidden from normal users until the frozen 100-match shadow test is complete. No prediction is guaranteed.
