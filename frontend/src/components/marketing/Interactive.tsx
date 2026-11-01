/**
 * The three interactive blocks: the process stepper, the product demo tabs and
 * the FAQ accordion.
 *
 * All three are built from real controls with real state. Nothing here is a
 * decorative widget that does not respond.
 *
 * Accessibility is the reason for the shapes chosen:
 *   - the stepper and the demo use the ARIA tabs pattern, including arrow-key
 *     roving focus, because a tablist that cannot be driven from the keyboard
 *     is not a tablist
 *   - the FAQ uses real <button> elements with aria-expanded and a linked
 *     region, not clickable divs
 *   - on narrow screens the stepper becomes a stacked accordion, since a row
 *     of seven-word tabs is unusable at 375px
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, Icon, IllustrativeTag, Reveal, Section, SectionHeading, TrustNote, btn } from './primitives';

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

interface Step {
  n: number;
  title: string;
  short: string;
  body: string;
  points: string[];
  icon: ReactNode;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Build Your Business Profile',
    short: 'Profile',
    body: 'Enter the business details and funding need that every assessment is built from. Nothing is inferred about your business that you have not told the platform.',
    points: [
      'Business basics, story, financials, market and team',
      'The amount you need and what it is for',
      'Anything left blank is treated as unknown, never as a pass',
    ],
    icon: Icon.building({ size: 18 }),
  },
  {
    n: 2,
    title: 'Understand Your Readiness',
    short: 'Readiness',
    body: 'Five weighted components are scored independently. Each returns its own score, the weight it carried, a plain-language reason, and the exact fields that would raise it.',
    points: [
      'Business profile, financials, market validation, team, proposal',
      'Every component names what is missing',
      'A missing input scores zero and says so, rather than being averaged away',
    ],
    icon: Icon.gauge({ size: 18 }),
  },
  {
    n: 3,
    title: 'Discover Relevant Opportunities',
    short: 'Discover',
    body: 'Your profile is compared against each published government scheme and, separately, against investors who have stated their preferences.',
    points: [
      'Seven weighted factors per scheme',
      'Investor fit assessed against stated preferences',
      'Results that need more information say so instead of guessing',
    ],
    icon: Icon.search({ size: 18 }),
  },
  {
    n: 4,
    title: 'Review and Connect',
    short: 'Act',
    body: 'Read the reasoning behind every result, work through the specific gaps it identifies, and follow the official link to apply.',
    points: [
      'Factor-by-factor explanation for every match',
      'An action plan built from the gaps actually found',
      'Official source links so terms can be confirmed first',
    ],
    icon: Icon.handshake({ size: 18 }),
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = STEPS.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = active === last ? 0 : active + 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = active === 0 ? last : active - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const step = STEPS[active]!;

  return (
    <Section id="how-it-works" tone="raised">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="Four steps, and you can see the reasoning at every one."
          lead="Each stage produces something you can read and act on, not a number you have to take on trust."
        />
      </Reveal>

      {/* Desktop: a real tablist. */}
      <div className="hidden md:block mt-10">
        <div
          role="tablist"
          aria-label="How FundBridge AI works"
          onKeyDown={onKeyDown}
          className="grid grid-cols-4 gap-3"
        >
          {STEPS.map((s, i) => {
            const selected = i === active;
            return (
              <button
                key={s.n}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`${baseId}-tab-${i}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${i}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                className={`text-left rounded-xl border p-4 transition-all duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected
                    ? 'border-accent bg-accent-soft shadow-[0_6px_20px_-10px_rgba(79,70,229,0.45)]'
                    : 'border-line bg-white hover:border-line-strong hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
                    selected ? 'bg-accent text-white' : 'bg-muted-bg text-ink-soft'
                  }`}
                >
                  {s.icon}
                </span>
                <p className="mt-3 text-[11px] font-semibold tracking-wider uppercase text-ink-soft">
                  Step {s.n}
                </p>
                <p
                  className={`mt-1 text-[14px] font-medium leading-snug ${
                    selected ? 'text-ink' : 'text-ink-soft'
                  }`}
                >
                  {s.title}
                </p>
              </button>
            );
          })}
        </div>

        {STEPS.map((s, i) => (
          <div
            key={s.n}
            role="tabpanel"
            id={`${baseId}-panel-${i}`}
            aria-labelledby={`${baseId}-tab-${i}`}
            hidden={i !== active}
            className="mt-6"
          >
            {i === active && (
              <Card className="p-6 sm:p-8">
                <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
                  <div>
                    <h3 className="text-[20px] font-semibold text-ink tracking-[-0.01em]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                  <ul className="space-y-3">
                    {step.points.map((p) => (
                      <li key={p} className="flex items-start gap-3">
                        <span className="text-accent mt-0.5 flex-shrink-0">
                          {Icon.check({ size: 16 })}
                        </span>
                        <span className="text-[13px] text-ink-soft leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: stacked disclosure, one open at a time. */}
      <div className="md:hidden mt-8 space-y-3">
        {STEPS.map((s, i) => {
          const open = i === active;
          return (
            <div
              key={s.n}
              className={`rounded-xl border transition-colors ${
                open ? 'border-accent bg-accent-soft' : 'border-line bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setActive(open ? -1 : i)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 p-4 text-left rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                    open ? 'bg-accent text-white' : 'bg-muted-bg text-ink-soft'
                  }`}
                >
                  {s.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                    Step {s.n}
                  </span>
                  <span className="block text-[14px] font-medium text-ink leading-snug">
                    {s.title}
                  </span>
                </span>
                <span
                  className={`text-ink-faint transition-transform duration-200 motion-reduce:transition-none ${
                    open ? 'rotate-90' : ''
                  }`}
                >
                  {Icon.chevron({ size: 16 })}
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4 -mt-1">
                  <p className="text-[13px] leading-relaxed text-ink-soft">{s.body}</p>
                  <ul className="mt-3 space-y-2">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5">
                        <span className="text-accent mt-0.5 flex-shrink-0">
                          {Icon.check({ size: 14 })}
                        </span>
                        <span className="text-[12px] text-ink-soft leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Reveal>
        <div className="mt-8">
          <TrustNote>
            A readiness score does not guarantee funding, and a match does not guarantee
            investment. Both describe how well stated information lines up with stated criteria.
          </TrustNote>
        </div>
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Product demo
// ---------------------------------------------------------------------------

const DEMO_TABS = [
  { key: 'profile', label: 'Business Profile' },
  { key: 'readiness', label: 'Funding Readiness' },
  { key: 'matches', label: 'Investor Matches' },
  { key: 'schemes', label: 'Government Schemes' },
] as const;

type DemoKey = (typeof DEMO_TABS)[number]['key'];

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-muted-bg last:border-0">
      <span className="text-[12px] text-ink-faint">{label}</span>
      <span
        className={`text-[12px] font-medium text-right ${
          tone === 'good' ? 'text-accent' : tone === 'warn' ? 'text-warning' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DemoPanel({ tab }: { tab: DemoKey }) {
  if (tab === 'profile') {
    return (
      <div>
        <p className="text-[13px] font-medium text-ink">What the platform is told</p>
        <p className="text-[12px] text-ink-faint leading-relaxed mt-1 mb-3">
          Seven sections. Completion is tracked per section so you always know what is still open.
        </p>
        <Row label="Business basics" value="Complete" tone="good" />
        <Row label="Business story" value="Complete" tone="good" />
        <Row label="Financials" value="Complete" tone="good" />
        <Row label="Market & traction" value="Complete" tone="good" />
        <Row label="Team" value="2 of 3 fields" tone="warn" />
        <Row label="Registrations" value="Complete" tone="good" />
        <Row label="Funding requirement" value="Complete" tone="good" />
      </div>
    );
  }

  if (tab === 'readiness') {
    return (
      <div>
        <p className="text-[13px] font-medium text-ink">Five weighted components</p>
        <p className="text-[12px] text-ink-faint leading-relaxed mt-1 mb-3">
          Each contributes at most its weight. The shortfall is shown as headroom rather than
          hidden.
        </p>
        <Row label="Business profile · 20% weight" value="100" tone="good" />
        <Row label="Financial information · 25% weight" value="80" />
        <Row label="Market validation · 20% weight" value="70" />
        <Row label="Team strength · 15% weight" value="65" />
        <Row label="Proposal quality · 20% weight" value="45" tone="warn" />
        <div className="mt-3 rounded-lg bg-accent-soft border border-line-accent px-3 py-2.5">
          <p className="text-[12px] text-ink">
            <span className="font-semibold">Proposal quality is the biggest gap.</span> The platform
            names the specific sections that would raise it.
          </p>
        </div>
      </div>
    );
  }

  if (tab === 'matches') {
    return (
      <div>
        <p className="text-[13px] font-medium text-ink">Why an investor may fit</p>
        <p className="text-[12px] text-ink-faint leading-relaxed mt-1 mb-3">
          Every factor is listed with the weight it carried. An unstated preference is scored
          neutrally, never as a match.
        </p>
        <Row label="Industry alignment · 30%" value="Matched" tone="good" />
        <Row label="Investment size · 25%" value="Matched" tone="good" />
        <Row label="Business stage · 20%" value="Matched" tone="good" />
        <Row label="Location · 15%" value="Matched" tone="good" />
        <Row label="Funding type · 10%" value="Not stated" tone="warn" />
        <div className="mt-3 rounded-lg bg-muted-bg border border-line px-3 py-2.5">
          <p className="text-[12px] text-ink-soft">
            A potential fit is an indication to look closer. It is not an offer, a commitment, or
            any sign that investment will follow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13px] font-medium text-ink">Scheme assessment</p>
      <p className="text-[12px] text-ink-faint leading-relaxed mt-1 mb-3">
        Seven factors per scheme. A criterion the platform cannot assess blocks a confident result
        rather than being assumed in your favour.
      </p>
      <Row label="Business stage" value="Matched" tone="good" />
      <Row label="Industry" value="Scheme does not restrict" tone="good" />
      <Row label="Funding amount" value="Within range" tone="good" />
      <Row label="Location" value="Matched" tone="good" />
      <Row label="DPIIT recognition" value="Not provided" tone="warn" />
      <div className="mt-3 rounded-lg bg-warning-bg border border-warning-line px-3 py-2.5">
        <p className="text-[12px] text-ink">
          <span className="font-semibold">Status: needs information.</span> One criterion could not
          be assessed, so the result is held back rather than reported as eligible.
        </p>
      </div>
    </div>
  );
}

export function ProductDemo() {
  const [tab, setTab] = useState<DemoKey>('readiness');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();
  const index = DEMO_TABS.findIndex((t) => t.key === tab);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = DEMO_TABS.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    setTab(DEMO_TABS[next]!.key);
    tabRefs.current[next]?.focus();
  };

  return (
    <Section id="demo">
      <Reveal>
        <SectionHeading
          eyebrow="Product preview"
          title="See how FundBridge AI works."
          lead="Four views of the same business, showing the kind of reasoning the platform returns at each stage."
        />
      </Reveal>

      <Reveal delay={80}>
        <Card className="mt-10 overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-muted-bg bg-surface-tint">
            <div
              role="tablist"
              aria-label="Product preview"
              onKeyDown={onKeyDown}
              className="flex gap-1 overflow-x-auto"
            >
              {DEMO_TABS.map((t, i) => {
                const selected = t.key === tab;
                return (
                  <button
                    key={t.key}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    role="tab"
                    id={`${baseId}-t-${t.key}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-p-${t.key}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTab(t.key)}
                    className={`whitespace-nowrap px-3 py-1.5 text-[12.5px] font-medium rounded-lg transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected
                        ? 'bg-accent-deep text-white'
                        : 'text-ink-soft hover:bg-muted-bg hover:text-ink'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <IllustrativeTag className="hidden sm:inline-flex flex-shrink-0" />
          </div>

          <div
            role="tabpanel"
            id={`${baseId}-p-${tab}`}
            aria-labelledby={`${baseId}-t-${tab}`}
            className="p-5 sm:p-6"
          >
            <DemoPanel tab={tab} />
          </div>

          <div className="px-5 py-3.5 border-t border-muted-bg bg-surface-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TrustNote>
              Sample figures for illustration. Your own results are computed from your own profile.
            </TrustNote>
            <Link to="/register" className={`${btn.primarySm} flex-shrink-0`}>
              Try it with your business
            </Link>
          </div>
        </Card>
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQS: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'What is FundBridge AI?',
    a: 'A decision-support and discovery platform for micro and small enterprises. It assesses how ready a business is to seek funding, compares the business against published government schemes and against investors who have stated their preferences, and explains every result it produces.',
  },
  {
    q: 'How does funding readiness work?',
    a: 'Five components are scored separately — business profile, financial information, market validation, team strength and proposal quality — each with a fixed weight. The engine that computes them is a pure function: it performs no database lookups and calls no language model, and every stored score records the model and weight version that produced it, so any result can be reproduced.',
  },
  {
    q: 'Does a match guarantee investment?',
    a: 'No. A match describes how well your stated information lines up with stated criteria or preferences. It is not an offer, a commitment, or any indication that investment or funding will follow. Only an investor or the issuing authority can make that decision.',
  },
  {
    q: 'How are investor matches explained?',
    a: 'Every match lists each factor, the weight it carried, the outcome, and a plain-language reason. Where you have not stated a preference, that factor is scored neutrally rather than as a match, and the match carries no blocking issues — a preference is not a rule.',
  },
  {
    q: 'Can I discover government schemes?',
    a: 'Yes. Published schemes are compared against your profile across seven weighted factors. Where the platform cannot assess a criterion, the result is reported as needing information rather than being assumed in your favour. Every scheme carries a link to its official source.',
  },
  {
    q: 'How are business documents handled?',
    a: 'Uploaded proposals are checked by content rather than by file extension, stored under a random identifier rather than the name you uploaded, and processed to produce a section-by-section score. Document text is treated strictly as data and is never allowed to act as an instruction to the system.',
  },
  {
    q: 'Who can access uploaded business information?',
    a: 'Your account. Every sensitive endpoint verifies the signed-in user, their role, and their ownership of the specific record on the server — the interface hiding a control is never what protects it. Investors browsing for opportunities see only businesses that opted into discovery, and only the fields those businesses chose to share: revenue appears as a band rather than an exact figure, and proposals are not shared at all.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <Section id="faq" tone="raised">
      <Reveal>
        <SectionHeading
          eyebrow="Questions"
          title="What the platform does, and what it does not claim."
          align="center"
        />
      </Reveal>

      <div className="mt-10 max-w-3xl mx-auto divide-y divide-muted-bg border-y border-muted-bg">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`${baseId}-a-${i}`}
                  id={`${baseId}-q-${i}`}
                  className="w-full flex items-start justify-between gap-4 py-5 text-left group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded"
                >
                  <span className="text-[15px] font-medium text-ink group-hover:text-accent transition-colors">
                    {f.q}
                  </span>
                  <span
                    className={`text-ink-faint flex-shrink-0 mt-0.5 transition-transform duration-200 motion-reduce:transition-none ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  >
                    {Icon.chevron({ size: 18 })}
                  </span>
                </button>
              </h3>
              <div
                id={`${baseId}-a-${i}`}
                role="region"
                aria-labelledby={`${baseId}-q-${i}`}
                hidden={!isOpen}
                className="pb-5 -mt-1"
              >
                <p className="text-[14px] leading-relaxed text-ink-soft max-w-2xl">{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
