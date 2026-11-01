# Government Scheme Dataset

## Status: 1 verified record

This is the honest number, and it needs explaining, because the brief asked for
at least 50.

| | |
|---|---|
| Dataset version | `government-schemes-v0.1.0` |
| Verified records | **1** |
| Records fabricated to reach a target | **0** |
| Pipeline | Built, tested, and proven on real data |

The collection pipeline, validation, provenance system, normalisation, duplicate
detection, import and RAG ingestion are all complete and working. What is small
is the **dataset**, not the machinery.

---

## Why one record and not fifty

The brief contains two requirements that cannot both be satisfied in a single
automated session:

- §5 — "AT LEAST 50 VERIFIED GOVERNMENT SCHEME RECORDS"
- §61 — "Absolutely do not create fake government schemes, government URLs,
  funding amounts, eligibility rules, application portals, source citations"

Producing 50 records quickly would have meant writing eligibility criteria and
funding figures from memory and labelling them `VERIFIED`. That is precisely what
§61 forbids, and it is the one failure mode that would make the whole dataset
worthless — a reviewer who spot-checked a single invented figure would have no
reason to trust any other record.

So the dataset contains what was genuinely verified, and this document records
exactly what it would take to extend it.

### What collection actually involves

Three findings from attempting it:

1. **`startupindia.gov.in/content/sih/en/government-schemes.html` is a hub page.**
   It lists no schemes — only links to MeitY Startup Hub, DST, AIM, BIRAC and a
   compendium PDF. There is no single page to harvest.

2. **The scheme sites are JavaScript single-page applications.** A plain HTTP
   fetch of `seedfund.startupindia.gov.in` returns the shell: the literal text
   `SISFS` and nothing else. Collection requires a rendering browser.

3. **The substantive fields live in PDF guidelines.** The SISFS site states its
   eligibility criteria on `/about`, but the per-startup funding ceilings are not
   on any HTML page — they are in
   `Guidelines_for_Startup_India_Seed_Fund_Scheme.pdf`. That is why GOV-0001 has
   `maxFunding: null` with a stated reason, rather than a number.

Each record therefore needs a rendered page read, often a PDF read, and a human
judgement about whether the text actually says what the structured field claims.
That is verification work, and doing it carelessly at volume is worse than doing
it slowly.

---

## The record that exists

**GOV-0001 — Startup India Seed Fund Scheme (SISFS)**

Collected 2026-10-09 from two rendered official pages:

- `https://seedfund.startupindia.gov.in/`
- `https://seedfund.startupindia.gov.in/about`

Verbatim extracts are preserved in
`datasets/raw/government/GOV-0001-sisfs/collection.json`, so every structured
field can be checked against the text it came from.

What was captured, quoted from the source:

- Nodal department: DPIIT
- Total outlay: INR 945 crore, supporting an estimated 3,600 entrepreneurs
  through 300 incubators over four years
- Notified 21.01.2021
- DPIIT recognition required; incorporated **not more than 2 years** ago
- Must use technology in its core product, service, business model, distribution
  model or methodology
- Indian promoter shareholding **at least 51%**
- Exclusion: must not have received **more than Rs 10 lakh** of monetary support
  under any other Central or State Government scheme
- Instruments: grant **and** debt/convertible debentures, each available once
- Sector-agnostic, PAN-India, may apply to 3 incubators simultaneously

What was **not** captured, and is recorded as such:

| Field | Why it is null |
|---|---|
| `minFunding` / `maxFunding` | Not stated on either page. Expected in the guidelines PDF. **Not inferred.** |
| `documentRequirements` | Not enumerated on the pages collected |

The `totalOutlay` of ₹945 crore is stored with an explicit note that it is the
scheme's **budget, not a per-applicant amount** — the single most plausible way
this record could be misread.

### Derived versus quoted

Two fields could not be quoted and are marked `DERIVED` with a note:

- `targetBusinessTypes: [PRIVATE_LIMITED]` — derived from the promoter
  shareholding requirement citing the Companies Act, which presupposes a
  company. The source does not enumerate permitted legal forms.
- `supportedStages: [IDEA, PRE_SEED, SEED, EARLY]` — derived from the ≤2-year
  incorporation limit and proof-of-concept purpose. The source uses no stage
  labels.

The validator **rejects** any field marked `DERIVED` that lacks an explanatory
note, so a silent derivation cannot enter the dataset.

### Preference is not eligibility

The source lists preferred sectors (social impact, waste management, education,
agriculture, healthcare and others). These are stored in `preferenceSectors` and
deliberately **not** in `supportedIndustries`, which stays empty because the
scheme is stated to be sector-agnostic.

This matters mechanically: the matching engine reads an empty
`supportedIndustries` as *unrestricted* and scores every industry full marks.
Had the preference list been put there instead, the engine would have reported a
construction-technology business as an industry **mismatch** — the opposite of
what the source says.

---

## Schema

Each record carries 50+ fields across five groups:

