import { Suspense } from "react";
import { RecoveryForm } from "@/components/auth/recovery-form";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <RecoveryForm mode="forgot" />
    </Suspense>
  );
}
