import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

const ENV_FILE = '../.env';
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

export default defineConfig({
  out: './drizzle',
  schema: ['./src/schema.ts', './src/api-keys.ts'],
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
