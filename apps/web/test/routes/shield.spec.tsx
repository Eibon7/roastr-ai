import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShieldPage } from "@/routes/shield";
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

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

const sampleLogs = [
  {
    id: "1",
    platform: "youtube",
    action_taken: "block",
    severity_score: 0.95,
    platform_fallback: false,
    created_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "2",
    platform: "x",
    action_taken: "hide",
    severity_score: 0.75,
    platform_fallback: true,
    created_at: "2026-01-02T10:00:00Z",
  },
  {
    id: "3",
    platform: "instagram",
    action_taken: "report",
    severity_score: 0.4,
    platform_fallback: false,
    created_at: "2026-01-03T10:00:00Z",
  },
];

describe("ShieldPage", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("shows loading skeletons while fetching", () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ShieldPage />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows a destructive alert when the request fails", async () => {
    mockedApiFetch.mockRejectedValue(new Error("Boom"));

    render(<ShieldPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Boom");
  });

  it("shows an empty state card when there is no activity", async () => {
    mockedApiFetch.mockResolvedValue({ logs: [], total: 0 });

    render(<ShieldPage />);

    expect(await screen.findByText("Sin actividad registrada")).toBeInTheDocument();
  });

  it("renders logs in both the mobile accordion and the desktop list", async () => {
    mockedApiFetch.mockResolvedValue({ logs: sampleLogs, total: sampleLogs.length });

    render(<ShieldPage />);

    await waitFor(() => {
      expect(screen.getAllByText("youtube").length).toBeGreaterThan(0);
    });

    // Accordion trigger (mobile) and desktop list both render the platform + action.
    expect(screen.getAllByText("Bloqueado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("x").length).toBeGreaterThan(0);
    expect(screen.getAllByText("instagram").length).toBeGreaterThan(0);

    // Stats summary counts (1 block, 1 hide, 1 report out of 3 total logs).
    expect(screen.getByText("Total acciones").closest('[data-slot="card"]')).toHaveTextContent("3");
    expect(screen.getByText("Bloqueados").closest('[data-slot="card"]')).toHaveTextContent("1");
  });

  it("filters logs by severity", async () => {
    mockedApiFetch.mockResolvedValue({ logs: sampleLogs, total: sampleLogs.length });

    render(<ShieldPage />);

    await waitFor(() => {
      expect(screen.getAllByText("youtube").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("instagram").length).toBeGreaterThan(0);

    await userEvent.selectOptions(
      screen.getByLabelText("Filtro de severidad"),
      "high",
    );

    await waitFor(() => {
      expect(screen.queryAllByText("instagram").length).toBe(0);
    });
    expect(screen.getAllByText("youtube").length).toBeGreaterThan(0);
  });

  it("expands an accordion item on mobile to reveal full log details", async () => {
    mockedApiFetch.mockResolvedValue({ logs: sampleLogs, total: sampleLogs.length });

    render(<ShieldPage />);

    await waitFor(() => {
      expect(screen.getAllByText("youtube").length).toBeGreaterThan(0);
    });

    const triggers = screen.getAllByRole("button", { name: /youtube/i });
    await userEvent.click(triggers[0]);

    expect(await screen.findByText("Fallback")).toBeInTheDocument();
  });
});
