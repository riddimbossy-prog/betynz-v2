# Betynz v2.8.1 Build Validation

Validated in the build sandbox on 24 July 2026.

## Passed

- All 28 TypeScript/TSX source files under `apps/api/src` and `apps/web/src` passed syntax parsing.
- The complete API source passed a strict TypeScript semantic check using declarations for unavailable external packages.
- The complete React source passed a strict TypeScript semantic check using declarations for unavailable UI packages.
- All 6 JSON files parsed successfully.
- All 4 Render/GitHub YAML files parsed successfully.
- Browser collector and service-worker JavaScript passed `node --check`.
- Base Zeus engine smoke test passed.
- Ares full-history favorite test passed at odds `1.55`.
- The Ares boundary test confirmed odds exactly `1.60` are rejected.
- The Ares thin-league fallback remained Provisional.
- The Odds API rescue smoke test matched teams and kickoff time and filled Home/Draw/Away odds.
- Static assertions confirmed direct-date-first collection, the rescue endpoint, retained-database protection, automatic provider rescue and engine version `zeus-chronos-ares-2.8.1`.

## Not run in the sandbox

- Live requests to BetExplorer, API-Football, The Odds API, Supabase and the deployed Render service were not possible because external network access and project secrets are unavailable here.
- A complete `npm install && npm run build` was not run because the sandbox cannot download npm dependencies and the source package does not include `node_modules`.
- The actual Playwright workflow will run in GitHub Actions, where Chromium and npm dependencies are installed.
