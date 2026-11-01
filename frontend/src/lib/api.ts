/**
 * API client.
 *
 * Three things this handles that a bare `fetch` would not:
 *
 * 1. **Credentials.** The session is an httpOnly cookie, so every request needs
 *    `credentials: 'include'`. No token is ever read or stored by JavaScript —
 *    that is the point of the httpOnly cookie, and why XSS cannot steal a
 *    session here.
 *
 * 2. **CSRF.** Mutating requests must echo the readable `fb_csrf` cookie in an
 *    `X-CSRF-Token` header. Done centrally so no call site can forget it.
 *
 * 3. **Errors.** The backend returns `{ error: { code, message, details } }`.
 *    That is unpacked into a typed `ApiError` carrying the field errors, so
 *    forms can show messages per input instead of one generic banner.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'CSRF_FAILED'
  | 'PRECONDITION_FAILED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Per-field messages from a VALIDATION_ERROR, keyed by field path. */
  readonly fields: Record<string, string>;
  readonly requestId?: string;

  constructor(options: {
    code: ApiErrorCode;
    message: string;
    status: number;
    fields?: Record<string, string>;
    requestId?: string;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.fields = options.fields ?? {};
    if (options.requestId) this.requestId = options.requestId;
  }

  /** True for errors the user can fix by correcting the form. */
  get isValidation(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  get isAuth(): boolean {
    return this.code === 'UNAUTHENTICATED' || this.code === 'INVALID_CREDENTIALS';
  }
}

/** Reads the readable CSRF cookie the server set at login. */
function readCsrfToken(): string | null {
  const match = /(?:^|;\s*)fb_csrf=([^;]+)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Appended as a query string; null/undefined values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      // Sends the httpOnly session cookie cross-origin (frontend :5173, API
      // :4000). The backend's CORS allowlist permits exactly this origin.
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (err) {
    // A rejected fetch means the request never completed — usually the API is
    // not running. Say that, rather than reporting a server error.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check that the API is running and try again.',
      status: 0,
    });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A non-JSON body from a JSON API means something upstream failed; do not
      // surface raw HTML to the user.
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        message: 'The server returned an unexpected response.',
        status: response.status,
      });
    }
  }

  if (!response.ok) {
    const body = payload as { error?: { code?: string; message?: string; details?: { fields?: Record<string, string> }; requestId?: string } } | null;
    const error = body?.error;
    throw new ApiError({
      code: (error?.code as ApiErrorCode) ?? 'INTERNAL_ERROR',
      message: error?.message ?? 'Something went wrong. Please try again.',
      status: response.status,
      fields: error?.details?.fields ?? {},
      ...(error?.requestId ? { requestId: error.requestId } : {}),
    });
  }

  // Success responses are enveloped as `{ data, meta? }`.
  const body = payload as { data?: T } | null;
  return (body?.data ?? (payload as T)) as T;
}

/** Variant that also returns pagination metadata. */
export async function apiRequestWithMeta<T, M = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: M }> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const response = await fetch(buildUrl(path, options.query), { method, headers, credentials: 'include' });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as { data: T; meta: M; error?: { code?: string; message?: string } }) : null;

  if (!response.ok) {
    throw new ApiError({
      code: (payload?.error?.code as ApiErrorCode) ?? 'INTERNAL_ERROR',
      message: payload?.error?.message ?? 'Something went wrong.',
      status: response.status,
    });
  }
  return { data: payload!.data, meta: payload!.meta };
}

/**
 * Fetches a binary response — a stored proposal file — as a Blob.
 *
 * This exists because a browser-initiated load cannot be used for these files.
 * The app and the API are different origins (`:5173` and `:4000`), and the
 * session cookie is `SameSite`-restricted, so an `<iframe src>`, an
 * `<a href target="_blank">` or a plain `<embed>` would arrive at the server
 * with no cookie and be rejected with a 401. `fetch` with
 * `credentials: 'include'` is the path the CORS allowlist is configured for, so
 * the bytes are pulled here and handed to the viewer or to a download anchor.
 *
 * An error body is still JSON, so failures surface as a normal `ApiError`.
 */
export async function apiBlob(path: string): Promise<{ blob: Blob; filename: string | null }> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), { method: 'GET', credentials: 'include' });
  } catch {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check that the API is running and try again.',
      status: 0,
    });
  }

  if (!response.ok) {
    let message = 'The file could not be loaded.';
    let code: ApiErrorCode = 'INTERNAL_ERROR';
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      if (body.error?.message) message = body.error.message;
      if (body.error?.code) code = body.error.code as ApiErrorCode;
    } catch {
      // A non-JSON error body tells us nothing useful; the default message stands.
    }
    throw new ApiError({ code, message, status: response.status });
  }

  return { blob: await response.blob(), filename: filenameFromDisposition(response) };
}

/**
 * Reads the filename the server chose from `Content-Disposition`.
 *
 * The server already sanitised it, but it is treated as untrusted here anyway:
 * any path separator would make it a traversal attempt rather than a filename,
 * so only the final segment is kept.
 */
function filenameFromDisposition(response: Response): string | null {
  const header = response.headers.get('Content-Disposition');
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!match?.[1]) return null;
  const decoded = decodeURIComponent(match[1].trim());
  const segment = decoded.split(/[/\\]/).pop();
  return segment && segment !== '.' && segment !== '..' ? segment : null;
}

/**
 * Hands a fetched Blob to the browser as a download.
 *
 * The object URL is revoked straight after the click so the blob is not held in
 * memory for the life of the page.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => apiRequest<T>(path, { method: 'GET', ...(query ? { query } : {}) }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
