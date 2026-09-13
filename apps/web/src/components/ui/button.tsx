import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, controlSize, focusRing } from "@/lib/utils";

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 rounded-control text-sm font-medium transition-colors duration-quick",
    "disabled:pointer-events-none disabled:opacity-50",
    focusRing,
    controlSize,
  ),
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground hover:bg-brand/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
        outline: "border border-border bg-surface text-text hover:bg-surface-sunken",
        secondary: "bg-surface-sunken text-text hover:bg-surface-sunken/80",
        ghost: "text-text hover:bg-surface-sunken",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2",
        sm: "px-3 text-label",
        lg: "px-8 text-title",
        icon: "size-[var(--layout-min-target)] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
