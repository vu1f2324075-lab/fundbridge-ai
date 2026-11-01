/**
 * Scheme match list.
 *
 * Grouped by status rather than sorted by score alone, because the status is
 * the more decisive fact: a 68/100 match with a blocking issue is less useful
 * than a 55/100 one without. Sorting purely by score would bury that.
 */
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  ScoreBar,
  SyntheticBadge,
} from '../../components/ui';
import { IconRecommend } from '../../components/ui/icons';
import { useRecalculateMatches, useSchemeMatches } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { formatRange, humanise } from '../../utils/format';
import { STATUS_LABEL, STATUS_TONE } from '../../components/domain/matchStatus';
import { BarChart, Donut, STATUS_COLOUR, type Slice } from '../../components/charts';
import type { MatchStatus, SchemeMatch } from '../../types/api';

/** Most actionable first. */
const GROUP_ORDER: MatchStatus[] = [
  'POTENTIALLY_ELIGIBLE',
  'NEEDS_INFORMATION',
  'REVIEW_REQUIRED',
  'LIKELY_NOT_ELIGIBLE',
];

const GROUP_DESCRIPTION: Record<MatchStatus, string> = {
  POTENTIALLY_ELIGIBLE: 'Your profile satisfies the criteria on record, with no blocking issues found.',
  NEEDS_INFORMATION: 'Promising, but some criteria could not be checked. Scores here are a floor and may rise.',
  REVIEW_REQUIRED: 'Some criteria did not match. Read the breakdown before deciding whether to pursue these.',
  LIKELY_NOT_ELIGIBLE: 'A stated condition is not met. Shown so you know why, and do not spend time on them.',
};

