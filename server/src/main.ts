import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { FeedbackStore } from './feedback-store.ts';

const port = Number(process.env.PORT ?? 3000);
const staticDir = process.env.STATIC_DIR ?? '../web/dist';
const dataDir = process.env.DATA_DIR ?? './data';
const feedbackToken = process.env.FEEDBACK_TOKEN ?? '';

mkdirSync(dataDir, { recursive: true });
const feedback = new FeedbackStore(join(dataDir, 'feedback.db'));
if (!feedbackToken) console.warn('FEEDBACK_TOKEN is not set: GET /api/feedback is disabled.');

function positiveInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

const openaiKey = process.env.OPENAI_API_KEY ?? '';
if (!openaiKey) console.warn('OPENAI_API_KEY is not set: POST /api/ask answers 503.');

const app = createApp({ staticDir, feedback, feedbackToken, ask: {
    apiKey: openaiKey,
    model: process.env.OPENAI_MODEL,
    rateLimit: positiveInt(process.env.ASK_RATE_LIMIT),
    dailyLimit: positiveInt(process.env.ASK_DAILY_LIMIT),
  },
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Pydra listening on port ${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    feedback.close();
    process.exit(0);
  });
}
