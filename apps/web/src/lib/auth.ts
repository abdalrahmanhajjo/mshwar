import { securityFetch } from "@/lib/security";
export const SESSION_COOKIE = "mshwar_session";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  locale: string;
  email_verified?: boolean;
  admin_tier?: "ops" | "elevated" | null;
};

export const PROTECTED_PATHS = [
  /^\/plan(?:\/|$)/,
  /^\/saved(?:\/|$)/,
  /^\/trips(?:\/|$)/,
  /^\/favorites(?:\/|$)/,
  /^\/bookings(?:\/|$)/,
  /^\/notifications(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/business(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

export function isProtectedPath(pathname: string): boolean {
  const current = pathname.replace(/^\/(en|ar|fr)(?=\/|$)/, "") || "/";
  return PROTECTED_PATHS.some((pattern) => pattern.test(current));
}

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.admin_tier === "ops" || user?.admin_tier === "elevated";
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await securityFetch("/api/v1/auth/me", { credentials: "include" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthUser;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  display_name: string;
  locale: string;
}): Promise<AuthUser> {
  const response = await securityFetch("/api/v1/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
  return (await response.json()) as AuthUser;
}

export async function signInAccount(input: { email: string; password: string }): Promise<AuthUser> {
  const response = await securityFetch("/api/v1/auth/signin", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
  return (await response.json()) as AuthUser;
}

export async function signOutAccount(): Promise<void> {
  await securityFetch("/api/v1/auth/signout", { method: "POST", credentials: "include" });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await securityFetch("/api/v1/auth/forgot-password", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
}

export async function verifyEmail(token: string): Promise<AuthUser> {
  const response = await securityFetch("/api/v1/auth/verify-email", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
  return (await response.json()) as AuthUser;
}

export async function resendVerification(email?: string): Promise<void> {
  const response = await securityFetch("/api/v1/auth/resend-verification", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(email ? { email } : {}),
  });
  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
}

export async function resetPassword(input: { token: string; password: string }): Promise<AuthUser> {
  const response = await securityFetch("/api/v1/auth/reset-password", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
  return (await response.json()) as AuthUser;
}

async function readAuthError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    /* ignore non-JSON */
  }
  return "authError";
}
