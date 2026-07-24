# Betynz v2.9.1 — Render Build Hotfix

## Fixed

- Production TypeScript builds now exclude standalone smoke-test files (`src/**/*-smoke.ts`).
- This prevents obsolete local test files such as `src/ares-smoke.ts` from breaking Render deployment.
- Regular source files are still compiled normally.
- Smoke tests remain runnable through their existing `npm run test:*` commands with `tsx`.

## Render error addressed

```text
src/ares-smoke.ts: no exported member analyzeAresFixture
src/ares-smoke.ts: no exported member ARES_ENGINE_VERSION
```

The stale Ares smoke test is not part of the production application and should not be compiled into the deployment bundle.
