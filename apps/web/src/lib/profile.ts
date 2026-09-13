export type PreferenceTerm = {
  kind: string;
  slug: string;
  label: string;
};

export type HomeArea = {
  id: string;
  slug: string;
  name: string;
  country_code: string;
};

export type PreferenceValues = {
  source: "explicit";
  home_area_id: string | null;
  default_group_size: number | null;
  activity_intensity: string | null;
  dietary: string[];
  accessibility: string[];
  interests: string[];
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  locale: string;
  preferences: PreferenceValues;
  home_area: HomeArea | null;
};

export type AreaCatalog = {
  source: string;
  picker: string;
  replace_with: string;
  areas: HomeArea[];
};

export type VocabularyCatalog = {
  dietary: PreferenceTerm[];
  accessibility: PreferenceTerm[];
  interest: PreferenceTerm[];
  activity_intensity: PreferenceTerm[];
};

export const EMPTY_PREFERENCES: PreferenceValues = {
  source: "explicit",
  home_area_id: null,
  default_group_size: null,
  activity_intensity: null,
  dietary: [],
  accessibility: [],
  interests: [],
};

export function hydratePreferences(profile: Profile): PreferenceValues {
  return {
    ...EMPTY_PREFERENCES,
    ...profile.preferences,
    home_area_id: profile.preferences.home_area_id ?? profile.home_area?.id ?? null,
    source: "explicit",
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    /* ignore */
  }
  return "authError";
}

export async function fetchProfile(): Promise<Profile> {
  const response = await fetch("/api/v1/profile", { credentials: "include" });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as Profile;
}

export async function saveProfile(input: {
  display_name: string;
  locale: string;
  preferences: PreferenceValues;
}): Promise<Profile> {
  const response = await fetch("/api/v1/profile", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, preferences: { ...input.preferences, source: "explicit" } }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as Profile;
}

export async function fetchAreas(): Promise<AreaCatalog> {
  const response = await fetch("/api/v1/locations/areas", { credentials: "include" });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as AreaCatalog;
}

export async function persistSignedInLocale(locale: string): Promise<void> {
  try {
    const profile = await fetchProfile();
    await saveProfile({
      display_name: profile.display_name,
      locale,
      preferences: hydratePreferences(profile),
    });
  } catch {
    /* Guest or unauthenticated header switches still persist via cookie. */
  }
}

export async function fetchVocabularies(): Promise<VocabularyCatalog> {
  const response = await fetch("/api/v1/profile/vocabularies", { credentials: "include" });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as VocabularyCatalog;
}
