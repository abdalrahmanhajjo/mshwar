import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { LEGAL_VERSIONS } from "@/lib/legal/types";
import { navigationMocks } from "@/test-mocks/next-navigation";

function renderForm(mode: "signin" | "signup") {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <AuthForm mode={mode} />
      </AuthProvider>
    </LocaleProvider>,
  );
}

const passwordInput = () => screen.getByLabelText("Password", { selector: "input" });

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  navigationMocks.replace = () => undefined;
});

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

    renderForm("signin");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "long-enough-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const signInCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/signin"));
    expect(signInCall?.[1]).toMatchObject({ credentials: "include" });
    expect(screen.queryByText("long-enough-secret")).not.toBeInTheDocument();
  });

  it("links guests to sign-up and forgot-password", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderForm("signin");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/signup?next=%2F");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  });

  it("shows and hides the password without losing it or submitting", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    renderForm("signin");
    const input = passwordInput();
    fireEvent.change(input, { target: { value: "secret-value-123" } });
    expect(input).toHaveAttribute("type", "password");

    const show = screen.getByRole("button", { name: "Show password" });
    expect(show).toHaveAttribute("type", "button");
    expect(show).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(show);
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("secret-value-123");

    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hide);
    expect(input).toHaveAttribute("type", "password");
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/signin"))).toBe(false);
  });

  it("says the email or password is wrong without saying which", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/me")
          ? jsonResponse(401, {})
          : jsonResponse(401, { detail: "Invalid email or password" }),
      ),
    );
    renderForm("signin");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The email or password you entered is incorrect.");
  });

  it("checks the fields before calling the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    renderForm("signin");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Enter a valid email address/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/signin"))).toBe(false);
  });
});

describe("sign-up consent (MSHWAR-113)", () => {
  function fillSignUp() {
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "long-enough-secret" } });
  }

  it("needs the terms box ticked and never pre-ticks optional consent", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm("signup");
    const terms = screen.getByRole("checkbox", { name: /I agree to the/ });
    expect(terms).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /personalise plans/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /travel ideas and offers/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "terms of service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");

    fillSignUp();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/Please accept the Terms of Service/)).toBeInTheDocument();
    expect(terms).toHaveAttribute("aria-invalid", "true");
    expect(terms).toHaveFocus();
    expect(fetchMock.mock.calls.some((call) => String((call as unknown[])[0]).includes("/register"))).toBe(false);
  });

  it("shows the length rule turning green as the password grows", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderForm("signup");
    expect(screen.getByText("(not yet)")).toBeInTheDocument();
    fireEvent.change(passwordInput(), { target: { value: "long-enough-secret" } });
    expect(screen.getByText("(done)")).toBeInTheDocument();
  });

  it("sends the accepted versions and each optional choice separately, then shows where the link went", async () => {
    const replace = vi.fn();
    navigationMocks.replace = replace;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return jsonResponse(201, { id: "1", email: "ada@example.com", display_name: "Ada", locale: "en" });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm("signup");
    fillSignUp();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /personalise plans/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/register"))).toBe(true));
    const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/register"));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      accept_terms: true,
      policy_versions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
      personalisation_consent: true,
      marketing_consent: false,
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/verify-email?sent=1&next=%2F"));
  });

  it("offers sign-in and reset when the email is already registered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/me")
          ? jsonResponse(401, {})
          : jsonResponse(409, { detail: "An account with this email already exists" }),
      ),
    );
    renderForm("signup");
    fillSignUp();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists.");
    expect(screen.getByRole("link", { name: "Sign in instead" })).toHaveAttribute("href", "/signin?next=%2F");
    expect(screen.getByRole("link", { name: "reset your password" })).toHaveAttribute("href", "/forgot-password");
  });
});
