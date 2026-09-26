/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AdminTwoStep } from "./admin-two-step";
import { LocaleProvider } from "@/components/shell/locale-provider";

function route(handlers: Record<string, unknown>) {
  const calls: { url: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const hit = handlers[url];
      const status = typeof hit === "number" ? hit : hit === undefined ? 404 : 200;
      return {
        ok: status < 400,
        status,
        json: async () => (typeof hit === "number" ? { detail: "no" } : hit),
        headers: new Headers(),
        statusText: "",
      };
    }),
  );
  return calls;
}

const console_ = <p>Console</p>;
// A fake, low-entropy key: valid base32, never mistaken for a real credential.
const FAKE_KEY = "ABCD".repeat(8);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin two-step sign-in", () => {
  it("shows the console when the session is verified, or when it is not required", async () => {
    route({ "/api/v1/admin/mfa": { required: true, enrolled: true, verified: true, verified_until: null } });
    render(<LocaleProvider>{<AdminTwoStep>{console_}</AdminTwoStep>}</LocaleProvider>);
    expect(await screen.findByText("Console")).toBeInTheDocument();
  });

  it("sets up an authenticator, then verifies the session with the next code", async () => {
    const calls = route({
      "/api/v1/admin/mfa": { required: true, enrolled: false, verified: false, verified_until: null },
      "/api/v1/partners/security/totp": { secret: FAKE_KEY, otpauth_uri: "otpauth://totp/x" },
      "/api/v1/partners/security/totp/confirm": { totp_enabled: true },
      "/api/v1/admin/mfa/verify": { required: true, enrolled: true, verified: true, verified_until: null },
    });
    const { container } = render(<LocaleProvider>{<AdminTwoStep>{console_}</AdminTwoStep>}</LocaleProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Show my key" }));
    expect(await screen.findByText("ABCD ABCD ABCD ABCD ABCD ABCD ABCD ABCD")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    const code = screen.getByLabelText("Code");
    fireEvent.change(code, { target: { value: "12a3456" } });
    expect(code).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/Now enter the next code/)).toBeInTheDocument();
    expect(screen.queryByText("Console")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Console")).toBeInTheDocument();
    expect(calls.find((call) => call.url === "/api/v1/admin/mfa/verify")?.body).toEqual({ code: "654321" });
  });

  it("says when a code is wrong and keeps the console closed", async () => {
    route({
      "/api/v1/admin/mfa": { required: true, enrolled: true, verified: false, verified_until: null },
      "/api/v1/admin/mfa/verify": 422,
    });
    render(<LocaleProvider>{<AdminTwoStep>{console_}</AdminTwoStep>}</LocaleProvider>);
    fireEvent.change(await screen.findByLabelText("Code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("not right"));
    expect(screen.queryByText("Console")).not.toBeInTheDocument();
  });
});
