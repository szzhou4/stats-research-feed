/** Central registry of every localStorage key the app uses, namespaced to avoid collisions. */
export const STORAGE_KEYS = {
  followedJournalIds: "stats-feed:followed-journal-ids",
  seenArticleIds: "stats-feed:seen-article-ids",
  /** Timestamp (ms) marking the end of the last distinct visit/session (the "previous visit" baseline). */
  previousVisitAt: "stats-feed:previous-visit-at",
  /** Timestamp (ms) of the most recent activity seen, used to detect when a new session has begun. */
  lastActivityAt: "stats-feed:last-activity-at",
  /** Where the user was last reading, for "continue where you left off". */
  continueReadingPosition: "stats-feed:continue-reading-position",
  firstRunNoticeDismissed: "stats-feed:first-run-dismissed",
  bookmarkedArticleIds: "stats-feed:bookmarked-article-ids",
  openAlexSourceCache: "stats-feed:openalex-source-cache",
  openAlexWorksCache: "stats-feed:openalex-works-cache",
} as const;
