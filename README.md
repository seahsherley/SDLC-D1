# Snip

A tiny URL shortener, built as **one backend, two clients**:

- a minimal HTTP API for creating and resolving short links,
- a web UI (Angular) for people who want to click buttons,
- a CLI for people who want to type commands or script it.

All three talk to the same backend over plain HTTP — nothing is shared at the
code level, only the contract below.

## API contract

Base URL defaults to `http://localhost:3000` (backend's `PORT`/`BASE_URL` env vars).

| Method | Path          | Body                | Success                                                    | Errors                              |
| ------ | ------------- | -------------------- | ----------------------------------------------------------- | ------------------------------------ |
| POST   | `/api/links`  | `{ "url": "https://…" }` | `201 { code, url, shortUrl, hits, createdAt }`         | `400` invalid JSON / non-http(s) URL |
| GET    | `/api/links`  | —                     | `200` array of the same link objects                        | —                                     |
| GET    | `/:code`      | —                     | `302` redirect to the original URL, increments `hits`       | `404` unknown code                    |

CORS is wide open (including `OPTIONS` preflight) so any origin can call the API.

## Layout: branch-per-layer + submodules

Each layer lives on its own **orphan branch** of this same repository, with no
shared history:

- `backend`  — Bun server, zero npm dependencies ([server.js](backend/server.js))
- `frontend` — Angular 19 app ([angular.json](frontend/angular.json))
- `cli`      — zero-dependency Node CLI ([cli.js](cli.js))
- `bundle`   — **generated**, see [Generated bundle branch](#generated-bundle-branch) below

The `main` branch (this one) is an **aggregator**: it doesn't contain any of
those layers itself, it mounts each branch as a **git submodule** pointing at
this repo, checked out on its own branch:

```
backend/   -> submodule, tracks branch "backend"
frontend/  -> submodule, tracks branch "frontend"
cli/       -> submodule, tracks branch "cli"
bundle/    -> submodule, tracks branch "bundle" (generated, do not hand-edit)
```

This keeps each layer's history and files isolated, while `main` gives a single
place to clone and see (and pin versions of) all three together.

## Cloning

Plain `git clone` leaves the `backend/`, `frontend/`, and `cli/` folders
**empty** (submodules are just pointers until initialized). Clone with:

```bash
git clone --recurse-submodules <REPO_URL>
```

or, if you already cloned without it:

```bash
git submodule update --init --recursive
```

## Running everything

```bash
# Backend (Bun, port 3000 by default)
cd backend
bun run start

# Frontend (Angular dev server, in another terminal)
cd frontend
npm install
npm start

# CLI (in another terminal, needs Node 18+ for global fetch)
cd cli
node cli.js ls
node cli.js add https://example.com
node cli.js open <code>
```

The CLI and frontend both call the backend at `http://localhost:3000` by
default (`SNIP_API` env var for the CLI).

## Updating a submodule pointer

Changes are made **inside** the submodule folder, on its own branch, then the
superproject records the new commit it points to:

```bash
# 1. Make and push a change inside the submodule folder
cd backend
git add -A
git commit -m "..."
git push

# 2. Back in the superproject, fetch the new commit and bump the pointer
cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```

Repeat the same for `frontend` or `cli` as needed.

## Generated bundle branch

`bundle` is **generated output, not hand-edited**. It's a self-contained,
deployable copy of the app: the backend server, the built frontend, and the
CLI, plus a Dockerfile/`railway.json` for shipping it as one container.

It's produced by [scripts/build-bundle.mjs](scripts/build-bundle.mjs), a
zero-dependency Node script (run from the repo root) that:

1. updates `backend`, `frontend`, and `cli` to their branch tips,
2. runs `npm install` + `npm run build` in `frontend` (fails loudly if
   `frontend/dist/snip-frontend/browser/index.html` is missing),
3. assembles `bundle/`: copies `backend/server.js` and `cli/cli.js` as-is,
   copies the frontend build output to `bundle/public`, and writes `.env`
   (`PUBLIC_DIR=./public`, auto-loaded by Bun so the server also serves the
   UI), `package.json` (`"start": "bun server.js"`, no `"type"` field so
   `cli.js` still runs under plain Node), `Dockerfile`, `.dockerignore`, and
   `railway.json`,
4. commits inside `bundle/` and bumps the submodule pointers on `main` —
   each commit is skipped when there's nothing staged, so re-running with no
   upstream changes is a safe no-op.

```bash
node scripts/build-bundle.mjs          # build + commit locally
node scripts/build-bundle.mjs --push   # also push bundle and main
```

