# MAJOR PROJECT SYNOPSIS

## TITLE OF THE PROJECT

**"FundBridge AI — An Explainable AI-Based Funding Decision Support and Investor–Business Matching System for Micro and Small Enterprises"**

Submitted in partial fulfillment of the requirements for the award of the degree of
**Bachelor of Engineering (B.E.) in Computer Engineering**

### Submitted By

| Sr. No. | Student Name | VID No. |
|---|---|---|
| 1 | Manas Gund | VU1F2324070 |
| 2 | Raj Kashid | VU1F2324073 |
| 3 | Atharva Katkar | VU1F2324075 |
| 4 | Hardik Jadhav | VU1F2324083 |

**Under the Guidance of**
Prof. Priya M Gupta

**Department of Computer Engineering**
Vasantdada Patil Pratishthan's College of Engineering & Visual Arts
Vasantdada Patil Educational Complex, Eastern Express Highway,
Near Everard Nagar, Sion, Chunabhatti, Mumbai – 400022

**University of Mumbai**
**Academic Year: 2026–27**

---

## DECLARATION

We declare that this written submission represents our ideas in our own words. We also declare that we have adhered to all principles of academic honesty and integrity and have not misrepresented, fabricated, or falsified any idea/data/fact/source in our submission. We understand that any violation of the above will be cause for disciplinary action.

1. ______________________________ (Manas Gund)
2. ______________________________ (Raj Kashid)
3. ______________________________ (Atharva Katkar)
4. ______________________________ (Hardik Jadhav)

*(Name and Signature of Team members)*

Date: ______________

---

## SUPERVISOR REPORT

This project synopsis report entitled **"FundBridge AI — An Explainable AI-Based Funding Decision Support and Investor–Business Matching System for Micro and Small Enterprises"** is approved for the degree of Bachelor in Computer Engineering.

Submitted by,

| Sr. No. | Name | VID No. | Signature |
|---|---|---|---|
| 1 | Manas Gund | VU1F2324070 | __________ |
| 2 | Raj Kashid | VU1F2324073 | __________ |
| 3 | Atharva Katkar | VU1F2324075 | __________ |
| 4 | Hardik Jadhav | VU1F2324083 | __________ |

Name: Prof. Priya M Gupta  Name: ________________  Name: Dr. Rais Mulla

Signature: ________________  Signature: _____________  Signature: ___________

Project Supervisor    Project Coordinator    HOD

**Computer Department**

---

## 1. INTRODUCTION

Micro, small and medium enterprises are widely described as a backbone of the Indian economy, yet access to finance remains one of the most persistent constraints on their growth. A business owner seeking capital must work across at least three separate worlds at once: central and state government schemes, each with its own eligibility conditions and application portal; private investors, whose preferences are rarely published in any comparable form; and the internal question of whether the business is actually prepared to be assessed at all.

The practical difficulty is not that this information is secret. It is that it is **scattered, inconsistently expressed, and expensive to interpret.** A single central scheme may state its eligibility across a web page, a guidelines PDF and a circular. An investor may state a sector preference but not a cheque size. A business owner typically discovers that a required document was missing only after an application has been rejected. The cost of this fragmentation is paid in weeks of effort and in applications that were never viable.

A second, less obvious problem sits beneath the first. Most tools that attempt to help in this space return a number — a score, a rank, a percentage match — without saying how that number was reached. For a decision as consequential as where to spend limited time and capital, an unexplained score is close to useless. The owner cannot tell whether a low score reflects a genuine mismatch or simply a field they forgot to fill in, and cannot tell what to change.

Recent research has made real progress on the individual pieces. Semantic analysis of project text has been shown to carry predictive signal for funding outcomes. Investor recommendation systems have demonstrated that preferences can drive matching and that explanation matters to users. Machine learning models have been compared experimentally for crowdfunding prediction. Large language models have been used both to improve fundraising narratives and to fuse structured and textual startup information. What the literature has largely studied **separately**, however, is what an entrepreneur needs **together**.

**FundBridge AI** is proposed as an integrated, explainable funding decision-support system for Indian startups and MSMEs. It brings business profile analysis, funding readiness assessment, government scheme matching, investor matching, explainable recommendations and proposal assistance into one workflow. Its defining design commitment is that the system must never state more confidence than its inputs support: every score is decomposed into the factors and weights that produced it, information the user has not supplied is treated as unknown rather than favourable, and scheme facts are reproduced only from official sources with the source link and verification date attached.

The project was chosen because it addresses a real and locally relevant problem, because it sits at the intersection of several active research areas rather than reimplementing one, and because the explainability requirement makes it technically substantial: a system that must justify every number cannot be built by delegating the decision to an opaque model.

---

## 2. PROBLEM STATEMENT

### What is the existing problem?

