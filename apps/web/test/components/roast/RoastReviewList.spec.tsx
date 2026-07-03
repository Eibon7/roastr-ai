import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoastReviewList } from "@/components/roast/RoastReviewList";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    isAuthenticated: true,
  }),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function candidate(overrides: Partial<{
  id: string;
  platform: string;
  tone: string;
  status: "pending_review" | "approved" | "discarded" | "published";
  has_validation_errors: boolean;
  created_at: string;
  account_id: string;
}> = {}) {
  return {
    id: "cand-1",
    platform: "youtube",
    tone: "balanceado",
    status: "pending_review" as const,
    has_validation_errors: false,
    created_at: new Date().toISOString(),
    account_id: "acc-1",
    ...overrides,
  };
}

describe("RoastReviewList", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("shows a loading skeleton while fetching", () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}));

    render(<RoastReviewList />);

    expect(screen.getByTestId("roast-review-loading")).toBeInTheDocument();
  });

  it("shows a destructive alert on fetch error", async () => {
    mockedApiFetch.mockRejectedValue(new Error("Error de red"));

    render(<RoastReviewList />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Error de red");
  });

  it("shows an empty state when there are no candidates", async () => {
    mockedApiFetch.mockResolvedValue({ candidates: [] });

    render(<RoastReviewList />);

    expect(await screen.findByText("No hay roasts pendientes de revisión.")).toBeInTheDocument();
  });

  it("renders candidates fetched from /roast/candidates", async () => {
    mockedApiFetch.mockResolvedValue({
      candidates: [candidate({ id: "cand-1", platform: "youtube", tone: "canalla" })],
    });

    render(<RoastReviewList />);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/roast/candidates", { token: "test-token" });
    });
    expect((await screen.findAllByText("YouTube")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Canalla").length).toBeGreaterThan(0);
  });

  it("discards a pending candidate and refetches the list", async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ candidates: [candidate({ id: "cand-1" })] })
      .mockResolvedValueOnce(undefined) // PATCH discard
      .mockResolvedValueOnce({ candidates: [] }); // refetch after discard

    render(<RoastReviewList />);

    const discardButtons = await screen.findAllByRole("button", { name: "Descartar roast" });
    await userEvent.click(discardButtons[0]);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenNthCalledWith(2, "/roast/candidates/cand-1/discard", {
        token: "test-token",
        method: "PATCH",
      });
    });
    expect(await screen.findByText("No hay roasts pendientes de revisión.")).toBeInTheDocument();
  });

  it("shows a destructive alert when discard fails", async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ candidates: [candidate({ id: "cand-1" })] })
      .mockRejectedValueOnce(new Error("No se pudo descartar"));

    render(<RoastReviewList />);

    const discardButtons = await screen.findAllByRole("button", { name: "Descartar roast" });
    await userEvent.click(discardButtons[0]);

    expect(await screen.findByText("No se pudo descartar")).toBeInTheDocument();
  });
});
