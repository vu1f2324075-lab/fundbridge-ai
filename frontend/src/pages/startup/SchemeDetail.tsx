/**
 * Scheme detail with explanation.
 *
 * Shows the scheme record and, when one exists, the full match explanation for
 * this business. The official-source link is prominent: FundBridge is a
 * discovery layer and should hand the user off to the authority, not stand in
 * for it.
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
  SyntheticBadge,
  Table,
  Td,
  Th,
} from '../../components/ui';
import MatchExplanation from '../../components/domain/MatchExplanation';
import { useSaveOpportunity, useScheme, useSchemeMatch } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { formatDate, formatRange, humanise } from '../../utils/format';

export default function SchemeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const schemeQuery = useScheme(id);
  const matchQuery = useSchemeMatch(id);
  const save = useSaveOpportunity();

  if (schemeQuery.isLoading) return <LoadingPanel label="Loading scheme…" />;
  if (schemeQuery.isError) {
    return (
      <ErrorPanel
        message={schemeQuery.error instanceof ApiError ? schemeQuery.error.message : 'Could not load this scheme.'}
        onRetry={() => void schemeQuery.refetch()}
      />
    );
  }

  const scheme = schemeQuery.data!.scheme;
  // A 404 here simply means matching has not been run for this scheme; that is
  // not an error worth showing.
  const match = matchQuery.data?.match ?? null;

  return (
    <div>
      <Link to="/app/recommendations" className="text-[13px] text-accent hover:underline inline-flex mb-4">
        ← Back to recommendations
      </Link>

      <PageHeader
        title={scheme.name}
        description={`${scheme.provider}${scheme.ministry ? ` · ${scheme.ministry}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={save.isPending}
              disabled={save.isSuccess}
              onClick={() => save.mutate({ opportunityType: 'SCHEME', opportunityId: scheme.id })}
            >
              {save.isSuccess ? 'Saved' : 'Save'}
            </Button>
            <a
              href={scheme.applicationUrl ?? scheme.officialSourceUrl}
              target="_blank"
              // noreferrer as well as noopener: the destination should not
              // receive this application's URL as a referrer.
              rel="noopener noreferrer"
              className="inline-flex items-center text-[13px] font-medium bg-accent-deep text-white px-4 py-2 rounded-lg hover:bg-navy-light transition-colors"
            >
              Official source ↗
            </a>
          </div>
        }
      />

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Badge tone="info">{humanise(scheme.schemeType)}</Badge>
        <Badge>{humanise(scheme.level)}</Badge>
        {scheme.sourceType === 'SYNTHETIC' && <SyntheticBadge />}
        <span className="text-[12px] text-ink-soft">Last verified: {formatDate(scheme.lastVerifiedAt)}</span>
      </div>

      {scheme.sourceType === 'SYNTHETIC' && (
        <div className="mb-6 bg-warning-bg border border-warning/30 rounded-lg px-4 py-3">
          <p className="text-[13px] text-ink leading-relaxed">
            <strong className="font-semibold">This is a synthetic demonstration record.</strong> It is not a real
            government scheme. Its criteria were written to exercise the matching engine and must not be cited or
            applied for.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {match ? (
            <MatchExplanation
              explanation={match.explanation}
              narrative={match.narrative}
              modelVersion={match.modelVersion}
              configVersion={match.configVersion}
            />
          ) : (
            <Card>
              <CardHeader
                title="No match calculated"
                description="Run matching from the recommendations page to see how your profile compares against this scheme's criteria."
              />
              <Link to="/app/recommendations">
                <Button variant="secondary" size="sm">
                  Go to recommendations
                </Button>
              </Link>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card variant="feature">
            <CardHeader title="Scheme details" />
            <Table>
              <tbody>
                <tr>
                  <Th>Funding range</Th>
                  <Td align="right">{formatRange(scheme.minFunding, scheme.maxFunding)}</Td>
                </tr>
                <tr>
                  <Th>Type</Th>
                  <Td align="right">{humanise(scheme.schemeType)}</Td>
                </tr>
                <tr>
                  <Th>Level</Th>
                  <Td align="right">{humanise(scheme.level)}</Td>
                </tr>
                {scheme.department && (
                  <tr>
                    <Th>Department</Th>
                    <Td align="right">{scheme.department}</Td>
                  </tr>
                )}
                <tr>
                  <Th>Source</Th>
                  <Td align="right">{scheme.source}</Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          {scheme.description && (
            <Card>
              <CardHeader title="About this scheme" />
              <p className="text-[13px] text-ink-soft leading-relaxed">{scheme.description}</p>
            </Card>
          )}

          {scheme.supportedIndustries.length > 0 && (
            <Card>
              <CardHeader title="Supported industries" />
              <div className="flex flex-wrap gap-1.5">
                {scheme.supportedIndustries.map((i) => (
                  <Badge key={i}>{i}</Badge>
                ))}
              </div>
            </Card>
          )}

          {scheme.supportedStages.length > 0 && (
            <Card>
              <CardHeader title="Supported stages" />
              <div className="flex flex-wrap gap-1.5">
                {scheme.supportedStages.map((s) => (
                  <Badge key={s}>{humanise(s)}</Badge>
                ))}
              </div>
            </Card>
          )}

          {scheme.applicationProcess && (
            <Card>
              <CardHeader title="Application process" />
              <p className="text-[13px] text-ink-soft leading-relaxed whitespace-pre-line">
                {scheme.applicationProcess}
              </p>
            </Card>
          )}

          <Card>
            <CardHeader title="Verify before applying" />
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Scheme terms change. FundBridge is a discovery layer, not the application portal — always confirm current
              eligibility and process with the official source.
            </p>
            <a
              href={scheme.officialSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex mt-3 text-[13px] font-medium text-accent hover:underline break-all"
            >
              {scheme.officialSourceUrl} ↗
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
