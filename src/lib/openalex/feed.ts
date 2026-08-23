import type { Article, FeedDataStatus } from "@/lib/types";
import type { JournalDefinition } from "@/lib/journals/catalog";
import { storage } from "@/lib/storage/localStorageAdapter";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { resolveJournalSources } from "./sources";
import { fetchRecentWorksForSources } from "./works";
import { getDemoArticles } from "./demoData";

const RECENT_WINDOW_DAYS = 90;
const WORKS_CACHE_TTL_MS = 20 * 60 * 1000;

export interface FeedResult {
  status: Exclude<FeedDataStatus, "loading">;
  articles: Article[];
  /** Followed journals OpenAlex had no matching source for; still shown, just excluded from fetching. */
  unresolvedJournalIds: string[];
}

interface CachedFeed extends FeedResult {
  cacheKey: string;
  fetchedAt: number;
}

function cacheKeyFor(journalIds: string[]): string {
  return [...journalIds].sort().join(",");
}

export async function getFeedArticles(followedJournals: JournalDefinition[]): Promise<FeedResult> {
  if (followedJournals.length === 0) {
    return { status: "live", articles: [], unresolvedJournalIds: [] };
  }

  const journalIds = followedJournals.map((j) => j.id);
  const cacheKey = cacheKeyFor(journalIds);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const filterToFollowed = (articles: Article[]) => {
    const followedIds = new Set(journalIds);
    return articles.filter((a) => followedIds.has(a.journalId));
  };

  const { sourceIdByJournalId, unresolvedJournalIds } = await resolveJournalSources(followedJournals);

  if (sourceIdByJournalId.size === 0) {
    // OpenAlex was unreachable, or nothing resolved: fall back to demo data.
    return { status: "demo", articles: filterToFollowed(getDemoArticles()), unresolvedJournalIds };
  }

  const journalNameByJournalId = new Map(followedJournals.map((j) => [j.id, j.name]));
  const worksResult = await fetchRecentWorksForSources(
    sourceIdByJournalId,
    journalNameByJournalId,
    RECENT_WINDOW_DAYS,
  );

  if (!worksResult.complete && worksResult.articles.length === 0) {
    return { status: "demo", articles: filterToFollowed(getDemoArticles()), unresolvedJournalIds };
  }

  const result: FeedResult = { status: "live", articles: worksResult.articles, unresolvedJournalIds };
  writeCache(cacheKey, result);
  return result;
}

function readCache(cacheKey: string): FeedResult | null {
  const cached = storage.get<CachedFeed | null>(STORAGE_KEYS.openAlexWorksCache, null);
  if (!cached || cached.cacheKey !== cacheKey) return null;
  if (Date.now() - cached.fetchedAt > WORKS_CACHE_TTL_MS) return null;
  return { status: cached.status, articles: cached.articles, unresolvedJournalIds: cached.unresolvedJournalIds };
}

function writeCache(cacheKey: string, result: FeedResult): void {
  const payload: CachedFeed = { ...result, cacheKey, fetchedAt: Date.now() };
  storage.set(STORAGE_KEYS.openAlexWorksCache, payload);
}
