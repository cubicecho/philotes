import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Empty, so a test that loads the db client by mistake fails at once. Tests build their own PGlite.
    env: { DATABASE_URL: '' },
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
