import { AuthShell } from "@/components/auth/auth-shell";

/** Sign-up, sign-in, verification and recovery share a quiet frame without the marketing chrome. */
export default function AuthRoutesLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
