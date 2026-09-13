"use client";

import * as React from "react";

const STORAGE_KEY = "mshwar_saved_experiences";
const CHANGE_EVENT = "mshwar-saved-experiences";

let cachedRaw = "[]";

function readSaved(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function snapshot(): string {
  const next = JSON.stringify(readSaved());
  if (next !== cachedRaw) {
    cachedRaw = next;
  }
  return cachedRaw;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function writeSaved(next: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedRaw = JSON.stringify(next);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function peekSavedExperiences() {
  return readSaved();
}

export function useSavedExperiences() {
  const raw = React.useSyncExternalStore(subscribe, snapshot, () => "[]");
  const slugs = React.useMemo(() => JSON.parse(raw) as string[], [raw]);

  const has = React.useCallback((slug: string) => slugs.includes(slug), [slugs]);

  const toggle = React.useCallback((slug: string) => {
    const current = readSaved();
    const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
    writeSaved(next);
  }, []);

  return { slugs, has, toggle };
}
