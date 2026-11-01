/**
 * Landing hero.
 *
 * The right-hand panel is an ILLUSTRATION, and is labelled as one on screen.
 * It shows the shape of the product — a readiness ring, weighted components,
 * match reasons, a scheme card — using figures that are clearly marked as a
 * sample. It deliberately does not call the API: an anonymous visitor has no
 * business of their own, and borrowing someone else's real figures to decorate
 * a marketing page would be both a privacy breach and a lie about whose data
 * it is.
 *
 * The sample numbers are internally consistent (the components sum to the ring
 * value) so the illustration cannot teach a visitor something false about how
 * the scoring works.
 */
import { Link } from 'react-router-dom';
import { Icon, IllustrativeTag, TrustNote, btn } from './primitives';

const SAMPLE_COMPONENTS = [
  { label: 'Business profile', score: 100, weight: 20 },
  { label: 'Financial information', score: 80, weight: 25 },
  { label: 'Market validation', score: 70, weight: 20 },
  { label: 'Team strength', score: 65, weight: 15 },
  { label: 'Proposal quality', score: 45, weight: 20 },
];

// 20*1.0 + 25*0.8 + 20*0.7 + 15*0.65 + 20*0.45 = 72.75 -> 73
const SAMPLE_READINESS = Math.round(
  SAMPLE_COMPONENTS.reduce((sum, c) => sum + (c.score / 100) * c.weight, 0),
);

const SAMPLE_MATCH_REASONS = [
  'Industry alignment',
  'Funding range compatibility',
  'Business stage',
];

function ReadinessRing({ value }: { value: number }) {
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const filled = (value / 100) * CIRC;

  return (
    <div className="relative flex-shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90" aria-hidden="true">
        <circle cx="44" cy="44" r={R} fill="none" stroke="#E5E1F4" strokeWidth="9" />
        <circle
          cx="44"
          cy="44"
          r={R}
          fill="none"
          stroke="#4F46E5"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC - filled}`}
          className="fb-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-semibold text-ink tabular-nums leading-none">
          {value}
        </span>
        <span className="text-[10px] text-ink-faint mt-0.5">of 100</span>
      </div>
    </div>
  );
}

function PreviewPanel() {
  return (
    <div className="relative">
      {/* Soft emerald wash behind the panel, purely decorative. */}
      <div
        className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-accent-soft via-transparent to-accent-soft blur-xl opacity-70"
        aria-hidden="true"
      />

      <div className="relative bg-white border border-line rounded-2xl shadow-[0_18px_50px_-18px_rgba(22,16,51,0.22)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-muted-bg bg-surface-tint">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-[12px] font-medium text-ink">Funding readiness</span>
          </div>
          <IllustrativeTag />
        </div>

        <div className="p-5">
          <div className="flex items-center gap-5">
            <ReadinessRing value={SAMPLE_READINESS} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">
                Five weighted components
              </p>
              <p className="text-[12px] text-ink-faint leading-relaxed mt-1">
                Each one states what it scored, the weight it carried, and the specific fields that
                would raise it.
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-2.5">
            {SAMPLE_COMPONENTS.map((c, i) => (
              <li key={c.label}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-[12px] text-ink-soft">{c.label}</span>
                  <span className="text-[11px] text-ink-faint tabular-nums flex-shrink-0">
                    {c.score}
                    <span className="text-ink-faint"> · {c.weight}% weight</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted-bg overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent fb-bar"
                    style={{ width: `${c.score}%`, animationDelay: `${120 + i * 90}ms` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-muted-bg p-5 bg-surface-tint">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium text-ink">Why this investor may fit</p>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent-soft border border-line-accent rounded-full px-2 py-0.5">
              Potential fit
            </span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {SAMPLE_MATCH_REASONS.map((r) => (
              <li
                key={r}
                className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft bg-white border border-line rounded-full px-2.5 py-1"
              >
                <span className="text-accent">{Icon.check({ size: 12 })}</span>
                {r}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-white p-3">
            <span className="text-accent mt-0.5 flex-shrink-0">{Icon.layers({ size: 18 })}</span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-ink">
                A government scheme worth reading
              </p>
              <p className="text-[11px] text-ink-faint leading-relaxed mt-0.5">
                Surfaced with its stated criteria and a link to the official source, so terms can be
                confirmed before applying.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-canvas">
      {/* Decorative field. aria-hidden and pointer-events-none so it never
          intercepts a click or reaches a screen reader. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -right-32 w-[34rem] h-[34rem] rounded-full bg-accent-soft blur-3xl opacity-70" />
        <div className="absolute top-32 -left-40 w-[26rem] h-[26rem] rounded-full bg-accent-soft blur-3xl opacity-60" />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid gap-12 lg:gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="fb-rise">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent bg-accent-soft border border-line-accent rounded-full px-3 py-1.5">
              {Icon.spark({ size: 13 })}
              AI-powered funding intelligence
            </span>

            <h1 className="mt-6 text-[34px] sm:text-[46px] lg:text-[52px] leading-[1.08] font-semibold tracking-[-0.03em] text-ink text-balance">
              The Right Funding Starts with the Right Connection.
            </h1>

            <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-ink-soft max-w-xl">
              FundBridge AI helps micro and small enterprises understand their funding readiness,
              discover relevant government schemes, and connect with potential investors through
              explainable, data-driven insights.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/register?role=STARTUP" className={btn.primary}>
                Get Funding Ready
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">
                  {Icon.arrow({ size: 16 })}
                </span>
              </Link>
              <a href="#how-it-works" className={btn.secondary}>
                Explore How It Works
              </a>
            </div>

            <div className="mt-8 flex items-start gap-2.5 max-w-lg">
              <span className="text-ink-faint mt-0.5 flex-shrink-0">{Icon.shield({ size: 16 })}</span>
              <TrustNote>
                Readiness scores and matches are decision-support tools. They are not an approval,
                an offer, or a guarantee of funding — only the issuing authority or investor can
                decide that.
              </TrustNote>
            </div>
          </div>

          <div className="fb-rise fb-rise-delay">
            <PreviewPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
