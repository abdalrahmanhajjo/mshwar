"use client";

import * as React from "react";

const STORAGE_KEY = "mshwar_saved_experiences";

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

export function useSavedExperiences() {
  const [slugs, setSlugs] = React.useState<string[]>([]);

  React.useEffect(() => {
    setSlugs(readSaved());
  }, []);

  const has = React.useCallback((slug: string) => slugs.includes(slug), [slugs]);

  const toggle = React.useCallback((slug: string) => {
    setSlugs((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { slugs, has, toggle };
}
