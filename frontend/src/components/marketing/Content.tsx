/**
 * Static content sections: credibility strip, problem/solution, feature bento,
 * the two audience blocks, About, and the closing call to action.
 *
 * Nothing here states a figure the project cannot stand behind. There are no
 * partner logos, user counts, funding totals, success rates, testimonials or
 * certifications, because none of those exist — the credibility strip states
 * design principles, which are verifiable by reading the code.
 *
 * Every CTA points at a route that exists and goes through the real
 * authentication flow. None of them bypass sign-in or create a session.
 */
import { Link } from 'react-router-dom';
import { Card, Icon, Reveal, Section, SectionHeading, TrustNote, btn } from './primitives';

// ---------------------------------------------------------------------------

const PRINCIPLES = [
  {
    icon: Icon.spark({ size: 18 }),
    title: 'Explainable by design',
    body: 'Every score lists the factors, weights and reasons behind it.',
  },
  {
    icon: Icon.building({ size: 18 }),
    title: 'Built for MSMEs',
    body: 'Scoped to the funding questions small Indian enterprises actually face.',
  },
  {
    icon: Icon.layers({ size: 18 }),
    title: 'Official sources only',
    body: 'Scheme facts are reproduced from official portals, with links to verify.',
  },
  {
    icon: Icon.lock({ size: 18 }),
    title: 'Privacy-conscious handling',
    body: 'Ownership is checked on the server for every sensitive request.',
  },
];

