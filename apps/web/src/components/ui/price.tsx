import * as React from "react";
import { cn } from "@/lib/utils";

export interface PriceProps extends React.HTMLAttributes<HTMLParagraphElement> {
  amount: number;
  currency?: string;
  locale?: string;
  estimate?: boolean;
  period?: string;
}

function Price({
  amount,
  currency = "USD",
  locale = "en-US",
  estimate = false,
  period,
  className,
  ...props
}: PriceProps) {
  const formatted = new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);

  return (
    <p className={cn("text-title font-semibold text-text", className)} {...props}>
      <span>{formatted}</span>
      {period ? <span className="text-sm font-normal text-text-muted"> / {period}</span> : null}
      {estimate ? <span className="ms-2 text-label font-medium text-text-muted">Estimate</span> : null}
    </p>
  );
}

export { Price };
