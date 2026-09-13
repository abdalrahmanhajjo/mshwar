import * as React from "react";
import { cn, focusRing } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "accent" | "danger" | "success" | "warning" | "outline";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = "default", ...props }, ref) => (
  <span
    className={cn(
      "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-semibold",
      focusRing,
      {
        "border-transparent bg-brand text-brand-foreground": variant === "default",
        "border-transparent bg-surface-sunken text-text": variant === "secondary",
        "border-transparent bg-accent text-accent-foreground": variant === "accent",
        "border-transparent bg-danger text-danger-foreground": variant === "danger",
        "border-transparent bg-success text-success-foreground": variant === "success",
        "border-transparent bg-warning text-warning-foreground": variant === "warning",
        "border-border text-text": variant === "outline",
      },
      className,
    )}
    ref={ref}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
