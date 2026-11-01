# Data Sources and Access Record

**FundBridge AI — An Explainable AI-Based Funding Decision Support and Investor–Business Matching System for Micro and Small Enterprises**

This document records every external data source the project touched: what it is,
where it came from, when it was accessed, and whether it is actually used in the
system. It is written to be auditable — a reviewer should be able to open any URL
below and check the record against it.

Compiled 30 October 2026. All URLs in Tables 1–3 were re-checked on that date and
returned HTTP 200.

---

## A note on scale, stated up front

This project does **not** use a large downloaded dataset. Its government scheme
corpus was collected record by record from official sources, with each field
marked as quoted or derived, and a validation gate that rejects any record citing
a non-government domain.

At the date of writing the corpus holds **2 verified records**. That is a small
number and it is deliberate: the alternative was to populate the system with
scheme names, funding ceilings and eligibility rules taken from unofficial
aggregators or generated outright, which would have made every downstream result
untrustworthy. Section D explains why the obvious bulk sources were not usable.

---

## Table 1 — Primary sources used in the system

Collected directly from official sources. These are the only records that drive
matching and retrieval.

| ID | Scheme | Source URL | Domain | Collected | Verified | Re-checked | Status |
|---|---|---|---|---|---|---|---|
| GOV-0001 | Startup India Seed Fund Scheme (SISFS) | https://seedfund.startupindia.gov.in/ | `seedfund.startupindia.gov.in` | 09 Oct 2026 | 09 Oct 2026 | 30 Oct 2026 | VERIFIED · PUBLISHED |
| GOV-0002 | Pradhan Mantri MUDRA Yojana (PMMY) | https://www.mudra.org.in/offerings | `mudra.org.in` | 11 Oct 2026 | 11 Oct 2026 | 30 Oct 2026 | VERIFIED · PUBLISHED |

**Nature of the data.** Scheme name, administering body, government level, scheme
type, eligibility criteria, supported purposes, funding range, application route,
official source URL and verification date. Every field carries a provenance marker
of `QUOTED` (reproduced verbatim from the source page) or `DERIVED` (mapped by us,
with the reasoning recorded in an adjacent note field).

**Example of the quoting discipline.** The PMMY loan bands are stored exactly as
the official page states them — *"Shishu: covering loans upto 50,000/-"*,
*"Tarun Plus: covering loans above 10 lakh and upto 20 lakh"* — and the
collateral-free ceiling as *"MUDRA loans, i.e., loans up to 20 lakh, have been made
collateral free, as per the RBI norms in this regard."* Note that the 20 lakh
ceiling is above the 10 lakh figure commonly quoted elsewhere; the official page is
what the record follows.

**Where an official source does not state a figure, it is left null with a written
reason** rather than estimated. GOV-0001's `maxFunding` is null for exactly this
reason: the ceiling is published in a guidelines PDF that has not yet been read.

**Files.**

```
datasets/raw/government/GOV-0001-sisfs/collection.json      raw capture
datasets/processed/government/government_schemes.json       curated records
datasets/metadata/government/validation_report.json         gate output
datasets/metadata/government/collection_log.json            import log
```

Import of record into the database: **15 Oct 2026**, 2 records read, 2 published,
0 issues.

---

## Table 2 — Collected but withheld

| ID | Scheme | Source URL | Collected | Why it is not in the system |
|---|---|---|---|---|
| GOV-0003 | Stand-Up India | https://www.standupmitra.in/Home/SUISchemes | 11 Oct 2026 | `standupmitra.in` is a bare `.in` domain. The provenance gate accepts only `.gov.in`, `.nic.in` and `.org.in`, and refused the record: *"may not cite a non-government source as authoritative."* |

The content was collected in full and is quoted verbatim in
`datasets/raw/government/GOV-0003-standup-india/collection.json` — composite loan
of ₹10 lakh to ₹100 lakh, green-field projects only, 51% SC/ST or women
shareholding for non-individual enterprises, 7-year repayment with an 18-month
moratorium. The file records the exact steps required to promote it once the same
figures are confirmed against a `financialservices.gov.in` source.

It is kept out of the processed dataset rather than forced through, because the
gate existing and then being overridden would make it worthless.

---

## Table 3 — Pre-trained model artifact

