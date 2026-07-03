import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

function SmokeButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Click me</button>;
}

describe("Testing Library + jsdom setup", () => {
  it("renders a component and finds it by role", () => {
    render(<SmokeButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("fires user events", async () => {
    const onClick = vi.fn();
    render(<SmokeButton onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Click me" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
