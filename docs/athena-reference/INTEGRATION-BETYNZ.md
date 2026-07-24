# Betynz Integration Guide

## 1. Copy the package

Copy this folder into the Betynz repository, for example:

```text
betynz/
  packages/
    athena-transition-engine/
```

Then add it to the server package:

```json
{
  "dependencies": {
    "@betynz/athena-transition-engine": "file:../packages/athena-transition-engine"
  }
}
```

Run:

```bash
npm install
```

## 2. Server-side execution only

Run Athena on the backend or scheduled workflow. Do not expose the full scoring logic or thresholds in the public browser bundle.

```js
import { analyseFixture } from '@betynz/athena-transition-engine';

export async function generateAthenaPick(fixture) {
  const input = mapDatabaseFixtureToAthena(fixture);
  const result = analyseFixture(input);
  await saveAthenaPrediction(result);
  return result;
}
```

## 3. Required database fields

Create an `athena_predictions` table with at least:

- `id`
- `fixture_id`
- `engine_version`
- `generated_at`
- `kickoff_at`
- `classification`
- `classification_side`
- `banker_market`
- `banker_score`
- `status` (`pending`, `won`, `lost`, `void`, `no_pick`)
- `input_snapshot_json`
- `output_snapshot_json`
- `settled_at`

Save the complete input and output snapshots before kickoff. This prevents hindsight edits.

## 4. Shadow-mode display

For RC1, keep picks hidden from ordinary users. Add an admin-only route such as:

```text
/admin/athena-shadow
```

Display:

- classification
- banker
- score
- warnings
- pre-kickoff timestamp
- result and settlement
- accuracy by market and classification

## 5. Scheduler

Run Athena after the daily fixture enrichment completes and again only when material pre-match data changes. Do not overwrite the original prediction. Create a new revision with a timestamp.

## 6. NO PICK handling

When `banker.market === "NO_PICK"`:

- do not show a public selection
- store the skipped fixture
- include it in coverage and rejection statistics

## 7. Recommended API route

```js
import express from 'express';
import { createAthenaHandler } from '@betynz/athena-transition-engine/express';

const router = express.Router();
router.post('/internal/engines/athena/analyse', createAthenaHandler());
export default router;
```

Protect the endpoint with your existing admin/service authentication.

## 8. Production promotion gate

Promote RC1 only after a frozen batch of at least 100 unseen matches and a full review by:

- market
- classification
- league
- score band
- home/away split availability
- odds conflict

Do not modify RC1 in the middle of the batch. Any later changes become v1.1.
