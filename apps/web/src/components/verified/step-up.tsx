"use client";

import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";
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
import { Notice } from "@/components/ui/notice";
import { ApiError } from "@/lib/api/client";
import { isStepUpError, stepUp } from "@/lib/partners";
import { useVerifiedCopy } from "@/lib/verified-copy";

type Pending = { run: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void };

/**
 * Sensitive changes on a live partner account (a plate, an address, rates) are
 * refused until the partner gives a fresh authenticator code. `withStepUp(fn)`
 * runs fn; if the API asks for a code it opens the dialog, confirms the code and
 * runs fn again. Render `dialog` once in the component.
 */
export function useStepUp() {
  const copy = useVerifiedCopy();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const withStepUp = React.useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    return run().catch((caught: unknown) => {
      if (!isStepUpError(caught)) {
        throw caught;
      }
      return new Promise<T>((resolve, reject) => {
        setCode("");
        setError(null);
        setPending({ run, resolve: resolve as (value: unknown) => void, reject });
      });
    });
  }, []);

  async function confirm() {
    if (!pending) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await stepUp(code);
    } catch (caught) {
      setBusy(false);
      if (caught instanceof ApiError && caught.status === 422) {
        // A wrong or already-used code: the dialog stays open for another try.
        setError(copy.wrongCode);
        return;
      }
      pending.reject(caught);
      setPending(null);
      return;
    }
    try {
      pending.resolve(await pending.run());
    } catch (caught) {
      pending.reject(caught);
    } finally {
      setPending(null);
      setBusy(false);
    }
  }

  function close() {
    pending?.reject(new ApiError("step-up cancelled", 499, null));
    setPending(null);
  }

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" aria-hidden />
            {copy.stepUpTitle}
          </DialogTitle>
          <DialogDescription>{copy.stepUpBody}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="step-up-code">{copy.codeLabel}</Label>
            <Input
              id="step-up-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoFocus
            />
          </div>
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy || code.replace(/\D/g, "").length !== 6}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {copy.stepUpAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { withStepUp, dialog };
}

/** True when a rejection only means the partner closed the code dialog. */
export function isStepUpCancelled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 499;
}
