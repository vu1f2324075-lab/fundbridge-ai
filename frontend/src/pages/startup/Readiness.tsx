/**
 * Funding readiness detail.
 *
 * Shows the whole calculation: each component's score, its configured weight,
 * the points it contributed, the reason, and the exact fields that would raise
 * it. The weights are read from the API response, never hardcoded here — they
 * live in the backend's MatchingConfig table so they can be retuned and
 * experimented with.
 */
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  MetricRing,
  PageHeader,
  ScoreBar,
} from '../../components/ui';
import { IconReadiness } from '../../components/ui/icons';
import { useAnalyseReadiness, useReadiness } from '../../hooks/queries';
import { ApiError } from '../../lib/api';

export default function ReadinessPage() {
  const { data, isLoading, isError, error, refetch } = useReadiness();
  const analyse = useAnalyseReadiness();

  if (isLoading) return <LoadingPanel label="Loading your readiness analysis…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your readiness analysis.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const readiness = data?.readiness ?? null;

  if (!readiness) {
    return (
      <div>
        <PageHeader
          title="Funding readiness"
          description="How prepared your business is to pursue funding — not a prediction of whether you will receive it."
        />
        <EmptyState
          icon={<IconReadiness size={22} />}
          title="No analysis yet"
          description="Readiness scores five weighted components of your business case. Each one reports the specific fields that would raise it, so the result is always actionable."
          action={
            <Button loading={analyse.isPending} onClick={() => analyse.mutate()}>
              Analyse my readiness
            </Button>
          }
        />
        {analyse.isError && (
          <div className="mt-4">
            <ErrorPanel
              message={analyse.error instanceof ApiError ? analyse.error.message : 'The analysis could not be completed.'}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Funding readiness"
        description="How prepared your business is to pursue funding — not a prediction of whether you will receive it."
        action={
          <Button variant="secondary" loading={analyse.isPending} onClick={() => analyse.mutate()}>
            Recalculate
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1" variant="feature">
          <p className="text-micro uppercase text-ink-faint">Overall readiness</p>

          <div className="flex justify-center py-5">
            <MetricRing
              value={readiness.overallScore}
              caption={readiness.category}
              size={168}
            />
          </div>

          <p className="text-[12px] text-ink-soft mt-1 leading-relaxed">
            Weighted sum of the five components opposite. A component you have not supplied data for scores zero and is
            listed under "what would raise this" rather than being estimated.
          </p>

          <p className="text-[11px] text-ink-faint mt-4 pt-3 border-t border-line">
            Model {readiness.modelVersion}
            {readiness.configVersion ? ` · weights ${readiness.configVersion}` : ''}
          </p>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {readiness.components.map((c) => (
            <Card key={c.key}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-[14px] font-semibold text-ink">{c.name}</h3>
                  <p className="text-[12px] text-ink-soft mt-0.5">
                    {Math.round(c.weight * 100)}% of your overall score · contributed {c.contribution} points
                  </p>
                </div>
                <span className="text-[18px] font-semibold tabular-nums text-ink">
                  {c.score}
                  <span className="text-ink-faint text-[12px] font-normal">/100</span>
                </span>
              </div>

              <div className="mt-3">
                <ScoreBar score={c.score} showValue={false} />
              </div>

              <p className="text-[13px] text-ink-soft mt-3 leading-relaxed">{c.reason}</p>

              {c.missing.length > 0 && (
                <div className="mt-4 pt-3 border-t border-line">
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    What would raise this
                  </p>
                  <ul className="space-y-1.5">
                    {c.missing.map((m) => (
                      <li key={m} className="text-[13px] text-ink flex gap-2.5 leading-relaxed">
                        <span className="text-warning flex-shrink-0" aria-hidden="true">
                          +
                        </span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {readiness.recommendations.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Where to focus first"
            description="Ordered by how many points each gap is costing you, largest first."
          />
          <ol className="space-y-2.5">
            {readiness.recommendations.map((r, i) => (
              <li key={r} className="flex gap-3 text-[13px] text-ink leading-relaxed">
                <span className="text-ink-faint tabular-nums flex-shrink-0 font-medium">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
