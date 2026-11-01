/**
 * Investor matches, with the factor breakdown inline.
 *
 * The vocabulary here is "fit", never "eligibility" — an investor preference is
 * not a rule, so a mismatch is informative rather than disqualifying. The engine
 * emits no blocking issues for this reason, and the UI must not imply any.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  ScoreBar,
} from '../../components/ui';
import { IconMatches } from '../../components/ui/icons';
import {
  useAddToShortlist,
  useInvestorMatches,
  useRecalculateInvestorMatches,
} from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { BarChart, Donut, STATUS_COLOUR, type Slice } from '../../components/charts';
import { formatCurrency, humanise } from '../../utils/format';
import type { FitOutcome, InvestorMatch } from '../../types/modules';

const OUTCOME_LABEL: Record<FitOutcome, string> = {
  MATCH: 'Matches',
  MISMATCH: 'Differs',
  UNSTATED: 'You have not stated',
  UNKNOWN: 'Business has not stated',
};

const OUTCOME_TONE: Record<FitOutcome, 'success' | 'danger' | 'warning' | 'neutral'> = {
  MATCH: 'success',
  MISMATCH: 'danger',
  // Shown neutrally: an unstated preference is an absence of information, not
  // evidence of a good fit.
  UNSTATED: 'neutral',
  UNKNOWN: 'warning',
};

function MatchCard({ match }: { match: InvestorMatch }) {
  const [open, setOpen] = useState(false);
  const shortlist = useAddToShortlist();
  const [added, setAdded] = useState(false);

  const b = match.business;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <Link
            to={`/investor/businesses/${match.businessId}`}
            className="text-[15px] font-medium text-ink hover:text-accent transition-colors"
          >
            {b.businessName}
          </Link>
          <p className="text-[12px] text-ink-soft mt-1">
            {b.industry ?? 'Industry not stated'} · {humanise(b.businessStage)} · {b.location ?? '—'}
            {b.state ? `, ${b.state}` : ''}
          </p>
          <p className="text-[12px] text-ink-soft mt-1">
            Seeking{' '}
            {b.fundingRequirement
              ? `${formatCurrency(b.fundingRequirement.amountRequired, b.fundingRequirement.currency)} for ${b.fundingRequirement.purpose}`
              : 'not stated'}{' '}
            · revenue {b.revenueBand}
          </p>
        </div>

        <div className="flex-shrink-0 w-32">
          <div className="text-right mb-1.5">
            <span className="text-[20px] font-semibold tabular-nums text-ink">
              {match.overallScore}
              <span className="text-ink-faint text-[12px] font-normal">/100</span>
            </span>
            <p className="text-[10px] text-ink-faint uppercase tracking-wider">potential fit</p>
          </div>
          <ScoreBar score={match.overallScore} showValue={false} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Why this score'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={added}
          loading={shortlist.isPending && shortlist.variables?.businessId === match.businessId}
          onClick={async () => {
            try {
              await shortlist.mutateAsync({ businessId: match.businessId });
            } finally {
              setAdded(true);
            }
          }}
        >
          {added ? 'Shortlisted' : 'Shortlist'}
        </Button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-3">
            How the score was formed
          </p>
          <div className="space-y-4">
            {match.explanation.factors.map((f) => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{f.name}</span>
                    <Badge tone={OUTCOME_TONE[f.outcome]}>{OUTCOME_LABEL[f.outcome]}</Badge>
                  </div>
                  <span className="text-[12px] text-ink-soft tabular-nums">
                    {Math.round(f.score * 100)}% × {(f.weight * 100).toFixed(1)}% ={' '}
                    <span className="font-semibold text-ink">{(f.score * f.weight * 100).toFixed(1)} pts</span>
                  </span>
                </div>
                <ScoreBar
                  score={f.score * 100}
                  showValue={false}
                  tone={
                    f.outcome === 'MATCH'
                      ? 'success'
                      : f.outcome === 'UNKNOWN'
                        ? 'warning'
                        : f.outcome === 'UNSTATED'
                          ? 'neutral'
                          : 'danger'
                  }
                />
                <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">{f.reason}</p>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-line">
            <span className="text-[13px] font-semibold text-ink">Total</span>
            <span className="text-[14px] font-semibold tabular-nums text-ink">
              {match.overallScore}
              <span className="text-ink-faint text-[12px] font-normal">/100</span>
            </span>
          </div>

          <p className="text-[11px] text-ink-faint mt-2">{match.modelVersion}</p>
          <Disclaimer text={match.explanation.disclaimer} />
        </div>
      )}
    </Card>
  );
}

export default function InvestorMatchesPage() {
  const { data, isLoading, isError, error, refetch } = useInvestorMatches();
  const recalc = useRecalculateInvestorMatches();

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
        <PageHeader title="Potential fits" />
        <EmptyState
          icon={<IconMatches size={22} />}
          title="No matches calculated yet"
          description="Matching compares each discoverable business against the preferences you have stated, and shows the full factor breakdown for every result."
          action={
            <Button loading={recalc.isPending} onClick={() => recalc.mutate()}>
              Find potential fits
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

  const strong = matches.filter((m) => m.overallScore >= 70);
  const moderate = matches.filter((m) => m.overallScore >= 50 && m.overallScore < 70);
  const weak = matches.filter((m) => m.overallScore < 50);

  const groups = [
    [`Strong fit (${strong.length})`, 'Satisfies most of your stated preferences.', strong],
    [`Moderate fit (${moderate.length})`, 'Satisfies some preferences; read the breakdown.', moderate],
    [`Limited fit (${weak.length})`, 'Few preferences satisfied. Shown so you know why.', weak],
  ] as const;

  // The same three bands the page already groups by, so the chart and the list
  // below it can never disagree.
  const bandSlices: Slice[] = [
    { key: 'strong', label: 'Strong fit', value: strong.length, colour: STATUS_COLOUR.success },
    { key: 'moderate', label: 'Moderate fit', value: moderate.length, colour: STATUS_COLOUR.info },
    { key: 'weak', label: 'Limited fit', value: weak.length, colour: STATUS_COLOUR.neutral },
  ];
  const bandBars = bandSlices.map((b) => ({ key: b.key, label: b.label, value: b.value, colour: b.colour }));

  return (
    <div>
      <PageHeader
        title="Potential fits"
        description="A potential-fit indicator based on your stated preferences. Not an offer, a commitment, or any indication that investment will follow."
        action={
          <Button variant="secondary" loading={recalc.isPending} onClick={() => recalc.mutate()}>
            Recalculate
          </Button>
        }
      />

      {/* Computed from the full match list this page holds, not a top-N slice. */}
      <Card className="mb-6">
        <CardHeader
          title="How your potential fits break down"
          description="Every discoverable business assessed against your stated preferences."
        />
        <div className="grid gap-5 sm:grid-cols-2 items-center">
          <Donut slices={bandSlices} centreValue={matches.length} centreLabel={matches.length === 1 ? 'business assessed' : 'businesses assessed'} />
          <BarChart bars={bandBars} />
        </div>
        <p className="text-[11px] text-ink-faint mt-4 leading-relaxed">
          A band reflects how many of your stated preferences a business satisfies. An unstated preference is scored
          neutrally rather than as a match, so bands widen as you state more.
        </p>
      </Card>

      <div className="space-y-6">
        {groups
          .filter(([, , list]) => list.length > 0)
          .map(([title, description, list]) => (
            <div key={title}>
              <CardHeader title={title} description={description} />
              <div className="space-y-3">
                {list.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
