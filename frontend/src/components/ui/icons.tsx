/**
 * Icon set.
 *
 * These replace the unicode glyphs the navigation previously used (`⊞`, `◎`,
 * `₹`, `◈`, `♡`). Those were a real defect rather than a stylistic one: a glyph
 * resolves to whatever font on the user's machine happens to contain it, so the
 * icons rendered at different weights and baselines on different platforms and
 * some fell back to a missing-character box. A drawn path renders identically
 * everywhere.
 *
 * All icons share one grid and one stroke treatment so a row of them reads as a
 * set: 24×24 viewBox, 1.6 stroke, round caps and joins, `currentColor`. They
 * are decorative wherever a text label sits beside them, so they are
 * `aria-hidden` by default; pass a `title` only when an icon is the sole
 * content of a control.
 */
import type { SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Pixel size for both dimensions. */
  size?: number;
  /** Accessible name. Omit when a visible text label is adjacent. */
  title?: string;
}

function Svg({ size = 18, title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="4.5" rx="1.5" />
    <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Svg>
);

export const IconBusiness = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9.5 21v-5h5v5" />
    <path d="M9.5 10.5h.01M14.5 10.5h.01" />
  </Svg>
);

export const IconRupee = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10" />
    <path d="M7 9h10" />
    <path d="M14.5 4c0 3.2-2.3 5-5.5 5h-2l8.5 11" />
  </Svg>
);

export const IconReadiness = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 8.5 6.1" strokeWidth={2.6} />
    <path d="M12 8v4l2.5 2" />
  </Svg>
);

export const IconSchemes = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11l1.8 2.2h5.7A1.5 1.5 0 0 1 20 7.7v10.8A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5Z" />
    <path d="M8 13h8M8 16.5h5" />
  </Svg>
);

export const IconRecommend = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.5 2.6 5.4 5.9.84-4.25 4.17 1 5.89L12 17.02l-5.25 2.78 1-5.89L3.5 9.74l5.9-.84Z" />
  </Svg>
);

export const IconDocument = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a1.6 1.6 0 0 0-1.6 1.6v14.8A1.6 1.6 0 0 0 7 21h10a1.6 1.6 0 0 0 1.6-1.6V7.6Z" />
    <path d="M14 3v4.6h4.6" />
    <path d="M9 12.5h6M9 16h4" />
  </Svg>
);

export const IconAssistant = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.5a6.5 6.5 0 0 1-6.5 6.5H8l-4 2.5V9.5A6.5 6.5 0 0 1 10.5 3h3A6.5 6.5 0 0 1 20 9.5Z" />
    <path d="M9 10.5h6M9 14h3.5" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Svg>
);

export const IconActionPlan = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5h10M9 12h10M9 19h10" />
    <path d="m3 4.6 1.4 1.4L7 3.4M3 11.6 4.4 13 7 10.4M3 18.6 4.4 20 7 17.4" />
  </Svg>
);

export const IconSaved = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.5 4.8 13.1a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l.7.7.7-.7a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5Z" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.2 14.4a1.5 1.5 0 0 0 .3 1.65l.05.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.91 1.37V20a1.8 1.8 0 0 1-3.6 0v-.1a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.06.06a1.8 1.8 0 1 1-2.55-2.55l.06-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.91H4a1.8 1.8 0 0 1 0-3.6h.1a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.06a1.8 1.8 0 1 1 2.55-2.55l.06.06a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .91-1.37V4a1.8 1.8 0 0 1 3.6 0v.1a1.5 1.5 0 0 0 .91 1.37 1.5 1.5 0 0 0 1.65-.3l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.91H20a1.8 1.8 0 0 1 0 3.6h-.1a1.5 1.5 0 0 0-1.37.91Z" />
  </Svg>
);

export const IconDiscover = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8" />
  </Svg>
);

export const IconMatches = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="4" />
    <circle cx="16" cy="16" r="4" />
    <path d="M11.2 11.2 8 8M12.8 12.8 16 16" />
  </Svg>
);

export const IconPreferences = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="10" cy="17" r="2.2" />
  </Svg>
);

export const IconDataQuality = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
  </Svg>
);

export const IconScales = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v16M7 20h10M12 6 5 8.5M12 6l7 2.5" />
    <path d="M2.5 14.5a2.5 2.5 0 0 0 5 0L5 8.5Z" />
    <path d="M16.5 14.5a2.5 2.5 0 0 0 5 0L19 8.5Z" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 14.6A6 6 0 0 1 21 20" />
  </Svg>
);

export const IconAudit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h14v16H5z" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </Svg>
);

export const IconKnowledge = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
    <path d="M18 16H5.5A1.5 1.5 0 0 0 4 17.5" />
    <path d="M8 8.5h6" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 9 7 7 7-7" />
  </Svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 5-7 7 7 7" />
  </Svg>
);

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 18.5V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 8.5v4.5M12 16.5h.01" />
    <circle cx="12" cy="12" r="9" />
  </Svg>
);

export const IconSignOut = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 20H6a1.6 1.6 0 0 1-1.6-1.6V5.6A1.6 1.6 0 0 1 6 4h8" />
    <path d="M16 15.5 20 12l-4-3.5M20 12H9.5" />
  </Svg>
);
