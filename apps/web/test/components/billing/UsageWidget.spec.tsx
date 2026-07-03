import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsageWidget } from "@/components/billing/UsageWidget";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

vi.mock("@/contexts/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApiFetch = vi.mocked(apiFetch);

function withSession(accessToken: string | null) {
  mockedUseAuth.mockReturnValue({
    session: accessToken ? ({ access_token: accessToken } as never) : null,
    user: null,
    loading: false,
    isAuthenticated: !!accessToken,
  });
}

describe("UsageWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton while fetching usage", () => {
    withSession("tok");
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<UsageWidget />);

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it("shows an error alert when the request fails", async () => {
    withSession("tok");
    mockedApiFetch.mockRejectedValue(new Error("network down"));

    render(<UsageWidget />);

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a message when there is no session", async () => {
    withSession(null);

    render(<UsageWidget />);

    expect(await screen.findByText("Sin datos de uso")).toBeInTheDocument();
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it("renders usage details when data is available", async () => {
    withSession("tok");
    mockedApiFetch.mockResolvedValue({
      plan: "pro",
      billing_state: "active",
      analysis_limit: 1000,
      analysis_used: 250,
      roasts_limit: 500,
      roasts_used: 100,
      current_period_end: null,
      trial_end: null,
    });

    render(<UsageWidget />);

    expect(await screen.findByText("Uso del ciclo actual")).toBeInTheDocument();
    expect(screen.getByText(/Plan pro/)).toBeInTheDocument();
    expect(
      screen.getByText(`${(250).toLocaleString()} / ${(1000).toLocaleString()}`),
    ).toBeInTheDocument();
    expect(screen.getByText(`${(750).toLocaleString()} restantes`)).toBeInTheDocument();
  });

  it("shows a payment retry warning when billing_state requires attention", async () => {
    withSession("tok");
    mockedApiFetch.mockResolvedValue({
      plan: "pro",
      billing_state: "payment_retry",
      analysis_limit: 1000,
      analysis_used: 250,
      roasts_limit: 500,
      roasts_used: 100,
      current_period_end: null,
      trial_end: null,
    });

    render(<UsageWidget />);

    expect(
      await screen.findByText("Actualiza tu método de pago para evitar la interrupción del servicio."),
    ).toBeInTheDocument();
  });
});
