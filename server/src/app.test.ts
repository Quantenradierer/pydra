import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMMUTABLE, REVALIDATE, createApp, tokenMatches } from './app.ts';
import { FeedbackStore } from './feedback-store.ts';

function staticApp() {
  const root = mkdtempSync(join(tmpdir(), 'pydra-static-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Pydra</title>');
  writeFileSync(join(root, 'sw.js'), '// sw');
  writeFileSync(join(root, 'manifest.webmanifest'), '{}');
  writeFileSync(join(root, 'workbox-1234abcd.js'), '// workbox');
  writeFileSync(join(root, 'assets', 'index-abc123.js'), 'console.log(1)');
  return createApp({ staticDir: root });
}

describe('server app', () => {
  it('answers the health check using the shared package', async () => {
    const res = await createApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, app: 'Pydra' });
  });

  it('reports unhealthy when the database is unusable', async () => {
    const feedback = new FeedbackStore(':memory:');
    const app = createApp({ feedback });
    expect((await app.request('/api/health')).status).toBe(200);
    feedback.close();
    expect((await app.request('/api/health')).status).toBe(503);
  });

  it('answers unknown API paths with JSON 404, not the app', async () => {
    const res = await staticApp().request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not-found' });
  });
});

describe('static files', () => {
  it('caches hashed assets forever', async () => {
    const res = await staticApp().request('/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE);
  });

  it('revalidates index.html, the service worker, the manifest and workbox files', async () => {
    const app = staticApp();
    for (const path of ['/', '/index.html', '/sw.js', '/manifest.webmanifest', '/workbox-1234abcd.js']) {
      const res = await app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('cache-control'), path).toBe(REVALIDATE);
    }
  });

  it('falls back to index.html for app paths', async () => {
    const res = await staticApp().request('/some/route');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Pydra</title>');
    expect(res.headers.get('cache-control')).toBe(REVALIDATE);
  });

  it('does not answer missing hashed assets with index.html', async () => {
    const res = await staticApp().request('/assets/missing-000.js');
    expect(res.status).toBe(404);
  });
});

describe('token check', () => {
  it('accepts only the exact bearer token', () => {
    expect(tokenMatches('Bearer secret', 'secret')).toBe(true);
    expect(tokenMatches('Bearer secre', 'secret')).toBe(false);
    expect(tokenMatches('secret', 'secret')).toBe(false);
    expect(tokenMatches(undefined, 'secret')).toBe(false);
  });

  it('never matches when no token is configured', () => {
    expect(tokenMatches('Bearer ', '')).toBe(false);
    expect(tokenMatches('Bearer x', undefined)).toBe(false);
  });
});
