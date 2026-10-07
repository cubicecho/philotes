import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = [
  { find: '@', replacement: path.resolve(__dirname, './app/src') },
  // graphql ships no exports map: Vite follows `module` to index.mjs while Node
  // follows `main` to index.js, and the two copies fail each other's instanceof checks.
  { find: /^graphql$/, replacement: path.resolve(__dirname, './node_modules/graphql/index.js') },
];

const SERVER_TEST_TIMEOUT_MS = 30_000;
const SERVER_HOOK_TIMEOUT_MS = 60_000;

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**'],
    // A test that forgets its throwaway db fails loudly instead of writing to the developer's Postgres.
    env: { DATABASE_URL: '' },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['db/**/*.test.ts', 'server/**/*.test.ts'],
          // Each suite pushes the whole schema into a fresh PGlite, which takes seconds on a busy machine.
          testTimeout: SERVER_TEST_TIMEOUT_MS,
          hookTimeout: SERVER_HOOK_TIMEOUT_MS,
        },
      },
      // The app's tests cover plain modules, so they need no DOM. A component test would add a jsdom project.
      { extends: true, test: { name: 'app', environment: 'node', include: ['app/**/*.test.ts'] } },
    ],
  },
});
