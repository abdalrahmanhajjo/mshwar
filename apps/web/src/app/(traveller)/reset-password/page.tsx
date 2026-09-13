import { Suspense } from "react";
import { RecoveryForm } from "@/components/auth/recovery-form";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <RecoveryForm mode="reset" />
    </Suspense>
  );
}
