/**
 * UI primitives.
 *
 * Restrained cards, thin borders, professional tables, generous whitespace. The
 * design brief rules out neon, glassmorphism and AI imagery, so nothing here
 * introduces them.
 *
 * Score presentation follows one rule throughout: a score is always shown with
 * the evidence behind it, and anything not yet calculated is shown as such
 * rather than as a zero.
 *
 * Two conventions this file now enforces:
 *
 *  - **Colour comes from tokens, never from a literal.** `text-ink`,
 *    `border-line`, `bg-surface` and so on are defined once in `index.css`.
 *    Pages previously carried 991 hardcoded hex values between them, which is
 *    why the interface drifted out of alignment with itself.
 *  - **Type comes from the scale.** `text-display` down to `text-micro`, each
 *    with a job. Nearly every string used to be 11–15px, so headings never
 *    separated from body text and the eye had nowhere to land.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconAlert, IconChevronRight } from './icons';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted-bg text-ink-soft border-line',
  success: 'bg-success-bg text-success border-success/20',
  warning: 'bg-warning-bg text-warning border-warning/20',
  danger: 'bg-danger-bg text-danger border-danger/20',
  info: 'bg-accent-soft text-accent border-accent/20',
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-accent',
};

// --- Layout ----------------------------------------------------------------

/**
 * A surface.
 *
 * `variant` is the hierarchy control. Everything used to be the same white box
 * with the same border and shadow, so a page's most important panel looked
 * exactly like its least important one.
 *
 *  - `default` — the ordinary case.
 *  - `feature` — the one panel on a page that matters most. Lifted.
 *  - `quiet`   — grouped supporting content. Recedes.
 */