Information required to pursue funding is distributed across many sources and expressed in incompatible ways, and the tools that exist return results without reasoning. Specifically:

1. **Funding readiness is invisible to the applicant.** There is no accessible way for an owner to learn, before applying, which parts of their business case are weak and precisely which missing information is responsible.
2. **Government scheme eligibility is difficult to determine.** Criteria are spread across portals, PDFs and circulars, change over time, and are written for administrators rather than applicants.
3. **Identifying suitable investors is largely guesswork.** Investor preferences are rarely published in a comparable structure, so outreach becomes a volume exercise rather than a matching one.
4. **Existing recommendations are not explainable.** A match score with no stated reasoning cannot be acted upon, and cannot be checked by the person it most affects.
5. **Scheme information in third-party listings is frequently stale or unsourced,** so an owner cannot tell whether a stated amount or condition is current.

### Who faces this problem?

- **Micro and small enterprise owners and early-stage founders**, who bear the search cost directly and usually without a finance team.
- **First-generation entrepreneurs and applicants from under-represented groups**, for whom informal networks that would otherwise substitute for this information are weakest.
- **Investors**, who incur their own cost in finding businesses that match a stated thesis.
- **Scheme administrators**, who receive applications from businesses that were never eligible, consuming review capacity.

### Why is the problem important?

MSMEs account for a substantial share of national employment and output, and finance access is repeatedly identified as a primary growth constraint. Time spent on unsuitable applications is time not spent on the business, and the burden falls hardest on exactly those owners with the least administrative capacity. A system that reduces wasted applications and makes the reasoning visible therefore has both an economic and an equity dimension.

The problem also has a correctness dimension that makes it a genuine engineering challenge rather than a presentation one. In this domain a confidently wrong answer is worse than no answer: a fabricated eligibility rule or an invented funding ceiling could cause a real applicant to waste months. Any acceptable solution must be designed so that it fails toward silence rather than toward invention.

---

## 3. LITERATURE SURVEY

Five recent IEEE/peer-reviewed papers were studied, summarised below in ascending order of year of publication.

### 3.1 Babayoff & Shehory (2022) — *The Role of Semantics in the Success of Crowdfunding Projects*

**Problem.** Whether semantic information contained in project descriptions can predict crowdfunding success.
**Data & method.** A large crowdfunding dataset containing project information and text, with underlying data made available through Figshare; semantic features combined with project metadata, used in predictive models.
**Key finding.** Semantic features together with metadata achieved an F1 score of 96.2% on the studied dataset.
**What this contributes to FundBridge AI.** It establishes that textual business information carries predictive signal, which motivates the NLP feature-extraction and proposal-analysis components of the proposed system.
**Limitation relative to this project.** The study is confined to crowdfunding projects. It does not address Indian startups and MSMEs, investor matching, or government scheme eligibility.

### 3.2 Zhang, Wang, Li & Zhang (2022) — *Who Will Support My Project? Interactive Search of Potential Crowdfunding Investors Through InSearch*

**Problem.** Identifying potentially interested crowdfunding investors and explaining the resulting recommendations.
**Data & method.** Crowdfunding project and investor information, with expert interviews informing the design; interactive visual analytics combined with a graph neural network to model investor preferences.
**Key finding.** Investor recommendation is improved when users can interactively explore results and when recommendations are accompanied by explanation.
**What this contributes to FundBridge AI.** It directly motivates two components: investor-preference-based matching, and the requirement that recommendations be explainable rather than delivered as a bare score.
**Limitation relative to this project.** Crowdfunding-focused; it does not cover funding readiness, government schemes, or LLM-assisted proposal improvement.

### 3.3 Raflesia, Lestarini, Kurnia & Hardiyanti (2023) — *Using Machine Learning Approach Towards Successful Crowdfunding Prediction*

**Problem.** Predicting whether a crowdfunding campaign will succeed.
**Data & method.** Kickstarter projects from January 2020 to September 2022; Logistic Regression, Random Forest and XGBoost compared, with PCA and log transformation applied in preprocessing.
**Key finding.** Log transformation improved performance and XGBoost performed best, with the paper reporting 83% accuracy for the XGBoost with PCA configuration.
**What this contributes to FundBridge AI.** It supplies the experimental discipline for this project's own evaluation: multiple models and preprocessing strategies should be compared rather than a single approach assumed.
**Limitation relative to this project.** Addresses crowdfunding prediction only, with no investor or scheme matching component.

### 3.4 Ye, Zheng, Jin, Qiu, Ai & Mei (2024) — *Using Artificial Intelligence to Unlock Crowdfunding Success for Small Businesses* — **BASE PAPER**

