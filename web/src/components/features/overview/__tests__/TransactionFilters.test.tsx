import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionFilters } from "../TransactionFilters";

const { push, searchParams } = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams.current,
}));

const months = ["2026-03", "2026-02", "2026-01"];

function pushedParams(): URLSearchParams {
  const url = push.mock.calls[0][0] as string;
  return new URLSearchParams(url.slice(1));
}

describe("TransactionFilters", () => {
  beforeEach(() => {
    push.mockReset();
    searchParams.current = new URLSearchParams();
  });

  it("opens the filter listbox and shows every option", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters months={months} />);

    const trigger = screen.getByRole("button", { name: /^Filter: / });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Transfers" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Uncategorised" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "International purchase" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cash withdrawal" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(13);
  });

  it("pushes the exact bucket value and resets the page", async () => {
    const user = userEvent.setup();
    searchParams.current = new URLSearchParams("month=2026-02&per_page=50&page=3");
    render(<TransactionFilters months={months} />);

    await user.click(screen.getByRole("button", { name: /^Filter: / }));
    await user.click(screen.getByRole("option", { name: "Card payments" }));

    const pushed = pushedParams();
    expect(pushed.get("bucket")).toBe("card_payments");
    expect(pushed.get("page")).toBe("1");
    expect(pushed.get("month")).toBe("2026-02");
    expect(pushed.get("per_page")).toBe("50");
    expect(pushed.get("kind")).toBeNull();
  });

  it("pushes the exact kind value and replaces a bucket", async () => {
    const user = userEvent.setup();
    searchParams.current = new URLSearchParams("bucket=transfers&page=2");
    render(<TransactionFilters months={months} />);

    await user.click(screen.getByRole("button", { name: /^Filter: / }));
    await user.click(screen.getByRole("option", { name: "Card purchase" }));

    const pushed = pushedParams();
    expect(pushed.get("kind")).toBe("card_purchase");
    expect(pushed.get("bucket")).toBeNull();
    expect(pushed.get("page")).toBe("1");
  });

  it("changes the month and drops the incoming date range", async () => {
    const user = userEvent.setup();
    searchParams.current = new URLSearchParams("from=2026-03-01&to=2026-03-31&page=4");
    render(<TransactionFilters months={months} />);

    await user.click(screen.getByRole("button", { name: /^Month: / }));
    await user.click(screen.getByRole("option", { name: "February 2026" }));

    const pushed = pushedParams();
    expect(pushed.get("month")).toBe("2026-02");
    expect(pushed.get("from")).toBeNull();
    expect(pushed.get("to")).toBeNull();
    expect(pushed.get("page")).toBe("1");
  });

  it("clears month, bucket and kind and resets the page", async () => {
    const user = userEvent.setup();
    searchParams.current = new URLSearchParams(
      "month=2026-02&bucket=transfers&from=2026-02-01&to=2026-02-28&page=5"
    );
    render(<TransactionFilters months={months} />);

    expect(screen.getByText(/Showing: from 2026-02-01 to 2026-02-28/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));

    const pushed = pushedParams();
    expect(pushed.get("month")).toBeNull();
    expect(pushed.get("bucket")).toBeNull();
    expect(pushed.get("kind")).toBeNull();
    expect(pushed.get("from")).toBeNull();
    expect(pushed.get("to")).toBeNull();
    expect(pushed.get("page")).toBe("1");
  });

  it("selects with the keyboard", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters months={months} />);

    screen.getByRole("button", { name: /^Filter: / }).focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");

    const pushed = pushedParams();
    expect(pushed.get("bucket")).toBe("income");
    expect(pushed.get("page")).toBe("1");
  });

  it("opens on Enter as well as Space", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters months={months} />);

    const trigger = screen.getByRole("button", { name: /^Filter: / });
    trigger.focus();

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
