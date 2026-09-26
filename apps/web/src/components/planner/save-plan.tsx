"use client";

import * as React from "react";
import { Bookmark, Check } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchTripSaved, saveTrip } from "@/lib/planner";
import type { PlannerCopy } from "@/lib/planner-copy";

/**
 * A plan is kept in "My trips" only when the traveller saves it and confirms. Until then the planner
 * says it is not saved, and nothing is added to their trips.
 */
export function SavePlan({ tripId, title, copy }: { tripId: string; title: string; copy: PlannerCopy }) {
  // Keyed by trip, so a new plan never shows the previous plan's state.
  const [known, setKnown] = React.useState<{ tripId: string; saved: boolean } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(title);
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const saved = known?.tripId === tripId ? known.saved : null;

  React.useEffect(() => {
    let live = true;
    fetchTripSaved(tripId)
      .then((state) => live && setKnown({ tripId, saved: state.saved }))
      .catch(() => live && setKnown({ tripId, saved: false }));
    return () => {
      live = false;
    };
  }, [tripId]);

  const start = () => {
    setName(title);
    setFailed(false);
    setOpen(true);
  };

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    try {
      const state = await saveTrip(tripId, name.trim() || undefined);
      setKnown({ tripId, saved: state.saved });
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  if (saved === null) return null;
  if (saved) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm" role="status">
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <Check className="size-4" aria-hidden />
          {copy.savedToTrips}
        </span>
        <LocaleLink href={`/trips/${tripId}`} className="underline underline-offset-2">
          {copy.viewInTrips}
        </LocaleLink>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface-sunken/60 p-4">
      <p className="text-sm text-text-muted">{copy.unsavedNote}</p>
      <Button type="button" onClick={start}>
        <Bookmark aria-hidden />
        {copy.savePlan}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? null : setOpen(next))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.savePlanTitle}</DialogTitle>
            <DialogDescription>{copy.savePlanBody}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="save-plan-name">{copy.savePlanName}</Label>
            <Input id="save-plan-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          {failed ? (
            <p className="text-sm text-danger" role="alert">
              {copy.savePlanFailed}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
            <Button type="button" disabled={pending} onClick={() => void confirm()}>
              {copy.savePlanConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
