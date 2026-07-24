# Betynz v2.7.1 — Zeus Auto Picks hotfix

- Prevents a missing v2.7 intelligence migration from blocking the entire prediction rebuild.
- Falls back to computed historical streak intelligence until the optional Supabase tables are available.
- Starts a background rebuild when fixtures exist but no v2.7.1 predictions have been created yet, while temporarily showing the newest compatible feed instead of a blank page.
- Includes qualified provisional selections in Zeus Auto Picks, while still keeping them out of Bankers.
- Opens the first date that actually contains picks instead of showing an empty today tab when later dates have selections.
- Adds a visible refresh action and API error message instead of silently showing zero picks.
- Bumps the PWA cache so installed devices receive the fix.
