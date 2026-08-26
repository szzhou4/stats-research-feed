/**
 * Low-level fetch wrapper for the OpenAlex REST API.
 *
 * OpenAlex (https://docs.openalex.org) is fully open and requires no API
 * key. Every call in this app is read-only and anonymous. We intentionally
 * do not send a `mailto` polite-pool parameter, since doing so would mean
 * baking a contact address into client-side requests; the app instead
 * relies on OpenAlex's generous no-key rate limits (documented as ~100k
 * requests/day, ~10/second) and keeps its own request volume small via
 * batching and per-journal caching (see `sources.ts`, `works.ts`, `feed.ts`)
 * plus in-flight request de-duplication (below).
 */

const OPENALEX_BASE_URL = "https://api.openalex.org";
const REQUEST_TIMEOUT_MS = 12_000;

export type OpenAlexResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// In-flight request de-duplication: if two callers ask for the exact same
// URL (same path + params) while a request is already in flight, they share
// one network call instead of issuing two. Keyed by the fully-built URL, so
// it's automatically request-shape-aware (different filters/cursors are
// different keys). Cleared as soon as the request settles — this is only
// about coalescing concurrent duplicates, not a result cache (that's
// sources.ts / feed.ts's job, with real TTLs).
const inFlightRequests = new Map<string, Promise<OpenAlexResult<unknown>>>();

/** Dev-only request logging. Gated off in production; kept intentionally (not stripped) as lightweight observability for future debugging of request volume. */
function logRequest(url: URL): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[OpenAlex] GET ${url.pathname}${url.search}`);
}

export async function openAlexGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<OpenAlexResult<T>> {
  const url = new URL(path, OPENALEX_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const key = url.toString();

  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<OpenAlexResult<T>>;

  const requestPromise = performRequest<T>(url);
  inFlightRequests.set(key, requestPromise as Promise<OpenAlexResult<unknown>>);
  requestPromise.finally(() => inFlightRequests.delete(key));
  return requestPromise;
}

async function performRequest<T>(url: URL): Promise<OpenAlexResult<T>> {
  logRequest(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return { ok: false, error: `OpenAlex responded with status ${response.status}` };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "OpenAlex request timed out" };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Unknown network error" };
  } finally {
    clearTimeout(timeout);
  }
}

export interface OpenAlexSourceRecord {
  id: string;
  display_name: string;
  issn_l?: string | null;
  issn?: string[] | null;
}

export interface OpenAlexAuthorship {
  author?: { display_name?: string | null } | null;
}

export interface OpenAlexLocation {
  source?: { id?: string | null; display_name?: string | null } | null;
  landing_page_url?: string | null;
  is_oa?: boolean | null;
}

export interface OpenAlexWorkRecord {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_date?: string | null;
  authorships?: OpenAlexAuthorship[] | null;
  primary_location?: OpenAlexLocation | null;
  open_access?: { is_oa?: boolean | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  /**
   * OpenAlex's canonical work type (post the July 2026 type-classification
   * overhaul): "article", "review", "erratum", "retraction", "preprint",
   * "editorial", "letter", "paratext", etc. Requested and checked defensively
   * (see normalize.ts) even though the API request itself already filters on
   * it, in case a record is missing the field or the upstream filter ever
   * misbehaves.
   */
  type?: string | null;
  /**
   * True if OpenAlex's Retraction Watch-backed data says this work has been
   * retracted. Distinct from type:"retraction", which is the retraction
   * *notice* document itself, not the retracted original work.
   */
  is_retracted?: boolean | null;
}

export interface OpenAlexListResponse<T> {
  results: T[];
  meta: { count: number; next_cursor?: string | null };
}
