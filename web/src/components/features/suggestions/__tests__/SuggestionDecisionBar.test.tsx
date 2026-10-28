import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SuggestionDecisionBar } from "../SuggestionDecisionBar";

describe("SuggestionDecisionBar", () => {
  it("acknowledges in one click", async () => {
    const onDecide = vi.fn(async () => {});
    render(<SuggestionDecisionBar decision="" onDecide={onDecide} />);

    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    await waitFor(() => expect(onDecide).toHaveBeenCalledWith("acknowledged"));
  });

  it("confirms a dismissal before applying it", async () => {
    const onDecide = vi.fn(async () => {});
    render(<SuggestionDecisionBar decision="" onDecide={onDecide} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Dismiss this suggestion?");
    expect(onDecide).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(onDecide).toHaveBeenCalledWith("dismissed"));
  });

  it("cancels a dismissal without deciding", async () => {
    const onDecide = vi.fn(async () => {});
    render(<SuggestionDecisionBar decision="" onDecide={onDecide} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onDecide).not.toHaveBeenCalled();
  });

  it("undoes an acknowledged decision", async () => {
    const onDecide = vi.fn(async () => {});
    render(<SuggestionDecisionBar decision="acknowledged" onDecide={onDecide} />);

    expect(screen.getByText("Acknowledged")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(onDecide).toHaveBeenCalledWith(""));
  });

  it("shows an error and keeps the state when saving fails", async () => {
    const onDecide = vi.fn(async () => {
      throw new Error("network");
    });
    render(<SuggestionDecisionBar decision="" onDecide={onDecide} />);

    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(
      await screen.findByText("Could not save the decision. Try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acknowledge" })).toBeEnabled();
  });
});
