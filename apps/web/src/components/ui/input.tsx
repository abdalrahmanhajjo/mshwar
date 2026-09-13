import * as React from "react";
import { cn, controlSize, focusRing } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-sm text-text",
        "placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        controlSize,
        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
