/**
 * Scheme administration: the lifecycle queue and the verification action.
 *
 * The lifecycle is enforced server-side — a DRAFT cannot jump to PUBLISHED, and
 * VERIFIED is refused on a record with no eligibility criteria. The UI offers
 * only the transitions the backend permits, and surfaces its refusal verbatim
 * rather than guessing.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  SyntheticBadge,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { IconSchemes } from '../../components/ui/icons';
import { useAdminScheme, useAdminSchemes, useTransitionScheme } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatDate, formatRange, humanise } from '../../utils/format';
import type { SchemeStatus } from '../../types/modules';

const STATUS_TONE: Record<SchemeStatus, 'success' | 'warning' | 'info' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  NEEDS_VERIFICATION: 'warning',
  VERIFIED: 'info',
  PUBLISHED: 'success',
  NEEDS_REVERIFICATION: 'warning',
  ARCHIVED: 'neutral',
};

/** Mirrors ALLOWED_TRANSITIONS in the backend service. */
const NEXT: Record<SchemeStatus, SchemeStatus[]> = {
  DRAFT: ['NEEDS_VERIFICATION', 'ARCHIVED'],
  NEEDS_VERIFICATION: ['VERIFIED', 'DRAFT', 'ARCHIVED'],
  VERIFIED: ['PUBLISHED', 'NEEDS_VERIFICATION', 'ARCHIVED'],
  PUBLISHED: ['NEEDS_REVERIFICATION', 'ARCHIVED'],
  NEEDS_REVERIFICATION: ['VERIFIED', 'PUBLISHED', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

const ALL_STATUSES = Object.keys(NEXT) as SchemeStatus[];

const inputClass =
  'px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';

export function AdminSchemesPage() {
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = { page, ...(status ? { status } : {}), ...(search ? { search } : {}) };
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminSchemes(params);

  return (
    <div>
      <PageHeader
        title="Government schemes"
        description="Only PUBLISHED schemes are visible to business users or retrievable for grounded answers."
      />

      <Card className="mb-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="search" className="block text-[13px] font-medium text-ink mb-1.5">
              Search
            </label>
            <input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} w-full`}
              placeholder="Name, provider or slug"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-[13px] font-medium text-ink mb-1.5">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanise(s)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary" loading={isFetching}>
            Search
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <LoadingPanel label="Loading schemes…" />
      ) : isError ? (
        <ErrorPanel
          message={error instanceof ApiError ? error.message : 'Could not load schemes.'}
          onRetry={() => void refetch()}
        />
      ) : (data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={<IconSchemes size={22} />} title="No schemes found" description="Try a different status or search term." />
      ) : (
        <>
          <Card padded={false} className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Scheme</Th>
                  <Th>Status</Th>
                  <Th>Funding range</Th>
                  <Th>Criteria</Th>
                  <Th align="right">Last verified</Th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/admin/schemes/${s.id}`}
                          className="font-medium text-ink hover:text-accent transition-colors"
                        >
                          {s.name}
                        </Link>
                        {s.sourceType === 'SYNTHETIC' && <SyntheticBadge />}
                      </div>
                      <p className="text-[12px] text-ink-soft mt-0.5">
                        {s.provider} · {humanise(s.level)} · {humanise(s.schemeType)}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[s.status as SchemeStatus]}>{humanise(s.status)}</Badge>
                    </Td>
                    <Td>{formatRange(s.minFunding, s.maxFunding)}</Td>
                    <Td>
                      {s.eligibilityCriteria.length === 0 ? (
                        <span className="text-warning text-[12px]">none recorded</span>
                      ) : (
                        <span className="text-ink-soft text-[12px]">{s.eligibilityCriteria.length} recorded</span>
                      )}
                    </Td>
                    <Td align="right" className="text-ink-soft">
                      {formatDate(s.lastVerifiedAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {data!.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[13px] text-ink-soft">
                Page {data!.meta.page} of {data!.meta.totalPages} · {data!.meta.total} schemes
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data!.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AdminSchemeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useAdminScheme(id);
  const transition = useTransitionScheme();
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (isLoading) return <LoadingPanel label="Loading scheme…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load this scheme.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const scheme = data!.scheme;
  const current = scheme.status as SchemeStatus;
  const allowed = NEXT[current] ?? [];

  const canVerify = scheme.eligibilityCriteria.length > 0;

  const move = async (target: SchemeStatus) => {
    setResult(null);
    setFailure(null);
    try {
      const r = await transition.mutateAsync({ id, status: target, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      setResult(r.indexNote ? `Moved to ${target}. ${r.indexNote}` : `Moved to ${target}.`);
      setReason('');
    } catch (err) {
      // The backend's refusal message is specific and actionable; show it
      // verbatim rather than paraphrasing.
      setFailure(err instanceof ApiError ? err.message : 'The transition failed.');
    }
  };

  return (
    <div>
      <Link to="/admin/schemes" className="text-[13px] text-accent hover:underline inline-flex mb-4">
        ← Back to schemes
      </Link>

      <PageHeader
        title={scheme.name}
        description={`${scheme.provider}${scheme.ministry ? ` · ${scheme.ministry}` : ''}`}
      />

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Badge tone={STATUS_TONE[current]}>{humanise(current)}</Badge>
        <Badge tone="info">{humanise(scheme.schemeType)}</Badge>
        <Badge>{humanise(scheme.level)}</Badge>
        {scheme.sourceType === 'SYNTHETIC' && <SyntheticBadge />}
        <span className="text-[12px] text-ink-soft">Last verified: {formatDate(scheme.lastVerifiedAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Lifecycle"
              description="Transitions are enforced server-side. Verification additionally requires the record to carry eligibility criteria."
            />

            {!canVerify && (
              <div className="mb-4 bg-warning-bg border border-warning/30 rounded-lg px-4 py-2.5">
                <p className="text-[13px] text-ink leading-relaxed">
                  This record has no eligibility criteria, so it cannot be verified. An empty criteria list would be
                  read by the matching engine as "unrestricted", making the scheme appear to accept everyone.
                </p>
              </div>
            )}

            <label htmlFor="reason" className="block text-[13px] font-medium text-ink mb-1.5">
              Reason (recorded in the revision history)
            </label>
            <input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${inputClass} w-full mb-4`}
              placeholder="Optional note explaining this change"
            />

            <div className="flex flex-wrap gap-2">
              {allowed.length === 0 ? (
                <p className="text-[13px] text-ink-soft">No transitions are available from {humanise(current)}.</p>
              ) : (
                allowed.map((target) => (
                  <Button
                    key={target}
                    size="sm"
                    variant={target === 'ARCHIVED' ? 'danger' : 'secondary'}
                    disabled={target === 'VERIFIED' && !canVerify}
                    loading={transition.isPending && transition.variables?.status === target}
                    onClick={() => void move(target)}
                  >
                    Move to {humanise(target)}
                  </Button>
                ))
              )}
            </div>

            {result && (
              <div className="mt-4 bg-success-bg border border-success/25 rounded-lg px-4 py-2.5" role="status">
                <p className="text-[13px] text-ink">{result}</p>
              </div>
            )}
            {failure && (
              <div className="mt-4">
                <ErrorPanel message={failure} />
              </div>
            )}

            <p className="text-[12px] text-ink-soft mt-4 leading-relaxed">
              Publishing indexes the scheme for retrieval. Archiving removes its chunks from the index and deletes
              existing matches, so no user is shown a withdrawn scheme.
            </p>
          </Card>

          <Card>
            <CardHeader title={`Eligibility criteria (${scheme.eligibilityCriteria.length})`} />
            {scheme.eligibilityCriteria.length === 0 ? (
              <p className="text-[13px] text-warning">
                None recorded. These must be entered from the official source before verification.
              </p>
            ) : (
              <ul className="space-y-2">
                {scheme.eligibilityCriteria.map((c) => (
                  <li key={c} className="text-[13px] text-ink leading-relaxed flex gap-2.5">
                    <span className="text-ink-faint flex-shrink-0" aria-hidden="true">
                      •
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {scheme.eligibilityRules && Object.keys(scheme.eligibilityRules).length > 0 && (
            <Card>
              <CardHeader
                title="Machine-checkable gates"
                description="The subset the engine evaluates automatically. Everything else is reported for human verification."
              />
              <pre className="text-[12px] text-ink bg-canvas border border-line rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(scheme.eligibilityRules, null, 2)}
              </pre>
            </Card>
          )}

          {scheme.notes && (
            <Card>
              <CardHeader title="Provenance notes" />
              <p className="text-[12px] text-ink-soft leading-relaxed whitespace-pre-line">{scheme.notes}</p>
            </Card>
          )}

          {scheme.revisions && scheme.revisions.length > 0 && (
            <Card>
              <CardHeader
                title={`Revision history (${scheme.revisions.length})`}
                description="Append-only. Every edit snapshots the previous values first, so provenance is never overwritten."
              />
              <ul className="space-y-3">
                {scheme.revisions.map((r) => (
                  <li key={r.id} className="text-[13px] border-l-2 border-line pl-3">
                    <p className="text-ink">{r.reason ?? 'No reason recorded'}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      {formatDate(r.createdAt)}
                      {r.changedBy ? ' · by an administrator' : ' · by an automated import'}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Record" />
            <Table>
              <tbody>
                <tr>
                  <Th>Funding range</Th>
                  <Td align="right">{formatRange(scheme.minFunding, scheme.maxFunding)}</Td>
                </tr>
                <tr>
                  <Th>Documents required</Th>
                  <Td align="right">{scheme.requiredDocuments.length || '—'}</Td>
                </tr>
                <tr>
                  <Th>Matches</Th>
                  <Td align="right">{scheme._count?.matches ?? 0}</Td>
                </tr>
                <tr>
                  <Th>Indexed documents</Th>
                  <Td align="right">{scheme._count?.documents ?? 0}</Td>
                </tr>
                <tr>
                  <Th>Source</Th>
                  <Td align="right">{scheme.source}</Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Official source" />
            <a
              href={scheme.officialSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-accent hover:underline break-all"
            >
              {scheme.officialSourceUrl} ↗
            </a>
            {scheme.applicationUrl && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                  Application portal
                </p>
                <a
                  href={scheme.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-accent hover:underline break-all"
                >
                  {scheme.applicationUrl} ↗
                </a>
              </div>
            )}
            <p className="text-[12px] text-ink-soft mt-4 leading-relaxed">
              Open the official source and confirm the stored criteria still match before verifying.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