export function Card({
  children,
  className = '',
  padded = true,
  variant = 'default',
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  variant?: 'default' | 'feature' | 'quiet';
}) {
  const variants = {
    default: 'bg-surface border-line shadow-card',
    feature: 'bg-surface border-line shadow-raised',
    quiet: 'bg-muted-bg/60 border-line/70',
  };

  return (
    <div
      className={`border rounded-card ${variants[variant]} ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h2 className="text-section text-ink">{title}</h2>
        {description && (
          <p className="text-small text-ink-soft mt-1 max-w-prose leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/**
 * The heading block at the top of a page.
 *
 * The title is `text-display` rather than the old 20px, because the topbar now
 * also names the page and the two need to be distinguishable: the topbar says
 * where you are, this says what the page is for.
 */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-7">
      <div className="min-w-0">
        {eyebrow && <p className="text-micro uppercase text-accent mb-1.5">{eyebrow}</p>}
        <h1 className="text-display text-ink">{title}</h1>
        {description && (
          <p className="text-body text-ink-soft mt-2 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 pt-1">{action}</div>}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="text-micro uppercase text-ink-faint mb-3">{title}</h3>
      {children}
    </section>
  );
}

// --- Controls --------------------------------------------------------------

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const variants = {
    primary: 'bg-accent-deep text-white hover:bg-navy-light border-transparent shadow-card',
    secondary: 'bg-surface text-ink hover:bg-canvas border-line',
    ghost: 'bg-transparent text-accent hover:bg-accent-soft border-transparent',
    danger: 'bg-surface text-danger hover:bg-danger-bg border-danger/30',
  };
  const sizes = { sm: 'px-3 py-1.5 text-small', md: 'px-4 py-2 text-body' };

  return (
    <button
      type={type}
      onClick={onClick}
      // `loading` disables too, so a slow request cannot be submitted twice.
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium border rounded-control transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <span
          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-micro tracking-normal font-medium border ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

// --- Scores ----------------------------------------------------------------

/** Bands match the readiness categories; see backend config/matching.ts. */
export function scoreTone(score: number): Tone {
  if (score >= 75) return 'success';
  if (score >= 40) return 'warning';
  return 'danger';
}

const TONE_BAR: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-accent',
  neutral: 'bg-ink-faint',
};

const TONE_STROKE: Record<Tone, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-accent)',
  neutral: 'var(--color-ink-faint)',
};

export function ScoreBar({
  score,
  max = 100,
  tone,
  showValue = true,
  label,
  emphasis = false,
}: {
  score: number;
  max?: number;
  tone?: Tone;
  showValue?: boolean;
  label?: string;
  /** Raises this row above its neighbours — for the one component that needs work. */
  emphasis?: boolean;
}) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (score / max) * 100));
  const resolved = tone ?? scoreTone((score / max) * 100);

  return (
    <div>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          {label && (
            <span className={`text-small ${emphasis ? 'font-medium text-ink' : 'text-ink'}`}>
              {label}
            </span>
          )}
          {showValue && (
            <span
              className={`text-small font-semibold tabular-nums ${emphasis ? TONE_TEXT[resolved] : 'text-ink'}`}
            >
              {Math.round(score)}
              <span className="text-ink-faint font-normal">/{max}</span>
            </span>
          )}
        </div>
      )}
      <div
        className={`${emphasis ? 'h-2' : 'h-1.5'} bg-muted-bg rounded-full overflow-hidden`}
        role="meter"
        aria-valuenow={Math.round(score)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Score'}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${TONE_BAR[resolved]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The single headline score on a page, drawn as a ring.
 *
 * The sweep is animated from the real value rather than counted up: the number
 * in the middle is correct on the first frame, so nobody can read a figure off
 * the screen that the system never computed. The ring is decorative — the
 * accessible value is on the text inside it.
 */
export function MetricRing({
  value,
  max = 100,
  caption,
  tone,
  size = 164,
}: {
  value: number;
  max?: number;
  caption?: string;
  tone?: Tone;
  size?: number;
}) {
  const resolved = tone ?? scoreTone((value / max) * 100);
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference * (1 - Math.max(0, Math.min(1, value / max)));

  // Starts empty, then transitions to the real offset once mounted, so the
  // sweep plays without a keyframe tied to a particular radius.
  const [offset, setOffset] = useState(circumference);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const id = requestAnimationFrame(() => setOffset(target));
      return () => cancelAnimationFrame(id);
    }
    setOffset(target);
    return undefined;
  }, [target, circumference]);

  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-muted-bg)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[resolved]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-metric text-ink tabular-nums">{Math.round(value)}</span>
          <span className="text-caption text-ink-faint mt-1">out of {max}</span>
        </div>
      </div>
      {caption && (
        <span className={`mt-3 text-section ${TONE_TEXT[resolved]}`}>{caption}</span>
      )}
    </div>
  );
}

/**
 * Big headline number for a dashboard tile.
 *
 * Passing `to` makes the whole tile a link to wherever that figure is acted on,
 * which is what stops a dashboard being a dead end. `action` still renders a
 * button inside; the two are mutually exclusive in practice, because a link
 * containing a button is neither keyboard- nor screen-reader-sane. When both
 * are given, `action` wins and the tile stays static.
 */
export function StatTile({
  label,
  value,
  caption,
  tone,
  action,
  to,
}: {
  label: string;
  /** A string lets a caller pass "Not calculated yet" instead of a misleading 0. */
  value: string | number;
  caption?: string;
  tone?: Tone;
  action?: ReactNode;
  /** Where this figure is acted on. Makes the tile a link. */
  to?: string;
}) {
  const isNumeric = typeof value === 'number';

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-micro uppercase text-ink-faint">{label}</div>
        {to && !action && (
          <IconChevronRight
            size={15}
            className="text-line-strong group-hover:text-accent transition-colors flex-shrink-0 -mt-0.5"
          />
        )}
      </div>
      <div
        className={
          isNumeric
            ? `mt-2.5 text-[30px] leading-none font-semibold tabular-nums ${tone ? TONE_TEXT[tone] : 'text-ink'}`
            : 'mt-2.5 text-body font-medium leading-snug text-ink-soft'
        }
      >
        {value}
      </div>
      {caption && <div className="mt-2 text-caption text-ink-soft">{caption}</div>}
      {action && <div className="mt-3.5">{action}</div>}
    </>
  );

  if (to && !action) {
    return (
      <Link
        to={to}
        className="group block bg-surface border border-line rounded-card shadow-card p-5 transition-all hover:border-accent/35 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {body}
      </Link>
    );
  }

  return <Card>{body}</Card>;
}

// --- States ----------------------------------------------------------------

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-small text-ink-soft" role="status">
      <span
        className="w-3.5 h-3.5 border-2 border-line-strong border-t-accent rounded-full animate-spin"
        aria-hidden="true"
      />
      {label ?? 'Loading…'}
    </div>
  );
}

export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <Card className="flex items-center justify-center py-14">
      <Spinner label={label} />
    </Card>
  );
}

/**
 * Empty state.
 *
 * Takes an explicit action, because an empty state that only says "nothing
 * here" leaves the user stuck. The illustration slot and the bounded width stop
 * it reading as a small card adrift in an empty page, which is how these
 * previously looked.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="text-center py-14 px-6">
      <div className="max-w-sm mx-auto">
        {icon && (
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto mb-4">
            {icon}
          </div>
        )}
        <h3 className="text-section text-ink">{title}</h3>
        {description && (
          <p className="text-small text-ink-soft mt-2 leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </Card>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-danger/30 bg-danger-bg/40">
      <div className="flex items-start gap-3">
        <IconAlert size={17} className="text-danger flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-small text-ink leading-relaxed">{message}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
              Try again
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Inline form error, rendered as text so untrusted content is never HTML. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-caption text-danger mt-1" role="alert">
      {message}
    </p>
  );
}

// --- Tables ----------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  return (
    // Horizontal scroll is contained here so the page body never scrolls
    // sideways on a narrow screen.
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`text-micro uppercase text-ink-faint pb-2.5 border-b border-line whitespace-nowrap ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={`py-3 text-small text-ink border-b border-muted-bg align-top ${
        align === 'right' ? 'text-right tabular-nums' : ''
      } ${className}`}
    >
      {children}
    </td>
  );
}

// --- Disclaimers -----------------------------------------------------------

/**
 * The product-wide disclaimer.
 *
 * Required wherever a match or score is shown. Styled as quiet supporting text
 * rather than a warning box — the brief asks for security and limitations to be
 * communicated without making the interface frightening.
 */
export function Disclaimer({ text }: { text: string }) {
  return (
    <p className="text-caption text-ink-soft leading-relaxed border-t border-line pt-3 mt-4">
      {text}
    </p>
  );
}

/** Marks a record that is demonstration data, so it can never pass as real. */
export function SyntheticBadge() {
  return (
    <Badge tone="warning">
      <span title="Synthetic demonstration record — not a real government scheme">Demo data</span>
    </Badge>
  );
}
