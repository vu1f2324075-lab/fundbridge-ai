/**
 * Proposal assistant: section drafting and grounded scheme questions.
 *
 * Two features, both deliberately constrained:
 *
 * - **Drafting** uses only facts the backend holds. Anything a section needs
 *   that is missing is listed for the user to supply, never filled in with a
 *   plausible value.
 * - **Questions** are answered only from retrieved official sources, with
 *   citations. When nothing relevant is retrieved the assistant says so instead
 *   of answering from general knowledge.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  PageHeader,
} from '../../components/ui';
import { useMeta } from '../../hooks/queries';
import { useAskSchemes, useSuggestSection } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatDate, humanise } from '../../utils/format';

const SECTIONS = [
  'executive_summary',
  'problem',
  'solution',
  'market',
  'business_model',
  'competition',
  'traction',
  'team',
  'financials',
  'funding_requirement',
  'use_of_funds',
  'implementation_plan',
  'risks',
] as const;

const EXAMPLE_QUESTIONS = [
  'Which schemes support growth stage technology businesses expanding operations?',
  'What documents are required to apply?',
  'What are the eligibility conditions I should check?',
  'Does any scheme support equipment purchase?',
];

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';

function SectionDrafting() {
  const suggest = useSuggestSection();
  const [section, setSection] = useState<string>('executive_summary');
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    try {
      await suggest.mutateAsync({ section, currentText: currentText.trim() || null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not get suggestions.');
    }
  };

  const result = suggest.data?.suggestion;

  return (
    <Card>
      <CardHeader
        title="Draft a proposal section"
        description="Guidance is always specific to the section. A draft is produced only when a language model is available, and only from facts already on your profile."
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="section" className="block text-[13px] font-medium text-ink mb-1.5">
            Section
          </label>
          <select id="section" value={section} onChange={(e) => setSection(e.target.value)} className={inputClass}>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {humanise(s)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="currentText" className="block text-[13px] font-medium text-ink mb-1.5">
            What you have written so far (optional)
          </label>
          <textarea
            id="currentText"
            rows={4}
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            className={`${inputClass} resize-y`}
            placeholder="Paste your current text and it will be improved rather than replaced."
          />
        </div>

        <Button loading={suggest.isPending} onClick={() => void run()}>
          Get guidance
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorPanel message={error} />
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          {result.llm_note && (
            <div className="bg-muted-bg border border-line rounded-lg px-4 py-2.5">
              <p className="text-[12px] text-ink-soft leading-relaxed">{result.llm_note}</p>
            </div>
          )}

          {result.guidance.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                What this section must cover
              </p>
              <ul className="space-y-2">
                {result.guidance.map((g) => (
                  <li key={g} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
                    <span className="text-accent flex-shrink-0" aria-hidden="true">
                      •
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Listed, never invented. This is the point of the whole feature. */}
          {result.missing_facts.length > 0 && (
            <div className="bg-warning-bg border border-warning/30 rounded-lg p-4">
              <p className="text-[11px] font-semibold text-warning uppercase tracking-wider mb-2">
                Information needed from you
              </p>
              <ul className="space-y-1.5">
                {result.missing_facts.map((f) => (
                  <li key={f} className="text-[13px] text-ink">
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-ink-soft mt-3 leading-relaxed">
                These were not filled in with estimates. Add them to your{' '}
                <Link to="/app/profile" className="text-accent hover:underline">
                  business profile
                </Link>{' '}
                and the draft will include them.
              </p>
            </div>
          )}

          {result.draft && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">Draft</p>
                <Badge tone="info">AI-assisted</Badge>
              </div>
              <div className="bg-canvas border border-line rounded-lg p-4">
                <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">{result.draft}</p>
              </div>
              <p className="text-[12px] text-ink-soft mt-2 leading-relaxed">
                Written from the facts on your profile. Any figure in square brackets is a placeholder for you to
                replace — review every claim before using it.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SchemeQuestions() {
  const ask = useAskSchemes();
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (q: string) => {
    if (q.trim().length < 5) {
      setError('Ask a question of at least five characters.');
      return;
    }
    setError(null);
    try {
      await ask.mutateAsync({ question: q.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not answer that question.');
    }
  };

  const answer = ask.data?.answer;

  return (
    <Card>
      <CardHeader
        title="Ask about government schemes"
        description="Answered only from official source material held in the knowledge base, with citations. If nothing relevant is found, you will be told rather than given an unsourced answer."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(question);
        }}
        className="space-y-3"
      >
        <textarea
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={`${inputClass} resize-y`}
          placeholder="What would you like to know?"
          aria-label="Your question"
        />
        <Button type="submit" loading={ask.isPending}>
          Ask
        </Button>
      </form>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">Examples</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                void run(q);
              }}
              className="text-[12px] text-accent bg-accent-soft border border-accent/20 rounded-md px-2.5 py-1 hover:bg-accent/10 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorPanel message={error} />
        </div>
      )}

      {answer && (
        <div className="mt-6 space-y-4">
          {answer.narrative ? (
            <div className="bg-accent-soft border border-accent/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold text-accent uppercase tracking-wider">Answer</p>
                <Badge tone="info">AI-assisted</Badge>
              </div>
              <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">{answer.narrative}</p>
            </div>
          ) : (
            <div className="bg-muted-bg border border-line rounded-lg p-4">
              <p className="text-[13px] text-ink leading-relaxed">
                {answer.citations.length > 0
                  ? 'No narrative was generated, but the official source extracts below were retrieved for your question. Read them directly.'
                  : 'No official source material matched your question closely enough to answer from.'}
              </p>
              {answer.note && <p className="text-[12px] text-ink-soft mt-2 leading-relaxed">{answer.note}</p>}
            </div>
          )}

          {answer.citations.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                Sources ({answer.citations.length})
              </p>
              <div className="space-y-3">
                {answer.citations.map((c) => (
                  <div key={c.chunkId} className="border border-line rounded-lg p-3.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        {c.schemeId ? (
                          <Link
                            to={`/app/schemes/${c.schemeId}`}
                            className="text-[13px] font-medium text-ink hover:text-accent"
                          >
                            {c.schemeName ?? c.documentTitle}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-medium text-ink">{c.documentTitle}</span>
                        )}
                        <p className="text-[11px] text-ink-soft mt-0.5">
                          Last verified: {formatDate(c.lastVerifiedAt)}
                        </p>
                      </div>
                      <span className="text-[11px] text-ink-soft tabular-nums flex-shrink-0">
                        relevance {(c.similarity * 100).toFixed(0)}%
                      </span>
                    </div>

                    <p className="text-[12px] text-ink-soft mt-2.5 leading-relaxed">{c.excerpt}</p>

                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-[12px] text-accent hover:underline mt-2 break-all"
                    >
                      {c.sourceUrl} ↗
                    </a>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-ink-soft mt-3 leading-relaxed">
                Scheme terms change. Confirm current requirements with the official source before applying.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AssistantPage() {
  const { data: meta } = useMeta();
  const ragAvailable = meta?.features['ragExplanations'] !== false;
  const assistantAvailable = meta?.features['proposalAssistant'] !== false;

  return (
    <div>
      <PageHeader
        title="Proposal assistant"
        description="Help writing your proposal, and answers about government schemes grounded in official sources."
      />

      {!ragAvailable && !assistantAvailable && (
        <div className="mb-5 bg-muted-bg border border-line rounded-lg px-4 py-3">
          <p className="text-[13px] text-ink leading-relaxed">
            Both features need the AI service, which is not currently running. Section guidance below is still specific
            and useful; drafting and question answering are unavailable.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <SectionDrafting />
        <SchemeQuestions />
      </div>
    </div>
  );
}
