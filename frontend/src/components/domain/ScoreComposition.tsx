/**
 * How a weighted score was composed.
 *
 * The readiness card already shows each component's own 0-100 score. What it
 * could not show is how those five scores ADD UP to the overall figure, which is
 * the question someone actually has when they look at a 92. Each segment's width
 * is that component's `contribution` — the real value the engine computed, never
 * recomputed here — and the segments sum to the overall score, with the shortfall
 * shown as remaining headroom.
 *
 * COLOUR
 * ------
 * Five segments are five identities, not five magnitudes, so the palette is
 * categorical and assigned in fixed order by component key — never cycled, and
 * never reordered by size, so a component keeps its colour as scores change.
 *
 * The hues are validated rather than chosen by eye: all five sit inside the
 * L 0.43-0.77 band, clear the chroma floor, hold ΔE >= 10.3 on the worst adjacent
 * pair under deuteranopia and 11.8 under tritanopia, and exceed 3:1 against the
 * card surface. Both CVD figures clear the >= 8 target, so legibility does not
 * rest on secondary encoding — but keep the 2px gaps and the legend anyway, and
 * re-run scripts/validate_palette.js before substituting any hue.
 *
 * The numbers are NOT printed inside the segments. White 11px text scores only
 * 3.74:1 on the teal and 3.68:1 on the cyan, under the 4.5:1 that size needs, and
 * darkening those two hues to fix it would break the validated palette. The
 * legend below carries every figure instead, which also avoids putting a number
 * on every segment.
 *
 * The status palette (success / warning / danger) is deliberately NOT reused
 * here: those colours mean "state" everywhere else in the product, and a segment
 * is not a state.
 */
import { useId, useState } from 'react';
import type { ReadinessComponent } from '../../types/api';

/** Fixed, validated categorical order. Keyed so a component keeps its hue. */
const SEGMENT_COLOUR: Record<ReadinessComponent['key'], string> = {
  businessProfile: '#4F46E5',
  financialInformation: '#0D9488',
  marketValidation: '#7C3AED',
  teamStrength: '#DB2777',
  proposalQuality: '#0891B2',
};

export function ScoreComposition({
  components,
  overallScore,
}: {
  components: ReadinessComponent[];
  overallScore: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const titleId = useId();

  // The engine's own contributions. Summed rather than assumed to equal the
  // overall score, so a rounding difference shows up as headroom instead of
  // silently distorting every segment.
  const contributed = components.reduce((sum, c) => sum + c.contribution, 0);
  const headroom = Math.max(0, 100 - contributed);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h4 id={titleId} className="text-[12px] font-medium text-ink">
          How this score is composed
        </h4>
        <span className="text-[11px] text-ink-faint tabular-nums">
          {Math.round(contributed)} of 100 earned
        </span>
      </div>

      {/* 2px surface gaps between fills, per the mark spec - they are also the
          secondary encoding the tritanopia floor requires. */}
      <div
        className="flex items-stretch gap-[2px] h-7 rounded-md overflow-hidden bg-muted-bg"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-table`}
      >
        {components.map((c) => {
          if (c.contribution <= 0) return null;
          const dim = hovered !== null && hovered !== c.key;
          return (
            <div
              key={c.key}
              className="relative transition-opacity duration-150 motion-reduce:transition-none first:rounded-l-md"
              style={{
                width: `${c.contribution}%`,
                backgroundColor: SEGMENT_COLOUR[c.key],
                opacity: dim ? 0.35 : 1,
              }}
              onMouseEnter={() => setHovered(c.key)}
              onMouseLeave={() => setHovered(null)}
              title={`${c.name}: ${Math.round(c.contribution)} of a possible ${Math.round(c.weight * 100)}`}
            />
          );
        })}

        {headroom > 0 && (
          <div
            className="bg-line last:rounded-r-md"
            style={{ width: `${headroom}%` }}
            title={`${Math.round(headroom)} points not yet earned`}
          />
        )}
      </div>

      {/* Legend: always present for more than one series, and the text wears text
          tokens while the swatch alone carries identity. */}
      <ul id={`${titleId}-table`} className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {components.map((c) => (
          <li
            key={c.key}
            className="flex items-center gap-1.5 text-[11px] cursor-default"
            onMouseEnter={() => setHovered(c.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: SEGMENT_COLOUR[c.key] }}
              aria-hidden="true"
            />
            <span className={hovered === c.key ? 'text-ink' : 'text-ink-soft'}>{c.name}</span>
            <span className="text-ink-faint tabular-nums">
              {Math.round(c.contribution)}/{Math.round(c.weight * 100)}
            </span>
          </li>
        ))}
        {headroom > 0 && (
          <li className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm bg-line flex-shrink-0" aria-hidden="true" />
            <span className="text-ink-faint">Not yet earned {Math.round(headroom)}</span>
          </li>
        )}
      </ul>

      <p className="text-[11px] text-ink-faint mt-2.5">
        Each component contributes at most its weight. Overall score {overallScore}.
      </p>
    </div>
  );
}
