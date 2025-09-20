import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainMenu } from "./MainMenu";

describe("MainMenu nickname validation", () => {
  const setup = () => {
    const onPlayLocal = vi.fn();
    const onPlayOnline = vi.fn();
    render(<MainMenu onPlayLocal={onPlayLocal} onPlayOnline={onPlayOnline} />);
    const input = screen.getByLabelText(/your nickname/i) as HTMLInputElement;
    const button = screen.getByRole("button", { name: /play online/i });
    return { onPlayLocal, onPlayOnline, input, button };
  };

  it("disables Play Online when invalid and shows errors on blur", async () => {
    const user = userEvent.setup();
    const { input, button } = setup();
    expect(button).toBeDisabled();

    await user.click(input);
    await user.type(input, "Jo");
    await user.tab();

    expect(screen.getByText(/must be 3–20/i)).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("enables Play Online for valid names and calls with sanitized value", async () => {
    const user = userEvent.setup();
    const { input, button, onPlayOnline } = setup();

    await user.clear(input);
    await user.type(input, "  Alice   42  ");
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onPlayOnline).toHaveBeenCalledWith("Alice 42");
  });

  it("blocks profanity and leetspeak variants", async () => {
    const user = userEvent.setup();
    const { input, button } = setup();

    await user.clear(input);
    await user.type(input, "sh1t");
    await user.tab();
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/family-friendly display name/i)
    ).toBeInTheDocument();
  });
});
