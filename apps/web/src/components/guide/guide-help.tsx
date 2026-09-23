"use client";

import * as React from "react";
import { LifeBuoy, Search } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { GUIDE_HELP, type HelpSection } from "@/lib/guide-help";

/** Keep the sections and answers that mention every word of the query. */
export function filterHelp(sections: HelpSection[], query: string): HelpSection[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return sections;
  }
  return sections
    .map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => {
        const text = `${entry.question} ${entry.answer}`.toLocaleLowerCase();
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.entries.length > 0);
}

/** /guide/help: the guide help centre. */
export function GuideHelp() {
  const { locale } = useLocale();
  const help = GUIDE_HELP[locale];
  const [query, setQuery] = React.useState("");
  const sections = filterHelp(help.sections, query);

  return (
    <div className="grid gap-8">
      <PageHeader icon={<LifeBuoy aria-hidden />} title={help.title} description={help.body} />
      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={help.search}
          placeholder={help.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="ps-10"
        />
      </div>
      {sections.length === 0 ? <p className="text-sm text-text-muted">{help.empty}</p> : null}
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`help-${section.id}`} className="grid gap-3">
          <h2 id={`help-${section.id}`} className="title-section text-[1.2rem]">
            {section.title}
          </h2>
          <div className="grid gap-2">
            {section.entries.map((entry) => (
              <details
                key={entry.id}
                id={entry.id}
                open={Boolean(query)}
                className="group rounded-card border border-border-subtle bg-surface-raised px-4 py-3"
              >
                <summary className="cursor-pointer font-medium">{entry.question}</summary>
                <p className="pt-2 text-sm leading-relaxed text-text-muted">{entry.answer}</p>
                {entry.link ? (
                  <LocaleLink href={entry.link.href} className="mt-2 inline-block text-sm underline">
                    {entry.link.label}
                  </LocaleLink>
                ) : null}
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
