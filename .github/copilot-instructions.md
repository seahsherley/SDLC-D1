# GitHub Copilot instructions

> Kept in sync with [CLAUDE.md](../CLAUDE.md) at the repo root.
> If you edit one, edit the other the same way.

## What this repo is

Snip is a tiny URL shortener built as **one backend, two clients** (web UI +
CLI). Each layer lives on its own **orphan branch** with no shared history.
`main` (this branch) is an **aggregator/superproject**: it has no app code of
its own, only `.gitmodules` mounting each branch as a submodule, plus the
build script, workflows, and this documentation.

| Path        | Branch     | Tech                          | Notes                                      |
| ----------- | ---------- | ------------------------------ | ------------------------------------------- |
| `backend/`  | `backend`  | Bun, zero npm deps             | in-memory `Map` storage, see below           |
| `frontend/` | `frontend` | Angular 19                    | build output path is load-bearing, see below |
| `cli/`      | `cli`      | Node (CommonJS), zero npm deps | must stay CommonJS, see below                |
| `bundle/`   | `bundle`   | generated                      | **never hand-edit**, see below               |

## API contract

Change it **everywhere or nowhere** — backend, frontend service, CLI, and this
table must always agree:

| Method | Path         | Body                       | Success                                          | Errors                               |
| ------ | ------------ | ---------------------------- | --------------------------------------------------- | -------------------------------------- |
| POST   | `/api/links` | `{ "url": "https://…" }` | `201 { code, url, shortUrl, hits, createdAt }` | `400` invalid JSON / non-http(s) URL |
| GET    | `/api/links` | —                             | `200` array of the same link objects              | —                                       |
| GET    | `/:code`     | —                             | `302` redirect, increments `hits`                 | `404` unknown code                    |

CORS is wide open, including `OPTIONS` preflight.

## Key commands

```bash
git clone --recurse-submodules <REPO_URL>   # plain clone leaves backend/frontend/cli/bundle EMPTY

cd backend && bun run start                 # backend, port 3000
cd frontend && npm install && npm start     # frontend dev server
cd cli && node cli.js ls                    # CLI (needs Node 18+ for global fetch)

node scripts/build-bundle.mjs               # regenerate bundle/ locally
node scripts/build-bundle.mjs --push        # ...and push bundle + main
```

## The edit → push → pointer-bump workflow

You never edit `backend/`, `frontend/`, or `cli/` content from `main` directly
long-term — each is its own branch:

1. `cd <layer>`, edit, `git add -A && git commit -m "..." && git push` (this
   pushes the layer's own branch, e.g. `backend`).
2. Back in the superproject root: `git submodule update --remote <layer>`,
   then `git add <layer> && git commit -m "Bump <layer> submodule" && git push`.

`bundle/` is different: never edit it by hand — regenerate it with
`scripts/build-bundle.mjs`, which does its own commit + pointer-bump for you.

## Do

- Keep the API contract identical across `backend`, `frontend`, `cli`, and
  both docs.
- Regenerate `bundle/` only via `node scripts/build-bundle.mjs`.
- Keep `cli/package.json` free of `"type": "module"` — `cli.js` is CommonJS.
- Remember storage is an in-memory `Map`: data resets on every backend
  restart, by design (no database).

## Don't

- Don't hand-edit anything under `bundle/` — it's fully generated output and
  will be overwritten on the next build.
- Don't add `"type": "module"` to `cli/package.json` or anywhere `cli.js` is
  loaded from — it relies on plain CommonJS `require`.
- Don't change the frontend build output path casually: the bundle step and
  Docker image both expect `frontend/dist/snip-frontend/browser/index.html`
  to exist exactly there.
- Don't add a `push` trigger to `.github/workflows/bundle.yml` — it's
  schedule/`workflow_dispatch`-only on purpose, since that workflow file only
  exists on `main`, so a push to `backend`/`frontend`/`cli` would never see it
  anyway.
- Don't assume `.github/workflows/docker.yml`'s `paths: [bundle, ...]` filter
  watches files inside `bundle/` — `bundle` there is the submodule **gitlink**
  itself, so it only fires when the pointer is bumped on `main`.
