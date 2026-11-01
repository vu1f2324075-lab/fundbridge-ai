/**
 * Government scheme explorer, driven by real data.
 *
 * Fetches `GET /api/public/schemes`, which is unauthenticated and returns only
 * PUBLISHED scheme records with an allowlisted set of public fields. Nothing on
 * this page is hardcoded: if the API is unreachable the section shows an honest
 * error with a retry, and if it returns nothing it says so. It never falls back
 * to invented schemes, because a fabricated scheme name, amount or eligibility
 * rule is the single most damaging thing this product could display.
 *
 * Synthetic demonstration records are badged on screen. They exist so the
 * matching engine can be exercised without inventing government facts, and a
 * visitor must never mistake one for a real programme.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Icon, Reveal, Section, SectionHeading, TrustNote, btn } from './primitives';

interface PublicScheme {
  id: string;
  slug: string;
  name: string;
  provider: string;
  ministry: string | null;
  level: string;
  schemeType: string;
  minFunding: number | null;
  maxFunding: number | null;
  fundingDescription: string | null;
  description: string | null;
  officialSourceUrl: string;
  applicationUrl: string | null;
  sourceType: string;
  lastVerifiedAt: string | null;
}

interface Payload {
  schemes: PublicScheme[];
  total: number;
  verifiedCount: number;
  syntheticCount: number;
  disclaimer: string;
}

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:4000/api';

function inr(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fundingLabel(s: PublicScheme): string {
  if (s.minFunding !== null && s.maxFunding !== null) return `${inr(s.minFunding)} – ${inr(s.maxFunding)}`;
  if (s.maxFunding !== null) return `Up to ${inr(s.maxFunding)}`;
  if (s.minFunding !== null) return `From ${inr(s.minFunding)}`;
  // Null is meaningful here: the figure was not stated by the official source.
  return 'Not stated by the source';
}

function humanise(v: string): string {
  return v
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function SchemeCard({ scheme }: { scheme: PublicScheme }) {
  const synthetic = scheme.sourceType === 'SYNTHETIC';
  const verified = scheme.sourceType === 'OFFICIAL_SOURCE';

  return (
    <Card interactive className="h-full p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 border"
          style={
            synthetic
              ? {
                  color: 'var(--color-warning)',
                  backgroundColor: 'var(--color-warning-bg)',
                  borderColor: 'var(--color-warning-line)',
                }
              : verified
                ? { color: '#4F46E5', backgroundColor: '#EEF0FF', borderColor: '#C7CCFF' }
                : { color: '#5C5A7D', backgroundColor: '#F2EFFB', borderColor: '#E5E1F4' }
          }
        >
          {synthetic ? 'Synthetic demo record' : verified ? 'Official source' : humanise(scheme.sourceType)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft bg-muted-bg border border-line rounded-full px-2 py-1 flex-shrink-0">
          {humanise(scheme.schemeType)}
        </span>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold text-ink leading-snug">{scheme.name}</h3>
      <p className="mt-1 text-[12px] text-ink-faint">
        {scheme.provider}
        {scheme.ministry ? ` · ${scheme.ministry}` : ''}
      </p>

      <dl className="mt-4 space-y-2 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[12px] text-ink-faint">Funding</dt>
          <dd className="text-[12px] font-medium text-ink text-right">{fundingLabel(scheme)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[12px] text-ink-faint">Level</dt>
          <dd className="text-[12px] text-ink-soft">{humanise(scheme.level)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[12px] text-ink-faint">Last verified</dt>
          <dd className="text-[12px] text-ink-soft">
            {scheme.lastVerifiedAt
              ? new Date(scheme.lastVerifiedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Not recorded'}
          </dd>
        </div>
      </dl>

      {synthetic ? (
        <p className="mt-4 pt-3 border-t border-muted-bg text-[11px] text-warning leading-relaxed">
          Demonstration data, not a real programme. It exists to exercise the matching engine and
          must never be cited.
        </p>
      ) : (
        <a
          href={scheme.officialSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 pt-3 border-t border-muted-bg inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Official source
          {Icon.external({ size: 13 })}
        </a>
      )}
    </Card>
  );
}

type Filter = 'all' | 'verified';

export function SchemeExplorer() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/public/schemes`, { credentials: 'omit' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`The scheme service responded with ${r.status}.`);
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setData(j.data as Payload);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not reach the scheme service.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.schemes.filter((s) => {
      if (filter === 'verified' && s.sourceType !== 'OFFICIAL_SOURCE') return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q) ||
        (s.ministry ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, query, filter]);

  return (
    <Section id="schemes">
      <Reveal>
        <SectionHeading
          eyebrow="Government schemes"
          title="Scheme information you can trace back to its source."
          lead="Every record carries the official link it came from and the date it was last verified. Where a figure was not stated by the source, it is left blank rather than filled in."
        />
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none">
              {Icon.search({ size: 16 })}
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or provider"
              aria-label="Search schemes by name or provider"
              className="w-full pl-9 pr-3 py-2.5 text-[13px] bg-white border border-line rounded-xl outline-none transition-colors focus:border-accent placeholder:text-ink-faint"
            />
          </div>

          <div className="flex gap-1.5 bg-white border border-line rounded-xl p-1 w-fit">
            {([['all', 'All published'], ['verified', 'Official source only']] as const).map(
              ([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`px-3 py-1.5 text-[12.5px] font-medium rounded-lg transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    filter === key ? 'bg-accent-deep text-white' : 'text-ink-soft hover:bg-muted-bg'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {data && (
            <p className="text-[12px] text-ink-faint sm:ml-auto">
              <span className="font-medium text-ink">{data.verifiedCount}</span> from official
              sources · <span className="font-medium text-ink">{data.syntheticCount}</span>{' '}
              synthetic
            </p>
          )}
        </div>
      </Reveal>

      <div className="mt-6">
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl border border-line bg-white animate-pulse motion-reduce:animate-none"
              />
            ))}
            <span className="sr-only">Loading schemes</span>
          </div>
        )}

        {!loading && error && (
          <Card className="p-8 text-center">
            <p className="text-[14px] text-ink font-medium">Scheme information is unavailable</p>
            <p className="text-[13px] text-ink-faint mt-2 max-w-md mx-auto leading-relaxed">
              {error} Nothing is shown in its place, because inventing a scheme would be worse than
              showing none.
            </p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${btn.secondarySm} mt-5`}>
              Try again
            </button>
          </Card>
        )}

        {!loading && !error && visible.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-[14px] text-ink font-medium">No schemes match that search</p>
            <p className="text-[13px] text-ink-faint mt-2">
              {data && data.total > 0
                ? 'Try a different term, or switch the filter back to all published schemes.'
                : 'No schemes have been published yet.'}
            </p>
          </Card>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <SchemeCard key={s.id} scheme={s} />
            ))}
          </div>
        )}
      </div>

      {data && (
        <Reveal>
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5">
            <TrustNote>
              {data.disclaimer} Sign in to see which of these your own business profile may be
              eligible for, with every factor explained.
            </TrustNote>
            <Link to="/register?role=STARTUP" className={`${btn.primarySm} flex-shrink-0`}>
              Check my eligibility
            </Link>
          </div>
        </Reveal>
      )}
    </Section>
  );
}
