import { defineConfig } from 'vitest/config';

// Standalone config for the environment-injectable HTTP test suite. Kept
// separate from the repo's root `vitest.config.ts` (which fans out to the
// per-package `projects`) so `npm test` runs only these black-box tests.
export default defineConfig({
  test: {
    environment: 'node',
    // Local mode boots an in-process WASM Postgres per file; forks keep each
    // suite's server/socket state isolated.
    pool: 'forks',
    include: ['tests/**/*.spec.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
  // Root is the repo root so `include` and the relative app imports resolve.
  root: import.meta.dirname ? `${import.meta.dirname}/..` : process.cwd(),
});