**Problem.** Identifying the factors associated with fundraising success and providing actionable campaign-improvement suggestions.
**Data & method.** 11,274 GoFundMe small-business crowdfunding campaigns with 168 features (105 lexicon-based and 11 GPT-4-derived semantic features); LLM-derived factors and lexicon features with LightGBM, feature interpretation, GPT-4 assistance, simulation and an online experiment.
**Key findings.** 81.0% prediction accuracy; 83% human preference for AI-augmented descriptions; an estimated increase of 11.9 percentage points in financial-support likelihood under evaluation.
**What this contributes to FundBridge AI.** This is the primary methodological foundation, demonstrating that text analysis, machine learning prediction, model interpretation and LLM-assisted narrative improvement can be combined coherently within one fundraising-support system.
**Limitation relative to this project.** It targets crowdfunding narratives and does not integrate funding readiness, investor matching, government scheme matching or explainability into a single workflow.

> **Important clarification.** The 81.0% accuracy, the 83% human preference and the 11.9 percentage-point figure are **results reported by Ye et al. on their own dataset and task**. They are *not* claims about FundBridge AI, and are not presented as this project's performance. FundBridge AI must be evaluated independently on its own defined task and data, as set out in Section 15.

### 3.5 Maarouf, Feuerriegel & Pröllochs (2024/2025) — *A Fused Large Language Model for Predicting Startup Success*

**Problem.** Predicting startup success from structured startup information together with textual descriptions.
**Data & method.** 20,172 Crunchbase startup profiles (preprint arXiv:2409.03668, 2024; published in the *European Journal of Operational Research*, 2025); a fused large language model combining structured fields with textual startup descriptions.
**Key finding.** Textual startup descriptions contributed significant predictive information beyond the structured fields alone.
**What this contributes to FundBridge AI.** It supports the combined structured-plus-unstructured approach used in business profile analysis, where numeric and categorical profile fields are assessed alongside free-text description and proposal content.
**Limitation relative to this project.** Oriented toward venture-capital success prediction; it is not a funding-discovery system and has no government scheme component.

### 3.6 Summary of the Literature

| Year | Paper | Capability established | Adopted into FundBridge AI |
|---|---|---|---|
| 2022 | Babayoff & Shehory | Semantic text carries funding signal | NLP business and proposal analysis |
| 2022 | Zhang, Wang, Li & Zhang (InSearch) | Investor recommendation with explanation | Investor matching + explainability |
| 2023 | Raflesia et al. (BEEI) | Comparative ML experimentation | Readiness model evaluation design |
| 2024 | Ye, Zheng, Jin, Qiu, Ai & Mei **(base)** | Text + ML + interpretation + LLM assistance | Overall methodological foundation |
| 2024 | Maarouf, Feuerriegel & Pröllochs | Structured + textual fusion | Combined profile analysis |

> *Note: a sixth relevant paper — Xu, Chen & Zhao (2023), "SocioLink: Leveraging Relational Information for Startup Recommendations" — was also studied, contributing the relationship-aware matching direction. It is omitted from the five summarised above only because the synopsis format specifies a maximum of five papers, and may be substituted for any of the above if preferred.*

---

## 4. MOTIVATION AND RESEARCH GAP

### Motivation

The motivation arose from a concrete observation: the funding information an MSME owner needs already exists publicly, but assembling and interpreting it is the actual work, and no accessible tool does that work while showing its reasoning. The literature confirmed that each required capability is individually feasible, which made integration — rather than invention of a new algorithm — the honest and useful contribution.

A second motivation is corrective. Several available tools present scores without justification, and some present scheme information without stating its source or age. In a domain where a wrong answer costs an applicant real time and money, that is a defect rather than a simplification. This project treats traceability as a primary requirement, not a feature.

### Limitations of Existing Systems

The existing systems and studies have limitations such as:

1. **Capabilities are addressed in isolation.** Semantic analysis, investor recommendation, startup recommendation, ML prediction and LLM assistance have each been studied separately; no reviewed work integrates them into a single funding-support workflow.
2. **The context is predominantly Western crowdfunding and venture capital.** The reviewed datasets — Kickstarter, GoFundMe, Crunchbase — do not reflect Indian startups and MSMEs, and none address Indian government funding schemes.
3. **Government scheme eligibility is not covered by any reviewed paper**, despite being a primary funding route for Indian MSMEs.
4. **Funding readiness is not assessed.** The literature predicts outcomes but does not tell an applicant which specific information in their own profile is missing or weak.
5. **Explanation is partial.** Where explainability is addressed, it accompanies the recommendation step alone, not readiness assessment and scheme eligibility as well.
6. **Provenance and freshness of funding data are not treated as system requirements**, although scheme terms change over time.

### Research Gap

