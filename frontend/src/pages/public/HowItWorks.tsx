/**
 * How it works — explains the architecture in plain language.
 *
 * Doubles as the honest-limitations page: it states what the system does not do
 * as plainly as what it does.
 */
import { Link } from 'react-router-dom';
import { PublicHeader, PublicFooter } from './Landing';

const STAGES = [
  {
    name: 'Structured matching',
    body: 'Your profile and funding requirement are compared against each scheme\u2019s stored criteria by deterministic rule \u2014 industry, stage, legal type, location, funding range and purpose. Each comparison produces a factor score and a stated reason.',
  },
  {
    name: 'Conservative handling of unknowns',
    body: 'A criterion you have not answered scores zero and is reported as missing, rather than being given partial credit. A displayed score is therefore a floor that can only rise as you fill gaps \u2014 never an optimistic guess. A criterion a scheme does not restrict scores full credit, because it genuinely excludes nobody.',
  },
  {
    name: 'Hard eligibility conditions',
    body: 'Where a scheme states a machine-checkable condition \u2014 a registration requirement, an age limit, a revenue ceiling \u2014 failing it is reported as a blocking issue and overrides the score. A high score with a blocker would be actively misleading.',
  },
  {
    name: 'Semantic relevance',
    body: 'Similarity between your business description and a scheme\u2019s description contributes a small, clearly-labelled relevance signal. It is never treated as evidence of eligibility.',
  },
  {
    name: 'Explanation, then language',
    body: 'The engine produces the score and the evidence. A language model is used only to phrase that evidence in readable prose. It cannot change a score and cannot invent a requirement.',
  },
];

const LIMITS = [
  'FundBridge does not provide funding and is not a government application portal.',
  'A match is a potential-relevance indicator, not an eligibility decision.',
  'Scheme information can change. Always verify current requirements with the official source before applying.',
  'Readiness measures how complete and evidenced your own case is \u2014 not whether you will receive funding.',
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicHeader />

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-3xl font-semibold text-ink tracking-tight">How FundBridge works</h1>
          <p className="text-base text-ink-soft mt-4 leading-relaxed">
            FundBridge is built so that every number it shows can be explained. Scores come from rules over verified
            data, and the reasoning is always available alongside the result.
          </p>

          <div className="mt-12 space-y-8">
            {STAGES.map((s, i) => (
              <div key={s.name} className="flex gap-5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-soft text-accent text-[13px] font-semibold flex items-center justify-center tabular-nums">
                  {i + 1}
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">{s.name}</h2>
                  <p className="text-[14px] text-ink-soft mt-1.5 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 bg-canvas border border-line rounded-[10px] p-6">
            <h2 className="text-[15px] font-semibold text-ink">What FundBridge does not do</h2>
            <ul className="mt-4 space-y-2.5">
              {LIMITS.map((l) => (
                <li key={l} className="flex gap-2.5 text-[13px] text-ink-soft leading-relaxed">
                  <span className="text-ink-faint flex-shrink-0" aria-hidden="true">
                    &mdash;
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10">
            <Link
              to="/register"
              className="inline-flex text-sm font-medium bg-accent-deep text-white px-5 py-2.5 rounded-lg hover:bg-navy-light transition-colors"
            >
              Create an account
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
