/**
 * Business detail, investor view.
 *
 * Shows exactly what the backend chooses to expose and nothing more. The
 * "what you are not seeing" panel is deliberate: an investor should know the
 * view is partial by the owner's choice, rather than assume the business has no
 * financial information.
 */
import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useAddToShortlist, useDiscoverableBusiness } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatCurrency, formatNumber, formatPercent, humanise } from '../../utils/format';

export default function InvestorBusinessDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useDiscoverableBusiness(id);
  const shortlist = useAddToShortlist();

  if (isLoading) return <LoadingPanel label="Loading business..." />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load this business.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const b = data!.business;
  const narrative: Array<[string, string | null]> = [
    ['What they do', b.description],
    ['Problem', b.problem],
    ['Solution', b.solution],
    ['Target customer', b.targetCustomer],
    ['Team', b.teamStrength],
  ];

  return (
    <div>
      <Link to="/investor/matches" className="text-[13px] text-accent hover:underline inline-flex mb-4">
        &larr; Back to matches
      </Link>

      <PageHeader
        title={b.businessName}
        description={[b.industry, b.subIndustry, b.location, b.state].filter(Boolean).join(' - ')}
        action={
          <Button
            variant="secondary"
            loading={shortlist.isPending}
            disabled={shortlist.isSuccess}
            onClick={() => shortlist.mutate({ businessId: b.id })}
          >
            {shortlist.isSuccess ? 'Shortlisted' : 'Add to shortlist'}
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Badge tone="info">{humanise(b.businessStage)}</Badge>
        <Badge>{humanise(b.businessType)}</Badge>
        {b.productStatus && <Badge>{humanise(b.productStatus)}</Badge>}
        {b.udyamRegistered && <Badge tone="success">Udyam registered</Badge>}
        {b.dpiitRecognised && <Badge tone="success">DPIIT recognised</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {narrative.some(([, v]) => v) ? (
            narrative
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <Card key={label}>
                  <CardHeader title={label} />
                  <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">{value}</p>
                </Card>
              ))
          ) : (
            <Card>
              <p className="text-[13px] text-ink-soft">
                This business has not yet written a description, problem statement or solution.
              </p>
            </Card>
          )}

          {(b.partnerships.length > 0 || b.certifications.length > 0 || b.intellectualProperty.length > 0) && (
            <Card variant="feature">
              <CardHeader title="Evidence" />
              <div className="space-y-3">
                {([
                  ['Partnerships', b.partnerships],
                  ['Certifications', b.certifications],
                  ['Intellectual property', b.intellectualProperty],
                ] as const)
                  .filter(([, list]) => list.length > 0)
                  .map(([label, list]) => (
                    <div key={label}>
                      <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">
                        {label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((item) => (
                          <Badge key={item}>{item}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {b.fundingRequirement && (
            <Card>
              <CardHeader title="Funding requirement" />
              <Table>
                <tbody>
                  <tr>
                    <Th>Amount</Th>
                    <Td align="right">
                      {formatCurrency(b.fundingRequirement.amountRequired, b.fundingRequirement.currency)}
                    </Td>
                  </tr>
                  <tr>
                    <Th>Purpose</Th>
                    <Td align="right">{b.fundingRequirement.purpose}</Td>
                  </tr>
                  <tr>
                    <Th>Type</Th>
                    <Td align="right">{humanise(b.fundingRequirement.fundingType)}</Td>
                  </tr>
                  {b.fundingRequirement.preferredTimeline && (
                    <tr>
                      <Th>Timeline</Th>
                      <Td align="right">{b.fundingRequirement.preferredTimeline}</Td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
          )}

          <Card>
            <CardHeader title="Business facts" />
            <Table>
              <tbody>
                <tr>
                  <Th>Revenue</Th>
                  <Td align="right">{b.revenueBand}</Td>
                </tr>
                <tr>
                  <Th>Customers</Th>
                  <Td align="right">{formatNumber(b.customerCount)}</Td>
                </tr>
                <tr>
                  <Th>Growth</Th>
                  <Td align="right">{formatPercent(b.growthRate)}</Td>
                </tr>
                <tr>
                  <Th>Team size</Th>
                  <Td align="right">{formatNumber(b.teamSize)}</Td>
                </tr>
                <tr>
                  <Th>Founder experience</Th>
                  <Td align="right">{b.founderExperience ? b.founderExperience + ' yrs' : '-'}</Td>
                </tr>
                <tr>
                  <Th>Founded</Th>
                  <Td align="right">{b.foundedYear ?? '-'}</Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="What you are not seeing" />
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Exact revenue, expenses, profit and debt figures are not shared with investors. Revenue is shown as a
              band instead. Uploaded proposals and the owner contact details are private and are not exposed through
              discovery.
            </p>
            <p className="text-[12px] text-ink-soft leading-relaxed mt-3">
              This is a deliberate limit, not missing data. Shortlist the business if you want to take the conversation
              further.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
