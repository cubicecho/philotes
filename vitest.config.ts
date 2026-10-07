import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // A test that loads the db package gets an in-memory PGlite, never the repo's pgdata directory.
    env: { DATABASE_URL: 'memory://' },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './app/src') },
      // Vite would pick graphql's ESM build while Node gives the packages it leaves external the
      // CommonJS one, and graphql refuses to mix types from two copies.
      { find: /^graphql$/, replacement: path.resolve(__dirname, './node_modules/graphql/index.js') },
    ],
  },
});
