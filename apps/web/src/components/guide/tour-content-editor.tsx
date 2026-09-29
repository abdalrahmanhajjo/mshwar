"use client";

import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { interpolate } from "@/i18n/catalogues";
import { ApiError } from "@/lib/api/client";
import type { GuideTour } from "@/lib/guide-work";
import { saveTourContent, type TourFaq } from "@/lib/tour-booking";
import { useToursCopy } from "@/lib/tours-copy";

type Content = { highlights: string[]; faq: TourFaq[]; accessibility: string };

/** Highlights, one per line, as the API takes them: trimmed, no blanks, at most eight. */
export function highlightList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 2)
    .slice(0, 8);
}

/** What the tour page says beyond the listing: highlights, questions and accessibility. */
export function TourContentEditor({ tour }: { tour: GuideTour & { content?: Content } }) {
  const copy = useToursCopy();
  const [highlights, setHighlights] = React.useState((tour.content?.highlights ?? []).join("\n"));
  const [faq, setFaq] = React.useState<TourFaq[]>(tour.content?.faq ?? []);
  const [accessibility, setAccessibility] = React.useState(tour.content?.accessibility ?? "");
  const [pending, setPending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      await saveTourContent(tour.id, {
        highlights: highlightList(highlights),
        faq: faq
          .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
          .filter((item) => item.question.length >= 3 && item.answer.length >= 2),
        accessibility: accessibility.trim(),
      });
      setNotice(copy.contentSaved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-control border border-border-subtle bg-surface p-4" onSubmit={onSubmit}>
      <div className="grid gap-1">
        <h4 className="text-sm font-semibold">{copy.contentTitle}</h4>
        <p className="text-xs text-text-muted">{copy.contentBody}</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-highlights`}>{copy.contentHighlights}</Label>
        <Textarea
          id={`${id}-highlights`}
          rows={4}
          value={highlights}
          onChange={(event) => setHighlights(event.target.value)}
        />
        <p className="text-xs text-text-muted">{copy.contentHighlightsHint}</p>
      </div>
      <fieldset className="grid gap-3">
        <legend className="pb-1 text-sm font-medium">{copy.contentFaq}</legend>
        {faq.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-control border border-border-subtle p-3">
            <div className="flex items-end gap-2">
              <div className="grid flex-1 gap-1">
                <Label htmlFor={`${id}-q-${index}`} className="text-xs">
                  {copy.contentQuestion}
                </Label>
                <Input
                  id={`${id}-q-${index}`}
                  maxLength={200}
                  value={item.question}
                  onChange={(event) =>
                    setFaq(faq.map((row, i) => (i === index ? { ...row, question: event.target.value } : row)))
                  }
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={interpolate(copy.contentRemoveQuestion, { n: String(index + 1) })}
                onClick={() => setFaq(faq.filter((_, i) => i !== index))}
              >
                <X aria-hidden />
              </Button>
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${id}-a-${index}`} className="text-xs">
                {copy.contentAnswer}
              </Label>
              <Textarea
                id={`${id}-a-${index}`}
                rows={2}
                maxLength={1000}
                value={item.answer}
                onChange={(event) =>
                  setFaq(faq.map((row, i) => (i === index ? { ...row, answer: event.target.value } : row)))
                }
              />
            </div>
          </div>
        ))}
        {faq.length < 10 ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFaq([...faq, { question: "", answer: "" }])}
            >
              <Plus aria-hidden />
              {copy.contentAddQuestion}
            </Button>
          </div>
        ) : null}
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-access`}>{copy.contentAccessibility}</Label>
        <Textarea
          id={`${id}-access`}
          rows={3}
          maxLength={1000}
          value={accessibility}
          onChange={(event) => setAccessibility(event.target.value)}
        />
        <p className="text-xs text-text-muted">{copy.contentAccessibilityHint}</p>
      </div>
      {notice ? (
        <Notice tone="success" role="status">
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.contentSave}
        </Button>
      </div>
    </form>
  );
}
