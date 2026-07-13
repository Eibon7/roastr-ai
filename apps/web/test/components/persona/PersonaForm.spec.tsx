import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaForm } from "@/components/persona/PersonaForm";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("PersonaForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while fetching the current persona", () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    render(<PersonaForm token="tok" />);

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("renders existing entries fetched from GET /persona", async () => {
    mockedApiFetch.mockResolvedValue({
      identities: ["madre", "ingeniera"],
      redLines: ["racismo"],
      tolerances: [],
    });

    render(<PersonaForm token="tok" />);

    expect(await screen.findByText("madre")).toBeInTheDocument();
    expect(screen.getByText("ingeniera")).toBeInTheDocument();
    expect(screen.getByText("racismo")).toBeInTheDocument();
    expect(mockedApiFetch).toHaveBeenCalledWith("/persona", { token: "tok" });
  });

  it("adds a new entry to a field and clears the input", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValue({ identities: [], redLines: [], tolerances: [] });

    render(<PersonaForm token="tok" />);
    await screen.findByLabelText("Lo que me define");

    const input = screen.getByLabelText("Lo que me define");
    await user.type(input, "gamer");
    await user.click(screen.getAllByRole("button", { name: "Añadir" })[0]);

    expect(await screen.findByText("gamer")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("adds a new entry when pressing Enter", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValue({ identities: [], redLines: [], tolerances: [] });

    render(<PersonaForm token="tok" />);
    const input = await screen.findByLabelText("Lo que me define");

    await user.type(input, "gamer{Enter}");

    expect(await screen.findByText("gamer")).toBeInTheDocument();
  });

  it("does not add an empty or whitespace-only entry", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValue({ identities: [], redLines: [], tolerances: [] });

    render(<PersonaForm token="tok" />);
    await screen.findByLabelText("Lo que me define");

    expect(screen.getAllByRole("button", { name: "Añadir" })[0]).toBeDisabled();

    const input = screen.getByLabelText("Lo que me define");
    await user.type(input, "   ");
    expect(screen.getAllByRole("button", { name: "Añadir" })[0]).toBeDisabled();
  });

  it("removes an entry when its remove button is clicked", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValue({
      identities: ["madre"],
      redLines: [],
      tolerances: [],
    });

    render(<PersonaForm token="tok" />);
    await screen.findByText("madre");

    await user.click(screen.getByRole("button", { name: 'Eliminar "madre" de Lo que me define' }));

    expect(screen.queryByText("madre")).not.toBeInTheDocument();
  });

  it("saves the profile via PUT /persona and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockedApiFetch.mockResolvedValueOnce({ identities: [], redLines: [], tolerances: [] });

    render(<PersonaForm token="tok" onSaved={onSaved} submitLabel="Continuar" />);
    const input = await screen.findByLabelText("Lo que me define");
    await user.type(input, "gamer{Enter}");

    const saved = { identities: ["gamer"], redLines: [], tolerances: [] };
    mockedApiFetch.mockResolvedValueOnce(saved);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/persona", {
        method: "PUT",
        token: "tok",
        body: JSON.stringify({ identities: ["gamer"], redLines: [], tolerances: [] }),
      });
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("shows an error message when loading fails", async () => {
    mockedApiFetch.mockRejectedValue(new Error("Error de red"));

    render(<PersonaForm token="tok" />);

    expect(await screen.findByText("Error de red")).toBeInTheDocument();
  });

  it("shows an error message when saving fails", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce({ identities: [], redLines: [], tolerances: [] });

    render(<PersonaForm token="tok" />);
    await screen.findByLabelText("Lo que me define");

    mockedApiFetch.mockRejectedValueOnce(new Error("Error al guardar"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Error al guardar")).toBeInTheDocument();
  });
});
