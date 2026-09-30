/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecurityPanel } from "./security-panel";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { describeDevice } from "@/lib/account-security";
import { SESSION_COOKIES } from "@/lib/auth";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

const SESSIONS = [
  {
    id: "s1",
    created_at: "2026-09-29T08:00:00Z",
    last_seen_at: "2026-09-30T08:00:00Z",
    expires_at: "2026-10-07T08:00:00Z",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
    current: true,
  },
  {
    id: "s2",
    created_at: "2026-09-20T08:00:00Z",
    last_seen_at: "2026-09-21T08:00:00Z",
    expires_at: "2026-09-28T08:00:00Z",
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
    current: false,
  },
];

function route(handlers: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const method = init?.method ?? "GET";
      const key = Object.keys(handlers)
        .filter((pattern) => {
          const [verb, path] = pattern.split(" ");
          return verb === method && url.startsWith(path);
        })
        .sort((a, b) => b.length - a.length)[0];
      return key ? jsonResponse(handlers[key]) : jsonResponse({ detail: "Your current password is not right" }, 403);
    }),
  );
  return calls;
}

describe("sign-in and security settings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names devices and keeps the old cookie name", () => {
    expect(describeDevice(SESSIONS[0].user_agent)).toBe("Chrome · macOS");
    expect(describeDevice(SESSIONS[1].user_agent)).toBe("Safari · iOS");
    expect(describeDevice("")).toBeNull();
    expect(SESSION_COOKIES).toEqual(["__Host-mshwar_session", "mshwar_session"]);
  });

  it("lists sessions and signs one out", async () => {
    const calls = route({
      "GET /api/v1/auth/sessions": SESSIONS,
      "DELETE /api/v1/auth/sessions/s2": { revoked: 1 },
    });
    const { container } = render(wrap(<SecurityPanel />));
    expect(await screen.findByText("Chrome · macOS")).toBeTruthy();
    expect(screen.getByText("This device")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sign out: Safari · iOS/ }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === "DELETE")).toBe(true));
    expect(calls.find((call) => call.init?.method === "DELETE")?.url).toBe("/api/v1/auth/sessions/s2");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("changes the password only when both new ones match", async () => {
    const calls = route({
      "GET /api/v1/auth/sessions": SESSIONS,
      "POST /api/v1/auth/password": { changed: true, sessions_revoked: 1 },
    });
    render(wrap(<SecurityPanel />));
    await screen.findByText("Chrome · macOS");
    fireEvent.change(screen.getByLabelText("Current password", { selector: "#current-password" }), {
      target: { value: "old secret value" },
    });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "cedar trails at dusk" } });
    fireEvent.change(screen.getByLabelText("Repeat the new password"), { target: { value: "cedar trails at noon" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("The two new passwords are different.")).toBeTruthy();
    expect(calls.some((call) => call.url === "/api/v1/auth/password")).toBe(false);

    fireEvent.change(screen.getByLabelText("Repeat the new password"), { target: { value: "cedar trails at dusk" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Password changed. 1 other sessions were signed out.")).toBeTruthy();
    const sent = calls.find((call) => call.url === "/api/v1/auth/password");
    expect(JSON.parse(String(sent?.init?.body))).toEqual({
      current_password: "old secret value",
      new_password: "cedar trails at dusk",
    });
    expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("");
  });

  it("asks the new address to confirm an email change and shows API errors", async () => {
    route({ "GET /api/v1/auth/sessions": SESSIONS });
    render(wrap(<SecurityPanel />));
    await screen.findByText("Chrome · macOS");
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Current password", { selector: "#email-password" }), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send confirmation link" }));
    expect(await screen.findByText("Your current password is not right")).toBeTruthy();
  });
});
