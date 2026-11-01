/**
 * Serialisation for API responses.
 *
 * Prisma returns `Decimal` objects for money columns. `JSON.stringify` turns
 * those into `{"s":1,"e":6,"d":[3500000]}`, which is both unusable in the
 * frontend and a confusing thing to see in an API. Every money field is
 * converted to a plain number here, at the one boundary where it matters.
 *
 * Decimal(18,2) values are well inside the range where a double is exact to the
 * paisa, so no precision is lost for the amounts this application handles.
 */

/** Anything with Prisma's Decimal shape. */
interface DecimalLike {
  toNumber: () => number;
}

function isDecimal(value: unknown): value is DecimalLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as DecimalLike).toNumber === 'function'
  );
}

export function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (isDecimal(value)) return value.toNumber();
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Recursively converts Decimal values to numbers, leaving everything else
 * untouched. Dates are preserved so `res.json` can render them as ISO strings.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (isDecimal(value)) return value.toNumber() as unknown as T;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T;

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out as T;
  }

  return value;
}
