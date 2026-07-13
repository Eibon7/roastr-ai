import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
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

function renderWizard(initialEntry = "/onboarding") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/connect" element={<div>CONNECT</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while fetching the onboarding state", () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    renderWizard();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("resumes at the step returned by GET /auth/onboarding", async () => {
    mockedApiFetch.mockImplementation((path: string) =>
      path === "/persona"
        ? Promise.resolve({ identities: [], redLines: [], tolerances: [] })
        : Promise.resolve({ state: "persona_setup" }),
    );

    renderWizard();

    expect(await screen.findByText("Configura tu Roastr Persona")).toBeInTheDocument();
    expect(mockedApiFetch).toHaveBeenCalledWith("/auth/onboarding", { token: "test-token" });
  });

  it("defaults to the welcome step for a brand-new profile", async () => {
    mockedApiFetch.mockResolvedValue({ state: "welcome" });

    renderWizard();

    expect(await screen.findByText("Bienvenido a Roastr")).toBeInTheDocument();
  });

  it("redirects to /dashboard when the onboarding is already done", async () => {
    mockedApiFetch.mockResolvedValue({ state: "done" });

    renderWizard();

    expect(await screen.findByText("DASHBOARD")).toBeInTheDocument();
  });

  it("prefers the ?step= query param over the fetched state (post-checkout redirect)", async () => {
    mockedApiFetch.mockImplementation((path: string) =>
      path === "/persona"
        ? Promise.resolve({ identities: [], redLines: [], tolerances: [] })
        : Promise.resolve({ state: "payment" }),
    );

    renderWizard("/onboarding?step=persona_setup");

    expect(await screen.findByText("Configura tu Roastr Persona")).toBeInTheDocument();
  });

  it("persists the new step via POST /auth/onboarding after advancing", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValue({ state: "welcome" });

    renderWizard();

    await screen.findByText("Bienvenido a Roastr");
    mockedApiFetch.mockResolvedValue({ state: "select_plan" });

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Elige tu plan")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/auth/onboarding", {
        token: "test-token",
        method: "POST",
        body: JSON.stringify({ state: "select_plan" }),
      });
    });
  });

  it("does not persist a state right after the initial load (only the GET is called)", async () => {
    mockedApiFetch.mockResolvedValue({ state: "welcome" });

    renderWizard();

    await screen.findByText("Bienvenido a Roastr");

    const postCalls = mockedApiFetch.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(postCalls).toHaveLength(0);
  });

  it("advances from select_plan to payment and persists it when a plan is chosen", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValue({ state: "select_plan" });

    renderWizard();

    await screen.findByText("Elige tu plan");
    mockedApiFetch.mockResolvedValue({ state: "payment" });

    const [chooseButton] = screen.getAllByRole("button", { name: "Elegir" });
    await user.click(chooseButton);

    expect(await screen.findByText("Pago")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/auth/onboarding", {
        token: "test-token",
        method: "POST",
        body: JSON.stringify({ state: "payment" }),
      });
    });
  });

  it("advances from persona_setup to connect_accounts once the persona form is saved", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/persona") {
        return init?.method === "PUT"
          ? Promise.resolve({ identities: ["gamer"], redLines: [], tolerances: [] })
          : Promise.resolve({ identities: [], redLines: [], tolerances: [] });
      }
      return Promise.resolve({ state: "persona_setup" });
    });

    renderWizard();

    await screen.findByText("Configura tu Roastr Persona");
    await user.click(await screen.findByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Conecta tus cuentas")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/auth/onboarding", {
        token: "test-token",
        method: "POST",
        body: JSON.stringify({ state: "connect_accounts" }),
      });
    });
  });

  describe("returning from the OAuth callback (connect_accounts)", () => {
    it("marks onboarding as done and redirects to /dashboard on a successful connection", async () => {
      mockedApiFetch.mockResolvedValue({ state: "connect_accounts" });

      renderWizard("/onboarding?success=youtube&accountId=acc-1");

      expect(await screen.findByText("DASHBOARD")).toBeInTheDocument();
      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/auth/onboarding", {
          token: "test-token",
          method: "POST",
          body: JSON.stringify({ state: "done" }),
        });
      });
    });

    it("shows an error and stays on connect_accounts when the provider reports one", async () => {
      mockedApiFetch.mockResolvedValue({ state: "connect_accounts" });

      renderWizard("/onboarding?error=access_denied");

      expect(await screen.findByText("Conecta tus cuentas")).toBeInTheDocument();
      expect(screen.getByText(/Acceso denegado/)).toBeInTheDocument();
      expect(screen.queryByText("DASHBOARD")).not.toBeInTheDocument();

      const postCalls = mockedApiFetch.mock.calls.filter(
        ([, init]) => init?.method === "POST" && init.body === JSON.stringify({ state: "done" }),
      );
      expect(postCalls).toHaveLength(0);
    });
  });

  describe("connect_accounts step actions", () => {
    it("navigates to /connect?from=onboarding when clicking 'Conectar cuentas'", async () => {
      const user = userEvent.setup();
      mockedApiFetch.mockResolvedValue({ state: "connect_accounts" });

      renderWizard();
      await screen.findByText("Conecta tus cuentas");
      await user.click(screen.getByRole("button", { name: "Conectar cuentas" }));

      expect(await screen.findByText("CONNECT")).toBeInTheDocument();
    });

    it("marks onboarding as done and redirects to /dashboard when clicking 'Saltar por ahora'", async () => {
      const user = userEvent.setup();
      mockedApiFetch.mockResolvedValue({ state: "connect_accounts" });

      renderWizard();
      await screen.findByText("Conecta tus cuentas");
      await user.click(screen.getByRole("button", { name: "Saltar por ahora" }));

      expect(await screen.findByText("DASHBOARD")).toBeInTheDocument();
      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/auth/onboarding", {
          token: "test-token",
          method: "POST",
          body: JSON.stringify({ state: "done" }),
        });
      });
    });
  });
});
