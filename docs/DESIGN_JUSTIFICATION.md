# Why FundBridge Scores Deterministically

**An Explainable AI-Based Funding Decision Support and Investor–Business Matching System for Micro and Small Enterprises**

This document answers the single hardest question a reviewer can ask about this
project:

> *"Your base paper trained a classifier and reported 81% accuracy. Where is
> your trained model, and what is your accuracy figure?"*

The answer is that FundBridge deliberately does not learn its funding decisions,
and that this is a design decision with reasons, not an omission. This document
sets out those reasons, states plainly what the project gives up by making that
choice, and records what would change the answer.

---

## 1. What the system actually contains

It is not true that the project contains no machine learning. It contains one
trained neural model and three deterministic engines, and the split between them
is the whole argument.

| Component | Kind | What it decides |
|---|---|---|
| `all-MiniLM-L6-v2` | Trained transformer, 384-dim, used as published | Semantic similarity between text |
| Readiness engine | Deterministic, 5 weighted components | How prepared an enterprise is |
| Scheme matching engine | Deterministic, 7 weighted factors | Whether a scheme fits |
| Investor matching engine | Deterministic, 5 weighted factors | Whether an investor fits |
| `openai/gpt-oss-120b` via Groq | Pre-trained LLM | Phrasing only — never a number |

The system uses learning exactly where learning is the right tool — judging
whether two pieces of text mean similar things, which cannot be written as a
rule — and refuses to use it where the answer is already known exactly.

---

## 2. Eligibility is rule-governed, not latent

This is the central point.

A government scheme's eligibility criteria are **published rules**. The Startup
India Seed Fund Scheme states its criteria. PMMY states its loan bands. These
are not hidden patterns waiting to be discovered in data; they are written down
by the issuing authority and are authoritative by definition.

Training a classifier to predict eligibility would mean approximating, from
noisy examples, a function that is already available in closed form — and
approximating it *worse*, because the model would be wrong on some fraction of
cases where the rule is never wrong. A model that achieves 95% accuracy at
reproducing a published rule has introduced a 5% error rate into a question that
had none.

The defensible use of learning here is on the parts that genuinely are latent:
whether an enterprise's description of its business is semantically close to
what a scheme is for. That is what the embedding model does.

---

## 3. A funding decision must be contestable

An applicant refused credit is entitled to know why, and to act on the answer.
That requirement shapes the architecture.

FundBridge returns, for every score, the component breakdown, the weight applied
to each component, and the specific missing items that cost points — surfaced in
the UI as expandable rows with deep links to the exact form field that would fix
them. A user can read the reason, change the input, and watch the score move.

A gradient-boosted classifier with SHAP values returns a feature attribution,
which is a different thing. SHAP says *"annual revenue contributed −0.3 to the
log-odds"*. It does not say *"your revenue figure is missing, add it here"*.
Attribution explains the model; the breakdown explains the decision. For a
system whose purpose is decision **support** — telling a micro-enterprise owner
what to do next — the second is what has value.

This also matters legally. Credit decisioning that materially affects access to
finance attracts fair-lending and explainability expectations in most
jurisdictions. A deterministic, inspectable rule set satisfies those directly.

---

## 4. The conservative-under-uncertainty rule has no learned equivalent

FundBridge treats an unknown value as a known weakness:

- `UNKNOWN` scores **0** *and* forces the overall verdict to `NEEDS_INFORMATION`
- `UNRESTRICTED` scores **1**
- weights are renormalised over the factors actually present
- a blocking issue overrides the score entirely

A trained classifier handles a missing feature by imputing it — substituting the
median, or letting the tree take a default branch. Imputation produces a
confident number from an absence of evidence. On a funding recommendation, that
is the specific failure mode that does the most damage: an enterprise is told it
is a strong match on the basis of data nobody ever supplied.

The project's rule is that uncertainty must propagate to the user rather than be
smoothed away. That rule is expressible deterministically and is not expressible
in a standard supervised pipeline without bolting a separate abstention
mechanism onto it.

---

## 5. What this costs — stated plainly

Three real things are given up, and it is better to name them than to be caught
out.

