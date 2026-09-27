import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { loadAuthVisual } from "@/lib/auth-visual";

export default async function VerifyEmailPage() {
  const visual = await loadAuthVisual("verify");
  return (
    <Suspense>
      <VerifyEmailForm visual={visual} />
    </Suspense>
  );
}
