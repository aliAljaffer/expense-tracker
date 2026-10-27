import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatScreen } from "../ChatScreen";
import { ChatUnavailableError, sendChat } from "@/lib/api/chat";

vi.mock("@/lib/api/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat")>("@/lib/api/chat");
  return { ...actual, sendChat: vi.fn() };
});

describe("ChatScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains what to ask and what is sent before the first message", () => {
    render(<ChatScreen />);

    expect(screen.getByText("No messages yet.")).toBeInTheDocument();
    expect(screen.getByText(/Only your monthly summary figures are sent/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends a message and renders the reply", async () => {
    vi.mocked(sendChat).mockResolvedValue("March spending was SAR 4,805.75.");
    render(<ChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message"), "How much did I spend in March?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("March spending was SAR 4,805.75.")).toBeInTheDocument();
    expect(screen.getByText("How much did I spend in March?")).toBeInTheDocument();
    expect(sendChat).toHaveBeenCalledWith([
      { role: "user", content: "How much did I spend in March?" },
    ]);
  });

  it("sends on Enter", async () => {
    vi.mocked(sendChat).mockResolvedValue("Bills were SAR 3,750.00.");
    render(<ChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message"), "How much went to bills?{Enter}");

    expect(sendChat).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Bills were SAR 3,750.00.")).toBeInTheDocument();
  });

  it("adds a newline on Shift and Enter without sending", async () => {
    render(<ChatScreen />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Message");

    await user.type(input, "Line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(input, "Line two");

    expect(sendChat).not.toHaveBeenCalled();
    expect(input).toHaveValue("Line one\nLine two");
  });

  it("shows a pending row and disables Send while waiting", async () => {
    let resolveReply: (reply: string) => void = () => {};
    vi.mocked(sendChat).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveReply = resolve;
        })
    );

    render(<ChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message"), "What changed last month?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Reading your monthly summary...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();

    await act(async () => {
      resolveReply("Spending fell by SAR 120.00.");
    });

    expect(await screen.findByText("Spending fell by SAR 120.00.")).toBeInTheDocument();
    expect(screen.queryByText("Reading your monthly summary...")).not.toBeInTheDocument();
  });

  it("shows the API error and keeps the message for a retry", async () => {
    vi.mocked(sendChat).mockRejectedValue(new Error("provider timed out"));
    render(<ChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message"), "Which category grew most?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("provider timed out");
    expect(screen.getByText("Which category grew most?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();

    vi.mocked(sendChat).mockResolvedValue("Groceries grew most.");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Groceries grew most.")).toBeInTheDocument();
    expect(sendChat).toHaveBeenLastCalledWith([
      { role: "user", content: "Which category grew most?" },
    ]);
  });

  it("explains that the assistant is not configured", async () => {
    vi.mocked(sendChat).mockRejectedValue(new ChatUnavailableError());
    render(<ChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message"), "How much did I spend?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/not configured on this server/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("sends at most the last eight messages", async () => {
    let replies = 0;
    vi.mocked(sendChat).mockImplementation(async () => {
      replies += 1;
      return `reply ${replies}`;
    });

    const { container } = render(<ChatScreen />);
    const user = userEvent.setup();

    for (let index = 1; index <= 5; index += 1) {
      await user.type(screen.getByLabelText("Message"), `message ${index}`);
      await user.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByText(`reply ${index}`);
    }

    const lastHistory = vi.mocked(sendChat).mock.calls.at(-1)?.[0] ?? [];
    expect(lastHistory).toHaveLength(8);
    expect(lastHistory.at(-1)).toEqual({ role: "user", content: "message 5" });
    expect(container.querySelectorAll(".chat__message")).toHaveLength(8);
    expect(
      vi
        .mocked(sendChat)
        .mock.calls.every(([history]) => history.length <= 8)
    ).toBe(true);
  });
});
