import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentThreatsWidget } from "@/components/dashboard/RecentThreatsWidget";
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

describe("RecentThreatsWidget", () => {
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

    render(<RecentThreatsWidget />);

    expect(screen.getByTestId("recent-threats-loading")).toBeInTheDocument();
    expect(screen.queryByText(/Sin amenazas recientes/)).not.toBeInTheDocument();
  });

  it("shows a destructive alert on error", () => {
    mockedUseShieldLogs.mockReturnValue({
      logs: [],
      total: 0,
      loading: false,
      error: "Error cargando logs",
      refetch: vi.fn(),
    });

    render(<RecentThreatsWidget />);

    expect(screen.getByRole("alert")).toHaveTextContent("Error cargando logs");
  });

  it("shows an empty state when there are no threats", () => {
    mockedUseShieldLogs.mockReturnValue({
      logs: [],
      total: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RecentThreatsWidget />);

    expect(screen.getByText("Sin amenazas recientes")).toBeInTheDocument();
  });

  it("renders the top 5 threats sorted by severity", () => {
    mockedUseShieldLogs.mockReturnValue({
      logs: [
        makeLog({ id: "1", platform: "youtube", action_taken: "hide", severity_score: 0.3 }),
        makeLog({ id: "2", platform: "x", action_taken: "block", severity_score: 0.95 }),
        makeLog({ id: "3", platform: "instagram", action_taken: "report", severity_score: 0.6 }),
      ],
      total: 3,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RecentThreatsWidget />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // Highest severity (0.95, platform X) should render first.
    expect(items[0]).toHaveTextContent("X");
    expect(items[0]).toHaveTextContent("95%");
    expect(items[0]).toHaveTextContent("block");
    expect(items[1]).toHaveTextContent("60%");
    expect(items[2]).toHaveTextContent("30%");
  });
});
