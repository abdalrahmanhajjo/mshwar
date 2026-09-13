import * as React from "react";
import { cn, focusRing } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-sm text-text",
        "placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