Therefore, there is a need for a system that **integrates business analysis, funding readiness assessment, government scheme matching, investor matching, explainable reasoning and proposal assistance into a single workflow for Indian startups and MSMEs, in which every score is traceable to the factors and weights that produced it, every scheme fact is traceable to an official source with a verification date, and information the user has not provided is treated as unknown rather than assumed favourable.**

### Research Hypothesis

An integrated AI-based decision-support approach combining structured business information, textual analysis, funding-opportunity matching and explainable recommendations can improve the efficiency and usability of funding discovery for startups and MSMEs, compared with manual funding search. This is a hypothesis to be tested experimentally and is not presented as a proven claim.

---

## 5. OBJECTIVES

The major objectives of the proposed project are:

1. **To study and analyse** the funding discovery process for Indian startups and MSMEs, together with existing research on funding prediction, investor recommendation, explainable AI and LLM-assisted analysis, in order to identify the integration gap this project addresses.
2. **To design and develop** an explainable funding readiness assessment that evaluates a business across weighted components and reports, for each component, its score, its weight, the reason for that score, and the specific fields that would improve it.
3. **To implement** a government scheme matching engine that compares a business profile against verified scheme criteria across multiple weighted factors, and that reports a result as requiring further information when a criterion cannot be assessed rather than assuming it is satisfied.
4. **To provide** explainable investor–business matching in which each factor, its weight and its outcome are disclosed, and in which an unstated investor preference is treated neutrally rather than as a match.
5. **To improve** funding proposal quality through NLP-based structural analysis and grounded, retrieval-backed language model assistance, with all generated content constrained to retrieved source material.
6. **To build** a verified government scheme dataset with full provenance — official source URL, verification date and source type recorded for every record — together with a validation pipeline that rejects any record failing its provenance checks.
7. **To evaluate the performance of the proposed system** through module-level experiments covering readiness classification, matching quality, NLP representation, proposal assistance and the usefulness of explanations.

---

## 6. PROPOSED SYSTEM

The proposed system will overcome the limitations of the existing approach by implementing an **integrated, explainable, provenance-tracked funding decision-support platform** in which deterministic scoring engines produce every numeric result and language models are restricted to explaining decisions those engines have already made.

The system will provide:

- **A unified business profile** covering business basics, narrative, financials, market traction, team, statutory registrations and funding requirement, with completion tracked per section.
- **Funding readiness assessment** across five weighted components, each reporting its own score, weight, contribution, plain-language reason and the exact fields that would raise it.
- **Government scheme matching** across seven weighted factors, producing one of four honest statuses — *potentially eligible*, *needs information*, *review required*, or *likely not eligible* — none of which asserts confirmed eligibility.
- **Investor–business matching** against stated investor preferences, with every factor and weight disclosed and with privacy preserved: discoverable businesses expose a revenue *band* rather than exact financial figures, and proposals are never shared.
- **A retrieval-augmented assistant** that answers scheme questions only from indexed official documents, returning citations with source URLs and verification dates, and explicitly declining to answer when no source passes the relevance threshold.
- **Proposal upload and analysis**, producing section-level scores and specific improvement guidance.
- **An action plan** generated from the gaps the assessments actually identified, prioritised by impact.
- **An administrative module** for scheme verification, user management, scoring-weight configuration, retrieval index operations and audit review.

### Advantages of Proposed System

1. **Improved efficiency** — funding readiness, scheme eligibility and investor fit are assessed in one workflow instead of across many portals.
2. **Reduced manual effort** — eligibility comparison and gap identification are performed by the system rather than by the applicant.
3. **Better accuracy** — scheme facts are reproduced only from verified official sources and are never generated by a language model.
4. **User-friendly interface** — role-specific dashboards with every figure linked to the page on which it can be acted upon.
5. **Improved security** — authentication, role and record-ownership are verified on the server for every sensitive request; the interface never serves as the access control.
6. **Cost effectiveness** — built entirely on open-source components, with locally executed embeddings and graceful degradation when no language model is configured.
7. **Explainability throughout** — every score is decomposed into factors, weights and reasons, and is reproducible from the recorded model and configuration version.

---

## 7. METHODOLOGY

The proposed project will be developed using the following methodology:

**Requirement Analysis → System Design → Development → Testing → Deployment → Evaluation**

**Phase 1: Requirement Analysis.** Identify functional and non-functional requirements from the funding workflow and from the research gap; define the scoring factors and their weights; establish the provenance rules that scheme data must satisfy.

**Phase 2: System Design.** Design the three-tier architecture, the relational database schema, the scoring engine contracts, the retrieval pipeline and the role-specific interfaces. Scoring engines are specified as pure functions — performing no database access, reading no clock and invoking no language model — so that every result is reproducible from its inputs.

**Phase 3: Development.** Implement the web application, the API layer, the scoring engines, the document-processing and retrieval service, the dataset collection and validation pipeline, and the administrative tooling.