export function CredibilityStrip() {
  return (
    <div className="bg-white border-y border-line">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title}>
              <Reveal delay={i * 60}>
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-soft text-accent flex-shrink-0">
                    {p.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{p.title}</p>
                    <p className="text-[12px] text-ink-faint leading-relaxed mt-0.5">{p.body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const CHALLENGES = [
  {
    icon: Icon.gauge({ size: 20 }),
    problem: 'You cannot tell whether you are ready to apply.',
    detail:
      'Requirements are scattered, and nothing tells you which gap in your own documentation is the one holding you back.',
    solution: 'A guided assessment that names the specific fields to fix',
    solutionDetail:
      'Five weighted components, each reporting its own score and the exact inputs that would raise it.',
  },
  {
    icon: Icon.search({ size: 20 }),
    problem: 'Finding a suitable investor is guesswork.',
    detail:
      'Preferences are rarely published in a comparable form, so outreach becomes volume rather than fit.',
    solution: 'Matching against stated preferences, with the reasoning shown',
    solutionDetail:
      'Each factor is listed with its weight and outcome. An unstated preference is scored neutrally, not as a match.',
  },
  {
    icon: Icon.layers({ size: 20 }),
    problem: 'Scheme eligibility is hard to read.',
    detail:
      'Criteria sit across portals and PDFs, and small print decides whether an application is worth making at all.',
    solution: 'Scheme criteria compared against your profile, conservatively',
    solutionDetail:
      'Where a criterion cannot be assessed, the result says so rather than assuming it in your favour.',
  },
];

export function ProblemSolution() {
  return (
    <Section id="problem">
      <Reveal>
        <SectionHeading
          eyebrow="The problem"
          title="Finding funding shouldn't feel like finding a needle in a haystack."
          lead="Three things make it hard for a small business. The platform is built around all three."
        />
      </Reveal>

      <div className="mt-12 space-y-5">
        {CHALLENGES.map((c, i) => (
          <Reveal key={c.problem} delay={i * 70}>
            <Card className="overflow-hidden">
              <div className="grid lg:grid-cols-2">
                <div className="p-6 sm:p-7">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-muted-bg text-ink-soft">
                    {c.icon}
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold text-ink leading-snug">
                    {c.problem}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-faint">{c.detail}</p>
                </div>

                <div className="p-6 sm:p-7 bg-accent-soft lg:border-l border-t lg:border-t-0 border-line-accent/60">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    {Icon.check({ size: 13 })}
                    How FundBridge helps
                  </span>
                  <h4 className="mt-3 text-[15px] font-medium text-ink leading-snug">
                    {c.solution}
                  </h4>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                    {c.solutionDetail}
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function Features() {
  return (
    <Section id="features" tone="raised">
      <Reveal>
        <SectionHeading
          eyebrow="Features"
          title="Seven capabilities, each one accountable for its output."
          lead="Scores come from deterministic engines. Language models phrase explanations; they never decide a result."
        />
      </Reveal>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {/* Lead tile, deliberately larger. */}
        <Reveal className="lg:col-span-2">
          <Card interactive className="h-full p-6 sm:p-8 bg-gradient-to-br from-white to-surface-tint">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-accent text-white">
              {Icon.gauge({ size: 22 })}
            </span>
            <h3 className="mt-5 text-[20px] font-semibold text-ink tracking-[-0.01em]">
              AI funding readiness
            </h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft max-w-xl">
              Five weighted components, scored independently, with the missing fields named for
              each. A component you have not filled in scores zero and says so, rather than being
              quietly averaged away.
            </p>
            <ul className="mt-5 grid sm:grid-cols-2 gap-2.5">
              {[
                'Per-component reasons, not a single opaque number',
                'The specific inputs that would raise each score',
                'Reproducible: model and weight version stamped on every result',
                'Guidance toward an application, never a financial approval',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="text-accent mt-0.5 flex-shrink-0">{Icon.check({ size: 15 })}</span>
                  <span className="text-[12.5px] text-ink-soft leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={60}>
          <Card interactive className="h-full p-6">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent-soft text-accent">
              {Icon.handshake({ size: 20 })}
            </span>
            <h3 className="mt-4 text-[16px] font-semibold text-ink">
              Explainable investor matching
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
              Industry, stage, investment size, location and funding type — each shown with the
              weight it carried. Preferences an investor has not stated are scored neutrally, and
              never produce a blocking issue.
            </p>
          </Card>
        </Reveal>

        <Reveal delay={60}>
          <Card interactive className="h-full p-6">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent-soft text-accent">
              {Icon.layers({ size: 20 })}
            </span>
            <h3 className="mt-4 text-[16px] font-semibold text-ink">
              Government scheme discovery
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
              Published schemes with their stated criteria, official source link and verification
              date. Potential eligibility is always labelled as potential — confirmed eligibility
              comes only from the issuing authority.
            </p>
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card interactive className="h-full p-6">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent-soft text-accent">
              {Icon.doc({ size: 20 })}
            </span>
            <h3 className="mt-4 text-[16px] font-semibold text-ink">
              Secure proposal handling
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
              Uploads are verified by file content rather than extension and stored under a random
              identifier. Document text is treated as data, never as an instruction to the system.
            </p>
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card interactive className="h-full p-6">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent-soft text-accent">
              {Icon.trend({ size: 20 })}
            </span>
            <h3 className="mt-4 text-[16px] font-semibold text-ink">
              Dashboards for both sides
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
              Business owners track profile completion, readiness and opportunities. Investors
              review discoverable businesses against their stated preferences, subject to what each
              business chose to share.
            </p>
          </Card>
        </Reveal>

        <Reveal delay={120}>
          <Card interactive className="h-full p-6">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent-soft text-accent">
              {Icon.shield({ size: 20 })}
            </span>
            <h3 className="mt-4 text-[16px] font-semibold text-ink">Administrative review</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
              Authorised reviewers verify scheme records, manage accounts and tune scoring weights.
              Security-relevant actions are written to an audit log — without recording passwords
              or attempted credentials.
            </p>
          </Card>
        </Reveal>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function Audiences() {
  return (
    <>
      <Section id="for-businesses">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <SectionHeading
              eyebrow="For business owners"
              title="Understand your funding options before you apply."
              lead="Know where your case is weak, which schemes are worth your time, and what to fix first — before you spend weeks on an application."
            />
            <ul className="mt-6 space-y-3">
              {[
                'A profile that drives every assessment, with completion tracked per section',
                'Readiness guidance that names the exact fields to improve',
                'Scheme discovery with official source links and stated criteria',
                'Explainable investor matching against stated preferences',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="text-accent mt-0.5 flex-shrink-0">{Icon.check({ size: 17 })}</span>
                  <span className="text-[14px] text-ink-soft leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/register?role=STARTUP" className={btn.primary}>
                Start as a Business Owner
                {Icon.arrow({ size: 16 })}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <Card className="p-6 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                What you get on day one
              </p>
              <div className="mt-4 space-y-3.5">
                {[
                  ['Profile completion', 'Tracked across seven sections'],
                  ['Readiness breakdown', 'Five components, each with its reasoning'],
                  ['Scheme matches', 'Every factor explained, nothing assumed'],
                  ['Action plan', 'Built from the gaps actually found'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 pb-3.5 border-b border-muted-bg last:border-0 last:pb-0">
                    <span className="text-[13px] font-medium text-ink">{k}</span>
                    <span className="text-[12px] text-ink-faint text-right max-w-[58%]">{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section id="for-investors" tone="deep">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal className="lg:order-2">
            <SectionHeading
              onDark
              eyebrow="For investors"
              title="Discover businesses that align with your investment interests."
              lead="State your preferences once, then review businesses that opted into discovery — with the fit reasoning shown factor by factor."
            />
            <ul className="mt-6 space-y-3">
              {[
                'Discovery limited to businesses that opted in',
                'Fit explained across industry, stage, size, location and funding type',
                'Revenue shown as a band, never an exact figure',
                'Shortlists to track the opportunities you are following',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="text-brand-glow mt-0.5 flex-shrink-0">{Icon.check({ size: 17 })}</span>
                  <span className="text-[14px] text-line-accent leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/register?role=INVESTOR" className={btn.onDark}>
                Explore as an Investor
                {Icon.arrow({ size: 16 })}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80} className="lg:order-1">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 sm:p-7 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-glow">
                The privacy boundary
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-line-accent">
                Businesses control their own visibility. What an investor can see is decided on the
                server by the query itself, not by hiding fields in the interface.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  ['Visible', 'Industry, stage, location, funding requirement, revenue band', true],
                  ['Not shared', 'Exact financial figures, proposals, owner identity', false],
                ].map(([label, value, shown]) => (
                  <div key={String(label)} className="rounded-xl border border-white/10 bg-accent-deep/40 p-3.5">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        shown ? 'text-brand-glow' : 'text-brand-glow'
                      }`}
                    >
                      {label}
                    </span>
                    <p className="text-[13px] text-line-accent mt-1 leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------

export function About() {
  return (
    <Section id="about" tone="raised">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <Reveal>
          <SectionHeading
            eyebrow="About"
            title="Built on one rule: never claim more confidence than the inputs support."
          />
        </Reveal>

        <Reveal delay={80}>
          <div className="space-y-4 text-[14px] leading-relaxed text-ink-soft">
            <p>
              FundBridge AI is a final-year academic project: an explainable funding
              decision-support and investor matching system for micro and small enterprises in
              India. It combines deterministic scoring engines with retrieval over official scheme
              documents.
            </p>
            <p>
              The scoring engines are pure functions. They perform no database access, read no
              clock and call no language model — weights are supplied as arguments and recorded
              alongside every result, so any score can be reproduced exactly. A language model, when
              configured, phrases explanations of decisions those engines have already made. It
              never determines eligibility, a funding amount, a scheme status or a score.
            </p>
            <p>
              Scheme records are reproduced from official sources with the source URL and
              verification date attached. Where a figure has not been verified it is left blank with
              the reason stated, and demonstration records are labelled as synthetic wherever they
              appear. A plausible invented number would be worse than an honest gap.
            </p>
            <TrustNote>
              The platform does not provide financial advice and is not a lender, an investor or a
              government agency.
            </TrustNote>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function FinalCta() {
  return (
    <section className="bg-canvas">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-20 pt-4">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-accent-deep px-6 py-14 sm:px-14 sm:py-16">
            <div
              className="pointer-events-none absolute -top-24 -right-16 w-96 h-96 rounded-full bg-accent opacity-25 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative max-w-2xl">
              <h2 className="text-[28px] sm:text-[36px] leading-[1.15] font-semibold tracking-[-0.02em] text-white text-balance">
                Make your next funding decision an informed one.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-line-accent">
                Bring your business information, funding goals, and opportunities into one guided
                experience.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/register" className={btn.onDark}>
                  Get Started
                  {Icon.arrow({ size: 16 })}
                </Link>
                <Link to="/how-it-works" className={btn.onDarkGhost}>
                  Explore the Platform
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
