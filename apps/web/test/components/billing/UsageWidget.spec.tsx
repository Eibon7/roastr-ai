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
    // No CTA button for this state — user acts directly on their existing payment method.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an expired-trial alert with a subscribe CTA", async () => {
    withSession("tok");
    mockedApiFetch.mockResolvedValue({
      plan: "starter",
      billing_state: "expired_trial_pending_payment",
      analysis_limit: 1000,
      analysis_used: 250,
      roasts_limit: 0,
      roasts_used: 0,
      current_period_end: null,
      trial_end: "2026-06-01T00:00:00.000Z",
    });

    render(<UsageWidget />);

    expect(
      await screen.findByText(
        "Tu periodo de prueba ha terminado. Añade un método de pago para seguir usando Roastr.",
      ),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Suscribirme" });
    expect(cta).toHaveAttribute("href", "/onboarding");
  });

  it("shows a paused-service alert with a reactivate CTA", async () => {
    withSession("tok");
    mockedApiFetch.mockResolvedValue({
      plan: "pro",
      billing_state: "paused",
      analysis_limit: 1000,
      analysis_used: 250,
      roasts_limit: 500,
      roasts_used: 100,
      current_period_end: null,
      trial_end: null,
    });

    render(<UsageWidget />);

    expect(
      await screen.findByText(
        "Tu servicio está suspendido: la ingestión de contenido y la generación de roasts están detenidas. Actualiza tu método de pago o contacta con soporte para reactivarlo.",
      ),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Reactivar suscripción" });
    expect(cta).toHaveAttribute("href", "/onboarding");
  });

  it("shows an informative canceled-pending alert with the period end date", async () => {
    withSession("tok");
    mockedApiFetch.mockResolvedValue({
      plan: "pro",
      billing_state: "canceled_pending",
      analysis_limit: 1000,
      analysis_used: 250,
      roasts_limit: 500,
      roasts_used: 100,
      current_period_end: "2026-08-15T00:00:00.000Z",
      trial_end: null,
    });

    render(<UsageWidget />);

    const expectedDate = new Date("2026-08-15T00:00:00.000Z").toLocaleDateString();
    expect(
      await screen.findByText(
        `Tu suscripción está programada para cancelarse el ${expectedDate}. Mantendrás acceso hasta esa fecha.`,
      ),
    ).toBeInTheDocument();
    // Informative tone — no CTA, this isn't an action the user needs to take.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a canceled-pending alert without a date when current_period_end is missing", async () => {
    withSession("tok");
    mockedApiFetch.mockResolvedValue({
      plan: "pro",
      billing_state: "canceled_pending",
      analysis_limit: 1000,
      analysis_used: 250,
      roasts_limit: 500,
      roasts_used: 100,
      current_period_end: null,
      trial_end: null,
    });

    render(<UsageWidget />);

    expect(
      await screen.findByText(
        "Tu suscripción está programada para cancelarse al final del periodo de facturación actual. Mantendrás acceso hasta entonces.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no billing alert for a healthy trialing or active state", async () => {
    withSession("tok");
    mockedApiFetch.mockResolvedValue({
      plan: "starter",
      billing_state: "trialing",
      analysis_limit: 1000,
      analysis_used: 250,
      roasts_limit: 0,
      roasts_used: 0,
      current_period_end: null,
      trial_end: "2026-08-01T00:00:00.000Z",
    });

    render(<UsageWidget />);

    await screen.findByText("Uso del ciclo actual");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
