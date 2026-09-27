import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryForm } from "./recovery-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { navigationMocks } from "@/test-mocks/next-navigation";

function renderRecovery(mode: "forgot" | "reset") {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <RecoveryForm mode={mode} />
      </AuthProvider>
    </LocaleProvider>,
  );
}

const newPassword = () => screen.getByLabelText("New password", { selector: "input" });
const confirmPassword = () => screen.getByLabelText("Confirm new password", { selector: "input" });

describe("recovery form", () => {
  afterEach(() => {
    navigationMocks.search = "";
    vi.unstubAllGlobals();
  });

  it("sends the same success copy after forgot-password and points to spam", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRecovery("forgot");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "If an account exists for this address, a reset link has been sent.",
      ),
    );
    expect(screen.getByText(/Check your Spam or Junk folder/)).toBeInTheDocument();
    // The resend is held back for a while so it cannot be spammed.
    expect(screen.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();
    const forgotCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/forgot-password"));
    expect(forgotCall?.[1]).toMatchObject({ credentials: "include" });
  });

  it("submits a reset token without rendering the new password", async () => {
    navigationMocks.search = "token=reset-token-value";
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRecovery("reset");
    fireEvent.change(newPassword(), { target: { value: "replacement-secret" } });
    fireEvent.change(confirmPassword(), { target: { value: "replacement-secret" } });
    expect(screen.getByText("Passwords match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/reset-password"))).toBe(true),
    );
    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(screen.queryByText("replacement-secret")).not.toBeInTheDocument();
    const resetCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/reset-password"));
    const body = JSON.parse(String(resetCall?.[1]?.body)) as { token: string; password: string };
    expect(body.token).toBe("reset-token-value");
    expect(body).toHaveProperty("password");
  });

  it("stops a mismatch before calling the server, and each field toggles on its own", () => {
    navigationMocks.search = "token=reset-token-value";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    renderRecovery("reset");
    fireEvent.change(newPassword(), { target: { value: "replacement-secret" } });
    fireEvent.change(confirmPassword(), { target: { value: "something-else" } });
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    const showNew = screen.getAllByRole("button", { name: "Show password" })[0];
    fireEvent.click(showNew as HTMLElement);
    expect(newPassword()).toHaveAttribute("type", "text");
    expect(confirmPassword()).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByText("The two passwords don’t match yet.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/reset-password"))).toBe(false);
  });

  it("shows the expired-link state when the reset token is missing", () => {
    navigationMocks.search = "";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderRecovery("reset");
    expect(
      screen.getByRole("heading", { name: "This reset link has expired or was already used" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText("New password", { selector: "input" })).not.toBeInTheDocument();
  });

  it("turns a rejected token into the expired-link state", async () => {
    navigationMocks.search = "token=used-token-value";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/me")
          ? { ok: false, status: 401, json: async () => ({}) }
          : {
              ok: false,
              status: 400,
              headers: new Headers({ "content-type": "application/json" }),
              json: async () => ({ detail: "Invalid or expired reset link" }),
            },
      ),
    );
    renderRecovery("reset");
    fireEvent.change(newPassword(), { target: { value: "replacement-secret" } });
    fireEvent.change(confirmPassword(), { target: { value: "replacement-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(
      await screen.findByRole("heading", { name: "This reset link has expired or was already used" }),
    ).toBeInTheDocument();
  });
});
