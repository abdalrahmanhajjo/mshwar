import { ApiError } from "@/lib/api/client";
import { interpolate } from "@/i18n/catalogues";
import type { AuthKey } from "@/lib/auth-copy";

type Copy = Record<AuthKey, string>;

/**
 * Turn a failed auth call into words a traveller can act on. Server details
 * never reach the screen; network trouble and rate limits get their own lines.
 */
export function authErrorMessage(
  error: unknown,
  copy: Copy,
  network: "errNetwork" | "errNetworkSignIn" = "errNetwork",
) {
  if (!(error instanceof ApiError)) {
    return copy[network];
  }
  if (error.status === 429 || error.code === "rate_limited") {
    const minutes = error.retryAfter ? Math.ceil(error.retryAfter / 60) : null;
    return minutes && minutes > 1 ? interpolate(copy.errRateLimitedMinutes, { n: minutes }) : copy.errRateLimited;
  }
  if (error.status === 0 || error.status >= 500) {
    return copy[network];
  }
  return copy.errGeneric;
}

export function isRateLimited(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 429 || error.code === "rate_limited");
}

/** A deliberately loose check: the server has the final say on what is a valid address. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Matches the API: RegisterRequest / ResetPasswordRequest require min_length=10, max_length=128. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
