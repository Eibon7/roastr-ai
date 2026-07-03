import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShieldStatsWidget } from "@/components/dashboard/ShieldStatsWidget";
import { useShieldLogs } from "@/hooks/use-shield-logs";
import type { ShieldLog } from "@/hooks/use-shield-logs";

vi.mock("@/hooks/use-shield-logs", () => ({
  useShieldLogs: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    isAuthenticated: true,
  }),
}));

const mockedUseShieldLogs = vi.mocked(useShieldLogs);

function makeLog(overrides: Partial<ShieldLog>): ShieldLog {
  return {
    id: "log-1",
    platform: "youtube",
    action_taken: "hide",
    severity_score: 0.5,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("ShieldStatsWidget", () => {
  beforeEach(() => {
    mockedUseShieldLogs.mockReset();
  });

  it("shows a loading skeleton while fetching", () => {
    mockedUseShieldLogs.mockReturnValue({
      logs: [],
      total: 0,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShieldStatsWidget />);

    expect(screen.getByTestId("shield-stats-loading")).toBeInTheDocument();
    expect(screen.queryByText(/Ocultados/)).not.toBeInTheDocument();
  });

  it("shows a destructive alert on error", () => {
    mockedUseShieldLogs.mockReturnValue({
      logs: [],
      total: 0,
      loading: false,
      error: "Error cargando logs",
      refetch: vi.fn(),
    });

    render(<ShieldStatsWidget />);

    expect(screen.getByRole("alert")).toHaveTextContent("Error cargando logs");
  });

  it("renders counts of zero when there are no logs", () => {
    mockedUseShieldLogs.mockReturnValue({
      logs: [],
      total: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShieldStatsWidget />);

    expect(screen.getByText("Ocultados")).toBeInTheDocument();
    expect(screen.getByText("Bloqueados")).toBeInTheDocument();
    expect(screen.getByText("Reportados")).toBeInTheDocument();
    expect(screen.getByText("0 esta semana")).toBeInTheDocument();
    expect(screen.getByText("0 acciones hoy")).toBeInTheDocument();
  });

  it("aggregates action counts from real data", () => {
    const now = new Date();
    mockedUseShieldLogs.mockReturnValue({
      logs: [
        makeLog({ id: "1", action_taken: "hide", created_at: now.toISOString() }),
        makeLog({ id: "2", action_taken: "hide", created_at: now.toISOString() }),
        makeLog({ id: "3", action_taken: "block", created_at: now.toISOString() }),
        makeLog({ id: "4", action_taken: "report", created_at: now.toISOString() }),
      ],
      total: 4,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShieldStatsWidget />);

    expect(screen.getByText("4 esta semana")).toBeInTheDocument();
    expect(screen.getByText("4 acciones hoy")).toBeInTheDocument();

    const counts = screen.getAllByText(/^[0-9]+$/).map((el) => el.textContent);
    expect(counts).toContain("2"); // Ocultados
    expect(counts).toContain("1"); // Bloqueados
    expect(counts).toContain("1"); // Reportados
  });
});
