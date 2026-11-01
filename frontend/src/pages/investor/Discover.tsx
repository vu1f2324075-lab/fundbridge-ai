/**
 * Business discovery.
 *
 * Only businesses whose owner opted in appear here, enforced server-side. The
 * copy says so, because an investor seeing a short list should understand it
 * reflects owner choice rather than an empty platform.
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
  Table,
  Td,
  Th,
} from '../../components/ui';
import { IconDiscover } from '../../components/ui/icons';
import { useMeta } from '../../hooks/queries';
import { useAddToShortlist, useDiscoverBusinesses } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatCurrency, humanise } from '../../utils/format';

const STAGES = ['IDEA', 'PROTOTYPE', 'EARLY', 'GROWTH', 'EXPANSION', 'MATURE'] as const;

const inputClass =
  'px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';

export default function DiscoverPage() {
  const { data: meta } = useMeta();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessStage, setBusinessStage] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);

  const params = {
    page,
    ...(search ? { search } : {}),
    ...(industry ? { industry } : {}),
    ...(businessStage ? { businessStage } : {}),
    ...(state ? { state } : {}),
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useDiscoverBusinesses(params);
  const shortlist = useAddToShortlist();
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());

  const reset = () => {
    setSearch('');
    setIndustry('');
    setBusinessStage('');
    setState('');
    setPage(1);
  };

  const add = async (businessId: string) => {
    try {
      await shortlist.mutateAsync({ businessId });
      setShortlisted((prev) => new Set(prev).add(businessId));
    } catch {
      // A duplicate is reported by the server as a conflict; marking it
      // shortlisted locally is the correct outcome either way.
      setShortlisted((prev) => new Set(prev).add(businessId));
    }
  };

  const hasFilters = Boolean(search || industry || businessStage || state);

  return (
    <div>
      <PageHeader
        title="Discover businesses"
        description="Businesses that have chosen to be discoverable and have stated a funding requirement."
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
              placeholder="Name, industry or description"
              className={`${inputClass} w-full`}
            />
          </div>

          <div>
            <label htmlFor="industry" className="block text-[13px] font-medium text-ink mb-1.5">
              Industry
            </label>
            <input
              id="industry"
              list="industry-filter"
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
            <datalist id="industry-filter">
              {meta?.vocabularies.industries.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="stage" className="block text-[13px] font-medium text-ink mb-1.5">
              Stage
            </label>
            <select
              id="stage"
              value={businessStage}
              onChange={(e) => {
                setBusinessStage(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {humanise(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="state" className="block text-[13px] font-medium text-ink mb-1.5">
              State
            </label>
            <input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={inputClass}
            />
          </div>

          <Button type="submit" variant="secondary" loading={isFetching}>
            Search
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={reset}>
              Clear
            </Button>
          )}
        </form>
      </Card>

      {isLoading ? (
        <LoadingPanel label="Loading businesses…" />
      ) : isError ? (
        <ErrorPanel
          message={error instanceof ApiError ? error.message : 'Could not load businesses.'}
          onRetry={() => void refetch()}
        />
      ) : (data?.data.length ?? 0) === 0 ? (
        <EmptyState
          icon={<IconDiscover size={22} />}
          title="No discoverable businesses found"
          description={
            hasFilters
              ? 'No business matches those filters. Try clearing them.'
              : 'No business has yet opted into discovery with a stated funding requirement. Business owners control their own visibility, so this list reflects their choice.'
          }
          {...(hasFilters ? { action: <Button onClick={reset}>Clear filters</Button> } : {})}
        />
      ) : (
        <>
          <Card padded={false} className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Business</Th>
                  <Th>Stage</Th>
                  <Th>Seeking</Th>
                  <Th>Revenue</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((b) => (
                  <tr key={b.id}>
                    <Td>
                      <Link
                        to={`/investor/businesses/${b.id}`}
                        className="font-medium text-ink hover:text-accent transition-colors"
                      >
                        {b.businessName}
                      </Link>
                      <p className="text-[12px] text-ink-soft mt-0.5">
                        {b.industry ?? 'Industry not stated'}
                        {b.location ? ` · ${b.location}` : ''}
                        {b.state ? `, ${b.state}` : ''}
                      </p>
                    </Td>
                    <Td>
                      <Badge>{humanise(b.businessStage)}</Badge>
                    </Td>
                    <Td>
                      {b.fundingRequirement
                        ? formatCurrency(b.fundingRequirement.amountRequired, b.fundingRequirement.currency)
                        : '—'}
                      {b.fundingRequirement && (
                        <p className="text-[11px] text-ink-soft mt-0.5">{b.fundingRequirement.purpose}</p>
                      )}
                    </Td>
                    <Td>
                      {/* A band, not a figure — the backend never exposes exact
                          financials to an investor. */}
                      <span className="text-ink-soft">{b.revenueBand}</span>
                    </Td>
                    <Td align="right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={shortlisted.has(b.id)}
                        loading={shortlist.isPending && shortlist.variables?.businessId === b.id}
                        onClick={() => void add(b.id)}
                      >
                        {shortlisted.has(b.id) ? 'Shortlisted' : 'Shortlist'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {data!.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[13px] text-ink-soft">
                Page {data!.meta.page} of {data!.meta.totalPages} · {data!.meta.total} businesses
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
