
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve project root independently of the terminal's working directory.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDirectory, '../..');
const envPath = resolve(projectRoot, '.env');

// Load local .env when available.
// In production, Render injects environment variables directly.
if (existsSync(envPath)) {
  const dotenvResult = config({ path: envPath });

  if (dotenvResult.error) {
    throw dotenvResult.error;
  }

  console.log(`Environment loaded from: ${envPath}`);
} else {
  console.log('No .env file found; using process environment variables.');
}

async function main() {
  const { getEnv } = await import('./config/env.js');
  const env = getEnv();

  const { buildApp } = await import('./app.js');
  const app = buildApp();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${env.PORT}`);
  });

  server.on('error', (error) => {
    console.error('Server startup error:', error.message);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(
    'Application startup failed:',
    error instanceof Error ? error.message : 'Unknown error'
  );
  process.exit(1);
});
