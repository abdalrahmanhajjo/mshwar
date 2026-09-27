import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { loadAuthVisual } from "@/lib/auth-visual";

export default async function SignInPage() {
  const visual = await loadAuthVisual("signin");
  return (
    <Suspense>
      <AuthForm mode="signin" visual={visual} />
    </Suspense>
  );
}
