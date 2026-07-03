import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";
import { useAccounts } from "@/hooks/use-accounts";
import { apiFetch } from "@/lib/api";

vi.mock("@/hooks/use-accounts", () => ({
  useAccounts: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const mockedUseAccounts = vi.mocked(useAccounts);
const mockedApiFetch = vi.mocked(apiFetch);

describe("ConnectedAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton while accounts are being fetched", () => {
    mockedUseAccounts.mockReturnValue({
      accounts: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<ConnectedAccounts token="tok" />);

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it("renders only the connect CTAs when there are no accounts", () => {
    mockedUseAccounts.mockReturnValue({
      accounts: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConnectedAccounts token="tok" />);

    expect(screen.getByRole("button", { name: /Conectar YouTube/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conectar X/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders connected accounts with platform, username and status badge", () => {
    mockedUseAccounts.mockReturnValue({
      accounts: [
        {
          id: "acc-1",
          platform: "youtube",
          username: "roastr-channel",
          status: "active",
          integration_health: "ok",
        },
        {
          id: "acc-2",
          platform: "x",
          username: "roastr",
          status: "paused",
          integration_health: "ok",
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConnectedAccounts token="tok" />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("YouTube")).toBeInTheDocument();
    expect(within(table).getByText("roastr-channel")).toBeInTheDocument();
    expect(within(table).getByText("Activa")).toBeInTheDocument();
    expect(within(table).getByText("@roastr")).toBeInTheDocument();
    expect(within(table).getByText("Pausada")).toBeInTheDocument();

    // Connect CTAs remain available, with a badge reflecting the current per-platform count
    expect(screen.getByRole("button", { name: "Conectar YouTube" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar X" })).toBeInTheDocument();
    expect(screen.getAllByText("1/2")).toHaveLength(2);
  });

  it("opens the config modal when clicking the settings action for an account", async () => {
    const user = userEvent.setup();
    mockedUseAccounts.mockReturnValue({
      accounts: [
        {
          id: "acc-1",
          platform: "youtube",
          username: "roastr-channel",
          status: "active",
          integration_health: "ok",
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockedApiFetch.mockResolvedValue({ shieldAggressiveness: 0.95 });

    render(<ConnectedAccounts token="tok" />);

    await user.click(screen.getByRole("button", { name: "Configurar cuenta" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Configuración del Shield")).toBeInTheDocument();
  });

  it("disables the connect button for a platform once the max accounts is reached", () => {
    mockedUseAccounts.mockReturnValue({
      accounts: [
        { id: "1", platform: "youtube", username: "a", status: "active", integration_health: "ok" },
        { id: "2", platform: "youtube", username: "b", status: "active", integration_health: "ok" },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConnectedAccounts token="tok" />);

    expect(screen.getByRole("button", { name: "Conectar YouTube" })).toBeDisabled();
  });
});
