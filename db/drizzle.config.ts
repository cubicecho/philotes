import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

// drizzle.config.ts is one level below the project root (db → root)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const dataDir = process.env.DATABASE_URL ?? path.join(projectRoot, 'pgdata');

export default defineConfig({
  out: './drizzle',
  schema: ['./src/schema.ts', './src/api-keys.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    url: dataDir,
  },
});
