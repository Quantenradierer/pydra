// Serves the production build (run `npm run build` first) with a throwaway
// data directory and a known feedback token. The built PWA is copied to
// STATIC_COPY so tests can simulate a new deployment by changing files.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATIC_COPY } from './paths.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
rmSync(STATIC_COPY, { recursive: true, force: true });
cpSync(join(root, 'web/dist'), STATIC_COPY, { recursive: true });

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'pydra-e2e-data-'));
process.env.STATIC_DIR = STATIC_COPY;
process.env.FEEDBACK_TOKEN = 'e2e-token';
process.env.OPENAI_API_KEY = ''; // the e2e tests mock /api/ask in the browser
await import(join(root, 'server/dist/main.js'));
