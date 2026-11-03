import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where the e2e server serves the built PWA from. */
export const STATIC_COPY = join(tmpdir(), 'pydra-e2e-static');
export const FEEDBACK_TOKEN = 'e2e-token';
