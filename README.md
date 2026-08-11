# 2brain

Personal knowledge and prep tracker. Built as a single-user web app — no backend, everything lives in localStorage.

## What's inside

- **Space** — markdown editor with a file tree, autosave
- **Board** — infinite canvas (Miro-style): drag nodes, draw arrows, pan/zoom

## Stack

- Next.js 15 (App Router, Turbopack)
- React 19
- TypeScript
- Pure CSS (no UI library)
- localStorage

## Architecture

[FSD](https://feature-sliced.design/) — Feature-Sliced Design:

```
src/
  app/          # routes (Next.js App Router), providers, global styles
  widgets/      # page-level composite components (Board, Space, PageEditor…)
  features/     # user-facing interactions (module picker, block operations…)
  entities/     # domain models + CRUD helpers (module, custom-page, profile…)
  shared/       # ui primitives, hooks, utils
```

State is managed via `useReducer` + Context, one store per domain. All stores hydrate from localStorage on mount with a `hydrated` flag to avoid SSR mismatch.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter any email to get in — auth is stubbed.

Node version is pinned in `.nvmrc` and shared by the Dockerfile and CI — `nvm use` picks it up.

## Checks

| Command                | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run lint`         | ESLint, zero warnings tolerated                |
| `npm run lint:fix`     | ESLint with autofix                            |
| `npm run format`       | Prettier, writes                               |
| `npm run format:check` | Prettier, verifies only                        |
| `npm run lint:fsd`     | FSD layer boundaries (`scripts/check-fsd.mjs`) |
| `npm run typecheck`    | `tsc --noEmit`                                 |
| `npm test`             | Jest unit tests                                |
| `npm run test:ci`      | Jest with coverage and thresholds              |
| `npm run test:e2e`     | Playwright against `next dev`                  |

Git hooks (husky): **pre-commit** runs lint-staged over staged files, **pre-push** runs
typecheck, FSD boundaries and unit tests. Both are installed by `npm install`.

## CI

`.github/workflows/ci.yml` runs on every push and PR to `main`: lint & format, typecheck,
unit tests with coverage, production build, Playwright e2e, a Docker image build with a
container smoke test, and a dependency audit. The `CI` job aggregates the rest — make that
one the required status check in branch protection.

E2E runs against `.next/standalone` — the same server the Docker image starts — so CI
exercises the artefact that ships rather than the dev server.

`.github/workflows/codeql.yml` runs CodeQL on push, PR and weekly. Dependabot proposes
grouped npm, GitHub Actions and Docker updates every Monday.

The repository was reformatted with Prettier in one commit; list it in
`.git-blame-ignore-revs` and enable it locally with:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```
