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

