/**
 * Scheme catalogue.
 *
 * Search, filtering and pagination are server-side query parameters, not
 * client-side array operations over a full download. That matters for both
 * correctness and privacy as the catalogue grows.
 *
 * Only PUBLISHED schemes are returned, enforced in the backend service — an
 * unverified record can never appear here as current official information.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
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
import { useSchemes } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { formatDate, formatRange, humanise } from '../../utils/format';

const SCHEME_TYPES = ['GRANT', 'LOAN', 'EQUITY', 'SUBSIDY', 'GUARANTEE', 'INCUBATION', 'OTHER'];

export default function SchemesPage() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [schemeType, setSchemeType] = useState('');
  const [page, setPage] = useState(1);

  const params = {
    page,
    ...(search ? { search } : {}),
    ...(level ? { level } : {}),
    ...(schemeType ? { schemeType } : {}),
  };
  const { data, isLoading, isError, error, refetch, isFetching } = useSchemes(params);

  const inputClass =
    'px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';

  const reset = () => {
    setSearch('');
    setLevel('');
    setSchemeType('');
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Government schemes"
        description="The published scheme catalogue. Every record links back to its official source."
      />

      <Card className="mb-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="block text-[13px] font-medium text-ink mb-1.5">
              Search
            </label>
            <input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Scheme or provider name"
              className={`${inputClass} w-full`}
            />
          </div>

          <div>
            <label htmlFor="level" className="block text-[13px] font-medium text-ink mb-1.5">
              Level
            </label>
            <select
              id="level"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All</option>
              <option value="CENTRAL">Central</option>
              <option value="STATE">State</option>
            </select>
          </div>

          <div>
            <label htmlFor="schemeType" className="block text-[13px] font-medium text-ink mb-1.5">
              Type
            </label>
            <select
              id="schemeType"
              value={schemeType}
              onChange={(e) => {
                setSchemeType(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All</option>
              {SCHEME_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanise(t)}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="secondary" loading={isFetching}>
            Search
          </Button>
          {(search || level || schemeType) && (
            <Button type="button" variant="ghost" onClick={reset}>
              Clear
            </Button>
          )}
        </form>
      </Card>

      {isLoading ? (
        <LoadingPanel label="Loading schemes…" />
      ) : isError ? (
        <ErrorPanel
          message={error instanceof ApiError ? error.message : 'Could not load the scheme catalogue.'}
          onRetry={() => void refetch()}
        />
      ) : (data?.data.length ?? 0) === 0 ? (
        <EmptyState
          icon={<IconSchemes size={22} />}
          title="No published schemes found"
          description={
            search || level || schemeType
              ? 'No scheme matches those filters. Try clearing them.'
              : 'The catalogue has no published schemes yet. Scheme records are published by an administrator once their details have been verified against the official source.'
          }
          {...(search || level || schemeType
            ? { action: <Button onClick={reset}>Clear filters</Button> }
            : {})}
        />
      ) : (
        <>
          <Card padded={false} className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Scheme</Th>
                  <Th>Type</Th>
                  <Th>Funding range</Th>
                  <Th align="right">Last verified</Th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/app/schemes/${s.id}`}
                          className="font-medium text-ink hover:text-accent transition-colors"
                        >
                          {s.name}
                        </Link>
                        {s.sourceType === 'SYNTHETIC' && <SyntheticBadge />}
                      </div>
                      <p className="text-[12px] text-ink-soft mt-0.5">
                        {s.provider} · {humanise(s.level)}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone="info">{humanise(s.schemeType)}</Badge>
                    </Td>
                    <Td>{formatRange(s.minFunding, s.maxFunding)}</Td>
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
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
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