**There is no accuracy figure for FundBridge.** No AUC, no F1, no precision at
k. The five experiments defined in synopsis §15 have not been run, because
running them requires labelled outcome data the project does not hold.

**The weights are reasoned, not fitted.** Scheme matching uses
25/20/15/15/10/10/5. Those numbers come from the relative importance of each
factor in the published eligibility criteria, recorded in the `MatchingConfig`
table and versioned — but they were not learned from outcomes, and a different
analyst could defend a different split. They are a documented judgement, which
is weaker than a fitted parameter and stronger than an arbitrary one.

**Comparison with the base paper is not like-for-like.** Ye et al.'s 81.0%
accuracy, 83% human preference and 11.9 percentage-point improvement are their
results, on their GoFundMe data, for their task. Those figures must never be
presented as FundBridge's. The project takes their *method* — structured
explanation of a funding outcome — not their numbers.

---

## 6. Why no model was trained: the data record

This is not an untested assumption. Candidate datasets were evaluated and the
evaluation is recorded in [`DATASETS.md`](DATASETS.md), Table 7.

In short: the one dataset with the right unit of analysis and the right label —
the World Bank Enterprise Survey for India 2022, 9,376 Indian firms with
credit-application and credit-constraint variables that map onto seven fields
FundBridge already collects — sits behind World Bank Microdata registration
whose access tier was not determinable in advance, and prohibits redistribution
of the raw file. The public-domain alternative, the US SBA 7(a) loan release,
has ample data but the wrong label (repayment of an already-approved loan) and
the wrong population (US borrowers).

Training on synthetic data was ruled out at the start and remains ruled out. A
reported metric computed on generated rows is worse than no metric, because it
looks like evidence.

---

## 7. What would change this

The design is not a permanent position. The conditions under which a learned
component should be added are specific:

1. **Access to WBES India 2022 is granted.** Then a credit-constraint classifier
   can be trained on 9,376 real Indian enterprises, cross-validated, and
   reported with genuine confidence intervals.
2. **It is added alongside, not instead of.** The deterministic engines continue
   to produce the readiness score and the eligibility verdict. The learned model
   appears as a separate, clearly-labelled comparative panel carrying its
   dataset, its N and its CV metric.
3. **It never decides eligibility, a funding amount, a scheme's status, a match
   score or a readiness score.** That constraint is a project rule and does not
   relax because a model becomes available.

Under those conditions the model adds a quantitative result without weakening
any of the properties above. Outside them it would trade an auditable system for
an unaudited number.

---

## 8. Answering the reviewer

Short forms of the above, for use under questioning.

**"Where is the machine learning?"**
> A trained transformer — all-MiniLM-L6-v2 — produces the 384-dimensional
> embeddings behind semantic retrieval and relevance scoring. It is used where
> learning is appropriate: judging whether two texts mean the same thing.
> Eligibility is not learned, because eligibility criteria are published rules
> and learning them would only introduce error.

**"What is your accuracy?"**
> FundBridge has no accuracy figure, because it makes no learned prediction to
> be accurate about. The 81% in the base paper is Ye et al.'s result on their
> GoFundMe data, not ours. What can be verified about this system is that its
> scores are reproducible, that every score decomposes into its components and
> weights, and that 176 backend tests plus 122 Python tests hold that behaviour
> in place.

**"Isn't a rule-based system just an expert system? That's not AI."**
> The system is three things at once: a trained embedding model, a retrieval
> layer over a provenance-gated corpus, and a deterministic scoring layer. The
> contribution is the architecture — specifically, that the language model is
> allowed to phrase an explanation and is structurally prevented from changing a
> number. That constraint is what makes the output safe to show to someone
> deciding whether to apply for credit.

**"Why not just train on any available dataset?"**
> Because the metric would not mean anything. A model trained on US loan
> repayment data would be reporting its performance on US loan repayment, not on
> Indian MSE funding access. Reporting that number next to this system would be
> misleading, and a reviewer who checked the dataset would find it.

---

## Summary

The project uses learning where the answer is latent and rules where the answer
is published. It gives up a headline accuracy figure and gains a system whose
every output can be traced to an input, a weight and a source. The cost is real
and is stated above; the trade was made deliberately, and the dataset evaluation
behind it is on record.
