/**
 * Marketing-site primitives.
 *
 * SCOPE
 * -----
 * These are for the public pages only. They draw from the SAME indigo/violet
 * palette as the signed-in application, so the marketing site and the product
 * read as one thing and the handoff at sign-in is not jarring. The values are
 * duplicated here rather than imported from components/ui because the two
 * surfaces have different component shapes; keep them in step by hand.
 *
 * COLOUR
 * ------
 * Indigo ink on a soft violet ground, with indigo as the single accent. Every
 * pair below was measured, not eyeballed:
 *
 *   ink        #161033 on #F5F3FF  16.56:1
 *   secondary  #5C5A7D on #F5F3FF   5.96:1
 *   muted      #6E6A94 on #F5F3FF   4.61:1
 *   accent     #4F46E5 on #FFFFFF   6.29:1
 *   white on accent                 6.29:1
 *   white on deep band #3730A3      9.93:1
 *   body on deep band  #C7CCFF      6.39:1
 *   muted on deep band #A5B4FC      4.98:1
 *
 * All clear the 4.5:1 needed for body text. Re-check with a contrast
 * calculator before changing any of them.
 *
 * ICONS
 * -----
 * Hand-drawn inline SVG rather than an icon package. The project ships no icon
 * dependency, the set needed here is small, and adding one for a handful of
 * glyphs would cost more bundle than the file. They match the stroke weight
 * already used across the application.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const C = {
  ink: '#161033',
  ink2: '#5C5A7D',
  muted: '#6E6A94',
  bg: '#F5F3FF',
  card: '#FFFFFF',
  border: '#E5E1F4',
  borderStrong: '#CDC7E8',
  accent: '#4F46E5',
  accentHover: '#4338CA',
  accentTint: '#EEF0FF',
  accentBorder: '#C7CCFF',
  mint: '#A5B4FC',
} as const;

// --- Motion ----------------------------------------------------------------

/**
 * Reveals a block the first time it scrolls into view.
 *
 * Returns `true` immediately when the visitor has asked for reduced motion, so
 * the content is simply present rather than animating. Also returns `true` if
 * IntersectionObserver is unavailable: content must never be left invisible
 * because an enhancement did not load.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const el = ref.current;
    if (!el) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

/** Fades and lifts its children into view once. */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  /** Milliseconds. Keep small; a long stagger reads as sluggish. */
  delay?: number;
  className?: string;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// --- Layout ----------------------------------------------------------------

