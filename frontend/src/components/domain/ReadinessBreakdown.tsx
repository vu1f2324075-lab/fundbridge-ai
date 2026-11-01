/**
 * Readiness components, expandable.
 *
 * The engine already returns, for every component, the exact fields that would
 * raise it (`missing`). The dashboard used to fetch that and never show it, so a
 * score of 25 told the user they had a problem without telling them what it was.
 * Each row here opens to list those fields and links to the page where they are
 * entered — which is the whole difference between a report and something you can
 * act on.
 *
 * Rows are real buttons with `aria-expanded`, not clickable divs, so keyboard and
 * screen-reader users get the same disclosure. A component with nothing missing
 * has nothing to open and is rendered as plain text rather than as a control that
 * does nothing.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScoreBar } from '../ui';
import type { ReadinessComponent } from '../../types/api';

/**
 * Where each component's inputs are actually entered. This is the "connected"
 * half: a weak score is one click from the form that fixes it.
 */
const FIX_LOCATION: Record<ReadinessComponent['key'], { to: string; label: string }> = {
  businessProfile: { to: '/app/profile', label: 'Edit business profile' },
  financialInformation: { to: '/app/profile', label: 'Edit financials' },
  marketValidation: { to: '/app/profile', label: 'Edit market & traction' },
  teamStrength: { to: '/app/profile', label: 'Edit team' },
  proposalQuality: { to: '/app/proposals', label: 'Go to proposals' },
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`text-ink-faint flex-shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
        open ? 'rotate-90' : ''
      }`}
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ComponentRow({ component }: { component: ReadinessComponent }) {
  const [open, setOpen] = useState(false);
  const fix = FIX_LOCATION[component.key];
  const hasDetail = component.missing.length > 0;

  const header = (
    <>
      <ScoreBar label={`${component.name}  ·  ${Math.round(component.weight * 100)}% weight`} score={component.score} />
      <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">{component.reason}</p>
    </>
  );

  // Nothing missing means nothing to disclose, so this is not made a control.
  if (!hasDetail) {
    return (
      <div className="py-3 first:pt-0">
        {header}
        <p className="text-[11px] text-success mt-1.5">Nothing outstanding on this component.</p>
      </div>
    );
  }

  return (
    <div className="py-3 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full text-left group rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        {header}
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent mt-1.5">
          {open ? 'Hide' : `${component.missing.length} item${component.missing.length > 1 ? 's' : ''} would raise this`}
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <div className="mt-2.5 ml-0.5 pl-3 border-l-2 border-line">
          <ul className="space-y-1">
            {component.missing.map((m) => (
              <li key={m} className="flex items-start gap-2 text-[12px] text-ink">
                <span className="text-warning mt-0.5 flex-shrink-0" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
          <Link
            to={fix.to}
            className="inline-flex items-center gap-1 mt-2.5 text-[12px] font-medium text-accent hover:underline"
          >
            {fix.label}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export function ReadinessBreakdown({ components }: { components: ReadinessComponent[] }) {
  return (
    <div className="divide-y divide-muted-bg">
      {components.map((c) => (
        <ComponentRow key={c.key} component={c} />
      ))}
    </div>
  );
}