**Phase 4: Testing.** Perform unit testing of the scoring engines, integration testing against a real database and HTTP layer, security testing of authentication and authorisation boundaries, and user acceptance testing across the three user roles.

**Phase 5: Deployment.** Deploy the application with environment-based configuration, secrets held outside version control, and health and capability reporting so that the interface reflects what is genuinely available.

**Phase 6: Evaluation.** Evaluate the system on readiness classification, matching quality, NLP representation, proposal assistance and explanation usefulness, as set out in Section 15, reporting the project's own measured results rather than figures drawn from the literature.

---

## 8. SYSTEM ARCHITECTURE

**Figure 1: Proposed System Architecture**

![FundBridge AI system architecture: a three-tier web application comprising a React presentation layer, a Node.js application layer containing the deterministic scoring engines, a PostgreSQL data layer and an isolated Python AI/NLP service, with an optional external language model used only to phrase explanations.](figures/system_architecture.png)

*Figure 1 — FundBridge AI system architecture.*
The architecture consists of the following major components:

1. **Presentation layer** — a React single-page application providing three role-specific interfaces. The browser communicates only with the application layer; it never reaches the database or the AI service directly.
2. **Application layer** — a Node.js REST API that owns authentication, role and ownership authorisation, request validation, rate limiting and audit logging, and that orchestrates all business workflows.
3. **Scoring engines** — pure functions for readiness, scheme matching and investor matching. They perform no input/output and receive their weights as arguments, which is what makes every score reproducible and independently testable.
4. **Data layer** — a PostgreSQL relational database holding users, profiles, verified scheme records, derived scores with their model and configuration versions, document chunks with vector embeddings, and an audit trail.
5. **AI/NLP service** — a separate Python service for document extraction, text cleaning, sentence embedding, retrieval chunking and proposal scoring. It is isolated because these workloads are Python-specific and CPU-bound, and because the platform must remain fully functional when it is unavailable.
6. **External LLM provider (optional)** — invoked only to phrase explanations of decisions already made by the engines, and only over retrieved source material. The platform degrades to deterministic output when no provider is configured.

---

## 9. MODULES OF THE PROJECT

### Module 1: Business Profile and Funding Requirement
**Description:** Captures and maintains the structured and textual business information on which every later assessment depends — business basics, narrative, financials, market traction, team, statutory registrations and the funding requirement. Completion is tracked per section so the owner always knows what remains open. A field left blank is carried forward as *unknown*, never silently defaulted.

### Module 2: Funding Readiness Assessment
**Description:** Scores the business across five weighted components — business profile, financial information, market validation, team strength and proposal quality. For each component the module returns the score, the weight, the contribution to the overall total, a plain-language reason and the specific missing fields. An unsupplied input scores zero with that fact stated, rather than being averaged away.

### Module 3: Government Scheme Matching and Discovery
**Description:** Compares the business profile against each published scheme across seven weighted factors, renormalising weights over the factors actually present. It distinguishes between *the scheme does not restrict this* and *the business has not stated this* — the latter scores zero and forces a "needs information" status. Results carry the official source link and verification date.

### Module 4: Investor–Business Matching
**Description:** Matches discoverable businesses against stated investor preferences across industry, investment size, business stage, location and funding type, disclosing each factor with its weight and outcome. Preferences an investor has not stated are scored neutrally and never produce a blocking issue, because a preference is not a rule. Business privacy is enforced in the query: revenue is exposed as a band, and proposals and exact financial figures are withheld.

### Module 5: Proposal Analysis and Grounded AI Assistance
**Description:** Accepts PDF and DOCX proposal uploads, validating them by file content rather than file extension and storing them under a random identifier. Extracted text is cleaned, sectioned and scored, producing section-level feedback. A retrieval-augmented assistant answers scheme questions strictly from indexed official documents, returns citations, and declines to answer when no retrieved passage meets the relevance threshold.

### Module 6: Administration, Verification and Audit
**Description:** Provides authorised review of scheme records through a verification lifecycle, user account management, configuration of scoring weights with versioning, retrieval index operations, a data-quality report including dataset provenance, and an audit log of security-relevant actions that records outcomes without ever storing passwords or attempted credentials.

---

## 10. FUNCTIONAL REQUIREMENTS

The proposed system should provide the following functionalities:

