/**
 * Chart primitives.
 *
 * Hand-rolled inline SVG rather than a charting library: the three forms used
 * here are small, the app ships no chart dependency, and a library would add
 * more bundle than the whole charts directory.
 *
 * FORM IS CHOSEN BY THE DATA'S JOB, NOT BY PREFERENCE
 * ---------------------------------------------------
 *   Part-to-whole, at a glance, <= 6 segments  -> Donut
 *   Compare magnitude across categories        -> BarChart (one hue, sequential)
 *   A single ratio against a limit             -> Meter
 *
 * Two forms are deliberately absent. A two-slice pie is never drawn — that is a
 * stat tile, and the number is the chart. Nor is a donut used to compare close
 * values, because arc lengths at similar sizes are the hardest comparison a
 * reader can be given; `BarChart` is the honest answer there.
 *
 * EVERY CHART HERE PLOTS VALUES IT WAS HANDED
 * -------------------------------------------
 * No primitive derives, estimates, infers or interpolates. If a caller has only
 * part of a dataset it must not pass it to a Donut, because a ring reads as a
 * complete whole whether or not it is one.
 *
 * Colour: text always wears text tokens; the swatch alone carries identity. Every
 * chart renders a legend and a value, so nothing depends on colour alone.
 */
import { useId, useState, type ReactNode } from 'react';

export interface Slice {
  key: string;
  label: string;
  value: number;
  colour: string;
}

/** Sequential indigo ramp, light to dark. For magnitude, never for identity. */
export const SEQUENTIAL = ['#C7CCFF', '#A5B4FC', '#818CF8', '#6366F1', '#4F46E5', '#4338CA'];

/** The product's status palette. Used only where a category genuinely is a state. */
export const STATUS_COLOUR = {
  success: '#047857',
  warning: '#C2410C',
  info: '#4F46E5',
  neutral: '#8481A8',
  danger: '#BE123C',
} as const;

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-28 rounded-lg border border-dashed border-line">
      <p className="text-[12px] text-ink-faint">{message}</p>
    </div>
  );
}

/**
 * Part-to-whole ring.
 *
 * Refuses more than six segments rather than rendering an unreadable ring: past
 * that, adjacent arcs blur and the honest form is a bar or a table. The caller
 * gets a visible message instead of a silently bad chart.
 */
export function Donut({
  slices,
  centreLabel,
  centreValue,
  emptyMessage = 'Nothing to show yet.',
}: {
  slices: Slice[];
  centreLabel?: string;
  centreValue?: string | number;
  emptyMessage?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const titleId = useId();

  const present = slices.filter((s) => s.value > 0);
  const total = present.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) return <EmptyChart message={emptyMessage} />;
  if (present.length > 6) {
    return <EmptyChart message={`${present.length} categories is too many for a ring — shown as a table instead.`} />;
  }

  // Geometry: a stroked circle, each segment a dash offset around it. Cheaper and
  // crisper than arc path maths, and the 2px gap between segments comes free as a
  // dash gap.
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const GAP = present.length > 1 ? 3 : 0;

  let offset = 0;
  const arcs = present.map((s) => {
    const frac = s.value / total;
    const len = Math.max(0, frac * CIRC - GAP);
    const arc = { ...s, len, offset, frac };
    offset += frac * CIRC;
    return arc;
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg
        viewBox="0 0 140 140"
        className="w-[130px] h-[130px] flex-shrink-0 -rotate-90"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {present.map((s) => `${s.label}: ${s.value}`).join('. ')}
        </title>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#F2EFFB" strokeWidth="18" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={a.colour}
            strokeWidth={hovered === a.key ? 21 : 18}
            strokeDasharray={`${a.len} ${CIRC - a.len}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
            className="transition-all duration-150 motion-reduce:transition-none"
            style={{ opacity: hovered && hovered !== a.key ? 0.35 : 1 }}
            onMouseEnter={() => setHovered(a.key)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {(centreValue !== undefined || centreLabel) && (
        <div className="sr-only">
          {centreLabel} {centreValue}
        </div>
      )}

      <ul className="flex-1 min-w-[150px] space-y-1.5">
        {centreValue !== undefined && (
          <li className="pb-1.5 mb-1 border-b border-muted-bg">
            <span className="text-[20px] font-semibold text-ink tabular-nums">{centreValue}</span>
            {centreLabel && <span className="text-[12px] text-ink-faint ml-1.5">{centreLabel}</span>}
          </li>
        )}
        {arcs.map((a) => (
          <li
            key={a.key}
            className="flex items-center gap-2 text-[12px] cursor-default"
            onMouseEnter={() => setHovered(a.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: a.colour }}
              aria-hidden="true"
            />
            <span className={`flex-1 ${hovered === a.key ? 'text-ink' : 'text-ink-soft'}`}>{a.label}</span>
            <span className="text-ink font-medium tabular-nums">{a.value}</span>
            <span className="text-ink-faint tabular-nums w-10 text-right">{Math.round(a.frac * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Omit to take the sequential ramp by position. */
  colour?: string;
  /** Optional note shown under the label. */
  note?: string;
}

/**
 * Horizontal bars for comparing magnitude.
 *
 * Horizontal because the categories here have long names, and a horizontal bar
 * gives the label room without rotating it. One hue by default: these are
 * magnitudes, not identities.
 */
export function BarChart({
  bars,
  max,
  valueSuffix = '',
  emptyMessage = 'Nothing to show yet.',
}: {
  bars: Bar[];
  /** Fixed ceiling. Defaults to the largest value, so bars fill the width. */
  max?: number;
  valueSuffix?: string;
  emptyMessage?: string;
}) {
  if (bars.length === 0) return <EmptyChart message={emptyMessage} />;

  const ceiling = max ?? Math.max(...bars.map((b) => b.value), 1);

  return (
    <ul className="space-y-2.5">
      {bars.map((b, i) => {
        // Zero stays visibly zero rather than being given a token sliver, which
        // would read as "a little" when it means "none".
        const pct = ceiling > 0 ? (b.value / ceiling) * 100 : 0;
        return (
          <li key={b.key} className="group">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[12px] text-ink">{b.label}</span>
              <span className="text-[12px] font-medium text-ink tabular-nums flex-shrink-0">
                {b.value}
                {valueSuffix}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted-bg overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${pct}%`,
                  backgroundColor: b.colour ?? SEQUENTIAL[Math.min(i, SEQUENTIAL.length - 1)],
                }}
              />
            </div>
            {b.note && <p className="text-[11px] text-ink-faint mt-1">{b.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One ratio against a limit.
 *
 * A two-slice pie for this is an anti-pattern, so it is a track with a fill and
 * the two numbers stated outright.
 */
export function Meter({
  label,
  value,
  limit,
  caption,
  tone,
}: {
  label: string;
  value: number;
  limit: number;
  caption?: ReactNode;
  /** Defaults to indigo; pass a status colour where the gap genuinely matters. */
  tone?: string;
}) {
  const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  const complete = limit > 0 && value >= limit;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[12px] text-ink">{label}</span>
        <span className="text-[12px] text-ink tabular-nums flex-shrink-0">
          <span className="font-semibold">{value}</span>
          <span className="text-ink-faint"> / {limit}</span>
        </span>
      </div>
      <div
        className="h-2.5 rounded-full bg-muted-bg overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%`, backgroundColor: tone ?? (complete ? STATUS_COLOUR.success : '#4F46E5') }}
        />
      </div>
      {caption && <p className="text-[11px] text-ink-faint mt-1.5 leading-relaxed">{caption}</p>}
    </div>
  );
}
