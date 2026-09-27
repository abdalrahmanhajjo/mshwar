import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailForm } from "./verify-email-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { navigationMocks } from "@/test-mocks/next-navigation";

function renderForm() {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <VerifyEmailForm />
      </AuthProvider>
    </LocaleProvider>,
  );
}

const json = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => body,
});

const unverified = { id: "1", email: "ada@example.com", display_name: "Ada", locale: "en", email_verified: false };

describe("verify email form", () => {
  afterEach(() => {
    navigationMocks.search = "";
    vi.unstubAllGlobals();
  });

  it("confirms a token from the query string and says the account is ready", async () => {
    navigationMocks.search = "token=verify-token-value";
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return json(200, { ...unverified, email_verified: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    expect(await screen.findByRole("heading", { name: "Email verified" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your Mshwar account is ready.");
    expect(screen.getByRole("link", { name: /Continue to Mshwar/ })).toHaveAttribute("href", "/");
    const verifyCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/verify-email"));
    expect(String(verifyCall?.[1]?.body)).toContain("verify-token-value");
  });

  it("explains a used or expired link and offers a new one", async () => {
    navigationMocks.search = "token=old-token-value";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/me") ? json(401, {}) : json(400, { detail: "Invalid or expired verification link" }),
      ),
    );
    renderForm();
    expect(
      await screen.findByRole("heading", { name: "This link has expired or was already used" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeInTheDocument();
  });

  it("shows where the link went, the spam reminder, and holds the resend after sending", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes("/me") ? json(200, unverified) : json(200, { ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText(/Check your Spam or Junk folder/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(await screen.findByText("Verification email sent to ada@example.com.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();
    const resendCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/resend-verification")) as
      [string, RequestInit] | undefined;
    expect(JSON.parse(String(resendCall?.[1].body))).toEqual({});
  });

  it("tells an already verified account there is nothing left to do", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(200, { ...unverified, email_verified: true })),
    );
    renderForm();
    expect(await screen.findByRole("heading", { name: "Your email is already verified" })).toBeInTheDocument();
  });

  it("resends for a guest with the same privacy-preserving copy", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes("/me") ? { ok: false, json: async () => ({}) } : json(200, { ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "If this address still needs verification, a new link has been sent.",
      ),
    );
  });
});
