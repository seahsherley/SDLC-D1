# Snip

A tiny URL shortener backend — a single-file [Bun](https://bun.sh) server with zero npm dependencies.

## Run

```bash
bun run start
```

## API

- `POST /api/links` — body `{ "url": "https://…" }` → `201` with `{ code, url, shortUrl, hits, createdAt }`. `400` on invalid JSON or a non-http(s) URL.
- `GET /api/links` — `200` with an array of all links (same shape).
- `GET /:code` — `302` redirect to the original URL, incrementing `hits`. `404` if the code is unknown.

CORS is open for all origins, including `OPTIONS` preflight requests.

## Config (env vars)

- `PORT` — port to listen on (default `3000`).
- `BASE_URL` — origin used when building `shortUrl` values. Falls back to `https://$RAILWAY_PUBLIC_DOMAIN` if set, otherwise `http://localhost:$PORT`.
- `PUBLIC_DIR` — optional folder of static files to serve. `/` serves `index.html`; an existing static file always wins over a same-named short code.