export function Section({
  id,
  children,
  className = '',
  tone = 'default',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'raised' | 'deep';
}) {
  const bg =
    tone === 'deep' ? 'bg-accent-deep' : tone === 'raised' ? 'bg-white' : 'bg-canvas';
  return (
    <section
      id={id}
      // scroll-mt clears the sticky header so an anchored heading is not hidden
      // underneath it.
      className={`scroll-mt-20 ${bg} ${className}`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
        onDark ? 'text-brand-glow' : 'text-accent'
      }`}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  onDark = false,
  align = 'left',
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  onDark?: boolean;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`${align === 'center' ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl'}`}>
      {eyebrow && <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>}
      <h2
        className={`mt-3 text-[26px] sm:text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance ${
          onDark ? 'text-white' : 'text-ink'
        }`}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={`mt-4 text-[15px] leading-relaxed ${
            onDark ? 'text-line-accent' : 'text-ink-soft'
          }`}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`bg-white border border-line rounded-2xl shadow-[0_1px_2px_rgba(22,16,51,0.04)] ${
        interactive
          ? 'transition-all duration-200 motion-reduce:transition-none hover:border-line-accent hover:shadow-[0_8px_24px_rgba(22,16,51,0.07)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

// --- Actions ---------------------------------------------------------------

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const btn = {
  primary: `${BTN_BASE} bg-accent text-white px-5 py-3 text-[14px] hover:bg-navy-light shadow-[0_1px_2px_rgba(79,70,229,0.25)] hover:shadow-[0_6px_18px_rgba(79,70,229,0.22)]`,
  primarySm: `${BTN_BASE} bg-accent text-white px-4 py-2 text-[13px] hover:bg-navy-light`,
  secondary: `${BTN_BASE} bg-white text-ink border border-line-strong px-5 py-3 text-[14px] hover:border-ink`,
  secondarySm: `${BTN_BASE} bg-white text-ink border border-line-strong px-4 py-2 text-[13px] hover:border-ink`,
  onDark: `${BTN_BASE} bg-white text-ink px-5 py-3 text-[14px] hover:bg-accent-soft focus-visible:outline-white`,
  onDarkGhost: `${BTN_BASE} border border-white/30 text-white px-5 py-3 text-[14px] hover:bg-white/10 focus-visible:outline-white`,
} as const;

/**
 * A short, plain statement of what the platform does not promise.
 *
 * Present on the hero and beside every result-shaped surface. The product is
 * decision support; a page that implies approval would misrepresent it.
 */
export function TrustNote({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p
      className={`text-[12px] leading-relaxed ${onDark ? 'text-brand-glow' : 'text-ink-faint'}`}
    >
      {children}
    </p>
  );
}

/** Marks a panel as an illustration so it is never mistaken for live data. */
export function IllustrativeTag({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft bg-muted-bg border border-line rounded-full px-2.5 py-1 ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-ink-faint" aria-hidden="true" />
      Illustrative preview
    </span>
  );
}

// --- Icons -----------------------------------------------------------------

type IconProps = { className?: string; size?: number };

function svg(path: ReactNode, { className = '', size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const Icon = {
  bridge: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M2 17V12a10 10 0 0 1 20 0v5" />
        <path d="M2 17h20" />
        <path d="M7 17v-5M12 17V9M17 17v-5" />
      </>,
      p,
    ),
  gauge: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M12 21a9 9 0 1 0-9-9" />
        <path d="M3 12h3M12 3v3M19.5 6.5l-2 2" />
        <path d="M12 12l4-2" />
      </>,
      p,
    ),
  search: (p: IconProps = {}) =>
    svg(
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>,
      p,
    ),
  handshake: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M11 17l2 2a1.4 1.4 0 0 0 2 0l4-4" />
        <path d="M3 10l4-4 4 3 3-1 5 4" />
        <path d="M3 14l3 3" />
      </>,
      p,
    ),
  shield: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M12 3l8 3v6c0 4.2-3.2 7.9-8 9-4.8-1.1-8-4.8-8-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </>,
      p,
    ),
  doc: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </>,
      p,
    ),
  building: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M4 21V7l7-4v18M11 21h9V11l-9-4" />
        <path d="M14 12h2M14 16h2M7 10h1M7 14h1" />
      </>,
      p,
    ),
  trend: (p: IconProps = {}) =>
    svg(
      <>
        <path d="m3 16 5-5 3.5 3.5L21 6" />
        <path d="M15 6h6v6" />
      </>,
      p,
    ),
  layers: (p: IconProps = {}) =>
    svg(
      <>
        <path d="m12 3 9 5-9 5-9-5z" />
        <path d="m3 13 9 5 9-5" />
      </>,
      p,
    ),
  check: (p: IconProps = {}) => svg(<path d="m4 12 5 5L20 6" />, p),
  arrow: (p: IconProps = {}) => svg(<path d="M5 12h14m-6-6 6 6-6 6" />, p),
  chevron: (p: IconProps = {}) => svg(<path d="m9 6 6 6-6 6" />, p),
  external: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M14 4h6v6" />
        <path d="M20 4 10 14" />
        <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </>,
      p,
    ),
  lock: (p: IconProps = {}) =>
    svg(
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>,
      p,
    ),
  menu: (p: IconProps = {}) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, p),
  close: (p: IconProps = {}) => svg(<path d="M6 6l12 12M18 6 6 18" />, p),
  spark: (p: IconProps = {}) =>
    svg(
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      </>,
      p,
    ),
};
