import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printSchema } from 'graphql';
import { schema } from './schema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const projectRoot = resolve(__dirname, '..', '..');
  const outputDir = resolve(projectRoot, 'server', '__generated__');
  const outputPath = resolve(outputDir, 'schema.graphql');

  const sdl = printSchema(schema);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, sdl, 'utf-8');
}

main();