| Sr. No. | Functional Requirement |
|---|---|
| 1 | Users shall register and authenticate under a defined role (business owner, investor, administrator), with sessions managed server-side. |
| 2 | A business owner shall create and maintain a business profile and funding requirement, with per-section completion reported. |
| 3 | The system shall compute a funding readiness assessment and present, for every component, its score, weight, reason and missing fields. |
| 4 | The system shall match the business profile against published government schemes and present a factor-by-factor explanation with the official source link and verification date for each result. |
| 5 | The system shall match businesses and investors against stated investor preferences, disclosing every factor and weight, while withholding exact financial figures and proposals from the investor view. |
| 6 | A business owner shall upload a funding proposal and receive a section-level analysis with specific improvement guidance. |
| 7 | The system shall answer scheme questions using retrieval over indexed official documents, return citations, and decline to answer when no sufficiently relevant source is retrieved. |
| 8 | The system shall generate a prioritised action plan from the gaps identified by the assessments. |
| 9 | An administrator shall verify and publish scheme records, manage users, configure scoring weights, operate the retrieval index and review the audit log. |
| 10 | The system shall report its own capability status so the interface never offers a control for a feature that cannot currently work. |

---

## 11. NON-FUNCTIONAL REQUIREMENTS

The system should satisfy the following requirements:

- **Performance:** Interactive pages should respond within approximately two seconds under normal single-user load. Long-running operations — document extraction, embedding generation and index rebuilding — are executed as explicit actions with progress reported, rather than blocking page loads.
- **Security:** Passwords stored using a one-way adaptive hash; sessions in httpOnly cookies with double-submit CSRF protection; authentication, role and record ownership verified on the server for every sensitive request; uploads validated by content; per-route rate limiting; secrets held only in environment configuration, excluded from version control, never exposed to the browser and never written to logs.
- **Reliability:** The platform must remain usable when the AI service or the language model is unavailable. Scoring, matching and the scheme catalogue continue to function, and affected features report themselves as unavailable rather than failing silently or fabricating output.
- **Scalability:** A stateless API permitting horizontal scaling; an indexed relational schema; a retrieval design with a documented migration path from exact vector search to an approximate-nearest-neighbour index as the corpus grows.
- **Usability:** Role-specific interfaces, responsive from mobile to desktop, meeting WCAG AA contrast, fully keyboard operable with visible focus indication, and honouring reduced-motion preferences.
- **Maintainability:** Layered architecture with scoring logic isolated in pure, independently testable functions; schema-validated configuration; versioned scoring weights; and an automated test suite covering unit, integration and security behaviour.

---

## 12. HARDWARE REQUIREMENTS

| Component | Minimum Requirement |
|---|---|
| Processor | Intel Core i5 (8th generation) or AMD Ryzen 5, 4 cores, 2.5 GHz |
| RAM | 8 GB (16 GB recommended — the embedding model is held in memory) |
| Storage | 20 GB free SSD space (application, database, Python environment and model weights) |
| Display | 1366 × 768 minimum; 1920 × 1080 recommended for the administrative console |
| Network | Broadband connection, required for scheme source collection and optional LLM access |
| Other Hardware | None. No GPU is required — embeddings are executed on CPU by design, to keep the system deployable on standard hardware |

---

## 13. SOFTWARE REQUIREMENTS

| Software / Technology | Version / Details |
|---|---|
| Operating System | Windows 11 (development); Linux-compatible for deployment |
| Programming Language | TypeScript (application and interface), Python 3.12 (AI/NLP service), SQL |
| Frontend | React 19, Vite 6, Tailwind CSS v4, React Router 7, TanStack Query 5 |
| Backend | Node.js 24, Express 4.21, Prisma ORM 6.19, Zod validation |
| Database | PostgreSQL 18 |
| Framework | FastAPI (AI service), Express (API), React (interface) |
| Development Tool / IDE | Visual Studio Code, Git, pgAdmin / Prisma Studio |
| Other Tools | Vitest and Pytest (testing), sentence-transformers, PyMuPDF, python-docx, scikit-learn |

---

## 14. TECHNOLOGIES USED

The project will use the following technologies:

- **Programming Language:** TypeScript, Python 3.12, SQL
- **Frontend Technology:** React 19 with Vite 6, Tailwind CSS v4, TanStack Query, React Hook Form with Zod validation
- **Backend Technology:** Node.js with Express, Prisma ORM, JSON Web Token session authentication, Helmet, express-rate-limit
- **Database:** PostgreSQL 18, with vector embeddings stored as a numeric array and cosine similarity computed by a dedicated SQL function
- **Framework:** FastAPI for the Python AI/NLP service; Pydantic v2 for schema validation of all model input and output
- **Cloud/AI/ML Technology:**
  - **NLP:** text cleaning, section detection, PyMuPDF and python-docx document extraction
  - **Embeddings:** `sentence-transformers/all-MiniLM-L6-v2`, 384-dimensional, L2-normalised, executed on CPU
  - **Retrieval-Augmented Generation:** document chunking, exact cosine similarity search with a minimum relevance threshold, and citation-bearing answers
  - **Machine Learning:** scikit-learn for the readiness experimentation described in Section 15
  - **Explainable AI:** deterministic factor-and-weight decomposition for every score, with SHAP used for interpretation of the experimental ML models
  - **Large Language Models:** a provider-independent abstraction supporting multiple vendors, used strictly for grounded explanation and never for deciding a score, an eligibility status or a funding amount
