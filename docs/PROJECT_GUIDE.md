# FundBridge AI — Project Guide

**Find the Right Funding. Know Why.**

An explainable funding decision-support platform for Indian startups and MSMEs. Every score it shows can be traced back to the specific inputs and weights that produced it.

This guide is the single reference for the project: how to run it, where everything lives, how the scoring works, and — stated plainly in §11 — what is not finished.

Last verified: 9 October 2026.

---

## 1. Running it

Two commands. Open PowerShell in the project root.

```powershell
.\start.ps1
```

```powershell
.\stop.ps1
```

`start.ps1` brings up PostgreSQL, then the Python AI service, then the API and web servers — waiting for each to actually answer before moving on. It is safe to run twice; already-running services are left alone. `stop.ps1` leaves PostgreSQL up by default (`-IncludeDb` stops it too).

Then open **http://localhost:5173/login**, which is a chooser offering one
portal per role.

| Portal | Account | Role |
|---|---|---|
| `/login/business` | `owner@buildtech.local` | Business owner |
| `/login/investor` | `team@alphaventures.local` | Investor |
| `/login/admin` | `admin@fundbridge.local` | Administrator |

Password for all three: `fundbridge-demo-2026`

The portals are presentation only. All three post to the same endpoint, show the
same failure text, and send you to the home of the role your **account** holds —
not the portal's. Signing in through the administrator portal with a business
account lands on the business dashboard silently, because an error there would
disclose which addresses are privileged.

### Two PowerShell rules that will bite you

These caused real failures during development, so they are worth stating directly:

| Don't | Do | Why |
|---|---|---|
| `npm run dev` | `npm.cmd run dev` | `npm` resolves to `npm.ps1`, which the execution policy blocks. `npm.cmd` is not a script file, so it is not blocked. **No policy change is needed.** |
| `cd ai-service && python ...` | `cd ai-service ; python ...` | Windows PowerShell 5.1 has no `&&` operator — it is a parse error, not a runtime failure. |

Inside `package.json`, `&&` is fine: npm runs scripts through `cmd.exe`, not PowerShell.

### Ports and logs

| Service | Port | Started by |
|---|---|---|
| PostgreSQL 18.6 (dev cluster) | 5433 | `pg_ctl` |
| Python AI service | 8000 | `uvicorn` |
| Node API | 4000 | `npm.cmd run dev` |
| React web app | 5173 | Vite |

Logs: `%LOCALAPPDATA%\FundBridge\logs\`

The database runs on **5433**, not 5432. It is a separate cluster owned by your user account, created so the project never touches the machine's existing PostgreSQL service and never needs the superuser password. It is **not** registered as a Windows service, so it does not survive a reboot — run `.\start.ps1` again after restarting.

---

## 2. Where everything lives

```
fundbridgeai/
├── start.ps1 / stop.ps1       Start and stop everything
│
├── backend/                   ← THE BACKEND. Node + TypeScript + Express
│   ├── src/
│   │   ├── index.ts           Process entry point
│   │   ├── app.ts             Express app assembly, middleware order
│   │   ├── routes/            URL → controller  (5 files, 64 endpoints)
│   │   ├── controllers/       HTTP in, HTTP out. No business logic.
│   │   ├── services/          Business logic  (13 files)
│   │   ├── engines/           ★ Scoring. Pure functions, no I/O.
│   │   ├── middleware/        auth, authorize, csrf, rateLimit, validate
│   │   ├── validators/        Zod request schemas
│   │   ├── config/            env.ts, matching.ts (weights + versions)
│   │   └── lib/               prisma, tokens, password, upload, errors
│   └── generated/prisma/      Generated DB client — do not edit
│
├── frontend/                  React 19 + Vite + Tailwind v4
│   └── src/
│       ├── pages/             28 pages: public / startup / investor / admin
│       ├── components/        ui/ primitives + domain/ widgets
│       ├── hooks/queries.ts   All TanStack Query hooks
│       └── layouts/           DashboardLayout — role-aware navigation
│
├── ai-service/                Python 3.12 + FastAPI
│   └── app/
│       ├── main.py            7 endpoints
│       ├── nlp/               cleaning.py, embeddings.py
│       ├── documents/         extract.py (PDF + DOCX)
│       ├── rag/chunking.py
│       ├── proposal/          analyse.py, assist.py
│       └── llm/               providers, router, prompts, client
│
├── prisma/schema.prisma       ★ Database source of truth. 21 tables, 21 enums.
├── prisma/migrations/         2 migrations
├── datasets/                  Government scheme data + provenance
├── scripts/                   setup/, validate-data/, import-government-schemes/
└── docs/                      This guide, architecture, dataset methodology
```

**Size:** backend 8,562 lines across 47 files · frontend 9,722 lines across 41 files · AI service 4,090 lines across 24 files.

---

## 3. Architecture

Four processes. The browser only ever talks to the Node API; it never reaches the AI service or the database directly.

```mermaid
graph LR
  B["Browser<br/>React :5173"] -->|"cookie + CSRF"| A["Node API :4000"]
  A -->|Prisma| D[("PostgreSQL :5433")]
  A -->|"shared token"| P["Python AI :8000"]
  P -.->|"optional"| L["Claude API"]

  style A fill:#dbeafe,stroke:#2563eb
  style D fill:#dcfce7,stroke:#16a34a
  style P fill:#fef3c7,stroke:#d97706
  style L fill:#f1f5f9,stroke:#94a3b8,stroke-dasharray: 4 3
