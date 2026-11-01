/**
 * Saved opportunities.
 *
 * A target that has since been unpublished arrives as `target: null` from the
 * API. That is rendered as "no longer available" rather than crashing on a
 * missing field — the backend returns null precisely so this case is visible.
 */
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from '../../components/ui';
import { IconSaved } from '../../components/ui/icons';
import { useDeleteSaved, useSaved } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { formatDate } from '../../utils/format';

export default function SavedPage() {
  const { data, isLoading, isError, error, refetch } = useSaved();
  const remove = useDeleteSaved();

  if (isLoading) return <LoadingPanel label="Loading saved opportunities…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your saved opportunities.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const saved = data?.saved ?? [];

  return (
    <div>
      <PageHeader title="Saved opportunities" description="Schemes you have bookmarked to come back to." />

      {saved.length === 0 ? (
        <EmptyState
          icon={<IconSaved size={22} />}
          title="Nothing saved yet"
          description="Save a scheme from its detail page to keep track of it here."
          action={
            <Link to="/app/recommendations">
              <Button>Browse recommendations</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {saved.map((s) => {
            const name = (s.target?.['name'] ?? s.target?.['investorName']) as string | undefined;
            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    {name ? (
                      <Link
                        to={`/app/schemes/${s.opportunityId}`}
                        className="text-[14px] font-medium text-ink hover:text-accent transition-colors"
                      >
                        {name}
                      </Link>
                    ) : (
                      <p className="text-[14px] font-medium text-ink-soft">This opportunity is no longer available</p>
                    )}
                    <p className="text-[12px] text-ink-soft mt-1">Saved {formatDate(s.createdAt)}</p>
                    {s.notes && <p className="text-[13px] text-ink mt-2">{s.notes}</p>}
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={remove.isPending && remove.variables === s.id}
                    onClick={() => remove.mutate(s.id)}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
