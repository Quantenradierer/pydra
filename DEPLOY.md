# Deployment

Pydra runs as one Docker container: a Node server that serves the PWA and the
`/api` endpoints. Feedback is stored in SQLite in a volume. Production:
https://pydra.quantenradierer.de/.

## How a change reaches production

1. Run the tests locally. CI runs no tests, type checks or lint:

   ```sh
   npm run check && npm test && npm run build && npm run test:e2e
   ```

2. Push to `main`.
3. GitHub Actions (`.github/workflows/deploy.yml`) builds the image and pushes
   it to GHCR as `ghcr.io/quantenradierer/pydra:<git sha>` and `:latest`.
4. Watchtower on the server checks for a new `:latest` every 5 minutes, pulls
   it and restarts the `pydra` container. The data volume is kept.
5. Open apps pick up the new service worker:
   - on launch, when they become visible again, or after at most an hour;
   - outside a quiz they reload at once;
   - during a quiz they reload when the quiz ends.

## One-time setup

### DNS and GitHub

1. Point `pydra.quantenradierer.de` (A/AAAA record) at the server.
2. Push to `main` once so the workflow publishes the first image.
3. Make the GHCR package public, so the server can pull without logging in:
   GitHub → Packages → `pydra` → Package settings → Change visibility → Public.

### Server (rootless Docker)

1. Create a directory, e.g. `~/pydra`, holding `compose.prod.yaml` and a `.env`:

   ```sh
   FEEDBACK_TOKEN=<long random string, e.g. from `openssl rand -hex 32`>
   # optional: HOST_PORT=3001, WATCHTOWER_POLL_INTERVAL=300
   # "Ask about this question" chat (answers 503 while the key is unset):
   OPENAI_API_KEY=<OpenAI API key>
   # optional: OPENAI_MODEL=gpt-5-mini, ASK_RATE_LIMIT=30 (per IP per 10 min), ASK_DAILY_LIMIT=1000 (all clients per 24 h)
   ```

2. Rootless Docker has its socket at `/run/user/1005/docker.sock`, not
   `/var/run/docker.sock`. Change the Watchtower volume in `compose.prod.yaml` to:

   ```yaml
   volumes:
     - /run/user/1005/docker.sock:/var/run/docker.sock
   ```

3. Start the stack:

   ```sh
   docker compose -f compose.prod.yaml up -d
   ```

### Caddy

Put this site in `/etc/caddy/sites.d/50-pydra.caddy` and reload Caddy
(`sudo systemctl reload caddy`):

```caddy
pydra.quantenradierer.de {
	reverse_proxy 127.0.0.1:3001 {
		header_up X-Real-IP {remote_host}
		flush_interval -1
	}
}
```

The app takes the client IP for the feedback rate limit from the last
`X-Forwarded-For` entry, which Caddy sets, and falls back to `X-Real-IP`.

## Checks

```sh
curl https://pydra.quantenradierer.de/api/health          # {"ok":true,"app":"Pydra"}
docker compose -f compose.prod.yaml ps                      # pydra should be "healthy"
docker compose -f compose.prod.yaml logs --tail 50 pydra watchtower
```

To read the feedback, newest first:

```sh
wget -qO- --header "Authorization: Bearer $FEEDBACK_TOKEN" https://pydra.quantenradierer.de/api/feedback
```

## Rollback

Every image is also tagged with its git SHA. To pin an older version:

1. In `compose.prod.yaml`, replace `image: ghcr.io/quantenradierer/pydra:latest`
   with `ghcr.io/quantenradierer/pydra:<sha>`.
2. Run `docker compose -f compose.prod.yaml up -d`.

Watchtower does not update a SHA tag. To return to automatic updates, switch
back to `:latest` after the fix is pushed.

## Data

The SQLite file is `/data/feedback.db` in the `pydra-data` volume. To back it up:

```sh
docker compose -f compose.prod.yaml cp pydra:/data/feedback.db ./feedback-backup.db
```
