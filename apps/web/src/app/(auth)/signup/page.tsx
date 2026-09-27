import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { loadAuthVisual } from "@/lib/auth-visual";

export default async function SignUpPage() {
  const visual = await loadAuthVisual("signup");
  return (
    <Suspense>
      <AuthForm mode="signup" visual={visual} />
    </Suspense>
  );
}
