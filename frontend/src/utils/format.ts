/**
 * Display formatting.
 *
 * Money is shown in Indian numbering (lakh/crore), which is what the users of
 * this product think in. A raw "₹5,000,000" is harder to read at a glance than
 * "₹50.00 L" for this audience.
 */

export function formatCurrency(value: number | null | undefined, currency = 'INR'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  if (currency === 'INR') {
    if (Math.abs(value) >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
    if (Math.abs(value) >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
    return `₹${value.toLocaleString('en-IN')}`;
  }

  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/** Inclusive range, handling an open upper or lower bound. */
export function formatRange(min: number | null, max: number | null, currency = 'INR'): string {
  if (min === null && max === null) return 'Not stated';
  if (min !== null && max === null) return `${formatCurrency(min, currency)} and above`;
  if (min === null && max !== null) return `Up to ${formatCurrency(max, currency)}`;
  return `${formatCurrency(min, currency)} – ${formatCurrency(max, currency)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Turns SCREAMING_SNAKE enum values into readable labels. */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—';
  return `${Math.round(fraction * 100)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-IN');
}

/** Byte count as a short human-readable size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
