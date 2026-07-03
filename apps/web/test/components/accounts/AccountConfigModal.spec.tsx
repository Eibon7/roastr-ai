import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountConfigModal } from "@/components/accounts/AccountConfigModal";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("AccountConfigModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while fetching the config", () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    render(
      <AccountConfigModal accountId="acc-1" token="tok" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("renders the fetched aggressiveness once loaded", async () => {
    mockedApiFetch.mockResolvedValue({ shieldAggressiveness: 0.95 });

    render(
      <AccountConfigModal accountId="acc-1" token="tok" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(await screen.findByLabelText("Agresividad del Shield")).toHaveValue("0.95");
    expect(mockedApiFetch).toHaveBeenCalledWith("/shield/accounts/acc-1/config", { token: "tok" });
  });

  it("shows an error and disables save when loading the config fails", async () => {
    mockedApiFetch.mockRejectedValue(new Error("boom"));

    render(
      <AccountConfigModal accountId="acc-1" token="tok" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("saves the new aggressiveness and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockedApiFetch.mockResolvedValueOnce({ shieldAggressiveness: 0.9 });
    mockedApiFetch.mockResolvedValueOnce(undefined);

    render(
      <AccountConfigModal accountId="acc-1" token="tok" onClose={vi.fn()} onSaved={onSaved} />,
    );

    await screen.findByLabelText("Agresividad del Shield");
    await user.selectOptions(screen.getByLabelText("Agresividad del Shield"), "1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockedApiFetch).toHaveBeenLastCalledWith("/shield/accounts/acc-1/config", {
      method: "PATCH",
      token: "tok",
      body: JSON.stringify({ shieldAggressiveness: 1 }),
    });
  });

  it("shows a save error without disabling the save button", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce({ shieldAggressiveness: 0.9 });
    mockedApiFetch.mockRejectedValueOnce(new Error("save failed"));

    render(
      <AccountConfigModal accountId="acc-1" token="tok" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    await screen.findByLabelText("Agresividad del Shield");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("calls onClose when clicking Cancelar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockedApiFetch.mockResolvedValue({ shieldAggressiveness: 0.9 });

    render(
      <AccountConfigModal accountId="acc-1" token="tok" onClose={onClose} onSaved={vi.fn()} />,
    );

    await screen.findByLabelText("Agresividad del Shield");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
  });
});
