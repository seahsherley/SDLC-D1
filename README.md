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

The `main` branch (this one) is an **aggregator**: it doesn't contain any of
those layers itself, it mounts each branch as a **git submodule** pointing at
this repo, checked out on its own branch:

```
backend/   -> submodule, tracks branch "backend"
frontend/  -> submodule, tracks branch "frontend"
cli/       -> submodule, tracks branch "cli"
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
