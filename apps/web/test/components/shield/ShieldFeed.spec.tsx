import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShieldFeed } from "@/components/shield/ShieldFeed";
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

describe("ShieldFeed", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("shows a loading skeleton while the request is in flight", async () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ShieldFeed />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows a destructive alert when the request fails", async () => {
    mockedApiFetch.mockRejectedValue(new Error("Network down"));

    render(<ShieldFeed />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Network down");
  });

  it("shows an empty state when there is no activity", async () => {
    mockedApiFetch.mockResolvedValue({ logs: [], total: 0 });

    render(<ShieldFeed />);

    expect(
      await screen.findByText(/No hay actividad reciente/i),
    ).toBeInTheDocument();
  });

  it("renders the received logs", async () => {
    mockedApiFetch.mockResolvedValue({
      total: 2,
      logs: [
        {
          id: "1",
          platform: "youtube",
          action_taken: "hide",
          severity_score: 0.82,
          platform_fallback: false,
          created_at: "2026-01-01T10:00:00Z",
        },
        {
          id: "2",
          platform: "x",
          action_taken: "block",
          severity_score: 0.95,
          platform_fallback: true,
          created_at: "2026-01-02T10:00:00Z",
        },
      ],
    });

    render(<ShieldFeed />);

    await waitFor(() => {
      expect(screen.getByText(/2 registros \(últimos 30\)/)).toBeInTheDocument();
    });

    const list = screen.getByRole("list");
    expect(within(list).getByText("Ocultado")).toBeInTheDocument();
    expect(within(list).getByText("Bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/youtube · Severidad 82%/)).toBeInTheDocument();
    expect(screen.getByText(/x · Severidad 95% · Fallback de plataforma/)).toBeInTheDocument();
  });

  it("refetches when the platform filter changes", async () => {
    mockedApiFetch.mockResolvedValue({ logs: [], total: 0 });

    render(<ShieldFeed />);

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(
      screen.getByLabelText("Filtro de plataforma"),
      "youtube",
    );

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledTimes(2));
    const lastCallPath = mockedApiFetch.mock.calls[1][0] as string;
    expect(lastCallPath).toContain("platform=youtube");
  });
});
