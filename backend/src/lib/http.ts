/**
 * Response helpers and async handler wrapper.
 */
import type { Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async handler so a rejected promise reaches Express's error
 * pipeline. Without this, an unawaited rejection would hang the request and
 * bypass `errorHandler` entirely.
 */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

/** Success envelope. Errors use the `{ error: {...} }` shape instead. */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(res: Response, items: T[], meta: PageMeta): void {
  res.status(200).json({ data: items, meta });
}
