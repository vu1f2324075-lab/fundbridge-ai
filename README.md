# FundBridge AI

**Find the Right Funding. Know Why.**

An explainable AI and Retrieval-Augmented Generation based decision-support
platform for startups and MSMEs. FundBridge helps a business owner assess their
funding readiness, discover potentially relevant government schemes, understand
*why* a scheme may fit, improve their funding proposal, and produce a concrete
next-step plan.

FundBridge is a **decision-support and discovery platform**. It does not
guarantee eligibility, funding, approval or investment. Scheme information is
always traceable to an official government source, and users are directed there
to verify current requirements before applying.

---

## Quick start

Already set up? Two commands, from PowerShell in the project root:

```powershell
.\start.ps1
```

```powershell
.\stop.ps1
```

`start.ps1` starts PostgreSQL, the AI service, the API and the web app in order,
waiting for each to answer before continuing. It is safe to re-run. Then open
**http://localhost:5173/login** - demo password `fundbridge-demo-2026`.

First-time setup is in [Setup](#setup) below. A full reference covering
architecture, scoring, the database and known limitations is in
[docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md).

### Two PowerShell rules

| Don't | Do | Why |
|---|---|---|
| `npm run dev` | `npm.cmd run dev` | `npm` resolves to `npm.ps1`, which the execution policy blocks. `npm.cmd` is not a script file, so it is not blocked - no policy change needed. |
| `cd x && y` | `cd x ; y` | Windows PowerShell 5.1 has no `&&` operator; it is a parse error. |

Inside `package.json` scripts, `&&` is fine - npm runs those through `cmd.exe`.

---

## Status

This project is under active development. The table below reflects what is
**actually implemented and verified**, not what is planned. A feature is listed
as done only when it has working code, passing tests and a clean typecheck.

| Phase | Area | Status |
|---|---|---|
| 1 | Monorepo, env validation, security middleware, auth, RBAC, audit log | ✅ Done |
| 1 | Database: 20 models, 21 enums, migrated, dev cluster + seed | ✅ Done |
| 2 | Business profile + funding requirement (API + UI) | ✅ Done |
| 4 | Scheme catalogue, search, filtering, pagination | ✅ Done |
| 4 | **Scheme matching engine** - 7 factors, configurable, explainable | ✅ Done |
| 5 | **Funding readiness engine** - 5 weighted components | ✅ Done |
| 6 | **RAG** - chunking, real embeddings, cosine retrieval, citations | ✅ Done |
| 7 | **Proposal pipeline** - secure upload, PDF/DOCX extraction, analysis | ✅ Done |
| 8 | **Action plan** from actual findings | ✅ Done |
| 9 | **Investor module** (backend) - discovery, matching, shortlist | ✅ Done |
| 10 | Explainable recommendation UI | ✅ Done |
| 11 | Frontend - public + business-owner module (15 pages) | ✅ Done |
| 12 | **Python AI service** - FastAPI, NLP, embeddings, LLM boundary | ✅ Done |
| 12 | **Admin module** (backend) - lifecycle, users, config, RAG, quality | ✅ Done |
| - | Tests: **251 passing** (139 unit, 24 integration, 88 AI service) | ✅ Done |
| 3 | Government scheme dataset from official sources | ⬜ Not started |
| 11 | Frontend for proposals / investor / admin | ⬜ **backend ready, UI not built** |
| 13 | Research experiments | ⬜ **Not evaluated yet** |

The API reports live capability flags at /api/meta, and the UI hides controls
for anything unavailable - so no screen offers a button that cannot work.

See docs/architecture/ai-architecture.md for how the AI layer is bounded.

No research metrics are reported anywhere in this repository. Experiments that
have not been run are labelled "Not evaluated yet" rather than given plausible
numbers.

---

## Architecture

```
React + TypeScript (Vite, Tailwind)
            │  REST, cookie session
            ▼
Node.js + TypeScript (Express)        ← business logic, authorisation
            │
    ┌───────┴────────┬──────────────┐
    ▼                ▼              ▼
PostgreSQL      Python AI service  Private file storage
+ Prisma        (FastAPI)          (proposals)
                     │
          NLP · embeddings · document
          extraction · RAG · LLM
```

**PostgreSQL is the source of truth.** Node owns application and authorisation
logic. Python owns NLP, embeddings, document processing and LLM calls. The
browser never talks to an LLM provider and never holds an API key.

### The rule that shapes the whole system

The LLM never decides a fact. Eligibility and scores come from deterministic
rules over verified data; retrieval supplies official context; the LLM only
phrases what the engine already computed.

```
Business profile → Structured matching engine → score + factor breakdown
                                                        │
                        Verified scheme data + RAG context
                                                        │
                                                        ▼
                                          Grounded LLM verbalisation
```

A stored score can always be reproduced: every derived row carries
`modelVersion` and `configVersion`, and scoring weights live in the
`MatchingConfig` table rather than in code or in React.

---

## How scoring works

Two engines, both pure functions with no database, clock or randomness — so a
stored score can be recomputed exactly from its inputs and the `configVersion`
recorded alongside it. Weights live in the `MatchingConfig` table, never in code
or in React, so they can be retuned and compared experimentally.

### Funding readiness

Five weighted components (profile 20%, financial 25%, market 20%, team 15%,
proposal 20%). Each returns its score, the fields that produced it, the fields
that would raise it, and a sentence explaining the result.

A component with no data scores **zero and says so** — it is never treated as
average, which would inflate the readiness of a business that has supplied
nothing.

### Scheme matching

Seven factors (industry 25%, stage 20%, type 15%, funding 15%, location 10%,
purpose 10%, semantic relevance 5%). Three rules make the output honest:

1. **Unknown scores zero, not half.** A criterion *you* have not answered cannot
   be assessed, so it contributes nothing and is reported as missing. A displayed
   score is a floor that can only rise as you fill gaps — never an optimistic
   guess. Any such gap forces status `NEEDS_INFORMATION` however high the score.
2. **Unrestricted scores full.** A criterion the *scheme* does not restrict
   genuinely excludes nobody, so it scores full credit — and the explanation says
   "not restricted" rather than claiming a match.
3. **A blocking issue overrides the score.** Where a scheme states a
   machine-checkable condition the profile fails, status becomes
   `LIKELY_NOT_ELIGIBLE` regardless of the number. A high score beside an
   unmeetable condition would be actively misleading.

Weights are **renormalised over the factors actually present**, so when semantic
scoring is unavailable the remaining factors still reach 100 rather than being
silently capped at 95.

`MatchStatus` has no `APPROVED` or `GUARANTEED_*` member. The engine cannot
emit an eligibility decision.

---

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Tested on 24.16 |
| PostgreSQL | ≥ 14 | Tested on 18.6 |
| Python | 3.12 | For the AI service; 3.12 chosen for ML wheel availability |

Docker is **not required** and is not used by this project. PostgreSQL runs
locally. See `scripts/setup/02-create-dev-cluster.ps1` for why the development
database is a separate cluster rather than the machine's service instance.

---

## Setup

### 1. Install dependencies

```powershell
npm.cmd install
```

### 2. Create the development database

```powershell
npm.cmd run db:setup
```

This initialises a PostgreSQL cluster that this project owns outright:

| | |
|---|---|
| data directory | `%LOCALAPPDATA%\FundBridge\pgdata` |
| port | 5433 (a machine PostgreSQL service on 5432 is left untouched) |
| cluster owner | `fb_admin` — superuser of this cluster only |
| application role | `fundbridge` — `NOSUPERUSER NOCREATEDB NOCREATEROLE` |

It needs no administrator rights, generates its own passwords, and writes them
to `backend/.env`. Nothing is printed to the terminal.

The cluster is not registered as a Windows service (that would need admin), so
it does not survive a reboot:

```powershell
npm.cmd run db:start
```

`db:stop`, `db:restart` and `db:status` are also available.

To use an existing PostgreSQL instance instead, run
`scripts/setup/01-create-database.sql` against it as superuser and point
`DATABASE_URL` at it.

### 3. Apply the schema and seed

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
```

The seed creates the scoring configuration, an administrator, and one demo
business and investor — every row marked `sourceType: SEED`. It also creates
five **government scheme stubs** carrying only each scheme's name, administering
body and official portal URL, at status `NEEDS_VERIFICATION` with **no**
eligibility data. Inventing eligibility rules is exactly what this project
forbids; collecting them from official sources with provenance is phase 3.

Demo accounts (local only), password `fundbridge-demo-2026`:

| Email | Role |
|---|---|
| `admin@fundbridge.local` | ADMIN |
| `owner@buildtech.local` | STARTUP |
| `team@alphaventures.local` | INVESTOR |

### 4. Set up the AI service environment

```powershell
cd ai-service ; python -m venv .venv ; .venv\Scripts\python -m pip install -r requirements-dev.txt
```

PyTorch installs CPU-only from PyTorch's own index — the embedding model
(all-MiniLM-L6-v2, 384-dim) runs fast enough on CPU at this corpus size, and the
CUDA build is roughly ten times larger for no benefit.

### 5. Run

```powershell
npm.cmd run dev
```

The API listens on `http://localhost:4000`. Check it with:

```powershell
curl http://localhost:4000/api/health
```

---

## Commands

| Command | Does |
|---|---|
| `npm.cmd run dev` | Backend and frontend together |
| `npm.cmd run dev:backend` | Backend only, with reload |
| `npm test` | Backend unit + integration tests |
| `npm.cmd run test:unit --workspace backend` | Unit tests only (no database needed) |
| `npm.cmd run test:integration --workspace backend` | Integration tests (needs the cluster running) |
| `npm.cmd run typecheck` | TypeScript across both workspaces |
| `npm.cmd run build` | Production build |
| `npm.cmd run db:migrate` | Create and apply a migration |
| `npm.cmd run db:studio` | Browse the database |
| `npm.cmd run db:seed` | Load clearly-marked development data |
| `npm.cmd run db:setup` | Create the development cluster (once) |
| `npm.cmd run db:start` / `db:stop` / `db:status` | Control the cluster |

---

## Security

Security is a first-class requirement, implemented rather than described.
What is in place today:

- **Passwords** — bcrypt at cost 12. Login pays the cost of a hash comparison
  even for unknown addresses, so response time does not reveal which emails are
  registered, and both failure modes return the same error.
- **Sessions** — JWT in an `httpOnly` cookie, so page JavaScript cannot read it
  and an XSS bug cannot exfiltrate a session. Algorithms are pinned to HS256,
  which blocks `alg: none` forgery. Issuer and audience are verified.
- **Authorisation** — role checks and ownership checks are separate and both
  enforced server-side. A resource belonging to another user returns 404, not
  403, so the API cannot be used to discover which records exist.
- **CSRF** — double-submit cookie with a constant-time comparison, required on
  every state-changing authenticated request.
- **Rate limiting** — tiered by cost and risk: credentials, AI calls, uploads
  and general reads each get their own budget, bucketed per account when
  authenticated and per IP otherwise.
- **Input validation** — Zod on every endpoint, with `.strict()` so unexpected
  fields are rejected rather than passed through to a database write. `role` is
  not self-assignable at registration.
- **Error handling** — one envelope, `{ error: { code, message, details } }`.
  Stack traces, SQL text, filesystem paths and provider messages are logged
  server-side and never serialised.
- **Logging** — structured (pino) with central redaction of passwords, tokens,
  cookies and authorisation headers, so a careless log call cannot leak one.
- **SQL injection** — all access goes through Prisma, which parameterises every
  query. String concatenation into SQL is forbidden.
- **Secrets** — server-side only. `VITE_*` variables are the sole values
  compiled into the browser bundle, and the template says so explicitly.
- **Audit trail** — security-relevant actions are recorded; audit failures are
  logged but never break the user's action.

Verified by 77 automated tests, which cover the attacks and not only the happy
path: tampered JWT payloads, `alg: none` forgery, wrong-secret and
wrong-audience tokens, CSRF omission and mismatch, role escalation at
registration, extra-field smuggling, account enumeration via timing and via
error text, and session invalidation on suspension or deletion.

Integration tests run against a dedicated `test` schema, never `public`. The
truncation helper asserts the target schema and refuses to run otherwise — a
guard that has already prevented one accidental wipe of development data during
development.

Full documentation lands with each feature. See `docs/security/` (in progress).

---

## Repository layout

```
fundbridgeai/
├── backend/          Express API (TypeScript)
│   ├── src/
│   │   ├── config/       env validation, scoring configuration
│   │   ├── controllers/  HTTP handlers
│   │   ├── lib/          prisma, logger, errors, password, tokens
│   │   ├── middleware/    auth, authz, csrf, rate limit, validation, errors
│   │   ├── routes/       route table
│   │   ├── services/     business logic (no Express types)
│   │   └── validators/   Zod schemas
│   └── generated/        Prisma client (git-ignored)
├── frontend/         React application
├── ai-service/       Python FastAPI service
├── prisma/           schema.prisma, migrations, seed
├── datasets/         government scheme dataset + provenance metadata
├── experiments/      research experiment scripts
├── scripts/          setup, import, validation, normalisation
├── docs/             architecture, datasets, api, security, research
└── reference/        original Figma prototype — read-only, for traceability
```

`reference/figma-prototype/` is the original 28-screen prototype. Nothing
imports from it and it is not part of any build. It is kept because the visual
identity carries forward; its mock data deliberately does not.

---

## Research positioning

FundBridge investigates an **integrated** explainable funding decision-support
workflow combining business analysis, funding-readiness assessment, government
scheme discovery, structured eligibility matching, semantic retrieval,
explainability and proposal assistance for startups and MSMEs.

The contribution is the integration, methodology, explainability and evaluation
in this application context — not a claim that no comparable platform exists.
The base paper (Ye et al., 2024) reports approximately 81% prediction accuracy
**on its own dataset**; that figure is not FundBridge's and appears nowhere as
such.

---

## Disclaimer

FundBridge AI is a decision-support and discovery platform. Information and
match results do not guarantee eligibility, funding, approval or investment.
Users should verify current requirements with the official source before
applying.
