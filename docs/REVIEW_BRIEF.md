# FundBridge AI — Review Brief

Everything in the project, in the order you'd explain it. Read the first two
sections before you walk in; the rest is for answering questions.

---

## 1. The thirty-second pitch

> An Indian MSME owner looking for funding has to work across three worlds at
> once — government schemes, private investors, and the question of whether
> their own business is even ready to be assessed. The information exists, but
> it's scattered across portals, PDFs and circulars, and the tools that try to
> help return a score with no reasoning.
>
> FundBridge AI brings readiness assessment, government scheme matching,
> investor matching and grounded Q&A into one workflow. Its defining rule is
> that **the system never states more confidence than its inputs support** —
> every score decomposes into the factors and weights that produced it, missing
> information is treated as unknown rather than favourable, and every scheme
> fact carries the official URL it came from and the date it was verified.

If you only land one point, land that last one.

---

## 2. Demo order — what to click

Start everything with `.\start.ps1`, then open **http://localhost:5173/login**.
Password for all three accounts: `fundbridge-demo-2026`.

**1 · Landing page** (10 s) — scroll to the Government Schemes section. It
fetches live from the public API. Point out the "Official source" badge and the
verification date.

**2 · Sign in as `owner@buildtech.local`** → Business dashboard.

**3 · Readiness** — the composition bar shows how the score adds up. Expand
**Proposal Quality**: it names the exact missing input. Say: *"The score isn't a
black box. Each component reports its weight, its reason, and what would raise
it."*

**4 · Recommendations** — the status donut and score bands. Open any match and
show the **seven factors with weights**. Find one marked `UNKNOWN` and say:
*"This is the heart of it. 'The scheme doesn't restrict this' and 'we don't know
this about you' are different claims. UNKNOWN scores zero and forces the status
to NEEDS INFORMATION, so a high score can never come from missing data."*