- **Development Tools:** Git, Visual Studio Code, Vitest, Pytest, Prisma Migrate

---

## 15. EXPECTED OUTCOMES

At the completion of the project, the proposed system is expected to:

1. **Provide** an integrated funding decision-support platform in which a business owner can assess readiness, discover relevant government schemes and investors, and read the full reasoning behind every result.
2. **Reduce** the manual effort required to determine scheme eligibility and funding readiness, by replacing cross-portal searching with a single assessment that names the specific gaps.
3. **Improve** the transparency of funding recommendations by decomposing every score into its factors, weights and reasons, with results reproducible from a recorded model and configuration version.
4. **Automate** business profile analysis, readiness scoring, scheme and investor matching, proposal section analysis and action-plan generation.
5. **Increase** the reliability of funding information presented to users, by reproducing scheme facts only from verified official sources with the source URL and verification date attached, and by leaving an unverified figure blank with a stated reason rather than filling it with a plausible estimate.
6. **Provide an efficient and reliable solution for** funding discovery and decision support for Indian startups and MSMEs, operating as a decision-support tool and not as a guarantee of funding, eligibility, approval or investment.

### Planned Experimental Evaluation

The following module-level experiments will produce this project's own measured results. No figure reported in the literature will be presented as a result of FundBridge AI.

| Experiment | What will be tested | Baseline / comparison | Metrics |
|---|---|---|---|
| 1. Funding readiness | Whether the defined features classify readiness | Rule-based vs. selected ML models | Accuracy, Precision, Recall, F1 |
| 2. Investor matching | Whether the engine ranks relevant businesses effectively | Simple similarity baseline vs. weighted engine | Precision@K, Recall@K, NDCG@K |
| 3. NLP representation | Whether business descriptions can be compared meaningfully | TF-IDF vs. sentence embeddings | Retrieval and similarity evaluation |
| 4. Proposal assistance | Whether AI suggestions improve proposal quality | Original vs. AI-assisted proposal | Clarity, completeness, structure, human preference |
| 5. Explainability | Whether explanations improve understanding and trust | Recommendation with vs. without explanation | User understanding, relevance, usability |

---

## 16. PROJECT TIMELINE

| Phase | Activity | Duration |
|---|---|---|
| Phase 1 | Problem identification & literature survey | 3 weeks |
| Phase 2 | Requirement analysis & dataset feasibility study | 2 weeks |
| Phase 3 | System design — architecture, database schema, scoring model | 3 weeks |
| Phase 4 | Development — profile, readiness, matching, NLP/RAG, dashboards | 10 weeks |
| Phase 5 | Dataset collection, verification and ingestion | 4 weeks (overlapping Phase 4) |
| Phase 6 | Testing — unit, integration, security, user acceptance | 3 weeks |
| Phase 7 | Experimental evaluation | 3 weeks |
| Phase 8 | Deployment, documentation & final presentation | 2 weeks |

*A Gantt chart or Work Breakdown Structure representing the above may be inserted here.*

---

## 17. SOCIAL / INDUSTRIAL / ENVIRONMENTAL IMPACT

- **Social Impact:** Reduces the information advantage that well-networked founders hold over first-generation and under-represented entrepreneurs, by making scheme eligibility and funding readiness legible to anyone with a browser. Because every result is explained, the platform also serves an educational purpose: a user learns *why* their case is weak, not merely that it is.
- **Industrial Impact:** Reduces wasted applications on both sides of the funding market. Applicants spend their effort on opportunities they may genuinely qualify for; scheme administrators and investors receive better-targeted applications, conserving review capacity.
- **Economic Impact:** Improved access to finance for micro and small enterprises supports the employment and output they generate. Faster, better-informed funding decisions shorten the interval between a viable business plan and the capital required to execute it.
- **Environmental Impact:** Replaces physical document submission and repeated in-person enquiry with a digital workflow. The computational footprint is deliberately modest — the embedding model runs on CPU and requires no GPU infrastructure, and language model use is bounded to short, optional explanation tasks rather than continuous inference.

---

## 18. FUTURE SCOPE

The project can be further enhanced by:

1. **Integration with official government scheme APIs** — for example a national scheme repository — to replace manual record verification with authenticated, automatically refreshed data.
2. **Implementation of a learned ranking model** for investor and scheme matching, once sufficient outcome data has been collected to train and validate it responsibly.
3. **Support for regional Indian languages**, so that scheme eligibility and readiness guidance are accessible to entrepreneurs who do not work primarily in English.
4. **Integration with cloud, AI and document-verification technologies**, including automated validation of statutory registration documents and migration of retrieval to a managed approximate-nearest-neighbour vector index.
5. **Development of a mobile application**, reflecting the fact that many MSME owners access the internet primarily by phone.
6. **Deployment at a larger scale**, with a longitudinal study of whether users who followed the platform's action plans experienced measurably better application outcomes — the strongest available validation of the research hypothesis.

