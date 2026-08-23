"use client";

import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedIdSetStore } from "./createPersistedStore";

const bookmarksStore = createPersistedIdSetStore(STORAGE_KEYS.bookmarkedArticleIds, []);

/** Optional per-article bookmarking, persisted locally. */
export function useBookmarks() {
  const { ids: bookmarkedArticleIds, has: isBookmarked, toggle: toggleBookmark } = bookmarksStore.useIdSet();

  return { bookmarkedArticleIds, isBookmarked, toggleBookmark };
}