| Artifact | Source URL | Obtained | Re-checked | Licence |
|---|---|---|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` | https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 | 09 Oct 2026 | 30 Oct 2026 | Apache-2.0 |

384-dimensional sentence embeddings, L2-normalised, executed on CPU. Used for
retrieval over the scheme corpus and for semantic relevance in scheme matching.
The model is used as published; it was **not** fine-tuned, so no training dataset
was required for it.

---

## Table 4 — Sources evaluated and rejected

Recorded because the evaluation is itself a finding: it explains why the corpus is
small.

| Source | URL | Accessed | Outcome |
|---|---|---|---|
| MyScheme (National Scheme portal, ~4,670 schemes) | https://www.myscheme.gov.in/ | 11 Oct 2026 · re-checked 30 Oct 2026 | Public API returns **HTTP 401** without an API key we do not hold. Scheme pages are client-rendered and return no scheme content to a plain fetch. The sitemap lists **no** `/schemes/` URLs. |
| MSME Ministry scheme pages | https://msme.gov.in/schemes-initiatives | 11 Oct 2026 | Returns an 8.7 KB application shell with zero scheme text — client-rendered. |
| CGTMSE | https://www.cgtmse.in/ | 11 Oct 2026 | Landing page carries navigation only; eligibility and figures live in linked scheme-document PDFs. |
| india.gov.in scheme pages | https://www.india.gov.in/ | 11 Oct 2026 | Target pages returned HTTP 404. |
| Third-party MyScheme mirrors (Kaggle, Hugging Face, GitHub) | various | 11 Oct 2026 | **Deliberately not used.** These are scraped copies, not official sources. Citing one would breach the project's provenance rule, and they may be stale relative to the issuing authority. |

`robots.txt` was fetched and honoured before any collection. `myscheme.gov.in`
permits crawling (`Allow: /`, only `/404` disallowed). Requests were issued
singly with a descriptive user agent and a delay between them; no bulk or
concurrent scraping was performed.

---

## Table 5 — Benchmark datasets cited in the literature

**None of these were downloaded, accessed or used by this project.** They are the
datasets reported *by the papers in the literature survey*, listed here because a
reviewer will reasonably ask what data the referenced studies used. Access dates
are deliberately absent: we accessed the **papers**, not the datasets.

| Dataset | Used by | Scale reported in the paper | Availability |
|---|---|---|---|
| Crowdfunding project text + metadata | Babayoff & Shehory (2022) | Large crowdfunding corpus | Underlying data released via Figshare by the authors |
| Crowdfunding project / investor records | Zhang et al. (2022) | Not stated in the reviewed text | Not released as a public dataset |
| Kickstarter projects, Jan 2020 – Sep 2022 | Raflesia et al. (2023) | Full Kickstarter listing for the period | Third-party dumps exist; redistribution terms unverified |
| GoFundMe small-business campaigns | Ye et al. (2024) — base paper | 11,274 campaigns, 168 features | Not released; described in the paper |
| Crunchbase startup profiles | Maarouf et al. (2024/25) | 20,172 profiles | Crunchbase is a commercial licensed source |

> **These papers' reported metrics are not this project's results.** The base
> paper's 81.0% accuracy, 83% human preference and 11.9 percentage-point figures
> belong to Ye et al. on their own GoFundMe data. FundBridge AI must be evaluated
> independently on its own task and data.

---

## Table 6 — Synthetic demonstration data

| Item | Count | Origin | Handling |
|---|---|---|---|
| `[DEMO]` scheme records | 5 | Generated by the project team | Stored with `sourceType = SYNTHETIC`, prefixed `[DEMO]` in the name, and badged *"Synthetic demonstration data — not a real programme"* wherever displayed |
| Seed placeholder records | 3 | Scheme **names** only, from public knowledge | Held at `NEEDS_VERIFICATION`, never published, and therefore never matched against |
| Demo user accounts and business profiles | 5 users / 3 profiles | Generated | Local development only |

Synthetic records exist so the matching engine can be exercised without inventing
government facts. They carry no eligibility claims traceable to any real
programme, and are removable with `npm.cmd run db:seed:demo -- --remove`.

**They must never be cited as research data or counted as verified records.**

---

## Table 7 — Training datasets evaluated for a supervised model

**No dataset in this table was downloaded or used.** They were evaluated on
02 November 2026 to decide whether a supervised model could be trained under the
project's provenance rules. The decision was not to train one; the reasoning is
in [`DESIGN_JUSTIFICATION.md`](DESIGN_JUSTIFICATION.md). The evaluation is
recorded here because "we considered it and here is why not" is a finding, and
because a reviewer will ask.

| Dataset | Source URL | Evaluated | Records | Label available | Licence / access | Outcome |
|---|---|---|---|---|---|---|
| India — World Bank Enterprise Survey 2022 | https://microdata.worldbank.org/index.php/catalog/6500 | 02 Nov 2026 | 9,376 firms, 331 variables | `k16` applied for a loan, `k17` reason not applied, `k20a1` outcome of most recent application, `k8` holds a loan or credit line | World Bank Microdata terms; free account required, access tier (Public Use vs Licensed) not stated on the catalogue page | **Not used** — see below |
| India — Enterprise Survey of Micro Firms 2022 | https://microdata.worldbank.org/index.php/catalog/6495 | 02 Nov 2026 | 998 micro firms, 237 variables, nine cities, Dec 2021 – Mar 2022 | Same finance block, plus `k13`–`k15d` collateral and `m1a_finance_pos` | As above | **Not used** |
| US SBA 7(a) loan-level FOIA release | https://data.sba.gov/ | 02 Nov 2026 | ~2.2 million loans since 1991 | `LoanStatus` — PIF (paid in full) / CHGOFF (charged off) / CANCLD | US public domain (usa.gov) | **Not used** — wrong label and population |

### Why the World Bank data was the right fit and still was not used

It is the correct dataset for this problem. The unit of analysis is Indian
enterprises, the label is credit access rather than a proxy for it, and the
predictor variables map onto seven fields FundBridge already collects — sector
(`d1a2_v4`), year operations began (`b5`), permanent employees (`l1`), annual
sales (`d2`), legal status (`b1`), female ownership (`b4`) and formal
registration (`b6b`). At 9,376 records it is comparable in scale to the 11,274
GoFundMe campaigns used by the base paper.

Two things stopped it:

1. **Access tier is not determinable in advance.** The catalogue pages give a
   "Get Microdata" button and a login, but state no access type. A Public Use
   File needs registration and agreement; a Licensed file needs "a documented
   application and signing an agreement", which has no predictable turnaround.
2. **Redistribution of the raw file is prohibited.** The terms permit use for
   "statistical and scientific research purposes only" and permit publishing
   aggregated results with citation, but state the data "shall not be
   redistributed or sold". The raw file therefore could not be committed to the
   repository or shipped with a deployment — only a derived model and its
   metrics could be.

Neither is disqualifying for a future run. Both meant the model could not be
built to a fixed deadline with a guaranteed start date.

### Why the SBA data was rejected despite being fully open

It is public domain, needs no account, and is two orders of magnitude larger.
It was rejected on fit, not availability. Every record is an **already-approved**
loan, so the only label is repayment — whether a disbursed loan was paid in full
or charged off. That is a lender's risk question. FundBridge's question is
whether an enterprise can obtain funding at all, which is a different target on
a different population (US borrowers, NAICS-coded, with loan terms rather than
enterprise characteristics).

A model trained on it would report its accuracy at predicting US loan
repayment. Presenting that figure beside an Indian MSE funding-access system
would be misleading, and a reviewer who opened the dataset would find it.

### Required citations, if either is used later

```
[6]  World Bank Group, "India — World Bank Enterprise Survey (WBES) 2022,"
     Ref. IND_2022_WBES_v01_M. Dataset downloaded from
     https://www.enterprisesurveys.org/en/data on [date].

