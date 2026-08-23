"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseArticleVisibilityTrackerOptions {
  /** Called once an article has been meaningfully in view for `dwellMs`. */
  onDwellSeen: (articleId: string) => void;
  /** Called (debounced) as the "primary" article the user is reading changes. */
  onPositionUpdate: (articleId: string) => void;
  isAlreadySeen: (articleId: string) => boolean;
  dwellMs?: number;
}

/**
 * A single shared IntersectionObserver behind a small per-article API.
 *
 * An article is marked seen only after it has spent real dwell time
 * meaningfully visible in the viewport — being fetched or merely rendered
 * off-screen never marks it seen. The same observer doubles as the signal
 * for "continue where you left off": whichever article currently has the
 * highest visible ratio is treated as the researcher's current reading
 * position and persisted (debounced) for next time.
 */
export function useArticleVisibilityTracker({
  onDwellSeen,
  onPositionUpdate,
  isAlreadySeen,
  dwellMs = 1500,
}: UseArticleVisibilityTrackerOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const dwellTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const visibleRatios = useRef(new Map<string, number>());
  const positionDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the observer instance stable across renders while always calling the
  // latest callback versions (avoids stale-closure bugs without recreating
  // the observer, which would drop in-flight dwell timers).
  const onDwellSeenRef = useRef(onDwellSeen);
  const onPositionUpdateRef = useRef(onPositionUpdate);
  const isAlreadySeenRef = useRef(isAlreadySeen);
  useEffect(() => {
    onDwellSeenRef.current = onDwellSeen;
    onPositionUpdateRef.current = onPositionUpdate;
    isAlreadySeenRef.current = isAlreadySeen;
  });

  useEffect(() => {
    const dwellTimersMap = dwellTimers.current;
    const visibleRatiosMap = visibleRatios.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const articleId = (entry.target as HTMLElement).dataset.articleId;
          if (!articleId) continue;

          if (entry.isIntersecting) {
            visibleRatiosMap.set(articleId, entry.intersectionRatio);

            if (!isAlreadySeenRef.current(articleId) && !dwellTimersMap.has(articleId)) {
              const timer = setTimeout(() => {
                dwellTimersMap.delete(articleId);
                onDwellSeenRef.current(articleId);
              }, dwellMs);
              dwellTimersMap.set(articleId, timer);
            }
          } else {
            visibleRatiosMap.delete(articleId);
            const timer = dwellTimersMap.get(articleId);
            if (timer) {
              clearTimeout(timer);
              dwellTimersMap.delete(articleId);
            }
          }
        }

        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of visibleRatiosMap) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        if (bestId) {
          if (positionDebounceTimer.current) clearTimeout(positionDebounceTimer.current);
          const finalId = bestId;
          positionDebounceTimer.current = setTimeout(() => {
            onPositionUpdateRef.current(finalId);
          }, 700);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-88px 0px -30% 0px" },
    );

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      dwellTimersMap.forEach((timer) => clearTimeout(timer));
      dwellTimersMap.clear();
      visibleRatiosMap.clear();
      if (positionDebounceTimer.current) clearTimeout(positionDebounceTimer.current);
    };
  }, [dwellMs]);

  /** Ref callback factory: `ref={registerCard(article.id)}` on each card's root element. */
  const registerCard = useCallback(
    (articleId: string) => (node: HTMLElement | null) => {
      const observer = observerRef.current;
      if (!node || !observer) return;
      node.dataset.articleId = articleId;
      observer.observe(node);
      return () => {
        observer.unobserve(node);
        const timer = dwellTimers.current.get(articleId);
        if (timer) {
          clearTimeout(timer);
          dwellTimers.current.delete(articleId);
        }
        visibleRatios.current.delete(articleId);
      };
    },
    [],
  );

  return { registerCard };
}
