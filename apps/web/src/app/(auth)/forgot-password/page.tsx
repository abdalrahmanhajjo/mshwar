import { Suspense } from "react";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { loadAuthVisual } from "@/lib/auth-visual";

export default async function ForgotPasswordPage() {
  const visual = await loadAuthVisual("recover");
  return (
    <Suspense>
      <RecoveryForm mode="forgot" visual={visual} />
    </Suspense>
  );
}
