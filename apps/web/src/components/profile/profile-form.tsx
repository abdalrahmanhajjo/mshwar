"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { LOCALES, LOCALE_LABELS, withLocalePrefix, type Locale } from "@/lib/locale";
import {
  EMPTY_PREFERENCES,
  fetchAreas,
  fetchProfile,
  fetchVocabularies,
  hydratePreferences,
  persistSignedInLocale,
  saveProfile,
  type HomeArea,
  type PreferenceTerm,
  type PreferenceValues,
  type VocabularyCatalog,
} from "@/lib/profile";

function toggleSlug(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug];
}

function ChipGroup({
  legend,
  terms,
  selected,
  onToggle,
}: {
  legend: string;
  terms: PreferenceTerm[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-text">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {terms.map((term) => {
          const on = selected.includes(term.slug);
          return (
            <button
              key={term.slug}
              type="button"
              aria-pressed={on}
              className={`rounded-control border px-3 py-2 text-sm min-h-[var(--layout-min-target)] ${
                on ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface-raised text-text"
              }`}
              onClick={() => onToggle(term.slug)}
            >
              {term.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProfileForm() {
  const { t, setLocale } = useLocale();
  const { refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/settings";
  const [displayName, setDisplayName] = React.useState("");
  const [locale, setLocaleState] = React.useState<Locale>("en");
  const [prefs, setPrefs] = React.useState<PreferenceValues>(EMPTY_PREFERENCES);
  const [areas, setAreas] = React.useState<HomeArea[]>([]);
  const [vocab, setVocab] = React.useState<VocabularyCatalog | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchProfile(), fetchAreas(), fetchVocabularies()])
      .then(([profile, catalog, vocabulary]) => {
        if (cancelled) {
          return;
        }
        setDisplayName(profile.display_name);
        setLocaleState(profile.locale as Locale);
        setPrefs(hydratePreferences(profile));
        setAreas(catalog.areas);
        setVocab(vocabulary);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("authError"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const next = await saveProfile({
        display_name: displayName,
        locale,
        preferences: { ...prefs, source: "explicit" },
      });
      setPrefs(hydratePreferences(next));
      setLocale(locale);
      router.push(withLocalePrefix(locale, pathname));
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("authError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={(event) => void onSubmit(event)}>
      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
          <CardDescription>{t("profileHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="display-name">{t("displayName")}</Label>
            <Input
              id="display-name"
              name="display_name"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="language">{t("language")}</Label>
            <Select
              value={locale}
              onValueChange={(value) => {
                const next = value as Locale;
                setLocaleState(next);
                setLocale(next);
                router.push(withLocalePrefix(next, pathname));
                void persistSignedInLocale(next);
              }}
            >
              <SelectTrigger id="language" aria-label={t("language")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LOCALE_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="home-area">{t("homeArea")}</Label>
            {areas.length > 0 ? (
              <Select
                value={prefs.home_area_id ?? "none"}
                onValueChange={(value) =>
                  setPrefs((current) => ({ ...current, home_area_id: value === "none" ? null : value }))
                }
              >
                <SelectTrigger id="home-area" aria-label={t("homeArea")}>
                  <SelectValue placeholder={t("notSet")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("notSet")}</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-text-muted">{t("notSet")}</p>
            )}
            <p className="text-xs text-text-muted">{t("homeAreaStub")}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="group-size">{t("groupSize")}</Label>
            <Input
              id="group-size"
              name="default_group_size"
              type="number"
              min={1}
              max={20}
              value={prefs.default_group_size ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                setPrefs((current) => ({
                  ...current,
                  default_group_size: raw === "" ? null : Number(raw),
                }));
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("preferences")}</CardTitle>
          <CardDescription>{t("preferencesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-text-muted">{t("explicitOnly")}</p>
          {vocab ? (
            <>
              <ChipGroup
                legend={t("dietary")}
                terms={vocab.dietary}
                selected={prefs.dietary}
                onToggle={(slug) => setPrefs((current) => ({ ...current, dietary: toggleSlug(current.dietary, slug) }))}
              />
              <ChipGroup
                legend={t("accessibility")}
                terms={vocab.accessibility}
                selected={prefs.accessibility}
                onToggle={(slug) =>
                  setPrefs((current) => ({ ...current, accessibility: toggleSlug(current.accessibility, slug) }))
                }
              />
              <div className="grid gap-2">
                <Label htmlFor="intensity">{t("activityIntensity")}</Label>
                <Select
                  value={prefs.activity_intensity ?? "none"}
                  onValueChange={(value) =>
                    setPrefs((current) => ({
                      ...current,
                      activity_intensity: value === "none" ? null : value,
                    }))
                  }
                >
                  <SelectTrigger id="intensity" aria-label={t("activityIntensity")}>
                    <SelectValue placeholder={t("notSet")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("notSet")}</SelectItem>
                    {vocab.activity_intensity.map((term) => (
                      <SelectItem key={term.slug} value={term.slug}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ChipGroup
                legend={t("interests")}
                terms={vocab.interest}
                selected={prefs.interests}
                onToggle={(slug) =>
                  setPrefs((current) => ({ ...current, interests: toggleSlug(current.interests, slug) }))
                }
              />
            </>
          ) : null}
          <p className="text-sm text-text-muted">{t("nextPlanUsesDefaults")}</p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="text-sm text-text">
              {t("profileSaved")}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {t("saveProfile")}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
