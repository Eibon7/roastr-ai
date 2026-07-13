import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";
import { useAccounts, type Account } from "@/hooks/use-accounts";
import { apiFetch } from "@/lib/api";

vi.mock("@/hooks/use-accounts", () => ({
  useAccounts: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const mockedUseAccounts = vi.mocked(useAccounts);
const mockedApiFetch = vi.mocked(apiFetch);

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    platform: "youtube",
    username: "roastr-channel",
    status: "active",
    status_reason: null,
    integration_health: "ok",
    retention_until: null,
    ...overrides,
  };
}

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
        makeAccount({ id: "acc-1", platform: "youtube", username: "roastr-channel", status: "active" }),
        makeAccount({ id: "acc-2", platform: "x", username: "roastr", status: "paused" }),
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
      accounts: [makeAccount()],
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
        makeAccount({ id: "1", username: "a" }),
        makeAccount({ id: "2", username: "b" }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConnectedAccounts token="tok" />);

    expect(screen.getByRole("button", { name: "Conectar YouTube" })).toBeDisabled();
  });

  it("does not count broken (error) or disconnected (revoked) accounts against the plan limit", () => {
    mockedUseAccounts.mockReturnValue({
      accounts: [
        makeAccount({ id: "1", username: "a", status: "error" }),
        makeAccount({ id: "2", username: "b", status: "revoked", retention_until: "2026-10-01T00:00:00Z" }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConnectedAccounts token="tok" />);

    expect(screen.getByRole("button", { name: "Conectar YouTube" })).not.toBeDisabled();
    expect(screen.getAllByText("0/2")).toHaveLength(2);
  });

  it("shows a Reconectar action for an account with a broken token, which restarts the OAuth flow", async () => {
    const user = userEvent.setup();
    mockedUseAccounts.mockReturnValue({
      accounts: [makeAccount({ status: "error" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockedApiFetch.mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/authorize?..." });

    const originalLocation = window.location;
    // @ts-expect-error - simplified location mock for this test
    delete window.location;
    window.location = { ...originalLocation, href: "" } as Location;

    render(<ConnectedAccounts token="tok" />);

    expect(screen.getAllByText("Token expirado").length).toBeGreaterThan(0);
    const [reconnectButton] = screen.getAllByRole("button", { name: "Reconectar cuenta" });
    await user.click(reconnectButton);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/oauth/youtube/authorize", { token: "tok" });
    });

    window.location = originalLocation;
  });

  it("does not show config/disconnect actions for a fully revoked (disconnected) account", () => {
    mockedUseAccounts.mockReturnValue({
      accounts: [makeAccount({ status: "revoked", retention_until: "2026-10-01T00:00:00Z" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConnectedAccounts token="tok" />);

    expect(screen.queryByRole("button", { name: "Configurar cuenta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desconectar cuenta" })).not.toBeInTheDocument();
    expect(screen.getByText(/Datos retenidos hasta/)).toBeInTheDocument();
  });

  describe("connecting a new account", () => {
    let originalLocation: Location;

    beforeEach(() => {
      originalLocation = window.location;
      // @ts-expect-error - simplified location mock for this test
      delete window.location;
      window.location = { ...originalLocation, href: "" } as Location;
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it("requests the plain authorize URL when no returnTo is set", async () => {
      const user = userEvent.setup();
      mockedUseAccounts.mockReturnValue({ accounts: [], loading: false, error: null, refetch: vi.fn() });
      mockedApiFetch.mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/authorize" });

      render(<ConnectedAccounts token="tok" />);
      await user.click(screen.getByRole("button", { name: "Conectar YouTube" }));

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/oauth/youtube/authorize", { token: "tok" });
      });
    });

    it("appends ?returnTo=onboarding to the authorize URL when rendered from the onboarding wizard", async () => {
      const user = userEvent.setup();
      mockedUseAccounts.mockReturnValue({ accounts: [], loading: false, error: null, refetch: vi.fn() });
      mockedApiFetch.mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/authorize" });

      render(<ConnectedAccounts token="tok" returnTo="onboarding" />);
      await user.click(screen.getByRole("button", { name: "Conectar YouTube" }));

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/oauth/youtube/authorize?returnTo=onboarding", {
          token: "tok",
        });
      });
    });
  });

  describe("disconnect flow", () => {
    it("opens a confirmation dialog and disconnects the account on confirm", async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockedUseAccounts.mockReturnValue({
        accounts: [makeAccount()],
        loading: false,
        error: null,
        refetch,
      });
      mockedApiFetch.mockResolvedValue(undefined);

      render(<ConnectedAccounts token="tok" />);

      await user.click(screen.getByRole("button", { name: "Desconectar cuenta" }));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Desconectar cuenta")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Desconectar" }));

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/accounts/acc-1", {
          token: "tok",
          method: "DELETE",
        });
      });
      expect(refetch).toHaveBeenCalled();
    });

    it("closes the dialog without calling the API when cancelled", async () => {
      const user = userEvent.setup();
      mockedUseAccounts.mockReturnValue({
        accounts: [makeAccount()],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<ConnectedAccounts token="tok" />);

      await user.click(screen.getByRole("button", { name: "Desconectar cuenta" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

      expect(mockedApiFetch).not.toHaveBeenCalled();
    });

    it("shows an error message when disconnecting fails", async () => {
      const user = userEvent.setup();
      mockedUseAccounts.mockReturnValue({
        accounts: [makeAccount()],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });
      mockedApiFetch.mockRejectedValue(new Error("Error de red"));

      render(<ConnectedAccounts token="tok" />);

      await user.click(screen.getByRole("button", { name: "Desconectar cuenta" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Desconectar" }));

      expect(await screen.findByText("Error de red")).toBeInTheDocument();
    });
  });

  describe("pause/resume flow", () => {
    it("pauses an active account", async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockedUseAccounts.mockReturnValue({
        accounts: [makeAccount({ status: "active" })],
        loading: false,
        error: null,
        refetch,
      });
      mockedApiFetch.mockResolvedValue({ paused: true });

      render(<ConnectedAccounts token="tok" />);

      await user.click(screen.getByRole("button", { name: "Pausar cuenta" }));

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/accounts/acc-1/pause", {
          token: "tok",
          method: "PATCH",
          body: JSON.stringify({ paused: true }),
        });
      });
      expect(refetch).toHaveBeenCalled();
    });

    it("resumes a paused account", async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockedUseAccounts.mockReturnValue({
        accounts: [makeAccount({ status: "paused" })],
        loading: false,
        error: null,
        refetch,
      });
      mockedApiFetch.mockResolvedValue({ paused: false });

      render(<ConnectedAccounts token="tok" />);

      await user.click(screen.getByRole("button", { name: "Reanudar cuenta" }));

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/accounts/acc-1/pause", {
          token: "tok",
          method: "PATCH",
          body: JSON.stringify({ paused: false }),
        });
      });
      expect(refetch).toHaveBeenCalled();
    });

    it("does not show a pause/resume action for broken or revoked accounts", () => {
      mockedUseAccounts.mockReturnValue({
        accounts: [
          makeAccount({ id: "1", username: "a", status: "error" }),
          makeAccount({ id: "2", username: "b", status: "revoked", retention_until: "2026-10-01T00:00:00Z" }),
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<ConnectedAccounts token="tok" />);

      expect(screen.queryByRole("button", { name: "Pausar cuenta" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reanudar cuenta" })).not.toBeInTheDocument();
    });

    it("shows an error message when pausing fails", async () => {
      const user = userEvent.setup();
      mockedUseAccounts.mockReturnValue({
        accounts: [makeAccount({ status: "active" })],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });
      mockedApiFetch.mockRejectedValue(new Error("Error de red"));

      render(<ConnectedAccounts token="tok" />);

      await user.click(screen.getByRole("button", { name: "Pausar cuenta" }));

      expect(await screen.findByText("Error de red")).toBeInTheDocument();
    });
  });
});
