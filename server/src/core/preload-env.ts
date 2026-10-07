// Preload: optionally load .env before the main module initializes.
// Runs via --import flag so it executes before ESM imports are hoisted.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');

try {
  process.loadEnvFile(envPath);
} catch {
  // .env not present — use environment variables as-is (Docker/CI)
}
