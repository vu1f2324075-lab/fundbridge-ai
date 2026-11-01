/**
 * Admin operations: users, data quality, knowledge base, matching config, audit.
 *
 * Grouped in one module because each is a single focused screen over one
 * endpoint; splitting them into separate files would add navigation without
 * adding clarity.
 */
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { IconAudit } from '../../components/ui/icons';
import {
  useAdminUsers,
  useAuditLogs,
  useClearRagIndex,
  useDataQuality,
  useMatchingConfig,
  useRagStats,
  useReindexRag,
  useSetUserStatus,
  useUpdateMatchingConfig,
} from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatDate, humanise } from '../../utils/format';
import { BarChart, Donut, Meter, SEQUENTIAL, STATUS_COLOUR, type Slice } from '../../components/charts';

const inputClass =
  'px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function AdminUsersPage() {
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = { page, ...(role ? { role } : {}), ...(search ? { search } : {}) };
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminUsers(params);
  const setStatus = useSetUserStatus();
  const [failure, setFailure] = useState<string | null>(null);

  const toggle = async (id: string, current: 'ACTIVE' | 'SUSPENDED') => {
    setFailure(null);
    try {
      await setStatus.mutateAsync({ id, status: current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
    } catch (err) {
      // The backend refuses to suspend the last active administrator, and to let
      // an admin suspend themselves. Show its reason verbatim.
      setFailure(err instanceof ApiError ? err.message : 'Could not change that account.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Suspending an account takes effect on the user's next request — sessions are revalidated against the database rather than trusted until expiry."
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
              placeholder="Name or email"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-[13px] font-medium text-ink mb-1.5">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All</option>
              <option value="STARTUP">Startup</option>
              <option value="INVESTOR">Investor</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <Button type="submit" variant="secondary" loading={isFetching}>
            Search
          </Button>
        </form>
      </Card>

      {failure && (
        <div className="mb-5">
          <ErrorPanel message={failure} />
        </div>
      )}

      {isLoading ? (
        <LoadingPanel label="Loading users…" />
      ) : isError ? (
        <ErrorPanel
          message={error instanceof ApiError ? error.message : 'Could not load users.'}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <Card padded={false} className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Profile</Th>
                  <Th>Last sign-in</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((u) => (
                  <tr key={u.id}>
                    <Td>
                      <span className="font-medium text-ink">{u.name}</span>
                      <p className="text-[12px] text-ink-soft mt-0.5">{u.email}</p>
                    </Td>
                    <Td>
                      <Badge tone={u.role === 'ADMIN' ? 'info' : 'neutral'}>{humanise(u.role)}</Badge>
                    </Td>
                    <Td className="text-[12px] text-ink-soft">
                      {u.businessProfile?.businessName ?? u.investorProfile?.investorName ?? '—'}
                    </Td>
                    <Td className="text-[12px] text-ink-soft">{formatDate(u.lastLoginAt)}</Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{humanise(u.status)}</Badge>
                        <Button
                          size="sm"
                          variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'}
                          loading={setStatus.isPending && setStatus.variables?.id === u.id}
                          onClick={() => void toggle(u.id, u.status)}
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {data!.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[13px] text-ink-soft">
                Page {data!.meta.page} of {data!.meta.totalPages} · {data!.meta.total} users
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

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

export function AdminDataQualityPage() {
  const { data, isLoading, isError, error, refetch } = useDataQuality();

  if (isLoading) return <LoadingPanel label="Building the data quality report…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load the report.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const r = data!.report;

  // Ordered lifecycle, so the bars keep a stable order instead of following
  // whatever order the object happened to arrive in.
  const STATUS_ORDER = [
    'DRAFT',
    'NEEDS_VERIFICATION',
    'VERIFIED',
    'PUBLISHED',
    'NEEDS_REVERIFICATION',
    'ARCHIVED',
  ] as const;
  const statusBars = STATUS_ORDER.filter((k) => (r.schemes.byStatus[k] ?? 0) > 0).map((k, i) => ({
    key: k,
    label: humanise(k),
    value: r.schemes.byStatus[k] ?? 0,
    colour: SEQUENTIAL[Math.min(i + 1, SEQUENTIAL.length - 1)],
  }));

  // Provenance, straight from the server's own groupBy. An earlier version of
  // this chart derived "from an official source" as total minus synthetic,
  // which counted four unverified SEED placeholders as sourced records and
  // overstated verified provenance five-fold. Never infer this by subtraction.
  const PROVENANCE: Array<{ key: string; label: string; colour: string }> = [
    { key: 'OFFICIAL_SOURCE', label: 'Verified against an official source', colour: STATUS_COLOUR.success },
    { key: 'MANUAL_ENTRY', label: 'Entered by an administrator', colour: STATUS_COLOUR.info },
    { key: 'SEED', label: 'Placeholder awaiting verification', colour: STATUS_COLOUR.neutral },
    { key: 'SYNTHETIC', label: 'Synthetic demonstration', colour: STATUS_COLOUR.warning },
  ];
  const provenanceSlices: Slice[] = PROVENANCE.map((p) => ({
    key: p.key,
    label: p.label,
    value: r.schemes.bySourceType[p.key] ?? 0,
    colour: p.colour,
  }));

  const gaps: Array<[string, number, string]> = [
    ['Missing eligibility criteria', r.schemes.missingEligibility, 'Cannot be verified; would read as unrestricted'],
    ['Missing funding range', r.schemes.missingFundingRange, 'Funding factor scores as unrestricted'],
    ['Missing application URL', r.schemes.missingApplicationUrl, 'User cannot be directed to apply'],
    ['Missing required documents', r.schemes.missingDocuments, 'User cannot prepare in advance'],
    ['Never verified', r.schemes.neverVerified, 'No verification date recorded'],
    ['Stale verification', r.schemes.staleVerification, 'Published but unverified for over six months'],
  ];

  return (
    <div>
      <PageHeader
        title="Data quality"
        description="Counts only, with no interpretation. A scheme missing its eligibility criteria is reported as such rather than treated as unrestricted."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Schemes by lifecycle status"
            description={`${r.schemes.total} records in total.`}
          />
          <BarChart bars={statusBars} emptyMessage="No scheme records yet." />

          <div className="mt-5 pt-4 border-t border-muted-bg">
            <CardHeader
              title="Where the data came from"
              description="The single most important thing to know about this dataset."
            />
            <Donut
              slices={provenanceSlices}
              centreValue={r.schemes.total}
              centreLabel="records"
              emptyMessage="No scheme records yet."
            />
          </div>

          {r.schemes.syntheticRecords > 0 && (
            <div className="mt-4 bg-warning-bg border border-warning/30 rounded-lg px-4 py-2.5">
              <p className="text-[13px] text-ink leading-relaxed">
                <span className="font-medium">
                  {r.schemes.syntheticRecords} synthetic demonstration record
                  {r.schemes.syntheticRecords > 1 ? 's' : ''}.
                </span>{' '}
                These exist to exercise the matching engine and must never be cited or used as a research result. Remove
                them with <code className="text-[12px]">npm run db:seed:demo -- --remove</code>.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Completeness gaps" description="What each gap means in practice." />
          <ul className="space-y-3">
            {gaps.map(([label, count, consequence]) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-ink">{label}</span>
                  <span
                    className={`text-[14px] font-semibold tabular-nums ${count > 0 ? 'text-warning' : 'text-success'}`}
                  >
                    {count}
                  </span>
                </div>
                <p className="text-[12px] text-ink-soft mt-0.5 leading-relaxed">{consequence}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Businesses" />
          <Table>
            <tbody>
              <tr>
                <Th>Total</Th>
                <Td align="right">{r.businesses.total}</Td>
              </tr>
              <tr>
                <Th>Missing financials</Th>
                <Td align="right">{r.businesses.missingFinancials}</Td>
              </tr>
              <tr>
                <Th>Missing funding requirement</Th>
                <Td align="right">{r.businesses.missingFundingRequirement}</Td>
              </tr>
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Proposals" />
          <Table>
            <tbody>
              <tr>
                <Th>Total uploaded</Th>
                <Td align="right">{r.proposals.total}</Td>
              </tr>
              <tr>
                <Th>Text extracted</Th>
                <Td align="right">{r.proposals.extracted}</Td>
              </tr>
              <tr>
                <Th>Extraction failed</Th>
                <Td align="right">
                  <span className={r.proposals.extractionFailed > 0 ? 'text-warning' : ''}>
                    {r.proposals.extractionFailed}
                  </span>
                </Td>
              </tr>
              <tr>
                <Th>Analysed</Th>
                <Td align="right">{r.proposals.analysed}</Td>
              </tr>
            </tbody>
          </Table>
        </Card>
      </div>

      {r.schemes.duplicateCandidates.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title={`Duplicate candidates (${r.schemes.duplicateCandidates.length})`}
            description="Flagged by normalised name. Nothing is removed automatically — two schemes can legitimately share a name fragment."
          />
          <ul className="space-y-1.5">
            {r.schemes.duplicateCandidates.map((d) => (
              <li key={d.normalisedName} className="flex justify-between text-[13px]">
                <span className="text-ink font-mono text-[12px]">{d.normalisedName}</span>
                <span className="text-ink-soft">{d.count} records</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export function AdminRagPage() {
  const { data, isLoading, isError, error, refetch } = useRagStats();
  const reindex = useReindexRag();
  const clear = useClearRagIndex();
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (isLoading) return <LoadingPanel label="Loading index statistics…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load index statistics.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const s = data!.stats;
  const unindexed = s.schemesPublished - s.schemesIndexed;

  return (
    <div>
      <PageHeader
        title="Knowledge base"
        description="The retrieval index behind grounded answers. Only PUBLISHED documents are retrievable, so an unverified draft can never be quoted as official."
      />

      <Card className="mb-6">
        <CardHeader
          title="Retrieval coverage"
          description="How much of what could be retrieved actually can be. A gap here means a published scheme cannot be quoted in a grounded answer."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Meter
            label="Published schemes indexed"
            value={s.schemesIndexed}
            limit={s.schemesPublished}
            {...(unindexed > 0 ? { tone: STATUS_COLOUR.warning } : {})}
            caption={
              unindexed > 0
                ? `${unindexed} published scheme${unindexed > 1 ? 's are' : ' is'} not indexed and cannot be retrieved.`
                : 'Every published scheme is retrievable.'
            }
          />
          <Meter
            label="Chunks with embeddings"
            value={s.embeddedChunks}
            limit={s.chunks}
            {...(s.chunks > s.embeddedChunks ? { tone: STATUS_COLOUR.warning } : {})}
            caption={
              s.chunks > s.embeddedChunks
                ? `${s.chunks - s.embeddedChunks} chunk${s.chunks - s.embeddedChunks > 1 ? 's have' : ' has'} no embedding, so ${s.chunks - s.embeddedChunks > 1 ? 'they are' : 'it is'} invisible to search.`
                : 'Every chunk is searchable.'
            }
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Index" />
          <Table>
            <tbody>
              <tr>
                <Th>Documents</Th>
                <Td align="right">
                  {s.documents} ({s.publishedDocuments} published)
                </Td>
              </tr>
              <tr>
                <Th>Chunks</Th>
                <Td align="right">{s.chunks}</Td>
              </tr>
              <tr>
                <Th>With embeddings</Th>
                <Td align="right">{s.embeddedChunks}</Td>
              </tr>
              <tr>
                <Th>Schemes indexed</Th>
                <Td align="right">
                  {s.schemesIndexed} of {s.schemesPublished}
                </Td>
              </tr>
              <tr>
                <Th>Embedding model</Th>
                <Td align="right">{s.embeddingModels.join(', ') || 'none'}</Td>
              </tr>
              <tr>
                <Th>Last indexed</Th>
                <Td align="right">{formatDate(s.lastIndexedAt)}</Td>
              </tr>
            </tbody>
          </Table>

          {unindexed > 0 && (
            <div className="mt-4 bg-warning-bg border border-warning/30 rounded-lg px-4 py-2.5">
              <p className="text-[13px] text-ink leading-relaxed">
                {unindexed} published scheme{unindexed > 1 ? 's are' : ' is'} not indexed and therefore cannot be
                retrieved for grounded answers. Re-index to fix this.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Maintenance"
            description="Re-indexing embeds every chunk in the corpus. It is the most expensive operation available here."
          />

          <div className="space-y-3">
            <div>
              <Button loading={reindex.isPending} onClick={async () => {
                setMessage(null);
                const r = await reindex.mutateAsync();
                setMessage(
                  `Indexed ${r.result.indexed} of ${r.result.schemes} published schemes into ${r.result.chunks} chunks.` +
                    (r.result.failures.length > 0 ? ` ${r.result.failures.length} failed.` : ''),
                );
              }}>
                Re-index all published schemes
              </Button>
              <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                Run this after verifying or editing a scheme, so retrieval reflects the current record.
              </p>
            </div>

            <div className="pt-3 border-t border-line">
              {confirmClear ? (
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    loading={clear.isPending}
                    onClick={async () => {
                      const r = await clear.mutateAsync();
                      setMessage(`Removed ${r.result.deletedChunks} chunks. Retrieval will return nothing until you re-index.`);
                      setConfirmClear(false);
                    }}
                  >
                    Confirm clear
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setConfirmClear(true)}>
                  Clear the index
                </Button>
              )}
              <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                Needed when changing the embedding model — vectors from two models are not comparable. Retrieval returns
                nothing until you re-index.
              </p>
            </div>
          </div>

          {reindex.isError && (
            <div className="mt-4">
              <ErrorPanel
                message={reindex.error instanceof ApiError ? reindex.error.message : 'Re-indexing failed.'}
              />
            </div>
          )}

          {message && (
            <div className="mt-4 bg-success-bg border border-success/25 rounded-lg px-4 py-2.5" role="status">
              <p className="text-[13px] text-ink">{message}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matching configuration
// ---------------------------------------------------------------------------

export function AdminMatchingConfigPage() {
  const { data, isLoading, isError, error, refetch } = useMatchingConfig();
  const update = useUpdateMatchingConfig();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (isLoading) return <LoadingPanel label="Loading configuration…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load configuration.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const save = async (key: string) => {
    setFailure(null);
    setSaved(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setFailure('That is not valid JSON.');
      return;
    }
    try {
      await update.mutateAsync({ key, value: parsed });
      setSaved(key);
      setEditing(null);
    } catch (err) {
      // The backend validates against the same schema the engines use, so its
      // message names the actual problem — for weights, that they must sum to 1.
      setFailure(err instanceof ApiError ? err.message : 'Could not save that configuration.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Matching configuration"
        description="Scoring weights and thresholds. Stored in the database and stamped onto every derived score, so a stored result can be traced to the configuration that produced it."
      />

      <Card className="mb-5">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Saving creates a new version rather than editing the old one, so historical scores stay interpretable. Weight
          sets are validated to sum to 1 — a set summing to 0.95 would silently cap every score at 95, so it is rejected.
        </p>
      </Card>

      {failure && (
        <div className="mb-5">
          <ErrorPanel message={failure} />
        </div>
      )}

      <div className="space-y-4">
        {data!.config.map((entry) => (
          <Card key={entry.key}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-[14px] font-semibold text-ink">{humanise(entry.key)}</h3>
                <p className="text-[12px] text-ink-soft mt-0.5">
                  {entry.isDefault ? 'Using the code default (nothing stored)' : `Version ${entry.version}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {entry.isDefault && <Badge tone="neutral">default</Badge>}
                {saved === entry.key && <Badge tone="success">saved</Badge>}
                {editing === entry.key ? (
                  <>
                    <Button size="sm" loading={update.isPending} onClick={() => void save(entry.key)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDraft(JSON.stringify(entry.value, null, 2));
                      setEditing(entry.key);
                      setSaved(null);
                      setFailure(null);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {editing === entry.key ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(16, draft.split('\n').length + 1)}
                className="w-full mt-3 px-3 py-2 text-[12px] font-mono bg-white border border-line rounded-lg outline-none focus:border-accent resize-y"
                spellCheck={false}
                aria-label={`${entry.key} value`}
              />
            ) : (
              <pre className="text-[12px] text-ink bg-canvas border border-line rounded-lg p-3 mt-3 overflow-x-auto">
                {JSON.stringify(entry.value, null, 2)}
              </pre>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const params = { page, limit: 50, ...(action ? { action } : {}) };
  const { data, isLoading, isError, error, refetch } = useAuditLogs(params);

  const ACTIONS = [
    'auth.login',
    'auth.login_failed',
    'auth.register',
    'auth.password_changed',
    'business.updated',
    'proposal.uploaded',
    'proposal.analysed',
    'scheme.verified',
    'scheme.updated',
    'scheme.archived',
    'matching_config.updated',
    'user.suspended',
  ];

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Security-relevant actions. Metadata records field names and outcomes, never passwords, tokens or financial values."
      />

      <Card className="mb-5">
        <label htmlFor="action" className="block text-[13px] font-medium text-ink mb-1.5">
          Filter by action
        </label>
        <select
          id="action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className={inputClass}
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Card>

      {isLoading ? (
        <LoadingPanel label="Loading audit log…" />
      ) : isError ? (
        <ErrorPanel
          message={error instanceof ApiError ? error.message : 'Could not load the audit log.'}
          onRetry={() => void refetch()}
        />
      ) : (data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={<IconAudit size={22} />} title="No entries" description="No audited action matches that filter yet." />
      ) : (
        <>
          <Card padded={false} className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Actor</Th>
                  <Th>Entity</Th>
                  <Th align="right">Source</Th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((entry) => (
                  <tr key={entry.id}>
                    <Td className="text-[12px] text-ink-soft whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Td>
                    <Td>
                      <Badge tone={entry.action.includes('failed') ? 'warning' : 'neutral'}>{entry.action}</Badge>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <p className="text-[11px] text-ink-soft mt-1 font-mono break-all">
                          {JSON.stringify(entry.metadata)}
                        </p>
                      )}
                    </Td>
                    <Td className="text-[12px]">
                      {entry.actor ? (
                        <>
                          <span className="text-ink">{entry.actor.email}</span>
                          <p className="text-[11px] text-ink-faint">{humanise(entry.actor.role)}</p>
                        </>
                      ) : (
                        <span className="text-ink-faint">anonymous</span>
                      )}
                    </Td>
                    <Td className="text-[12px] text-ink-soft">{entry.entity}</Td>
                    <Td align="right" className="text-[11px] text-ink-soft font-mono">
                      {entry.ip ?? '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {data!.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[13px] text-ink-soft">
                Page {data!.meta.page} of {data!.meta.totalPages} · {data!.meta.total} entries
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
