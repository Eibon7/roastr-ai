import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BillingPage } from "@/components/billing/BillingPage";
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

describe("BillingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // UsageWidget's own GET /billing/usage call, irrelevant to these tests.
    mockedApiFetch.mockResolvedValue({
      plan: "pro",
      billing_state: "active",
      analysis_limit: 1000,
      analysis_used: 0,
      roasts_limit: 50,
      roasts_used: 0,
      current_period_end: null,
      trial_end: null,
    });
  });

  it("disables the cancel button when there is no session", () => {
    withSession(null);

    render(<BillingPage />);

    expect(screen.getByRole("button", { name: "Cancelar suscripción" })).toBeDisabled();
  });

  it("opens a confirmation dialog before canceling", async () => {
    withSession("tok");

    render(<BillingPage />);
    await screen.findByText("Uso del ciclo actual");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar suscripción" }));

    expect(
      screen.getByText(/Se cancelará tu suscripción al final del periodo/),
    ).toBeInTheDocument();
    expect(mockedApiFetch).not.toHaveBeenCalledWith("/billing/cancel", expect.anything());
  });

  it("calls POST /billing/cancel and closes the dialog on confirm", async () => {
    withSession("tok");
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === "/billing/cancel") {
        return Promise.resolve({ billing_state: "canceled_pending" });
      }
      return Promise.resolve({
        plan: "pro",
        billing_state: "active",
        analysis_limit: 1000,
        analysis_used: 0,
        roasts_limit: 50,
        roasts_used: 0,
        current_period_end: null,
        trial_end: null,
      });
    });

    render(<BillingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar suscripción" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/billing/cancel",
        expect.objectContaining({ token: "tok", method: "POST" }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByText(/Se cancelará tu suscripción al final del periodo/),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows an error inside the dialog when cancellation fails", async () => {
    withSession("tok");
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === "/billing/cancel") {
        return Promise.reject(new Error("No hay una suscripción activa que cancelar"));
      }
      return Promise.resolve({
        plan: "pro",
        billing_state: "paused",
        analysis_limit: 1000,
        analysis_used: 0,
        roasts_limit: 50,
        roasts_used: 0,
        current_period_end: null,
        trial_end: null,
      });
    });

    render(<BillingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar suscripción" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));

    expect(
      await screen.findByText("No hay una suscripción activa que cancelar"),
    ).toBeInTheDocument();
  });
});
