/**
 * Low-level fetch wrapper for the OpenAlex REST API.
 *
 * OpenAlex (https://docs.openalex.org) is fully open and requires no API
 * key. Every call in this app is read-only and anonymous. We intentionally
 * do not send a `mailto` polite-pool parameter, since doing so would mean
 * baking a contact address into client-side requests; the app instead
 * relies on OpenAlex's generous no-key rate limits (documented as ~100k
 * requests/day, ~10/second) and keeps its own request volume small via
 * batching and caching (see `sources.ts`, `works.ts`, `cache.ts`).
 */

const OPENALEX_BASE_URL = "https://api.openalex.org";
const REQUEST_TIMEOUT_MS = 12_000;

export type OpenAlexResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function openAlexGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<OpenAlexResult<T>> {
  const url = new URL(path, OPENALEX_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

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
}

export interface OpenAlexListResponse<T> {
  results: T[];
  meta: { count: number; next_cursor?: string | null };
}
