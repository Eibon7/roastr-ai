import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireOnboarding } from "@/components/auth/RequireOnboarding";
import { apiFetch } from "@/lib/api";

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

const mockedApiFetch = vi.mocked(apiFetch);

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={<RequireOnboarding><div>DASHBOARD CONTENT</div></RequireOnboarding>}
        />
        <Route path="/onboarding" element={<div>ONBOARDING WIZARD</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while checking onboarding status", () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    renderGuarded();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("renders the protected content when onboarding is done", async () => {
    mockedApiFetch.mockResolvedValue({ state: "done" });

    renderGuarded();

    expect(await screen.findByText("DASHBOARD CONTENT")).toBeInTheDocument();
  });

  it("redirects to /onboarding when onboarding is incomplete", async () => {
    mockedApiFetch.mockResolvedValue({ state: "connect_accounts" });

    renderGuarded();

    expect(await screen.findByText("ONBOARDING WIZARD")).toBeInTheDocument();
  });

  it("fails open (renders content) when the onboarding state can't be fetched", async () => {
    mockedApiFetch.mockRejectedValue(new Error("network error"));

    renderGuarded();

    expect(await screen.findByText("DASHBOARD CONTENT")).toBeInTheDocument();
  });
});
