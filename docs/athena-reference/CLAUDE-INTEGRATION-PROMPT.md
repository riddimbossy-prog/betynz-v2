# Prompt for Claude Code

Use this prompt after adding the Athena zip/folder to the Betynz repository.

---

You are integrating `@betynz/athena-transition-engine` into the existing Betynz.com codebase.

Requirements:

1. Read the package `README.md`, `INTEGRATION-BETYNZ.md`, input schema and tests first.
2. Do not change the engine rules, thresholds or market scoring. This is frozen Athena v1.0-RC1.
3. Execute the engine server-side only. Do not expose source logic in the public browser bundle.
4. Map the existing Betynz fixture, HT/FT, Over/Under and odds data into the supplied schema.
5. Validate that all nine HT/FT counts sum exactly to matches played. Reject incomplete inputs instead of guessing.
6. Save the exact input snapshot, output snapshot, engine version and generated timestamp before kickoff.
7. Never overwrite a prior prediction. Store revisions separately.
8. Add an admin-only `/admin/athena-shadow` dashboard showing pending, won, lost and no-pick results.
9. Add automatic settlement for the supported markets.
10. Keep RC1 in shadow mode. Do not show Athena picks to normal users.
11. Preserve the existing Betynz mobile, tablet and Z Fold layouts.
12. Run the package tests and the existing Betynz test/build workflow before finishing.
13. Return a summary of files changed, migrations added, environment variables needed and exact deployment steps.

Do not invent data. When required data is missing, return `NO_PICK` or an input validation error.

---
