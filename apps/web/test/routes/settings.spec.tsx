import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "@/routes/settings";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    user: { id: "user-1", email: "test@example.com" },
    loading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a Roastr Persona link pointing to /settings/persona on the Perfil tab", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Roastr Persona/ })).toHaveAttribute(
      "href",
      "/settings/persona",
    );
  });
});
