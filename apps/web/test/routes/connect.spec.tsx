import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ConnectPage } from "@/routes/connect";
import { useAccounts } from "@/hooks/use-accounts";
import { apiFetch } from "@/lib/api";

vi.mock("@/hooks/use-accounts", () => ({
  useAccounts: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    user: { id: "user-1" },
    loading: false,
    isAuthenticated: true,
  }),
}));

const mockedUseAccounts = vi.mocked(useAccounts);
const mockedApiFetch = vi.mocked(apiFetch);

function renderConnect(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConnectPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAccounts.mockReturnValue({ accounts: [], loading: false, error: null, refetch: vi.fn() });
  });

  it("passes returnTo='onboarding' to ConnectedAccounts when ?from=onboarding is present", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    mockedApiFetch.mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/authorize" });

    const originalLocation = window.location;
    // @ts-expect-error - simplified location mock for this test
    delete window.location;
    window.location = { ...originalLocation, href: "" } as Location;

    renderConnect("/connect?from=onboarding");

    await user.click(screen.getByRole("button", { name: "Conectar YouTube" }));

    expect(mockedApiFetch).toHaveBeenCalledWith("/oauth/youtube/authorize?returnTo=onboarding", {
      token: "test-token",
    });

    window.location = originalLocation;
  });

  it("does not set returnTo when reached without ?from=onboarding", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    mockedApiFetch.mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/authorize" });

    const originalLocation = window.location;
    // @ts-expect-error - simplified location mock for this test
    delete window.location;
    window.location = { ...originalLocation, href: "" } as Location;

    renderConnect("/connect");

    await user.click(screen.getByRole("button", { name: "Conectar YouTube" }));

    expect(mockedApiFetch).toHaveBeenCalledWith("/oauth/youtube/authorize", { token: "test-token" });

    window.location = originalLocation;
  });

  it("shows a success message for a successful callback", () => {
    renderConnect("/connect?success=youtube&accountId=acc-1");

    expect(screen.getByText(/conectada correctamente/)).toBeInTheDocument();
  });

  it("shows an error message for a failed callback", () => {
    renderConnect("/connect?error=access_denied");

    expect(screen.getByText(/Acceso denegado/)).toBeInTheDocument();
  });
});
