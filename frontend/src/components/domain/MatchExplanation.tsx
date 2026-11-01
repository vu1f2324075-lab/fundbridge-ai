/**
 * Match explanation — the explainable-AI surface.
 *
 * Renders the engine's explanation object directly. The ordering is deliberate
 * and answers the user's questions in the order they actually ask them:
 *
 *   1. What is the verdict, and what does it mean?
 *   2. What would stop me?            (blocking issues first — most decisive)
 *   3. What is missing?               (actionable by the user)
 *   4. Why did it match?              (supporting evidence)
 *   5. How was the score formed?      (the full arithmetic, nothing hidden)
 *   6. What does the official source say?
 *
 * When a narrative from the language model is present it is shown *above* the
 * structured factors and labelled as AI-phrased — never in place of them. If it
 * is absent the page is complete without it, which is what makes the LLM
 * optional rather than load-bearing.
 */
import { Badge, Card, CardHeader, Disclaimer, ScoreBar } from '../ui';
import { OUTCOME_LABEL, OUTCOME_TONE, STATUS_EXPLANATION, STATUS_LABEL, STATUS_TONE } from './matchStatus';
import type { SchemeMatchExplanation } from '../../types/api';

export default function MatchExplanation({
  explanation,
  narrative,
  modelVersion,
  configVersion,
}: {
  explanation: SchemeMatchExplanation;
  narrative?: string | null;
  modelVersion?: string;
  configVersion?: string | null;
}) {
  const e = explanation;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">Potential relevance</p>
            <div className="flex items-baseline gap-3 mt-1.5">
              <span className="text-[32px] font-semibold tabular-nums leading-none text-ink">
                {e.eligibilityScore}
                <span className="text-ink-faint text-lg font-normal">/100</span>
              </span>
              <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
            </div>
          </div>
        </div>

        <p className="text-[13px] text-ink-soft mt-4 leading-relaxed max-w-prose">{STATUS_EXPLANATION[e.status]}</p>

        {narrative && (
          <div className="mt-4 bg-accent-soft border border-accent/20 rounded-lg p-4">
            <p className="text-[11px] font-semibold text-accent uppercase tracking-wider mb-2">
              AI-assisted summary
            </p>
            <p className="text-[13px] text-ink leading-relaxed">{narrative}</p>
            <p className="text-[11px] text-ink-soft mt-2.5 leading-relaxed">
              Phrased by a language model from the factors below. It cannot change a score or add a requirement.
            </p>
          </div>
        )}
      </Card>

      {/* Blocking issues come first: they override the score, so burying them
          below supporting evidence would be misleading. */}
      {e.blockingIssues.length > 0 && (
        <Card className="border-danger/30">
          <CardHeader
            title="What would stop you"
            description="Conditions this scheme states that your profile does not meet. These override the score above."
          />
          <ul className="space-y-2.5">
            {e.blockingIssues.map((issue) => (
              <li key={issue} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
                <span className="text-danger font-semibold flex-shrink-0" aria-hidden="true">
                  !
                </span>
                {issue}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {e.missingCriteria.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader
            title="Information still needed"
            description="These could not be assessed. Each scores zero until provided, so your score here is a floor rather than a final figure."
          />
          <ul className="space-y-2.5">
            {e.missingCriteria.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
                <span className="text-warning font-semibold flex-shrink-0" aria-hidden="true">
                  ?
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {e.matchedCriteria.length > 0 && (
        <Card>
          <CardHeader title="Why this may fit" description="Criteria your profile satisfies." />
          <ul className="space-y-2.5">
            {e.matchedCriteria.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
                <span className="text-success font-semibold flex-shrink-0" aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="How the score was formed"
          description="Each factor's result, the weight it carries, and the points it contributed. Weights are renormalised over the factors that could be assessed, so they always total 100%."
        />

        <div className="space-y-5">
          {e.factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">{f.name}</span>
                  <Badge tone={OUTCOME_TONE[f.outcome]}>{OUTCOME_LABEL[f.outcome]}</Badge>
                </div>
                <span className="text-[12px] text-ink-soft tabular-nums">
                  {Math.round(f.score * 100)}% × {(f.weight * 100).toFixed(1)}% weight ={' '}
                  <span className="font-semibold text-ink">{(f.score * f.weight * 100).toFixed(1)} pts</span>
                </span>
              </div>
              <ScoreBar
                score={f.score * 100}
                showValue={false}
                tone={f.outcome === 'MATCH' ? 'success' : f.outcome === 'UNKNOWN' ? 'warning' : f.outcome === 'UNRESTRICTED' ? 'neutral' : 'danger'}
              />
              <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">{f.reason}</p>
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between mt-5 pt-4 border-t border-line">
          <span className="text-[13px] font-semibold text-ink">Total</span>
          <span className="text-[15px] font-semibold tabular-nums text-ink">
            {e.eligibilityScore}
            <span className="text-ink-faint text-[12px] font-normal">/100</span>
          </span>
        </div>

        {(modelVersion || configVersion) && (
          <p className="text-[11px] text-ink-faint mt-3">
            {modelVersion && `Model ${modelVersion}`}
            {modelVersion && configVersion && ' · '}
            {configVersion && `weights ${configVersion}`}
          </p>
        )}
      </Card>

      {(e.statedCriteria.length > 0 || e.requiredDocuments.length > 0) && (
        <Card>
          <CardHeader
            title="What the official record states"
            description="Criteria and documents as recorded from the official source — not FundBridge's interpretation."
          />

          {e.statedCriteria.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                Stated eligibility criteria
              </p>
              <ul className="space-y-2">
                {e.statedCriteria.map((c) => (
                  <li key={c} className="text-[13px] text-ink leading-relaxed flex gap-2.5">
                    <span className="text-ink-faint flex-shrink-0" aria-hidden="true">
                      •
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {e.requiredDocuments.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                Required documents
              </p>
              <ul className="space-y-2">
                {e.requiredDocuments.map((doc) => (
                  <li key={doc} className="text-[13px] text-ink leading-relaxed flex gap-2.5">
                    <span className="text-ink-faint flex-shrink-0" aria-hidden="true">
                      •
                    </span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Disclaimer text={e.disclaimer} />
        </Card>
      )}
    </div>
  );
}
