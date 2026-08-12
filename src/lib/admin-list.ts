/**
 * Bounds for the admin list endpoints.
 *
 * `/api/admin/orders`, `/api/admin/contacts` and `/api/admin/lease-inquiries`
 * each did `.find({}).sort({ createdAt: -1 })` over the whole collection,
 * hydrated and unbounded. That is an in-memory sort once the collection
 * outgrows the index, and it fails outright at Mongo's 32 MB sort limit.
 *
 * The response stays a plain array so the existing admin tables keep working.
 * The cap is therefore not silent: the total is returned in `X-Total-Count`
 * and a truncated response is marked with `X-Result-Truncated`, so a caller —
 * or a future paginated table — can tell that rows were left behind.
 */
export const ADMIN_LIST_MAX = 500;

/** Clamp a caller-supplied `?limit=`, tolerating junk. */
export function adminListLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return ADMIN_LIST_MAX;
  return Math.min(n, ADMIN_LIST_MAX);
}

/** Headers describing what the bounded query left out. */
export function adminListHeaders(total: number, returned: number): HeadersInit {
  return {
    "X-Total-Count": String(total),
    "X-Result-Truncated": String(returned < total),
  };
}
