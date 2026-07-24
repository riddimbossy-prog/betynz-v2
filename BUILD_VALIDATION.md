# Betynz v2.8.0 Build Validation

Validated in the build sandbox on 24 July 2026.

## Passed

- Ares engine and its local TypeScript dependency graph passed strict TypeScript checks.
- Prediction dashboard service passed strict TypeScript checks using dependency stubs for unavailable external packages.
- React application, API client and web types passed strict TypeScript checks using UI dependency stubs.
- All 26 TypeScript and TSX source files passed transpile/syntax checks.
- JSON files parsed successfully.
- Render/GitHub YAML files parsed successfully.
- Browser-sync JavaScript passed `node --check`.
- Ares full-history smoke test passed at favorite odds 1.55.
- Ares provisional thin-league fallback smoke test passed.
- The strict upper boundary test confirmed that odds exactly 1.60 are excluded.
- The smoke test confirmed Ares outputs `ARES_STREAK_FAVOURITE` and never promotes the provisional fallback to Banker.

## Not run in the sandbox

A complete `npm install && npm run build` was not run because this environment has no external npm network access and the repository does not contain `node_modules`. Render or GitHub will install the declared dependencies during deployment.
