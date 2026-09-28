import type { Faq } from "@/lib/seo/schema";
import { cn } from "@/lib/utils";

/**
 * Questions with their answers on the page (FAQPage data must be visible). Plain
 * headings and paragraphs, so people, screen readers and AI crawlers read the same text.
 */
export function FaqSection({
  id,
  title,
  faqs,
  className,
}: {
  id: string;
  title: string;
  faqs: Faq[];
  className?: string;
}) {
  if (!faqs.length) return null;
  return (
    <section aria-labelledby={id} className={cn("grid gap-6", className)}>
      <h2 id={id} className="title-section">
        {title}
      </h2>
      <div className="grid gap-3">
        {faqs.map((faq) => (
          <div key={faq.question} className="rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
            <h3 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-text">{faq.question}</h3>
            <p className="mt-2 max-w-3xl leading-relaxed text-text-muted">{faq.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
