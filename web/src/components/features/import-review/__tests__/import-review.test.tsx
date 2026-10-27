import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderFigures } from "../HeaderFigures";
import { ReconciliationChecks } from "../ReconciliationChecks";
import { RowsTable, HeldRowMarker, initialSelectedIds } from "../RowsTable";
import { AnomalyNotice } from "../AnomalyNotice";
import { type ImportPreview } from "@/lib/api/types";
import fixture from "../../../../../test/fixtures/preview.json";

describe("HeaderFigures", () => {
  it("renders six header figures with formatted values", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    render(<HeaderFigures header={preview.header} />);

    expect(screen.getByText("Opening Balance")).toBeInTheDocument();
    expect(screen.getByText("Closing Balance")).toBeInTheDocument();
    expect(screen.getByText("Debit Total")).toBeInTheDocument();
    expect(screen.getByText("Credit Total")).toBeInTheDocument();
    expect(screen.getByText("Debit Count")).toBeInTheDocument();
    expect(screen.getByText("Credit Count")).toBeInTheDocument();

    expect(screen.getByText("1,000.00 SAR")).toBeInTheDocument();
    expect(screen.getByText("970.00 SAR")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("ReconciliationChecks", () => {
  it("renders all reconciliation checks with pass/fail icons", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    render(<ReconciliationChecks reconciliation={preview.reconciliation} />);

    preview.reconciliation.checks.forEach((check) => {
      const label = check.name.replace(/_/g, " ").replace(/\b\w/g, (l) =>
        l.toUpperCase()
      );
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("renders every failed check label for a rejected statement", () => {
    const preview = fixture.rejected as ImportPreview;
    render(<ReconciliationChecks reconciliation={preview.reconciliation} />);

    preview.reconciliation.checks.forEach((check) => {
      const label = check.name.replace(/_/g, " ").replace(/\b\w/g, (l) =>
        l.toUpperCase()
      );
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});

describe("RowsTable", () => {
  it("renders all rows from the preview", () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();

    const rowsToRender = preview.rows || [];
    render(
      <RowsTable
        rows={rowsToRender}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    expect(rowsToRender).toBeTruthy();
    expect(rowsToRender.length).toBeGreaterThan(0);

    rowsToRender.forEach((row) => {
      expect(screen.getByText(row.posted_date)).toBeInTheDocument();
      expect(screen.getByText(row.description_raw)).toBeInTheDocument();
    });
  });

  it("renders table with semantic markup and scope attributes", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();

    const { container } = render(
      <RowsTable
        rows={preview.rows || []}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();

    const headerCells = container.querySelectorAll("th[scope='col']");
    expect(headerCells.length).toBeGreaterThan(0);
  });

  it("toggles checkbox selection when clicked, preserving original row indices", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <RowsTable
        rows={preview.rows || []}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const firstCheckbox = screen.getAllByRole("checkbox")[0];
    await user.click(firstCheckbox);

    const rows = preview.rows || [];
    const firstDisplayedDateStr = container.querySelector("tbody tr td:nth-child(2)")?.textContent;
    const originalIndexOfFirstDisplayed = rows.findIndex(r => r.posted_date === firstDisplayedDateStr);

    expect(onToggle).toHaveBeenCalledWith(originalIndexOfFirstDisplayed);
  });

  it("initialSelectedIds respects default_selected flags", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    const rows = preview.rows || [];

    const selected = initialSelectedIds(rows);

    rows.forEach((row, index) => {
      if (row.default_selected) {
        expect(selected.has(index)).toBe(true);
      } else {
        expect(selected.has(index)).toBe(false);
      }
    });
  });

  it("initialSelectedIds excludes exact duplicates even if default_selected is true", () => {
    const rows = [
      {
        posted_date: "2026-01-05",
        description_raw: "test",
        debit: 100,
        credit: 0,
        balance_after: 100,
        kind: "card_purchase",
        fingerprint: "abc123",
        duplicate: { score: 10, exact: true, reason: "exact match" },
        default_selected: true,
      },
    ];

    const selected = initialSelectedIds(rows);
    expect(selected.has(0)).toBe(false);
  });

  it("exact duplicate row is disabled with visible reason", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();

    const rowsToRender = preview.rows || [];
    render(
      <RowsTable
        rows={rowsToRender}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const reasonTexts = screen.getAllByText("Already imported");

    rowsToRender.forEach((row, index) => {
      const isExactDuplicate = row.duplicate?.exact === true;

      const checkbox = checkboxes[index];
      if (isExactDuplicate) {
        expect(checkbox).toHaveAttribute("aria-disabled", "true");
        expect(checkbox).toHaveAttribute("aria-checked", "false");
      }
    });

    expect(reasonTexts.length).toBeGreaterThan(0);
  });

  it("held row (score 8+) starts unchecked but is enabled", async () => {
    const preview = fixture.alinma_anomaly as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <RowsTable
        rows={preview.rows || []}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const heldRow = checkboxes[0];

    expect(heldRow).not.toBeDisabled();
    expect(heldRow).not.toBeChecked();

    await user.click(heldRow);
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it("held row label is accessible to assistive tech", () => {
    const preview = fixture.alinma_anomaly as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();

    render(
      <RowsTable
        rows={preview.rows || []}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const row = preview.rows?.[0];
    if (row) {
      const checkboxes = screen.getAllByRole("checkbox");
      const heldRowCheckbox = checkboxes[0];

      expect(heldRowCheckbox.getAttribute("aria-label")).toContain(row.posted_date);
    }
  });

  it("keyboard space toggles checkbox selection", async () => {
    const preview = fixture.alinma_anomaly as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <RowsTable
        rows={preview.rows || []}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const heldRowCheckbox = checkboxes[0];

    heldRowCheckbox.focus();
    await user.keyboard(" ");

    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it("renders Arabic text with dir='auto' for descriptions", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();

    const rowsToRender = preview.rows || [];
    const { container } = render(
      <RowsTable
        rows={rowsToRender}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    rowsToRender.forEach((row) => {
      const cells = container.querySelectorAll("td");
      for (const cell of cells) {
        if (cell.textContent?.includes(row.description_raw)) {
          expect(cell.getAttribute("dir")).toBe("auto");
          break;
        }
      }
    });
  });
});

describe("HeldRowMarker", () => {
  it("renders held row marker with icon and message", () => {
    render(<HeldRowMarker />);

    expect(screen.getByText("Held for review")).toBeInTheDocument();
  });
});

describe("AnomalyNotice", () => {
  it("shows notice when anomaly_ready is false", () => {
    render(<AnomalyNotice anomalyReady={false} historyRows={15} />);

    expect(screen.getByText("Not enough history yet")).toBeInTheDocument();
    expect(screen.getByText(/Anomaly scoring needs at least 20 spending rows/)).toBeInTheDocument();
    expect(screen.getByText(/This account has 15/)).toBeInTheDocument();
  });

  it("renders nothing when anomaly_ready is true", () => {
    const { container } = render(
      <AnomalyNotice anomalyReady={true} historyRows={25} />
    );

    expect(
      screen.queryByText("Not enough history yet")
    ).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });
});

describe("RowsTable sorting", () => {
  it("sorts rows by posted_date descending (newest first)", () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();

    const { container } = render(
      <RowsTable
        rows={preview.rows || []}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const rows = container.querySelectorAll("tbody tr");
    const dates = Array.from(rows).map((row) => {
      const dateCell = row.querySelector("td:nth-child(2)");
      return dateCell?.textContent?.trim();
    });

    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]!.localeCompare(dates[i - 1]!)).toBeLessThanOrEqual(0);
    }
  });

  it("preserves original row indices for selection when displaying sorted rows", async () => {
    const rows = [
      {
        posted_date: "2026-01-01",
        description_raw: "First transaction",
        debit: 100,
        credit: 0,
        balance_after: 900,
        kind: "card_purchase",
        fingerprint: "abc1",
        default_selected: true,
      },
      {
        posted_date: "2026-01-03",
        description_raw: "Third transaction",
        debit: 200,
        credit: 0,
        balance_after: 700,
        kind: "card_purchase",
        fingerprint: "abc3",
        default_selected: true,
      },
      {
        posted_date: "2026-01-02",
        description_raw: "Second transaction",
        debit: 150,
        credit: 0,
        balance_after: 750,
        kind: "card_purchase",
        fingerprint: "abc2",
        default_selected: true,
      },
    ];

    const selectedIds = new Set([0, 1, 2]);
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <RowsTable
        rows={rows}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    expect(onToggle).toHaveBeenCalledWith(1);
  });
});