**5 · Assistant** — ask *"What is the maximum loan under MUDRA?"* → a written
answer with **3 citations**. Then ask something unrelated (*"Who won the cricket
world cup?"*) → **zero citations, no answer**. This is the single most
persuasive thing you can show.

**6 · Sign out → `team@alphaventures.local`** → Investor. Open the match, expand
*Why this score*. Point at **revenue: ₹25 lakh–1 crore** and say: *"A band, not
a figure. The exact number isn't hidden in the UI — it's never sent to the
investor at all."*

**7 · Sign out → `admin@fundbridge.local`** → Admin → **Data quality**. The
provenance donut reads **2 verified / 3 placeholder / 5 synthetic**. Show it
deliberately. A project that displays its own data gap reads as rigorous.

**8 · Optional, if they want depth** — in a terminal: `.\show-backend.ps1`.
It proves the security boundary live (§7 below).

---

## 3. What the system is made of

Four processes. The browser only ever talks to the Node API — never to the
database or the AI service directly.

| Layer | Technology | Role |
|---|---|---|
| Presentation | React 19, Vite 6, Tailwind v4, TanStack Query | Three role-specific interfaces, 28 pages |
| Application | Node 24, Express, Prisma 6, Zod | 64 endpoints, auth, authorisation, orchestration |
| **Scoring engines** | TypeScript, pure functions | Readiness, scheme matching, investor matching |
| Data | PostgreSQL 18.6, port 5433 | 21 tables, 21 enums, 2 migrations |
| AI/NLP | Python 3.12, FastAPI | Extraction, embeddings, chunking, retrieval, LLM routing |

**Size:** backend 48 files / 7,790 lines · frontend 41 files / ~9,700 lines ·
AI service 24 files / ~4,100 lines.

Why the AI service is separate: the embedding model and PDF parsing are
Python-only and slow to load. Isolating them keeps the API responsive **and
lets the whole platform run with AI switched off** — scoring and matching still
work, and AI features report themselves unavailable rather than failing.

---

## 4. The models — say this precisely

This is where reviewers probe hardest. The accurate answer:

### Two pre-trained models, used as published

| Model | Role | Detail |
|---|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` | Embeddings | 384-dimensional, L2-normalised, **CPU only**, Apache-2.0, from Hugging Face |
| `openai/gpt-oss-120b` via **Groq** | Explanation phrasing only | 131K context, OpenAI-compatible API |

### Three deterministic scoring models (our own)

These are weighted rule-based engines, not learned models. They are **pure
functions** — no database access, no clock, no LLM — which is exactly what makes
every score reproducible and unit-testable.

### Nothing was trained or fine-tuned

**Say this plainly if asked.** There is no `.pkl`, `.joblib` or `.pt` artifact in
the project. `scikit-learn` and `shap` are declared dependencies reserved for the
planned experiments (synopsis §15), but they are **not imported anywhere in the
running system**.

> **If a reviewer asks "where is the machine learning?"**
>
> *"The deployed system uses two pre-trained models — MiniLM for embeddings and
> a large language model for phrasing — plus deterministic weighted scoring. We
> deliberately did not train a model, because we don't yet have labelled Indian
> funding-outcome data, and training on the crowdfunding datasets from the
> literature would produce a model that doesn't transfer to this task. The
> experimental plan in §15 compares a rule-based baseline against ML models;
> that evaluation is the next phase."*
>
> That is a stronger answer than a weak model trained on the wrong data.

---

## 5. The three engines, with exact weights

### Funding readiness — five components

| Component | Weight |
|---|---:|
| Financial information | 25% |
| Business profile | 20% |
| Market validation | 20% |
| Proposal quality | 20% |
| Team strength | 15% |

Each returns its score, weight, contribution, a plain-language reason, and the
exact missing fields. **A missing proposal scores 0 with that stated** — never
averaged away.

### Scheme matching — seven factors

| Factor | Weight |
|---|---:|
| Industry | 25% |
| Business stage | 20% |
| Business type | 15% |
| Funding requirement | 15% |
| Location | 10% |
| Funding purpose | 10% |
| Semantic relevance | 5% |

Four outcomes per factor:

| Outcome | Score | Meaning |
|---|---|---|
| `MATCH` | 1 | profile satisfies it |
| `MISMATCH` | 0 | it does not |
| `UNRESTRICTED` | 1 | **the scheme states no constraint** |
| `UNKNOWN` | 0 | **the business did not state it** |

Weights are renormalised over factors actually present, and a blocking issue
overrides the numeric score. Four statuses: *potentially eligible · needs
information · review required · likely not eligible*. **None says "eligible"** —
only the issuing authority can determine that.

### Investor matching — five factors

Industry 30% · investment size 25% · stage 20% · location 15% · funding type 10%.

One deliberate difference: an **unstated** investor preference scores **0.5** and
the engine emits **no blocking issues at all** — because a preference is not a
rule.

---

## 6. The data story — rehearse this one

**The honest headline: 2 verified scheme records, not 50.**

| Category | Count |
|---|---:|
| Verified against an official source | **2** |
| Placeholders awaiting verification (never published, never matched) | 3 |
| Synthetic `[DEMO]`, badged on screen | 5 |
| External benchmark datasets downloaded | **0** |

The two real ones:

- **Startup India Seed Fund Scheme** — `seedfund.startupindia.gov.in`, verified 09 Oct 2026
- **Pradhan Mantri MUDRA Yojana** — `mudra.org.in/offerings`, verified 11 Oct 2026

**Why only two** — and this is a finding, not an excuse:

| Source | Why it didn't work |
|---|---|
| MyScheme API (~4,670 schemes) | **HTTP 401** — needs an API key we don't hold |
| MyScheme pages | client-rendered; sitemap lists no `/schemes/` URLs |
| msme.gov.in | 8.7 KB empty shell |
| CGTMSE | navigation only; substance is in PDFs |
| Kaggle / HuggingFace mirrors | **deliberately refused** — scraped copies, not official sources |

Two more details that play well:

- **SISFS's `maxFunding` is `null`** with a written reason, because the figure
  lives in a PDF we haven't read. *"A null with a stated reason beats a plausible
  invented number."*
- **Stand-Up India was collected in full and then rejected by our own validator**
  because `standupmitra.in` is a bare `.in`, not on the allowlist. We didn't
  override the gate. The content is parked with the steps to promote it.

Full record with URLs and access dates: `docs/DATASETS.md`.

---

## 7. Security — demonstrable, not asserted

`.\show-backend.ps1` proves all of this live:

```
anonymous  GET /business/dashboard        401
business owner  GET /admin/status         403   ← valid session, wrong role
POST /readiness/analyse, no CSRF header   403
real email, wrong password    "Email or password is incorrect."
email that does not exist     "Email or password is incorrect."   ← identical
```

| Concern | Implementation |
|---|---|
| Passwords | bcrypt, never logged, never returned |
| Sessions | JWT in an httpOnly cookie, HS256 pinned, **revalidated against the DB every request** — suspending a user kills a live token |
| CSRF | double-submit token on every mutation |
| Authorisation | authentication + role + **record ownership**, all server-side |
| Uploads | magic-byte sniffing, not extension; random 32-byte storage key |
| Audit | a failed login stores `{"emailAttempted": "..."}` — scan the table for "password": **no matches** |
| Prompt injection | retrieved text is data, never instructions; system prompt in the vendor's own channel |

---

## 8. Testing

**289 automated tests.**

| Suite | Count |
|---|---:|
| Backend unit (engines, config, uploads) | 143 |
| Backend integration (real HTTP, real DB) | 24 |
| AI service (NLP, retrieval, LLM routing) | 122 |

Worth naming: the account-enumeration test, and the integration suite's
truncation helper that **asserts the schema name before deleting anything** — it
caught a bug twice that would have wiped development data.

---

## 9. Hard questions, honest answers

**"Is this actually AI, or just if-statements?"**
Both, deliberately. Retrieval uses real 384-dimensional sentence embeddings with
cosine similarity. The language model generates grounded explanations. The
*decisions* are deterministic — and that's the contribution, not a shortcut. An
explainable funding recommendation has to be reproducible.

**"Your base paper reports 81% accuracy. What's yours?"**
That 81% belongs to Ye et al. on their own GoFundMe data. We never claim it. We
have no accuracy figure because we haven't run the evaluation yet — §15 of the
synopsis defines the five experiments that will produce our own numbers.

**"Only 2 schemes? That's not a dataset."**
Correct, and we say so on the admin page. The pipeline, provenance gate,
validation and retrieval index are complete and working; what's small is the
number of records through them. Scaling is manual verification per scheme, or a
MyScheme API key, which unlocks it in one step.

**"What stops the LLM making something up?"**
Three things. It never decides a score, a status or an amount — those come from
the engines. It only sees retrieved passages above a 0.35 cosine threshold. Below
that it returns nothing and says why. Demonstrate it with the cricket question.

**"What if the AI service goes down?"**
Readiness, matching, the scheme catalogue and all dashboards keep working. AI
features report themselves unavailable. There's a test asserting proposal scores
are identical with and without the LLM.

**"Why no pgvector?"**
Unavailable for PostgreSQL 18 on Windows. Embeddings are stored as
`double precision[]` and searched with an `fb_dot_product()` SQL function;
vectors are L2-normalised at write time, so a dot product *is* cosine. Search is
exact rather than approximate — correct, and fine at this size. The migration
path to pgvector is documented and touches one file.

---

## 10. Do not claim

- ❌ 81% accuracy, 83% preference, or 11.9pp — **those are Ye et al.'s**
- ❌ Any accuracy figure for FundBridge — we have none yet
- ❌ That the `[DEMO]` schemes are real, or that we have 10 verified schemes
- ❌ That the system determines eligibility — it reports *potential* relevance
- ❌ That a match means investment will follow

---

## 11. Two things that will be visibly imperfect

Be ready rather than surprised.

**Proposal Quality reads 0/100.** The database was wiped between sessions and the
proposal rows were lost; the PDFs survive in `backend/storage/proposals/`.
**Re-upload one before the review** and readiness climbs from 79 back to ~85. If
it comes up: *"That's the engine being honest — no proposal means that component
scores zero and says so, rather than being averaged away."*

**The top scheme match is a `[DEMO]` record at 98/100.** Don't hide it. Say it's
synthetic and labelled as such precisely so matching can be demonstrated without
inventing government facts — then show the real MUDRA record beside it.

---

## 12. One-line summary if you're running out of time

> *"We built an explainable funding decision-support platform for Indian MSMEs.
> Two pre-trained models — MiniLM embeddings and an LLM for phrasing — sit around
> three deterministic weighted scoring engines. Every score decomposes into its
> factors, every scheme fact traces to an official source with a verification
> date, and anything we don't know is scored as unknown rather than assumed in
> the applicant's favour. 289 tests, and the known gaps are on the admin page
> rather than hidden."*
