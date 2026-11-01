/**
 * Action plan.
 *
 * Every generated item shows the finding that produced it, so the advice can be
 * checked rather than taken on trust. Items the user has completed or dismissed
 * survive regeneration — the backend preserves them deliberately, because
 * re-opening a settled task would override the user's own judgement.
 */
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
} from '../../components/ui';
import { IconActionPlan } from '../../components/ui/icons';
import { useActionPlan, useGenerateActionPlan, useUpdateActionItem } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import type { ActionItem, ActionPriority } from '../../types/api';

const PRIORITY_TONE: Record<ActionPriority, 'danger' | 'warning' | 'info' | 'neutral'> = {
  P1: 'danger',
  P2: 'warning',
  P3: 'info',
  P4: 'neutral',
  P5: 'neutral',
};

const PRIORITY_LABEL: Record<ActionPriority, string> = {
  P1: 'Highest',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
  P5: 'Lowest',
};

const SOURCE_LABEL: Record<string, string> = {
  READINESS: 'From readiness analysis',
  PROPOSAL: 'From proposal analysis',
  SCHEME_MATCH: 'From scheme matching',
  INVESTOR_MATCH: 'From investor matching',
  MANUAL: 'Added by you',
};

function Item({ item }: { item: ActionItem }) {
  const update = useUpdateActionItem();
  const done = item.status === 'COMPLETED' || item.status === 'DISMISSED';

  return (
    <Card className={done ? 'opacity-60' : ''}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={PRIORITY_TONE[item.priority]}>{PRIORITY_LABEL[item.priority]}</Badge>
            <span className="text-[11px] text-ink-faint">{SOURCE_LABEL[item.sourceModule] ?? item.sourceModule}</span>
            {item.status === 'IN_PROGRESS' && <Badge tone="info">In progress</Badge>}
            {item.status === 'COMPLETED' && <Badge tone="success">Completed</Badge>}
            {item.status === 'DISMISSED' && <Badge>Dismissed</Badge>}
          </div>

          <h3
            className={`text-[14px] font-semibold mt-2 ${done ? 'text-ink-soft line-through' : 'text-ink'}`}
          >
            {item.title}
          </h3>

          {item.description && (
            <p className="text-[13px] text-ink mt-1.5 leading-relaxed">{item.description}</p>
          )}

          {item.reason && (
            <p className="text-[12px] text-ink-soft mt-2 leading-relaxed border-l-2 border-line pl-3">
              {item.reason}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-2">
          {item.status === 'TODO' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                loading={update.isPending}
                onClick={() => update.mutate({ id: item.id, status: 'IN_PROGRESS' })}
              >
                Start
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update.mutate({ id: item.id, status: 'DISMISSED' })}
              >
                Dismiss
              </Button>
            </>
          )}
          {item.status === 'IN_PROGRESS' && (
            <Button
              size="sm"
              variant="secondary"
              loading={update.isPending}
              onClick={() => update.mutate({ id: item.id, status: 'COMPLETED' })}
            >
              Mark done
            </Button>
          )}
          {done && (
            <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: item.id, status: 'TODO' })}>
              Reopen
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ActionPlanPage() {
  const { data, isLoading, isError, error, refetch } = useActionPlan();
  const generate = useGenerateActionPlan();
  const [showDone, setShowDone] = useState(false);

  if (isLoading) return <LoadingPanel label="Loading your action plan…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your action plan.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = data?.items ?? [];
  const open = items.filter((i) => i.status === 'TODO' || i.status === 'IN_PROGRESS');
  const closed = items.filter((i) => i.status === 'COMPLETED' || i.status === 'DISMISSED');

  return (
    <div>
      <PageHeader
        title="Action plan"
        description="Next steps generated from your actual findings, ordered by how much each would improve your position."
        action={
          <Button variant="secondary" loading={generate.isPending} onClick={() => generate.mutate()}>
            {items.length > 0 ? 'Regenerate' : 'Generate plan'}
          </Button>
        }
      />

      {generate.isError && (
        <div className="mb-5">
          <ErrorPanel
            message={generate.error instanceof ApiError ? generate.error.message : 'Could not generate the plan.'}
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<IconActionPlan size={22} />}
          title="No action plan yet"
          description="A plan is built from your readiness analysis and scheme matches. Run those first, then generate the plan — each item will cite the finding it came from."
          action={
            <Button loading={generate.isPending} onClick={() => generate.mutate()}>
              Generate plan
            </Button>
          }
        />
      ) : (
        <>
          {open.length > 0 ? (
            <div className="space-y-3">
              {open.map((i) => (
                <Item key={i.id} item={i} />
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-[13px] text-ink-soft">
                Nothing open. Regenerate after updating your profile to pick up new findings.
              </p>
            </Card>
          )}

          {closed.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowDone(!showDone)}
                className="text-[13px] font-medium text-accent hover:underline"
                aria-expanded={showDone}
              >
                {showDone ? 'Hide' : 'Show'} {closed.length} completed or dismissed
              </button>
              {showDone && (
                <div className="space-y-3 mt-3">
                  {closed.map((i) => (
                    <Item key={i.id} item={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[12px] text-ink-soft mt-6 leading-relaxed max-w-prose">
            Regenerating refreshes items from your current findings and removes any whose finding no longer holds.
            Anything you have completed or dismissed is left alone.
          </p>
        </>
      )}
    </div>
  );
}
