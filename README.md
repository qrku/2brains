# 2brain

Personal knowledge and prep tracker. Built as a single-user web app — no backend, everything lives in localStorage.

## What's inside

- **Space** — markdown editor with a file tree, autosave
- **Board** — infinite canvas (Miro-style): drag nodes, draw arrows, pan/zoom
- **Builder** — page constructor with 13 block types (text, tables, kanban, progress, etc.)
- **Modules** — plug-in sections: tasks, interviews, experience, packs, problems, knowledge, tests

## Stack

- Next.js 15 (App Router, Turbopack)
- React 19
- TypeScript
- Pure CSS (no UI library)
- localStorage — only persistence layer

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

## Notes

- `builder` directory is intentionally named that way — `constructor` crashes Next.js because it's a reserved JS word (`Object.prototype.constructor`)
- Board uses two coordinate systems: canvas coords (stored) and screen coords (rendered via CSS transform). Arrows are drawn in screen coords as an SVG overlay.
- Wheel listener is added as non-passive (`{ passive: false }`) to allow `preventDefault()` for zoom
