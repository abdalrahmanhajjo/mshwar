import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

function renderSignIn() {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <AuthForm mode="signin" />
      </AuthProvider>
    </LocaleProvider>,
  );
}

describe("auth form", () => {
  it("submits sign-in and does not include plaintext password in the heading", async () => {
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

    renderSignIn();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-enough-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const signInCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/signin"));
    expect(signInCall?.[1]).toMatchObject({ credentials: "include" });
    expect(screen.queryByText("long-enough-secret")).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("links guests to sign-up", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderSignIn();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup?next=%2F");
    vi.unstubAllGlobals();
  });
});