function MatchRow({ match }: { match: SchemeMatch }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/app/schemes/${match.schemeId}`}
              className="text-[14px] font-medium text-ink hover:text-accent transition-colors"
            >
              {match.scheme.name}
            </Link>
            {match.scheme.sourceType === 'SYNTHETIC' && <SyntheticBadge />}
          </div>
          <p className="text-[12px] text-ink-soft mt-1">
            {match.scheme.provider} · {humanise(match.scheme.schemeType)} · {humanise(match.scheme.level)} ·{' '}
            {formatRange(match.scheme.minFunding, match.scheme.maxFunding)}
          </p>

          <div className="mt-2.5 flex items-center gap-3 flex-wrap">
            {match.blockingIssues.length > 0 && (
              <span className="text-[12px] text-danger">
                {match.blockingIssues.length} blocking issue{match.blockingIssues.length > 1 ? 's' : ''}
              </span>
            )}
            {match.missingCriteria.length > 0 && (
              <span className="text-[12px] text-warning">
                {match.missingCriteria.length} item{match.missingCriteria.length > 1 ? 's' : ''} missing
              </span>
            )}
            {match.matchedCriteria.length > 0 && (
              <span className="text-[12px] text-success">
                {match.matchedCriteria.length} criteri{match.matchedCriteria.length > 1 ? 'a' : 'on'} matched
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 w-32">
          <div className="text-right mb-1.5">
            <span className="text-[18px] font-semibold tabular-nums text-ink">
              {match.eligibilityScore}
              <span className="text-ink-faint text-[12px] font-normal">/100</span>
            </span>
          </div>
          <ScoreBar score={match.eligibilityScore} showValue={false} />
          <Link
            to={`/app/schemes/${match.schemeId}`}
            className="block text-right text-[12px] font-medium text-accent hover:underline mt-2"
          >
            Why this result
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function RecommendationsPage() {
  const { data, isLoading, isError, error, refetch } = useSchemeMatches();
  const recalc = useRecalculateMatches();

  if (isLoading) return <LoadingPanel label="Loading your matches…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your matches.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const matches = data?.matches ?? [];

  if (matches.length === 0) {
    return (
      <div>
        <PageHeader
          title="Recommendations"
          description="Government schemes compared against your profile, with the reasoning behind every result."
        />
        <EmptyState
          icon={<IconRecommend size={22} />}
          title="No matches calculated yet"
          description="Matching compares your profile and funding requirement against each published scheme's stored criteria. Every result comes with its full reasoning."
          action={
            <Button loading={recalc.isPending} onClick={() => recalc.mutate()}>
              Find relevant schemes
            </Button>
          }
        />
        {recalc.isError && (
          <div className="mt-4">
            <ErrorPanel
              message={recalc.error instanceof ApiError ? recalc.error.message : 'Matching could not be completed.'}
            />
          </div>
        )}
      </div>
    );
  }

  const grouped = GROUP_ORDER.map((status) => ({
    status,
    items: matches.filter((m) => m.status === status).sort((a, b) => b.eligibilityScore - a.eligibilityScore),
  })).filter((g) => g.items.length > 0);

  const semanticUnavailable = matches.every((m) => m.semanticScore === null);

  // Status is genuinely a state, so this is the one place the product's status
  // palette is the correct choice rather than a categorical one. Grey for
  // "likely not eligible" is kept from the badge vocabulary: it is useful
  // information that saves the user time, not a failure on their part.
  const STATUS_SLICE_COLOUR: Record<MatchStatus, string> = {
    POTENTIALLY_ELIGIBLE: STATUS_COLOUR.success,
    NEEDS_INFORMATION: STATUS_COLOUR.warning,
    REVIEW_REQUIRED: STATUS_COLOUR.info,
    LIKELY_NOT_ELIGIBLE: STATUS_COLOUR.neutral,
  };

  const statusSlices: Slice[] = GROUP_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABEL[status],
    value: matches.filter((m) => m.status === status).length,
    colour: STATUS_SLICE_COLOUR[status],
  }));

  // Fixed bands, so the axis does not move as scores change.
  const BANDS: Array<{ key: string; label: string; min: number; max: number }> = [
    { key: 'b80', label: '80-100', min: 80, max: 100 },
    { key: 'b60', label: '60-79', min: 60, max: 79 },
    { key: 'b40', label: '40-59', min: 40, max: 59 },
    { key: 'b20', label: '20-39', min: 20, max: 39 },
    { key: 'b0', label: 'Under 20', min: 0, max: 19 },
  ];
  const scoreBands = BANDS.map((b) => ({
    key: b.key,
    label: b.label,
    value: matches.filter((m) => m.eligibilityScore >= b.min && m.eligibilityScore <= b.max).length,
  }));

  return (
    <div>
      <PageHeader
        title="Recommendations"
        description="Government schemes compared against your profile, with the reasoning behind every result."
        action={
          <Button variant="secondary" loading={recalc.isPending} onClick={() => recalc.mutate()}>
            Recalculate
          </Button>
        }
      />

      {semanticUnavailable && (
        <div className="mb-5 bg-muted-bg border border-line rounded-lg px-4 py-2.5">
          <p className="text-[12px] text-ink-soft leading-relaxed">
            Semantic relevance scoring is not currently available, so these results are computed from the deterministic
            criteria only, with the remaining weights renormalised. No placeholder similarity value has been assumed.
          </p>
        </div>
      )}

      {/* Both charts are computed from the FULL match list this page already
          holds, never from a top-N slice - a ring reads as a complete whole, so
          feeding it partial data would be a lie about the data's shape. */}
      <div className="grid gap-5 lg:grid-cols-2 mb-6">
        <Card variant="feature">
          <CardHeader
            title="How your matches break down"
            description="Every scheme assessed, grouped by what the assessment concluded."
          />
          <Donut
            slices={statusSlices}
            centreValue={matches.length}
            centreLabel={matches.length === 1 ? 'scheme assessed' : 'schemes assessed'}
          />
        </Card>

        <Card>
          <CardHeader
            title="Score distribution"
            description="How many schemes fall in each band. A band is a range of criteria satisfied, not a probability of approval."
          />
          <BarChart bars={scoreBands} />
          <p className="text-[11px] text-ink-faint mt-3 leading-relaxed">
            A high score means your profile satisfies more of the criteria on record. It is not a likelihood of
            approval, and only the issuing authority can determine eligibility.
          </p>
        </Card>
      </div>

      <div className="space-y-6">
        {grouped.map((group) => (
          <Card key={group.status}>
            <CardHeader
              title={`${STATUS_LABEL[group.status]} (${group.items.length})`}
              description={GROUP_DESCRIPTION[group.status]}
              action={<Badge tone={STATUS_TONE[group.status]}>{group.items.length}</Badge>}
            />
            <ul className="divide-y divide-muted-bg">
              {group.items.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
