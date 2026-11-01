/**
 * Investor dashboard.
 *
 * The preference-completeness tile is prominent on purpose: match quality
 * depends directly on how much the investor has stated, and an investor who has
 * filled in nothing should understand why their matches look indiscriminate
 * rather than concluding the matching is poor.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  ScoreBar,
  StatTile,
} from '../../components/ui';
import { IconMatches } from '../../components/ui/icons';
import { useInvestorDashboard, useRecalculateInvestorMatches } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatCurrency, formatRange, humanise } from '../../utils/format';
import type { InvestorMatch } from '../../types/modules';

export default function InvestorDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useInvestorDashboard();
  const recalc = useRecalculateInvestorMatches();

  if (isLoading) return <LoadingPanel label="Loading your dashboard…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your dashboard.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const d = data!.dashboard;
  const prefsIncomplete = d.preferences.percent < 100;

  return (
    <div>
      <PageHeader
        title="Investor dashboard"
        description="Businesses that have chosen to be discoverable, compared against the preferences you have stated."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatTile
          label="Preferences stated"
          value={`${d.preferences.percent}%`}
          caption={`${d.preferences.complete} of ${d.preferences.total} preference fields`}
          {...(prefsIncomplete
            ? { tone: 'warning' as const }
            : { tone: 'success' as const, to: '/investor/preferences' })}
          action={
            prefsIncomplete ? (
              <Link to="/investor/preferences">
                <Button size="sm" variant="secondary">
                  Complete them
                </Button>
              </Link>
            ) : undefined
          }
        />

        <StatTile
          label="Potential matches"
          value={d.matches.total === 0 ? 'None yet' : d.matches.total}
          caption={d.matches.total > 0 ? `${d.matches.strong} scoring 70 or above` : 'Run matching to see fits'}
          {...(d.matches.total > 0 ? { to: '/investor/matches' } : {})}
          action={
            d.matches.total === 0 ? (
              <Button size="sm" variant="secondary" loading={recalc.isPending} onClick={() => recalc.mutate()}>
                Find matches
              </Button>
            ) : undefined
          }
        />

        <StatTile
          label="Shortlisted"
          value={d.shortlistCount}
          caption="Businesses you are tracking"
          to="/investor/shortlist"
        />

        <StatTile
          label="Discoverable businesses"
          value={d.discoverableBusinesses}
          caption="With a stated funding requirement"
          to="/investor/discover"
        />
      </div>

      {prefsIncomplete && (
        <Card className="mb-6 border-warning/30 bg-warning-bg/40">
          <p className="text-[13px] text-ink leading-relaxed">
            <span className="font-medium">Your matches are only as good as your stated preferences.</span> A preference
            you have not stated is scored neutrally rather than as a match, so an incomplete profile produces
            undifferentiated results. Completing your industries, stages, locations, funding types and investment range
            is the single biggest improvement available.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card variant="feature">
            <CardHeader
              title="Top potential fits"
              description="Ranked by how many of your stated preferences each business satisfies."
              action={
                d.topMatches.length > 0 ? (
                  <Link to="/investor/matches" className="text-[13px] font-medium text-accent hover:underline">
                    View all
                  </Link>
                ) : undefined
              }
            />

            {d.topMatches.length === 0 ? (
              <EmptyState
                icon={<IconMatches size={22} />}
                title="No matches calculated yet"
                description="Matching compares each discoverable business against the preferences you have stated, and explains every factor."
                action={
                  <Button loading={recalc.isPending} onClick={() => recalc.mutate()}>
                    Find potential fits
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-muted-bg">
                {d.topMatches.map((m) => (
                  <li key={m.id} className="py-4 first:pt-0 last:pb-0">
                    <Link
                      to={`/investor/businesses/${m.businessId}`}
                      className="group block rounded-md -mx-1.5 px-1.5 py-1 transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-ink group-hover:text-accent transition-colors">
                            {m.business.businessName}
                          </p>
                          <p className="text-[12px] text-ink-soft mt-0.5">
                            {m.business.industry ?? 'Industry not stated'} ·{' '}
                            {humanise(m.business.businessStage)} · {m.business.location ?? '—'}
                          </p>
                          <p className="text-[12px] text-ink-soft mt-1">
                            Seeking{' '}
                            {m.business.fundingRequirement
                              ? formatCurrency(
                                  m.business.fundingRequirement.amountRequired,
                                  m.business.fundingRequirement.currency,
                                )
                              : 'not stated'}{' '}
                            · revenue {m.business.revenueBand}
                          </p>
                        </div>
                        <div className="flex-shrink-0 w-28">
                          <div className="text-right mb-1.5">
                            <span className="text-[16px] font-semibold tabular-nums text-ink">
                              {m.overallScore}
                              <span className="text-ink-faint text-[12px] font-normal">/100</span>
                            </span>
                          </div>
                          <ScoreBar score={m.overallScore} showValue={false} />
                        </div>
                      </div>
                    </Link>
                    <FitFactors match={m} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your stated preferences" />
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="text-ink-soft mb-1">Investment range</dt>
                <dd className="text-ink font-medium">
                  {formatRange(d.profile.minInvestment, d.profile.maxInvestment)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft mb-1">Industries</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {d.profile.industries.length > 0 ? (
                    d.profile.industries.map((i) => <Badge key={i}>{i}</Badge>)
                  ) : (
                    <span className="text-ink-faint text-[12px]">Not stated</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft mb-1">Stages</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {d.profile.preferredStages.length > 0 ? (
                    d.profile.preferredStages.map((s) => <Badge key={s}>{humanise(s)}</Badge>)
                  ) : (
                    <span className="text-ink-faint text-[12px]">Not stated</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft mb-1">Locations</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {d.profile.preferredLocations.length > 0 ? (
                    d.profile.preferredLocations.map((l) => <Badge key={l}>{l}</Badge>)
                  ) : (
                    <span className="text-ink-faint text-[12px]">Not stated</span>
                  )}
                </dd>
              </div>
            </dl>
            <Link
              to="/investor/preferences"
              className="inline-flex mt-4 text-[13px] font-medium text-accent hover:underline"
            >
              Edit preferences
            </Link>
          </Card>

          <Card>
            <CardHeader title="What you can see" />
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Business owners control their own visibility. You see only businesses that have opted in, and only the
              information they have chosen to make discoverable — exact financial figures are shown as a band rather
              than a number, and proposals are not shared.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Why a business scored what it did, inline on the dashboard.
 *
 * `explanation.factors` is already in the dashboard payload, so this adds no
 * request. UNSTATED is called out separately from a mismatch: an investor who has
 * not stated a preference is not the same as a business that fails it, and the
 * engine scores it 0.5 rather than 0 precisely because a preference is not a rule.
 */
function FitFactors({ match }: { match: InvestorMatch }) {
  const [open, setOpen] = useState(false);
  const factors = match.explanation.factors;
  if (factors.length === 0) return null;

  const unstated = factors.filter((f) => f.outcome === 'UNSTATED').length;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded"
      >
        {open ? 'Hide factors' : `Why this score · ${factors.length} factors`}
        {unstated > 0 && !open && (
          <span className="text-warning font-normal">({unstated} unstated)</span>
        )}
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5 pl-3 border-l-2 border-line">
          {factors.map((f) => (
            <li key={f.key} className="text-[12px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink">{f.name}</span>
                <span className="text-ink-soft tabular-nums flex-shrink-0">
                  {Math.round(f.score * 100)}% · weight {Math.round(f.weight * 100)}%
                </span>
              </div>
              <p className="text-ink-soft mt-0.5 leading-relaxed">{f.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