```

Why split the AI service out: the embedding model and PDF parsing are Python-only, CPU-bound, and slow to load. Isolating them keeps the API responsive and lets the platform run with the AI service switched off entirely.

**The product loop:** Profile → Analyse → Match → Explain → Improve → Act.

---

## 4. The three modules

### Business owner (`/app/*`)
Profile and funding requirement, readiness analysis, scheme matching with per-factor explanations, proposal upload and scoring, an action plan derived from the gaps found, saved opportunities, and a grounded Q&A assistant.

### Investor (`/investor/*`)
Preferences, business discovery, ranked matches with fit explanations, shortlists.

Privacy boundary: investors see a deliberately reduced view. Exact financials, proposals and owner identity are excluded at the query level — revenue is exposed as a band (e.g. "₹25 lakh–1 crore"), not a figure. This is enforced by a `discoverySelect` projection in the service layer, not by hiding fields in the UI.

### Administrator (`/admin/*`)
Scheme curation and verification, user management, scoring-weight configuration, audit log, RAG index operations.

---

## 5. Database

PostgreSQL 18.6 · 21 tables · 21 enums · 2 migrations.

Current contents:

| Table | Rows | | Table | Rows |
|---|---:|---|---|---:|
| AuditLog | 37 | | ProposalAnalysis | 2 |
| GovernmentScheme | 10 | | FundingRequirement | 1 |
| SchemeMatch | 6 | | InvestorProfile | 1 |
| MatchingConfig | 5 | | InvestorMatch | 1 |
| SchemeDocument | 5 | | SchemeRevision | 1 |
| SchemeDocumentChunk | 5 | | ExperimentRun | 0 |
| User | 4 | | Notification | 0 |
| ActionPlanItem | 3 | | SavedOpportunity | 0 |
| BusinessProfile | 2 | | Shortlist | 0 |
| FundingReadiness | 2 | | | |
| Proposal | 2 | | | |

To browse it visually:

```powershell
npm.cmd run db:studio
```

To query it directly — note that `?schema=public` must be stripped, because that is a Prisma parameter and not a libpq one:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://fundbridge:PASSWORD@localhost:5433/fundbridge'
```

`MatchingConfig` holds five rows — one per configuration key, each at version 1 — under a `@@unique([key, version])` constraint. Lookups filter by key, so exactly one active value resolves per key.

### No pgvector

pgvector is not available for PostgreSQL 18 on Windows. Embeddings are therefore stored as `double precision[]` with a SQL helper:

```sql
CREATE FUNCTION fb_dot_product(a double precision[], b double precision[]) ...
```

Vectors are L2-normalised at write time, so a dot product *is* cosine similarity. Search is exact rather than approximate — correct, and fine at this corpus size. The four-step migration path to pgvector is documented in `docs/architecture/ai-architecture.md`; no application code outside `rag.service.ts` would change.

---

## 6. How scoring works — the explainability core

This is the part that distinguishes the project, so it is worth understanding properly.

**Every score is computed by a pure function in `backend/src/engines/`.** No engine performs I/O, reads the clock, or calls an LLM. Weights arrive as arguments, loaded from the `MatchingConfig` table. Each result records the `modelVersion` and `configVersion` that produced it, so any stored score can be reproduced exactly.

### Funding readiness — `readiness.engine.ts`
Five weighted components: business profile, financial information, market validation, team strength, proposal quality (20%). Each component returns a score, a weight, its contribution, a plain-language reason, and the specific missing fields that would raise it.

A missing proposal scores **0 with a stated reason** — never the average. An absent input must not flatter the result.

### Scheme matching — `schemeMatching.engine.ts`
Seven factors, each resolving to one of four outcomes:

| Outcome | Score | Meaning |
|---|---|---|
| `MATCH` | 1 | The profile satisfies the criterion |
| `MISMATCH` | 0 | It does not |
| `UNRESTRICTED` | 1 | The scheme does not restrict this |
| `UNKNOWN` | 0 | **The business has not answered** |

The `UNKNOWN` / `UNRESTRICTED` distinction is the heart of it. "This scheme accepts any sector" and "we don't know your sector" are not the same claim, and must not score the same. `UNKNOWN` scores 0 *and* forces the status to `NEEDS_INFORMATION`, so a high score can never be produced by missing data. Weights are renormalised over the factors actually present, and any blocking issue overrides the numeric score.

Four statuses: `POTENTIALLY_ELIGIBLE`, `NEEDS_INFORMATION`, `REVIEW_REQUIRED`, `LIKELY_NOT_ELIGIBLE`. None of them says "eligible" — only the issuing authority can determine that, and every result carries a disclaimer saying so.

### Investor matching — `investorMatching.engine.ts`
Same structure, with one deliberate difference: unstated preferences score **0.5**, and the engine emits **no blocking issues at all**. An investor preference is not a rule, so it must not be presented as a disqualification.

---

## 7. The AI layer — what is real

### NLP (runs locally, no API key)
Text cleaning and section detection, `all-MiniLM-L6-v2` embeddings (384-dimensional, L2-normalised, CPU-only), PDF extraction via PyMuPDF, DOCX via python-docx, and proposal scoring over detected sections.

### RAG (real retrieval, real citations)
Documents are chunked, embedded, and stored. Retrieval is exact cosine similarity with a **minimum threshold of 0.35 on the raw cosine**.

That threshold matters, and it was a genuine bug. MiniLM scores unrelated English text at roughly 0.25–0.30 raw. I had originally thresholded a *rescaled* similarity at 0.5 — which is exactly the orthogonality point — so it filtered nothing, and the assistant answered "how long do I cook biryani?" with confident citations to a government scheme. Thresholding the raw cosine at 0.35 fixed it: a relevant question now returns 3 citations, and the biryani question returns 0 plus an honest refusal.

Retrieval is restricted to `status = 'PUBLISHED'`. Private proposal chunks are filtered by owner and never mixed into the public scheme index.

### LLM (optional, and currently not configured)
A provider abstraction (`LlmProvider`) with a task router assigning each task its own temperature, token ceiling and prompt version — 0.1 for grounded explanation and RAG answers, 0.2 for proposal analysis, 0.4 for drafting assistance.

**The LLM never decides anything.** It does not determine eligibility, funding amounts, scheme status, match scores or readiness scores. Those are all computed by the engines in §6. The LLM only phrases an explanation of a decision already made. A test asserts that proposal scores are byte-identical with and without it.

No `ANTHROPIC_API_KEY` is currently set, so every generation path falls back to deterministic output and the UI reports the feature as unavailable rather than failing. To enable it, add the key to `ai-service\.env` and re-run `.\start.ps1`.

Retrieved documents and uploaded files are treated as **untrusted data, never instructions**. Prompts use structural delimiters, delimiter-like sequences in document text are neutralised case-insensitively, and all model output is validated against a Pydantic schema before use. Instruction precedence is fixed: SYSTEM > APPLICATION > USER REQUEST > DOCUMENT CONTENT.

---

## 8. Security

| Concern | Implementation |
|---|---|
| Passwords | bcrypt. Never logged, never returned. |
| Sessions | JWT in an httpOnly cookie (`fb_session`), HS256 pinned, issuer and audience verified, revalidated against the database on every request — so suspending a user invalidates a live token immediately. |
| CSRF | Double-submit: `fb_csrf` cookie must match the `X-CSRF-Token` header on every mutation. Login, register and logout are exempt, because requiring a token to log in locks out anyone holding a stale cookie. |
| Authorization | Verified server-side on every sensitive endpoint: authentication, role, **and record ownership**. Frontend role checks are cosmetic. |
| Uploads | Magic-byte sniffing, not extension trust. DOCX verified by its `[Content_Types].xml`. Control characters stripped from display names. Files stored under a random 32-byte hex key matching `^[a-f0-9]{64}\.(pdf|docx)$`, so a crafted filename cannot escape the storage directory. |
| Rate limiting | Per-route, stricter on authentication. |
| Headers | helmet; CORS restricted to a configured origin. |
| Audit | Security-relevant actions recorded — including failed logins, without the attempted password. |
| Secrets | Only in `.env`, never in the frontend bundle, never in prompts, never logged. |

Account enumeration is specifically tested: an unknown email and a wrong password return identical errors.

---

## 9. Testing

**284 tests, all passing.**

| Suite | Tests | Command |
|---|---:|---|
| Backend unit (engines, config, upload) | 143 | `npm.cmd run test:unit --workspace backend` |
| Backend integration (real HTTP, real DB) | 24 | `npm.cmd run test:integration --workspace backend` |
| AI service | 117 | `.venv\Scripts\python -m pytest tests` |

Integration tests run against a dedicated `test` schema. The truncation helper asserts the schema name before deleting anything — a guard that twice caught a bug that would have wiped seeded development data.

```powershell
npm.cmd test --workspace backend
```

```powershell
npm.cmd run typecheck
```

---

## 10. Government scheme dataset

This is where honesty matters most, because fabricating it would be easy and would destroy the project's credibility.

| Source type | Status | Count | Used for matching? |
|---|---|---:|---|
| `OFFICIAL_SOURCE` | PUBLISHED | 1 | Yes |
| `SYNTHETIC` | PUBLISHED | 5 | Yes — badged `[DEMO]` in the UI |
| `SEED` | NEEDS_VERIFICATION | 4 | **No** |

**One scheme is genuinely verified** against its official source: the Startup India Seed Fund Scheme. Its `maxFunding` is `null` with a recorded reason, because the figure lives in a guidelines PDF that has not yet been read. A null with a stated reason is worth more than a plausible number.

The five `[DEMO]` schemes are **synthetic**, clearly labelled as such in the database, in the API and in the UI. They exist so matching and explanation can be demonstrated without inventing government facts. Remove them with:

```powershell
npm.cmd run db:seed:demo -- --remove
```

The four `SEED` records are scheme *names* awaiting verification. They are deliberately left unpublished, so matching ignores them entirely — which is why 6 published schemes produce exactly 6 `SchemeMatch` rows.

Why not 50 records: `startupindia.gov.in`'s scheme listing is a link hub, the individual scheme sites are JavaScript applications that return almost nothing to a plain fetch, and the funding ceilings live in linked PDFs. Each record needs a rendered page read, a PDF read, and human verification. The pipeline, the source list and the methodology are complete and documented in `docs/datasets/government-schemes.md`; only the manual collection remains.

Validation runs as a gate and exits non-zero on any provenance failure:

```powershell
npm.cmd run data:validate
```

---

## 11. What is not finished

Stated plainly, because a project guide that overclaims is worse than useless.

1. **49 more verified scheme records.** Tooling and methodology are done; the collection is manual. This is the highest-value remaining work.
2. **SISFS funding ceiling** — needs the guidelines PDF read. The single cheapest dataset improvement.
3. **RAG retrieval has not been formally evaluated.** With a 6-document corpus, precision and recall figures would be noise. No metrics are claimed anywhere.
4. **No LLM has ever run against this code.** Every generated-text path is tested with mocks and has deterministic fallbacks, but no real model has been configured.
5. **Not under version control.** `git init` has not been run. Worth doing before any further work.
6. **The 1.5 GB virtual environment sits inside OneDrive**, which will sync it continuously.
7. **No deployment.** `docker-compose.yml` exists but the production path is untested.

---

## 12. Demonstrating it

A walkthrough order that shows the real work rather than just the screens. Run
`.\start.ps1` first and have `%LOCALAPPDATA%\FundBridge\logs` open if you want
to show the services responding.

**1. Start from the gap, not the dashboard.** Log in as `owner@buildtech.local`,
open **Readiness**, and show the five weighted components with their reasons and
the named missing fields. The point to make: this is not a black-box number -
each component states what it scored, what weight it carried, and what would
raise it.

**2. Show a match explanation, not a match score.** Open **Recommendations**,
pick a scheme, and walk through the seven factors. Point out an `UNKNOWN` factor
if one is present, and explain that it scores zero *and* forces the status to
`NEEDS_INFORMATION` - so missing data can never produce a confident result.
Then point at the status labels: none of them says "eligible".

**3. Prove the data honesty.** The `[DEMO]` badge on synthetic schemes is the
most persuasive thing in the project. Show that the one real scheme (Startup
India Seed Fund Scheme) has a `null` funding ceiling with a recorded reason,
rather than a plausible invented number.

**4. Show the RAG refusing to answer.** Open the **Assistant**, ask a relevant
question and show the citations. Then ask something unrelated - the biryani
example in §7 - and show it return nothing rather than a confident fabrication.
If you explain one bug you fixed, make it this one: the threshold was set on a
rescaled similarity at exactly the orthogonality point, so it filtered nothing.

**5. Show the engines are pure.** Open `backend/src/engines/readiness.engine.ts`
and point out that it performs no I/O, reads no clock, and calls no model. The
weights arrive as arguments. That is what makes every stored score reproducible
from its `configVersion`.

**6. Show the database.** `npm.cmd run db:studio` gives a browsable view of all
21 tables. `SchemeMatch` is the interesting one - the stored explanation JSON
next to the score.

**7. Run the tests.** `npm.cmd test --workspace backend` - 167 backend tests,
then 117 in the AI service. The account-enumeration and schema-guard tests are
worth naming specifically.

**If you are asked what is incomplete**, §11 is the honest answer and it is
better to give it directly: one verified scheme record out of a target of fifty,
no formal RAG evaluation, and no live LLM. The pipeline for all three exists and
is tested; what is missing is manual data collection, which the project
deliberately refused to shortcut by inventing records.

---

## 13. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `npm.ps1 cannot be loaded` | Use `npm.cmd`. No policy change needed. |
| `'&&' is not a valid statement separator` | PowerShell 5.1. Use `;`. |
| Everything is down after a reboot | The DB cluster is not a Windows service. Run `.\start.ps1`. |
| AI features report unavailable | AI service not running, or no `ANTHROPIC_API_KEY`. Check `%LOCALAPPDATA%\FundBridge\logs\ai-service.log`. |
| `invalid URI query parameter: "schema"` | You passed Prisma's `DATABASE_URL` to `psql`. Strip `?schema=public`. |
| Port already in use | `.\stop.ps1`, then `.\start.ps1`. |
| Scores look wrong | They are reproducible by construction. Check `configVersion` on the stored row and the `MatchingConfig` values behind it. |

---

## 14. Reference

**Stack.** Node 24 · TypeScript · Express 4.21 · Prisma 6.19 · Zod · pino · PostgreSQL 18.6 · React 19 · Vite 6 · Tailwind v4 · TanStack Query 5 · Python 3.12 · FastAPI · Pydantic v2 · sentence-transformers · PyMuPDF · scikit-learn · SHAP.

**Endpoints.** 64 across five routers: auth 5, business 21, proposal 9, investor 11, admin 18. Plus 7 on the AI service: `/health`, `/embed`, `/similarity`, `/documents/extract`, `/rag/chunk`, `/proposal/analyse`, `/proposal/section`.

**Useful commands.**

```powershell
npm.cmd run db:status
```

```powershell
npm.cmd run db:studio
```

```powershell
npm.cmd run data:validate
```

```powershell
npm.cmd run typecheck
```

**Further documentation.** `docs/architecture/ai-architecture.md` · `docs/datasets/government-schemes.md` · `docs/research/prototype-specification.md` · `prisma/schema.prisma`

---

### The one design rule

Everything above follows from a single commitment: **the system never states more confidence than its inputs support.** Unknown data scores zero and says so. Unverified figures stay null with a recorded reason. Synthetic records are badged. Retrieval below threshold returns a refusal rather than a citation. The LLM explains decisions but never makes them. No result ever claims eligibility — only the issuing authority can.
