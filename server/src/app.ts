import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import { getConnInfo } from '@hono/node-server/conninfo';
import { APP_NAME, FEEDBACK_PATH, validateFeedback, type ApiError } from '@pydra/shared';
import type { FeedbackStore } from './feedback-store.ts';
import { RateLimiter } from './rate-limit.ts';

export const FEEDBACK_RATE_LIMIT = { posts: 5, windowMs: 60_000 };

/** Content-hashed build output: safe to cache forever. */
export const IMMUTABLE = 'public, max-age=31536000, immutable';
/** Everything else (index.html, sw.js, manifest, workbox files, icons) is revalidated. */
export const REVALIDATE = 'no-cache';

export interface AppOptions {
  /** Directory holding the built PWA; omit to serve the API only. */
  staticDir?: string;
  feedback?: FeedbackStore;
  /** Bearer token for reading feedback; reading is disabled when empty. */
  feedbackToken?: string;
  now?: () => Date;
}

/**
 * Client IP. Behind the reverse proxy the socket address is the proxy, so the
 * last X-Forwarded-For entry (the one the proxy appended) is used, then
 * X-Real-IP, then the socket address.
 */
function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',').at(-1)!.trim();
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function tokenMatches(header: string | undefined, token: string | undefined): boolean {
  if (!token || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono();
  const now = options.now ?? (() => new Date());
  const limiter = new RateLimiter(FEEDBACK_RATE_LIMIT.posts, FEEDBACK_RATE_LIMIT.windowMs, () => now().getTime());
  const error = (c: Context, status: 400 | 401 | 413 | 429, code: ApiError['error']) =>
    c.json<ApiError>({ error: code }, status);

  const feedback = options.feedback;

  app.get('/api/health', (c) => {
    try {
      feedback?.ping();
    } catch {
      return c.json({ ok: false, app: APP_NAME }, 503);
    }
    return c.json({ ok: true, app: APP_NAME });
  });

  if (feedback) {
    app.post(
      FEEDBACK_PATH,
      bodyLimit({ maxSize: 32 * 1024, onError: (c) => error(c, 413, 'too-long') }),
      async (c) => {
        if (!limiter.allow(clientIp(c))) return error(c, 429, 'rate-limited');
        const body: unknown = await c.req.json().catch(() => null);
        const result = validateFeedback(body);
        if ('error' in result) return error(c, 400, result.error);
        return c.json(feedback.add(result.text, now()), 201);
      },
    );

    app.get(FEEDBACK_PATH, (c) => {
      if (!tokenMatches(c.req.header('authorization'), options.feedbackToken)) {
        return error(c, 401, 'unauthorized');
      }
      return c.json(feedback.list());
    });
  }

  app.all('/api/*', (c) => c.json({ error: 'not-found' }, 404));

  if (options.staticDir) {
    const root = options.staticDir;
    // Set after serving, so it applies to static files and the index.html fallback.
    app.use('/*', async (c, next) => {
      await next();
      if (c.res.ok) c.res.headers.set('Cache-Control', c.req.path.startsWith('/assets/') ? IMMUTABLE : REVALIDATE);
    });
    app.use('/*', serveStatic({ root }));
    // A missing hashed asset must not be answered with index.html.
    app.get('/assets/*', (c) => c.text('Not found', 404));
    // Single-page app: unknown non-API paths fall back to index.html.
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }

  return app;
}