[7]  World Bank Group, "India — Enterprise Survey of Micro Firms (ESM) 2022,"
     Ref. IND_2022_ESM_v01_M. Dataset downloaded from
     https://www.enterprisesurveys.org/en/data on [date].
```

---

## Reference block for the synopsis

Ready to paste into §20 under *Websites / Documentation*. IEEE style, access dates
included as the format requires.

```
[1]  Department for Promotion of Industry and Internal Trade, Government of
     India, "Startup India Seed Fund Scheme," Startup India. [Online].
     Available: https://seedfund.startupindia.gov.in/
     [Accessed: 30-Oct-2026].

[2]  Micro Units Development & Refinance Agency Ltd. (MUDRA), "Offerings —
     Pradhan Mantri MUDRA Yojana," MUDRA. [Online].
     Available: https://www.mudra.org.in/offerings
     [Accessed: 30-Oct-2026].

[3]  Small Industries Development Bank of India, "Stand-Up India Scheme,"
     Stand-Up Mitra. [Online].
     Available: https://www.standupmitra.in/Home/SUISchemes
     [Accessed: 30-Oct-2026].

[4]  National e-Governance Division, Government of India, "myScheme — National
     Platform for Government Schemes." [Online].
     Available: https://www.myscheme.gov.in/
     [Accessed: 30-Oct-2026].

[5]  N. Reimers and I. Gurevych, "all-MiniLM-L6-v2," sentence-transformers,
     Hugging Face. [Online].
     Available: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
     [Accessed: 30-Oct-2026].
```

---

## Summary

| Category | Count |
|---|---|
| Verified records from official sources, in use | **2** |
| Collected but withheld on provenance grounds | 1 |
| Unverified name-only placeholders (never published) | 3 |
| Synthetic demonstration records (badged) | 5 |
| Pre-trained models used as published | 1 |
| External benchmark datasets downloaded or used | **0** |
| Training datasets evaluated for a supervised model, then declined | 3 |

The honest headline for a reviewer: **the collection pipeline, the provenance
gate, the validation tooling and the retrieval index are complete and working;
what is small is the number of records that have passed through them.** Scaling
that number is manual work — a rendered page read, a linked PDF read, and human
verification per scheme — or a MyScheme API key, which would unlock the bulk route
in a single step.
