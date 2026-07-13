import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PersonaSettingsPage } from "@/routes/persona";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/persona"]}>
      <Routes>
        <Route path="/settings/persona" element={<PersonaSettingsPage />} />
        <Route path="/settings" element={<div>SETTINGS PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PersonaSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      session: { access_token: "test-token" },
      user: { id: "user-1" },
      loading: false,
      isAuthenticated: true,
    });
  });

  it("renders the page heading and the persona form", async () => {
    mockedApiFetch.mockResolvedValue({ identities: [], redLines: [], tolerances: [] });

    renderPage();

    expect(screen.getByText("Roastr Persona")).toBeInTheDocument();
    expect(await screen.findByLabelText("Lo que me define")).toBeInTheDocument();
    expect(mockedApiFetch).toHaveBeenCalledWith("/persona", { token: "test-token" });
  });

  it("has a link back to /settings", () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole("link", { name: /Volver a ajustes/ })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("does not render the form when there is no session token", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      isAuthenticated: false,
    });

    renderPage();

    expect(screen.queryByLabelText("Lo que me define")).not.toBeInTheDocument();
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });
});
