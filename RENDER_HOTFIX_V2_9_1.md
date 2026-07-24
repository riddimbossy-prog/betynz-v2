# Render hotfix steps

1. Replace your project files with this v2.9.1 package.
2. In GitHub Desktop, confirm `apps/api/tsconfig.json` changed.
3. Commit: `Fix Render TypeScript build`
4. Push to GitHub.
5. Render should redeploy automatically.

The key fix is the `exclude` section in `apps/api/tsconfig.json`. It prevents stale `*-smoke.ts` files from being included in the production `tsc` build.

You may also delete `apps/api/src/ares-smoke.ts` from the repository because it is obsolete, but deletion is not required after this hotfix.
