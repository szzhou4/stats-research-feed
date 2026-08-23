"use client";

import { useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedValueStore } from "./createPersistedStore";

export interface ReadingPosition {
  articleId: string;
  updatedAt: number;
}

const positionStore = createPersistedValueStore<ReadingPosition | null>(
  STORAGE_KEYS.continueReadingPosition,
  null,
);

/** Tracks roughly where the researcher last stopped browsing, by stable article id. */
export function useContinueReading() {
  const [position, setPosition] = positionStore.useValue();

  const savePosition = useCallback(
    (articleId: string) => setPosition({ articleId, updatedAt: Date.now() }),
    [setPosition],
  );

  const clearPosition = useCallback(() => setPosition(null), [setPosition]);

  return { position, savePosition, clearPosition };
}
