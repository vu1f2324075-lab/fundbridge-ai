/**
 * Proposal analysis detail.
 *
 * Shows the stored document itself, all eight component scores, the sections
 * detected, and the findings. The scores/narrative split is stated on the page,
 * because a reader is entitled to know which parts a model wrote: the numbers
 * are always deterministic, the prose may be model-phrased.
 *
 * The document and its stored record are shown whether or not the analysis
 * succeeded. An upload whose extraction or analysis failed is still a file the
 * owner put there, and hiding it would make a recoverable failure look like a
 * lost upload.
 */
import { Suspense, lazy } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  LoadingPanel,
  MetricRing,
  PageHeader,
  ScoreBar,
  Spinner,
} from '../../components/ui';
import { ProposalFileRecord } from '../../components/domain/ProposalFileRecord';
import { useAnalyseProposal, useProposal } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatDate, humanise } from '../../utils/format';
import type { ImprovementSuggestion } from '../../types/modules';

/**
 * Loaded on demand.
 *
 * The viewer pulls in pdf.js — roughly 1.4MB of worker plus the library. This
 * is the only page that renders a PDF, so importing it eagerly put that weight
 * into the bundle every other page downloads.
 */
const ProposalFileViewer = lazy(() =>
  import('../../components/domain/ProposalFileViewer').then((m) => ({
    default: m.ProposalFileViewer,
  })),
);

/** Mirrors the viewer's own loading state, so the swap is not jarring. */
function ViewerFallback() {
  return (
    <Card className="flex items-center justify-center py-20">
      <Spinner label="Loading the document viewer…" />
    </Card>
  );
}

const SEVERITY_TONE: Record<ImprovementSuggestion['severity'], 'danger' | 'warning' | 'neutral'> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

const SEVERITY_LABEL: Record<ImprovementSuggestion['severity'], string> = {
  HIGH: 'Address first',
  MEDIUM: 'Worth fixing',
  LOW: 'Minor',
};

export default function ProposalDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useProposal(id);
  const analyse = useAnalyseProposal();

  if (isLoading) return <LoadingPanel label="Loading proposal…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load this proposal.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const proposal = data!.proposal;
  const analysis = proposal.analyses[0];

  const components: Array<[string, number]> = analysis
    ? [
        ['Completeness', analysis.completenessScore],
        ['Funding justification', analysis.fundingJustificationScore],
        ['Financial information', analysis.financialScore],
        ['Market evidence', analysis.marketEvidenceScore],
        ['Clarity', analysis.clarityScore],
        ['Structure', analysis.structureScore],
        ['Team', analysis.teamScore],
      ]
    : [];

  return (
    <div>
      <Link to="/app/proposals" className="text-[13px] text-accent hover:underline inline-flex mb-4">
        ← Back to proposals
      </Link>

      <PageHeader
        title={proposal.originalName}
        description={`${proposal.fileType.toUpperCase()} · ${proposal.wordCount?.toLocaleString('en-IN') ?? '—'} words · uploaded ${formatDate(proposal.createdAt)}`}
        action={
          analysis ? (
            <Button variant="secondary" loading={analyse.isPending} onClick={() => analyse.mutate(id)}>
              Re-analyse
            </Button>
          ) : undefined
        }
      />

      {!analysis ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Not analysed yet"
              description={proposal.statusMessage ?? 'This proposal has not been analysed.'}
            />
            <Button loading={analyse.isPending} onClick={() => analyse.mutate(id)}>
              Analyse now
            </Button>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <ProposalFileRecord proposal={proposal} />
            </div>
            <div className="lg:col-span-2">
              <Suspense fallback={<ViewerFallback />}>
                <ProposalFileViewer proposal={proposal} />
              </Suspense>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <Card variant="feature">
              <p className="text-micro uppercase text-ink-faint">Overall proposal score</p>

              <div className="flex justify-center py-5">
                <MetricRing value={analysis.overallScore} size={160} />
              </div>

              <p className="text-[12px] text-ink-soft mt-1 leading-relaxed">
                Computed from measurable properties of the document: which sections are present, whether claims carry
                figures, and whether the funding request is broken down.
              </p>

              <div className="mt-4 pt-3 border-t border-line">
                <Badge tone={analysis.llmAssisted ? 'info' : 'neutral'}>
                  {analysis.llmAssisted ? 'Findings AI-assisted' : 'Findings deterministic'}
                </Badge>
                <p className="text-[11px] text-ink-soft mt-2 leading-relaxed">
                  {analysis.llmAssisted
                    ? 'A language model phrased the findings below. Every score above was computed by rule — the model cannot change a number.'
                    : 'No language model was involved. Scores and findings were both computed by rule.'}
                </p>
                <p className="text-[11px] text-ink-faint mt-2">
                  {analysis.modelVersion} · {formatDate(analysis.createdAt)}
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Component scores" />
              <div className="space-y-3.5">
                {components.map(([label, score]) => (
                  <ScoreBar key={label} label={label} score={score} />
                ))}
              </div>
            </Card>

            {proposal.sections && Object.keys(proposal.sections).length > 0 && (
              <Card>
                <CardHeader
                  title="Sections detected"
                  description="Found by matching headings against the sections a funding assessor expects."
                />
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(proposal.sections).map((s) => (
                    <Badge key={s} tone="success">
                      {humanise(s)}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            <ProposalFileRecord proposal={proposal} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Suspense fallback={<ViewerFallback />}>
              <ProposalFileViewer proposal={proposal} />
            </Suspense>

            {analysis.missingSections.length > 0 && (
              <Card className="border-warning/30">
                <CardHeader
                  title="Sections not found"
                  description="An assessor who cannot find a section often treats the information as unavailable."
                />
                <div className="flex flex-wrap gap-1.5">
                  {analysis.missingSections.map((s) => (
                    <Badge key={s} tone="warning">
                      {s}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {analysis.improvementSuggestions.length > 0 && (
              <Card>
                <CardHeader
                  title="How to improve this proposal"
                  description="Each suggestion states the issue, the fix, and why it matters."
                />
                <ol className="space-y-5">
                  {analysis.improvementSuggestions.map((s, i) => (
                    <li key={`${s.area}-${i}`} className="border-l-2 border-line pl-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-ink">{s.area}</span>
                        <Badge tone={SEVERITY_TONE[s.severity]}>{SEVERITY_LABEL[s.severity]}</Badge>
                      </div>
                      <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed">{s.issue}</p>
                      <p className="text-[13px] text-ink mt-2 leading-relaxed">
                        <span className="font-medium">Do this: </span>
                        {s.suggestion}
                      </p>
                      <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                        <span className="font-medium">Why: </span>
                        {s.why_it_matters}
                      </p>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 pt-4 border-t border-line">
                  <Link
                    to="/app/assistant"
                    className="text-[13px] font-medium text-accent hover:underline"
                  >
                    Get help drafting a section →
                  </Link>
                </div>
              </Card>
            )}

            {analysis.identifiedStrengths.length > 0 && (
              <Card>
                <CardHeader title="Strengths" />
                <ul className="space-y-2.5">
                  {analysis.identifiedStrengths.map((s) => (
                    <li key={s} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
                      <span className="text-success font-semibold flex-shrink-0" aria-hidden="true">
                        ✓
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {analysis.identifiedWeaknesses.length > 0 && (
              <Card>
                <CardHeader title="Weaknesses" />
                <ul className="space-y-2.5">
                  {analysis.identifiedWeaknesses.map((w) => (
                    <li key={w} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
                      <span className="text-warning font-semibold flex-shrink-0" aria-hidden="true">
                        !
                      </span>
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