---

## 19. CONCLUSION

The proposed project **"FundBridge AI — An Explainable AI-Based Funding Decision Support and Investor–Business Matching System for Micro and Small Enterprises"** aims to provide an effective solution to the problem of **fragmented, opaque and difficult-to-verify funding information faced by Indian startups and MSMEs.**

The system will utilise **natural language processing, sentence-embedding-based retrieval-augmented generation, machine learning, explainable AI and large language model assistance, built on a React, Node.js, PostgreSQL and FastAPI stack**, to improve **the efficiency, transparency and reliability of funding discovery and readiness assessment.**

The project's distinguishing commitment is methodological rather than merely technical: no score is produced that cannot be decomposed into its factors and weights, no scheme fact is presented that cannot be traced to an official source and verification date, and no language model is permitted to determine an eligibility status, a funding amount or a score. Where information is absent, the system reports it as absent rather than inferring it favourably. Performance figures reported in the reviewed literature are treated strictly as motivation for the approach and are never presented as results of this system; FundBridge AI will be evaluated independently through the experiments defined in Section 15.

The proposed solution is expected to be efficient, reliable, scalable and user-friendly, operating as a decision-support tool rather than a guarantee of funding or investment. The project also provides substantial opportunity for future enhancement and real-world implementation.

---

## 20. REFERENCES

### Research Papers

1. O. Babayoff and O. Shehory, "The role of semantics in the success of crowdfunding projects," *PLOS ONE*, vol. 17, no. 2, art. e0263891, Feb. 2022, doi: 10.1371/journal.pone.0263891.
2. S. Zhang, Y. Wang, H. Li, and W. Zhang, "Who Will Support My Project? Interactive Search of Potential Crowdfunding Investors Through InSearch," in *Extended Abstracts of the 2022 CHI Conference on Human Factors in Computing Systems (CHI EA '22)*, New Orleans, LA, USA, 2022, arXiv:2205.02041.
3. S. P. Raflesia, D. Lestarini, R. D. Kurnia, and D. Y. Hardiyanti, "Using machine learning approach towards successful crowdfunding prediction," *Bulletin of Electrical Engineering and Informatics*, vol. 12, no. 4, pp. 2438–2445, Aug. 2023, doi: 10.11591/beei.v12i4.5238.
4. T. Ye, J. Zheng, J. Jin, J. Qiu, W. Ai, and Q. Mei, "Using Artificial Intelligence to Unlock Crowdfunding Success for Small Businesses," *arXiv preprint* arXiv:2407.09480, 2024. **(Base Paper)**
5. A. Maarouf, S. Feuerriegel, and N. Pröllochs, "A fused large language model for predicting startup success," *European Journal of Operational Research*, vol. 322, no. 1, pp. 198–214, 2025 (preprint arXiv:2409.03668, 2024).
6. L. Xu, J. Chen, and Y. Zhao, "SocioLink: Leveraging Relational Information in Knowledge Graphs for Startup Recommendations," *IEEE Transactions on Knowledge and Data Engineering*, 2023. *(Studied but not included among the five summarised papers; bibliographic details to be confirmed if cited.)*

### Books

1. S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, Pearson, 4th Edition, 2021.
2. C. D. Manning, P. Raghavan, and H. Schütze, *Introduction to Information Retrieval*, Cambridge University Press, 1st Edition, 2008.
3. C. Molnar, *Interpretable Machine Learning: A Guide for Making Black Box Models Explainable*, 2nd Edition, 2022.

### Websites / Documentation

1. Official documentation of React — https://react.dev (accessed October 2026).
2. Official documentation of PostgreSQL — https://www.postgresql.org/docs (accessed October 2026).
3. Official documentation of FastAPI — https://fastapi.tiangolo.com (accessed October 2026).
4. Official documentation of Prisma ORM — https://www.prisma.io/docs (accessed October 2026).
5. Sentence-Transformers documentation — https://www.sbert.net (accessed October 2026).
6. Startup India Seed Fund Scheme, Department for Promotion of Industry and Internal Trade — https://seedfund.startupindia.gov.in (accessed October 2026).
7. Pradhan Mantri MUDRA Yojana, MUDRA — https://www.mudra.org.in/offerings (accessed October 2026).

---

*Note: references 1–5 were verified against the published record in October 2026, including venue, volume, pages and DOI where applicable. Reference 6 was studied but is not among the five summarised papers; confirm its details before citing it.*
