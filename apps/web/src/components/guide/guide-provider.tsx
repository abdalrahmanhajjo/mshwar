"use client";

import * as React from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { useGuideWorkCopy } from "@/lib/guide-work-copy";
import { fetchMyGuideProfile, type MyGuideProfile } from "@/lib/guides";

type GuideContextValue = {
  profile: MyGuideProfile | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
};

const GuideContext = React.createContext<GuideContextValue>({
  profile: null,
  loading: true,
  failed: false,
  reload: () => undefined,
});

/** Loads the signed-in guide's profile once for every screen under /guide. */
export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<MyGuideProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void fetchMyGuideProfile()
      .then((next) => {
        if (!cancelled) {
          setProfile(next);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = React.useCallback(() => setVersion((value) => value + 1), []);
  const value = React.useMemo(() => ({ profile, loading, failed, reload }), [profile, loading, failed, reload]);
  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide() {
  return React.useContext(GuideContext);
}

/**
 * The working screens (tours, calendar, requests) exist only for an approved guide.
 * Anyone else is sent back to their application rather than shown an empty tool.
 */
export function ApprovedGuide({ children }: { children: (profile: MyGuideProfile) => React.ReactNode }) {
  const copy = useGuideWorkCopy();
  const { profile, loading, failed } = useGuide();

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-text-muted" role="status" aria-label={copy.saving}>
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.loadError}
      </Notice>
    );
  }
  if (!profile || profile.status !== "approved" || !profile.organization_id) {
    return (
      <EmptyState
        icon={<ShieldCheck aria-hidden />}
        title={copy.notApprovedTitle}
        description={copy.notApprovedBody}
        action={
          <Button asChild>
            <LocaleLink href="/guide">{copy.openApplication}</LocaleLink>
          </Button>
        }
      />
    );
  }
  return <>{children(profile)}</>;
}