| Group | Purpose |
|---|---|
| Identity | `schemeId`, `slug`, `schemeName`, `officialSchemeName` |
| Authority | `provider`, `ministry`, `department`, `governmentLevel`, `state` |
| Matching | industries, stages, business types, locations, funding types, purposes, amounts |
| Criteria | `eligibilityCriteria`, `ineligibilityCriteria`, `eligibilityRules`, requirements |
| Provenance | source URL/title/type/domain/date, collection + verification dates, statuses |

### eligibilityRules versus eligibilityCriteria

A deliberate split:

- **`eligibilityCriteria`** — human-readable, worded as the source words it.
  Shown to the user. Always complete.
- **`eligibilityRules`** — the subset that is machine-checkable against profile
  fields. For GOV-0001 that is only
  `{ requiresDpiitRecognition: true, maxBusinessAgeYears: 2 }`.

The technology-usage, market-fit, promoter-shareholding and prior-support
conditions are real criteria but cannot be checked from the fields a user
supplies. They are reported for verification rather than silently passed — which
is why a strong match can still read "Needs information".

---

## Pipeline

```
Official source (rendered)
   ↓ collection.json          verbatim extracts + per-source field attribution
   ↓ government_schemes.json  structured, with provenance markers
   ↓ npm run data:validate    shape + provenance + freshness + duplicates
   ↓ npm run data:import      PostgreSQL, snapshotting prior values
   ↓ POST /api/admin/rag/reindex
```

### Validation

`npm run data:validate` writes `validation_report.json` and
`duplicates_report.json`, and **exits non-zero** on any error so it can gate an
import. Beyond shape checks it enforces:

- a `VERIFIED` record must cite an official government domain, matched on
  registrable suffix so `startupindia.gov.in.example.com` fails
- a `VERIFIED` record must carry a verification date
- a `VERIFIED` record must have non-empty eligibility criteria — an empty list
  would be read downstream as "unrestricted"
- a funding figure must have a description saying where it came from
- a `DERIVED` field must have a note
- `ACTIVE` status must have a note recording the evidence, because a page
  existing is not evidence a scheme is open
- a `STATE` scheme must name its state

Current result: **1 record, 1 valid, 0 errors, 0 warnings.**

### Import

`npm run data:import` upserts by slug and snapshots prior values into
`SchemeRevision` first. Two safeguards:

- **An administrator's verification outranks the file.** If a stored scheme was
  verified by a human and the dataset disagrees, the record is left unchanged and
  the conflict reported.
- **Unmapped vocabulary is dropped, not coerced.** An unrecognised stage silently
  mapped to `EARLY` would change who the scheme appears to serve, so it is
  reported instead.

`--dry-run` reports what would change without writing.

---

## Extending the dataset

Per scheme:

1. Find the official page. Government domains only — `.gov.in`, `.nic.in`. The
   validator enforces this.
2. Render it in a browser; a plain fetch will usually return an empty shell.
3. Copy the eligibility, funding and process text **verbatim** into
   `datasets/raw/government/<id>/collection.json`.
4. Follow the guidelines PDF for funding ceilings. Leave `null` if unavailable.
5. Map to the structured schema, marking anything not quoted as `DERIVED` with a
   note.
6. `npm run data:validate` until clean.
7. `npm run data:import`, then re-index RAG.

### Known-good starting points

Identified during collection, not yet collected:

| Scheme | Official source |
|---|---|
| SISFS guidelines (funding ceilings for GOV-0001) | `seedfundapi.startupindia.gov.in` guidelines PDF |
| Compendium of Startup-related Schemes | linked from `startupindia.gov.in` |
| MSME schemes | `msme.gov.in`, `my.msme.gov.in` |
| PMEGP | `kviconline.gov.in` |
| MUDRA | `mudra.org.in` |
| CGTMSE | `cgtmse.in` |
| Stand-Up India | `standupmitra.in` |

The last five exist in the database as `NEEDS_VERIFICATION` stubs holding only
name, administering body and portal URL. They carry **no** eligibility data and
are **invisible to users**, because only `PUBLISHED` records are exposed.

---

## Limitations

1. **n = 1.** Too small for retrieval evaluation. Ranking metrics over one
   document would be meaningless, which is why `docs/rag/rag-evaluation.md`
   reports "Not evaluated yet" rather than a number.
2. **Five synthetic demo schemes exist** for exercising the engine. They are
   named `[DEMO]`, marked `sourceType: SYNTHETIC`, badged in the UI, and
   removable with `npm run db:seed:demo -- --remove`. They must never appear in a
   research result.
3. **GOV-0001 has no per-startup funding ceiling**, so its funding factor scores
   as unrestricted. Honest, but it makes the scheme look more broadly applicable
   on that axis than it is.
4. **Time-sensitive content.** The application deadline captured (31 May 2026)
   will expire. `SCHEME_REVERIFY_DAYS` drives the staleness check.
5. **English only.** Hindi guidelines exist and are not processed.
