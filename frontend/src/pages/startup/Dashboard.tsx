/**
 * Business dashboard.
 *
 * Every figure comes from `GET /api/business/dashboard`. Nothing is computed
 * here and nothing is hardcoded, so the dashboard cannot disagree with the
 * detail page for the same thing.
 *
 * Where an analysis has not been run, the tile says so and offers the action,
 * rather than showing a zero that reads like a result.
 */
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  MetricRing,
  ScoreBar,
  StatTile,
  scoreTone,
} from '../../components/ui';
import { IconReadiness, IconRecommend } from '../../components/ui/icons';
import { useAnalyseReadiness, useDashboard, useRecalculateMatches } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { formatCurrency, humanise } from '../../utils/format';
import { PageHeader } from '../../components/ui';
import { STATUS_TONE, STATUS_LABEL } from '../../components/domain/matchStatus';
import { ReadinessBreakdown } from '../../components/domain/ReadinessBreakdown';
import { ScoreComposition } from '../../components/domain/ScoreComposition';

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch } = useDashboard();
  const analyseReadiness = useAnalyseReadiness();
  const recalcMatches = useRecalculateMatches();

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
  const readiness = d.readiness;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your current funding position, assembled from your profile and the latest analysis."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatTile
          label="Profile completion"
          value={`${d.completion.overall}%`}
          caption={`${d.completion.sections.filter((s) => s.complete === s.total).length} of ${d.completion.sections.length} sections complete`}
          to="/app/profile"
        />

        <StatTile
          label="Funding readiness"
          // A string, not 0 — an uncalculated score must not read as a bad score.
          value={readiness ? readiness.overallScore : 'Not calculated yet'}
          caption={readiness ? readiness.category : 'Run an analysis to see your score'}
          {...(readiness ? { tone: scoreTone(readiness.overallScore), to: '/app/readiness' } : {})}
          action={
            !readiness ? (
              <Button
                size="sm"
                variant="secondary"
                loading={analyseReadiness.isPending}
                onClick={() => analyseReadiness.mutate()}
              >
                Analyse now
              </Button>
            ) : undefined
          }
        />

        <StatTile
          label="Scheme matches"
          value={d.schemeMatches.total === 0 ? 'None yet' : d.schemeMatches.total}
          caption={
            d.schemeMatches.total > 0
              ? `${d.schemeMatches.potentiallyEligible} potentially eligible, ${d.schemeMatches.needsInformation} need information`
              : 'Run matching to find relevant schemes'
          }
          {...(d.schemeMatches.total > 0 ? { to: '/app/recommendations' } : {})}
          action={
            d.schemeMatches.total === 0 ? (
              <Button
                size="sm"
                variant="secondary"
                loading={recalcMatches.isPending}
                onClick={() => recalcMatches.mutate()}
              >
                Find schemes
              </Button>
            ) : undefined
          }
        />

        <StatTile
          label="Open actions"
          value={d.actionPlan.open === 0 && d.actionPlan.total === 0 ? 'None yet' : d.actionPlan.open}
          caption={
            d.actionPlan.total > 0
              ? `${d.actionPlan.highPriority} high priority`
              : 'Generate a plan from your findings'
          }
          to="/app/action-plan"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <Card variant="feature">
            <CardHeader
              title="Funding readiness"
              description={
                readiness
                  ? 'How each weighted component contributed to your score.'
                  : 'Not yet calculated.'
              }
              action={
                readiness ? (
                  <Link to="/app/readiness" className="text-[13px] font-medium text-accent hover:underline">
                    View detail
                  </Link>
                ) : undefined
              }
            />

            {readiness ? (
              <div>
                {/* The score leads, then what makes it up. Previously the panel
                    opened with five near-identical rows and the headline figure
                    appeared only in a tile elsewhere on the page. */}
                <div className="flex flex-col sm:flex-row gap-7 items-center sm:items-start pb-5 mb-5 border-b border-line">
                  <MetricRing
                    value={readiness.overallScore}
                    caption={readiness.category}
                    size={150}
                  />
                  <div className="flex-1 min-w-0 w-full sm:pt-2">
                    <ScoreComposition
                      components={readiness.components}
                      overallScore={readiness.overallScore}
                    />
                  </div>
                </div>

                <ReadinessBreakdown components={readiness.components} />

                <p className="text-[11px] text-ink-faint pt-3 mt-1 border-t border-line">
                  Model {readiness.modelVersion}
                  {readiness.configVersion ? ` · weights ${readiness.configVersion}` : ''}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<IconReadiness size={22} />}
                title="No readiness analysis yet"
                description="Readiness scores five weighted components of your business case and tells you which specific fields would raise each one."
                action={
                  <Button loading={analyseReadiness.isPending} onClick={() => analyseReadiness.mutate()}>
                    Analyse my readiness
                  </Button>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Top scheme matches"
              description="Ranked by how many stored criteria your profile satisfies."
              action={
                d.schemeMatches.total > 0 ? (
                  <Link to="/app/recommendations" className="text-[13px] font-medium text-accent hover:underline">
                    View all
                  </Link>
                ) : undefined
              }
            />

            {d.schemeMatches.top.length > 0 ? (
              <ul className="divide-y divide-muted-bg -mb-1">
                {d.schemeMatches.top.map((m) => (
                  <li key={m.id} className="py-3 first:pt-0">
                    <Link to={`/app/schemes/${m.schemeId}`} className="group block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink group-hover:text-accent transition-colors truncate">
                            {m.scheme.name}
                          </p>
                          <p className="text-[12px] text-ink-soft mt-0.5">
                            {m.scheme.provider} · {humanise(m.scheme.schemeType)}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="text-[15px] font-semibold tabular-nums text-ink">
                            {m.eligibilityScore}
                            <span className="text-ink-faint text-[12px] font-normal">/100</span>
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                        {m.blockingIssues.length > 0 && (
                          <span className="text-[11px] text-danger">
                            {m.blockingIssues.length} blocking issue{m.blockingIssues.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {m.missingCriteria.length > 0 && (
                          <span className="text-[11px] text-warning">
                            {m.missingCriteria.length} item{m.missingCriteria.length > 1 ? 's' : ''} missing
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<IconRecommend size={22} />}
                title="No scheme matches yet"
                description="Matching compares your profile against each published scheme's stored criteria and explains every result."
                action={
                  <Button loading={recalcMatches.isPending} onClick={() => recalcMatches.mutate()}>
                    Find relevant schemes
                  </Button>
                }
              />
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Profile sections" description="What is filled in, and what is still open." />
            <ul className="space-y-1 -mx-1">
              {d.completion.sections.map((s) => {
                const done = s.complete === s.total;
                return (
                  <li key={s.key}>
                    <Link
                      to="/app/profile"
                      className="group block px-1 py-1.5 rounded-md transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    >
                      <div className="flex items-baseline justify-between mb-1 gap-2">
                        <span className="text-[13px] text-ink group-hover:text-accent transition-colors">
                          {s.name}
                        </span>
                        <span className="text-[12px] text-ink-soft tabular-nums flex items-center gap-1.5">
                          {s.complete}/{s.total}
                          {done && (
                            <span className="text-success" aria-label="complete">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2.5 6.2l2.2 2.2L9.5 3.6"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </span>
                      </div>
                      <ScoreBar
                        score={s.complete}
                        max={s.total}
                        showValue={false}
                        tone={done ? 'success' : s.complete === 0 ? 'danger' : 'warning'}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              to="/app/profile"
              className="inline-flex mt-4 text-[13px] font-medium text-accent hover:underline"
            >
              Complete your profile
            </Link>
          </Card>

          <Card>
            <CardHeader title="Funding requirement" />
            {d.requirement ? (
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Amount</dt>
                  <dd className="font-semibold text-ink tabular-nums">
                    {formatCurrency(d.requirement.amountRequired, d.requirement.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Purpose</dt>
                  <dd className="text-ink text-right">{d.requirement.purpose}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Type</dt>
                  <dd className="text-ink">{humanise(d.requirement.fundingType)}</dd>
                </div>
              </dl>
            ) : (
              <div>
                <p className="text-[13px] text-ink-soft">
                  Not set. Matching cannot assess funding compatibility without it.
                </p>
                <Link
                  to="/app/funding-requirement"
                  className="inline-flex mt-3 text-[13px] font-medium text-accent hover:underline"
                >
                  Set your requirement
                </Link>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Proposals"
              action={
                d.proposal.uploaded > 0 ? (
                  <Link to="/app/proposals" className="text-[13px] font-medium text-accent hover:underline">
                    View all
                  </Link>
                ) : undefined
              }
            />

            {!d.proposal.available ? (
              /* Extraction and analysis need the AI service. Stated plainly
                 rather than offering a control that would fail. */
              <p className="text-[13px] text-ink-soft leading-relaxed">
                Proposal processing needs the document-processing service, which is not currently running. Until a
                proposal has been analysed, Proposal Quality stays at zero in your readiness score and is reported as
                such rather than estimated.
              </p>
            ) : d.proposal.uploaded === 0 ? (
              <div>
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  No proposal uploaded. Proposal Quality is 20% of your readiness score and currently contributes
                  nothing.
                </p>
                <Link
                  to="/app/proposals"
                  className="inline-flex mt-3 text-[13px] font-medium text-accent hover:underline"
                >
                  Upload a proposal
                </Link>
              </div>
            ) : (
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Uploaded</dt>
                  <dd className="text-ink tabular-nums">{d.proposal.uploaded}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Analysed</dt>
                  <dd className="text-ink tabular-nums">{d.proposal.analysed}</dd>
                </div>
                {d.proposal.latestScore !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-soft">Latest score</dt>
                    <dd className="font-semibold text-ink tabular-nums">{d.proposal.latestScore}/100</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
