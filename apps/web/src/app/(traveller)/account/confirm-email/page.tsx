import { Suspense } from "react";
import { ConfirmEmailChange } from "@/components/profile/confirm-email-change";
import { ShellMain } from "@/components/shell/app-shell";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return buildMetadata({ title: "Confirm your new email", path: "/account/confirm-email", noindex: true });
}

export default function ConfirmEmailPage() {
  return (
    <ShellMain>
      <Suspense>
        <ConfirmEmailChange />
      </Suspense>
    </ShellMain>
  );
}
