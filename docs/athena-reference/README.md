# Athena Transition Engine v1.0-RC1

Frozen HT/FT transition engine prepared for Betynz.com shadow integration.

## What it does

Athena reads each team's nine HT/FT states:

- W/W, W/D, W/L
- D/W, D/D, D/L
- L/W, L/D, L/L

It then compares compatible routes, comeback ability, lead protection, draw tendency, goal profile and odds disagreement. The engine returns:

- match classification
- one banker or `NO_PICK`
- up to three secondary markets
- reasons, warnings and full audit data

## Install

```bash
npm install
npm test
npm run demo
```

## Use

```js
import { analyseFixture } from '@betynz/athena-transition-engine';

const result = analyseFixture(fixtureInput);
console.log(result.banker);
```

See `examples/okmk-vs-kokand.json` and `schemas/fixture-input.schema.json`.

## Frozen RC1 rules

Do not change thresholds during the shadow-test batch. Run at least 100 unseen fixtures, save every pre-kickoff output, settle automatically, then review the whole batch.

## Important

This package does not guarantee outcomes. It is a shadow-testing prediction component and should display confidence labels rather than claims of certainty.
