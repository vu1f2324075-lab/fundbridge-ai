/**
 * Admin overview: live system status and security.
 *
 * The AI-service panel reports a real probe result, refreshed periodically —
 * not a cached assumption. If the service is down, this page says so, because an
 * administrator acting on a stale "healthy" indicator is worse than no indicator.
 */
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  StatTile,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useSecurityOverview, useSystemStatus } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatDate } from '../../utils/format';

export default function AdminDashboardPage() {
  const status = useSystemStatus();
  const security = useSecurityOverview();

  if (status.isLoading) return <LoadingPanel label="Checking system status…" />;
  if (status.isError) {
    return (
      <ErrorPanel
        message={status.error instanceof ApiError ? status.error.message : 'Could not load system status.'}
        onRetry={() => void status.refetch()}
      />
    );
  }

  const s = status.data!.status;
  const ai = s.aiService;
  const sec = security.data?.overview;

  return (
    <div>
      <PageHeader
        title="System overview"
        description="Live status of the services this platform depends on, and the data it holds."
        action={
          <Button variant="secondary" size="sm" loading={status.isFetching} onClick={() => void status.refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatTile
          label="AI service"
          value={ai.reachable ? 'Reachable' : 'Unreachable'}
          caption={ai.reachable ? `version ${ai.version}` : ai.reason}
          tone={ai.reachable ? 'success' : 'danger'}
        />
        <StatTile
          label="Embeddings"
          value={ai.reachable && ai.embeddings ? 'Available' : 'Unavailable'}
          caption={ai.reachable ? (ai.embeddingModel ?? 'no model') : 'AI service unreachable'}
          tone={ai.reachable && ai.embeddings ? 'success' : 'warning'}
          to="/admin/rag"
        />
        <StatTile
          label="Language model"
          value={ai.reachable && ai.llm ? 'Configured' : 'Not configured'}
          caption={
            ai.reachable && ai.llm
              ? (ai.llmModel ?? '')
              : 'Scores and matching still work; narrative generation does not'
          }
          tone={ai.reachable && ai.llm ? 'success' : 'neutral'}
        />
        <StatTile
          label="Published schemes"
          value={s.data.publishedSchemes}
          caption={`${s.rag.schemesIndexed} indexed for retrieval`}
          to="/admin/schemes"
        />
      </div>

      {!ai.reachable && (
        <Card className="mb-6 border-danger/30 bg-danger-bg/40">
          <p className="text-[13px] text-ink leading-relaxed">
            <span className="font-medium">The AI service is unreachable.</span> Deterministic scoring, readiness,
            matching and the scheme catalogue continue to work. Semantic relevance is dropped from matching with the
            remaining weights renormalised, and proposal processing and retrieval are unavailable until it returns.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Retrieval index"
            description="What the knowledge base currently holds."
            action={
              <Link to="/admin/rag" className="text-[13px] font-medium text-accent hover:underline">
                Manage
              </Link>
            }
          />
          <Table>
            <tbody>
              <tr>
                <Th>Documents</Th>
                <Td align="right">
                  {s.rag.documents} ({s.rag.publishedDocuments} published)
                </Td>
              </tr>
              <tr>
                <Th>Chunks</Th>
                <Td align="right">{s.rag.chunks}</Td>
              </tr>
              <tr>
                <Th>With embeddings</Th>
                <Td align="right">
                  {s.rag.embeddedChunks}
                  {s.rag.chunks > 0 && s.rag.embeddedChunks < s.rag.chunks && (
                    <span className="text-warning ml-2">
                      {s.rag.chunks - s.rag.embeddedChunks} unembedded
                    </span>
                  )}
                </Td>
              </tr>
              <tr>
                <Th>Schemes indexed</Th>
                <Td align="right">
                  {s.rag.schemesIndexed} of {s.rag.schemesPublished} published
                </Td>
              </tr>
              <tr>
                <Th>Embedding model</Th>
                <Td align="right">
                  {s.rag.embeddingModels.length > 0 ? s.rag.embeddingModels.join(', ') : 'none'}
                </Td>
              </tr>
              <tr>
                <Th>Last indexed</Th>
                <Td align="right">{formatDate(s.rag.lastIndexedAt)}</Td>
              </tr>
            </tbody>
          </Table>

          {s.rag.schemesIndexed < s.rag.schemesPublished && (
            <p className="text-[12px] text-warning mt-3 leading-relaxed">
              {s.rag.schemesPublished - s.rag.schemesIndexed} published scheme
              {s.rag.schemesPublished - s.rag.schemesIndexed > 1 ? 's are' : ' is'} not indexed, so{' '}
              {s.rag.schemesPublished - s.rag.schemesIndexed > 1 ? 'they' : 'it'} cannot be retrieved for grounded
              answers.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Security"
            description={sec ? `Last ${sec.windowHours} hours.` : 'Loading…'}
          />
          {security.isError ? (
            <ErrorPanel message="Could not load the security overview." onRetry={() => void security.refetch()} />
          ) : sec ? (
            <>
              <Table>
                <tbody>
                  <tr>
                    <Th>Failed sign-in attempts</Th>
                    <Td align="right">
                      {sec.failedLogins}
                      {sec.failedLogins > 20 && <Badge tone="warning">elevated</Badge>}
                    </Td>
                  </tr>
                  <tr>
                    <Th>Privileged actions</Th>
                    <Td align="right">{sec.privilegedActions}</Td>
                  </tr>
                  <tr>
                    <Th>Suspended accounts</Th>
                    <Td align="right">{sec.suspendedUsers}</Td>
                  </tr>
                </tbody>
              </Table>

              {sec.failedLoginsByIp.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    Failed attempts by source
                  </p>
                  <ul className="space-y-1.5">
                    {sec.failedLoginsByIp.map((row) => (
                      <li key={row.ip} className="flex justify-between text-[13px]">
                        <span className="text-ink font-mono text-[12px]">{row.ip}</span>
                        <span className="text-ink-soft tabular-nums">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] text-ink-soft mt-2.5 leading-relaxed">
                    Grouped by source address rather than by attempted email, so this surfaces brute-force sources
                    without compiling a list of addresses someone tried.
                  </p>
                </div>
              )}

              <Link
                to="/admin/audit"
                className="inline-flex mt-4 text-[13px] font-medium text-accent hover:underline"
              >
                View full audit log
              </Link>
            </>
          ) : null}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Data held" />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
          {(
            [
              ['Users', s.data.users, '/admin/users'],
              ['Businesses', s.data.businesses, null],
              ['Investors', s.data.investors, null],
              ['Schemes', s.data.publishedSchemes, '/admin/schemes'],
              ['Matches', s.data.schemeMatches, null],
              ['Readiness', s.data.readinessRecords, null],
              ['Proposals', s.data.proposals, null],
            ] as const
          ).map(([label, value, to]) => {
            const inner = (
              <>
                <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">{label}</p>
                <p
                  className={`text-[20px] font-semibold tabular-nums mt-1 ${
                    to ? 'text-ink group-hover:text-accent transition-colors' : 'text-ink'
                  }`}
                >
                  {value}
                </p>
              </>
            );
            return to ? (
              <Link
                key={label}
                to={to}
                className="group block rounded-md -mx-1.5 px-1.5 py-1 transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                {inner}
              </Link>
            ) : (
              <div key={label} className="px-1.5 py-1">
                {inner}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
