import { Suspense } from "react";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { ShellMain } from "@/components/shell/app-shell";

export default function CheckoutPage() {
  return (
    <ShellMain>
      <Suspense>
        <CheckoutFlow />
      </Suspense>
    </ShellMain>
  );
}
