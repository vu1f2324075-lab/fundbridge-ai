# Reference material

## `figma-prototype/`

The original Figma Make prototype (React 19 + Vite + Tailwind v4, 28 screens, in-memory
mock data) that this project is built from. It is kept **unmodified, for traceability
only** — nothing imports from it and it is not part of any build.

Its value is the visual identity, which `frontend/` preserves deliberately:

| Element | Source | Preserved in |
|---|---|---|
| Colour tokens (`--color-navy` … ) | `src/index.css` `@theme` block | `frontend/src/index.css` |
| Bridge mark | `src/components/Logo.tsx` | `frontend/src/components/Logo.tsx` |
| Navy sidebar + white topbar shell | `src/components/DashboardLayout.tsx` | `frontend/src/layouts/DashboardLayout.tsx` |
| Card / KPI / badge / score-bar patterns | all pages | `frontend/src/components/ui/*` |

What deliberately **did not** carry over is the data layer. Every number in the
prototype was a literal in `src/data/mockData.ts` (readiness `78`, match `91%`,
eligibility verdicts, scheme lists). In this project those come from the database and
the scoring engines over HTTP. See `docs/MATCHING.md`.
