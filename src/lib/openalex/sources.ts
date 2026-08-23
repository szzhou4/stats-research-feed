import { JOURNAL_CATALOG, type JournalDefinition } from "@/lib/journals/catalog";
import { storage } from "@/lib/storage/localStorageAdapter";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { openAlexGet, type OpenAlexListResponse, type OpenAlexSourceRecord } from "./client";

const SOURCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // journal->source mappings barely ever change

export interface SourceResolution {
  /** Maps our internal journal id -> OpenAlex Source ID (e.g. "S154957246"). */
  sourceIdByJournalId: Map<string, string>;
  /** Journal ids the catalog defines but OpenAlex had no matching source for. */
  unresolvedJournalIds: string[];
}

interface CachedSourceMap {
  resolvedAt: number;
  sourceIdByJournalId: Record<string, string>;
  unresolvedJournalIds: string[];
}

function extractShortSourceId(fullId: string): string {
  const match = fullId.match(/[SW]\d+$/i);
  return match ? match[0] : fullId;
}

function normalizeIssn(issn: string): string {
  return issn.trim().toUpperCase();
}

/**
 * Resolves every followed journal's OpenAlex Source ID using ISSNs, the
 * stable identifier OpenAlex recommends over fuzzy title matching. All
 * ISSNs across every requested journal are sent in a single batched
 * `filter=issn:a|b|c` request rather than one call per journal.
 */
export async function resolveJournalSources(
  journals: JournalDefinition[] = JOURNAL_CATALOG,
): Promise<SourceResolution> {
  const cached = readCache(journals);
  if (cached) return cached;

  const issnToJournalId = new Map<string, string>();
  for (const journal of journals) {
    for (const issn of journal.issns) {
      issnToJournalId.set(normalizeIssn(issn), journal.id);
    }
  }

  const allIssns = Array.from(issnToJournalId.keys());
  const sourceIdByJournalId = new Map<string, string>();

  // OpenAlex allows OR-ing many filter values with `|`; chunk defensively in
  // case a future catalog grows large enough to risk URL length limits.
  const ISSN_CHUNK_SIZE = 50;
  for (let i = 0; i < allIssns.length; i += ISSN_CHUNK_SIZE) {
    const chunk = allIssns.slice(i, i + ISSN_CHUNK_SIZE);
    const result = await openAlexGet<OpenAlexListResponse<OpenAlexSourceRecord>>("/sources", {
      filter: `issn:${chunk.join("|")}`,
      "per-page": String(chunk.length),
      select: "id,display_name,issn_l,issn",
    });

    if (!result.ok) {
      // Network/API failure: return whatever we've resolved so far (likely
      // nothing on the first chunk) so callers can fall back to demo data.
      const unresolved = journals.map((j) => j.id).filter((id) => !sourceIdByJournalId.has(id));
      return { sourceIdByJournalId, unresolvedJournalIds: unresolved };
    }

    for (const source of result.data.results) {
      const candidateIssns = [source.issn_l, ...(source.issn ?? [])].filter(
        (issn): issn is string => Boolean(issn),
      );
      for (const issn of candidateIssns) {
        const journalId = issnToJournalId.get(normalizeIssn(issn));
        if (journalId && !sourceIdByJournalId.has(journalId)) {
          sourceIdByJournalId.set(journalId, extractShortSourceId(source.id));
        }
      }
    }
  }

  const unresolvedJournalIds = journals
    .map((journal) => journal.id)
    .filter((id) => !sourceIdByJournalId.has(id));

  writeCache(sourceIdByJournalId, unresolvedJournalIds);
  return { sourceIdByJournalId, unresolvedJournalIds };
}

function readCache(journals: JournalDefinition[]): SourceResolution | null {
  const cached = storage.get<CachedSourceMap | null>(STORAGE_KEYS.openAlexSourceCache, null);
  if (!cached) return null;
  if (Date.now() - cached.resolvedAt > SOURCE_CACHE_TTL_MS) return null;

  const requestedIds = new Set(journals.map((j) => j.id));
  const cachedIds = new Set([
    ...Object.keys(cached.sourceIdByJournalId),
    ...cached.unresolvedJournalIds,
  ]);
  const coversAllRequested = [...requestedIds].every((id) => cachedIds.has(id));
  if (!coversAllRequested) return null;

  return {
    sourceIdByJournalId: new Map(Object.entries(cached.sourceIdByJournalId)),
    unresolvedJournalIds: cached.unresolvedJournalIds,
  };
}

function writeCache(sourceIdByJournalId: Map<string, string>, unresolvedJournalIds: string[]): void {
  const payload: CachedSourceMap = {
    resolvedAt: Date.now(),
    sourceIdByJournalId: Object.fromEntries(sourceIdByJournalId),
    unresolvedJournalIds,
  };
  storage.set(STORAGE_KEYS.openAlexSourceCache, payload);
}
