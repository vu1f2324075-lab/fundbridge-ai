/**
 * Investor shortlist with pipeline status.
 *
 * Status and notes are the investor's own private annotations. They are never
 * shown to the business — "Passed" reaching a founder would be a harm the
 * platform has no business causing.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from '../../components/ui';
import { IconSaved } from '../../components/ui/icons';
import { useRemoveFromShortlist, useShortlist, useUpdateShortlist } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatCurrency, formatDate, humanise } from '../../utils/format';
import type { ShortlistEntry, ShortlistStatus } from '../../types/modules';

const STATUSES: ShortlistStatus[] = ['WATCHING', 'CONTACTED', 'IN_REVIEW', 'PASSED'];

const STATUS_TONE: Record<ShortlistStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  WATCHING: 'info',
  CONTACTED: 'warning',
  IN_REVIEW: 'success',
  PASSED: 'neutral',
};

function Entry({ entry }: { entry: ShortlistEntry }) {
  const update = useUpdateShortlist();
  const remove = useRemoveFromShortlist();
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [editing, setEditing] = useState(false);

  const b = entry.business;

  return (
    <Card className={entry.status === 'PASSED' ? 'opacity-70' : ''}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/investor/businesses/${entry.businessId}`}
              className="text-[14px] font-medium text-ink hover:text-accent transition-colors"
            >
              {b.businessName}
            </Link>
            <Badge tone={STATUS_TONE[entry.status]}>{humanise(entry.status)}</Badge>
          </div>

          <p className="text-[12px] text-ink-soft mt-1">
            {b.industry ?? 'Industry not stated'} · {humanise(b.businessStage)} · {b.location ?? '—'}
          </p>
          <p className="text-[12px] text-ink-soft mt-1">
            Seeking{' '}
            {b.fundingRequirement
              ? formatCurrency(b.fundingRequirement.amountRequired, b.fundingRequirement.currency)
              : 'not stated'}{' '}
            · shortlisted {formatDate(entry.createdAt)}
          </p>

          {editing ? (
            <div className="mt-3">
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent resize-y"
                placeholder="Your private notes on this business"
                aria-label="Notes"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  loading={update.isPending}
                  onClick={async () => {
                    await update.mutateAsync({ id: entry.id, notes: notes.trim() || null });
                    setEditing(false);
                  }}
                >
                  Save note
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNotes(entry.notes ?? '');
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              {entry.notes && (
                <p className="text-[13px] text-ink leading-relaxed border-l-2 border-line pl-3">
                  {entry.notes}
                </p>
              )}
              <button onClick={() => setEditing(true)} className="text-[12px] text-accent hover:underline mt-1.5">
                {entry.notes ? 'Edit note' : 'Add a note'}
              </button>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-2 items-end">
          <select
            value={entry.status}
            onChange={(e) => update.mutate({ id: entry.id, status: e.target.value as ShortlistStatus })}
            className="px-2.5 py-1.5 text-[12px] bg-white border border-line rounded-lg outline-none focus:border-accent"
            aria-label="Pipeline status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanise(s)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            loading={remove.isPending && remove.variables === entry.id}
            onClick={() => remove.mutate(entry.id)}
          >
            Remove
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function ShortlistPage() {
  const { data, isLoading, isError, error, refetch } = useShortlist();

  if (isLoading) return <LoadingPanel label="Loading your shortlist…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your shortlist.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const shortlist = data?.shortlist ?? [];
  const active = shortlist.filter((s) => s.status !== 'PASSED');
  const passed = shortlist.filter((s) => s.status === 'PASSED');

  return (
    <div>
      <PageHeader
        title="Shortlist"
        description="Businesses you are tracking. Status and notes are private to you and are never shown to the business."
      />

      {shortlist.length === 0 ? (
        <EmptyState
          icon={<IconSaved size={22} />}
          title="Nothing shortlisted yet"
          description="Shortlist a business from discovery or from your matches to track it here."
          action={
            <Link to="/investor/discover">
              <Button>Discover businesses</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((e) => (
                <Entry key={e.id} entry={e} />
              ))}
            </div>
          )}

          {passed.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-3">
                Passed ({passed.length})
              </p>
              <div className="space-y-3">
                {passed.map((e) => (
                  <Entry key={e.id} entry={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
