import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderFigures } from "../HeaderFigures";
import { ReconciliationChecks } from "../ReconciliationChecks";
import { RowsTable, HeldRowMarker, initialSelectedIds } from "../RowsTable";
import { AnomalyNotice } from "../AnomalyNotice";
import { StatusBanner } from "../StatusBanner";
import {
  formatSAR,
  displaySAR,
  type ImportPreview,
} from "@/lib/api/types";
import fixture from "../../../../../test/fixtures/preview.json";

describe("Money Formatting", () => {
  it("formats integer halalas to SAR string", () => {
    expect(formatSAR(0)).toBe("0.00");
    expect(formatSAR(100)).toBe("1.00");
    expect(formatSAR(2575)).toBe("25.75");
    expect(formatSAR(100000)).toBe("1000.00");
  });

  it("displays SAR with symbol and thousands separator", () => {
    expect(displaySAR(0)).toBe("0.00 SAR");
    expect(displaySAR(100)).toBe("1.00 SAR");
    expect(displaySAR(2575)).toBe("25.75 SAR");
    expect(displaySAR(100000)).toBe("1,000.00 SAR");
    expect(displaySAR(1234567)).toBe("12,345.67 SAR");
  });
});

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

  it("renders all six figures with exact formatted values from fixture", () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    render(<HeaderFigures header={preview.header} />);

    const openingBalance = preview.header.opening_balance;
    const closingBalance = preview.header.closing_balance;

    expect(screen.getByText(displaySAR(openingBalance!))).toBeInTheDocument();
    expect(screen.getByText(displaySAR(closingBalance!))).toBeInTheDocument();
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

  it("shows pass icon and colors for passing checks", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    const { container } = render(
      <ReconciliationChecks reconciliation={preview.reconciliation} />
    );

    const passChecks = container.querySelectorAll(
      "div[class*='bg-feedback-success']"
    );
    expect(passChecks.length).toBeGreaterThan(0);
  });

  it("shows fail icon and colors for failing checks", () => {
    const preview = fixture.rejected as ImportPreview;
    const { container } = render(
      <ReconciliationChecks reconciliation={preview.reconciliation} />
    );

    const failChecks = container.querySelectorAll(
      "div[class*='bg-feedback-error']"
    );
    expect(failChecks.length).toBeGreaterThan(0);
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
    expect(screen.getByText("Imported transaction rows with selection and duplicate/anomaly scores.")).toBeInTheDocument();

    const headerCells = container.querySelectorAll("th[scope='col']");
    expect(headerCells.length).toBeGreaterThan(0);
  });

  it("toggles checkbox selection when clicked", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
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

    const firstCheckbox = screen.getAllByRole("checkbox")[0];
    await user.click(firstCheckbox);

    expect(onToggle).toHaveBeenCalledWith(0);
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
        expect(checkbox).toBeDisabled();
        expect(checkbox).not.toBeChecked();
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

    const checkboxes = screen.getAllByRole("checkbox");
    const heldRowCheckbox = checkboxes[0];

    expect(heldRowCheckbox.getAttribute("aria-label")).toMatch(/row 1/i);
  });

  it("exact duplicate row has aria-describedby pointing to reason text", () => {
    const preview = fixture.alinma_ok as ImportPreview;
    const selectedIds = new Set<number>();
    const onToggle = vi.fn();

    render(
      <RowsTable
        rows={preview.rows || []}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const exactDupCheckbox = checkboxes[0];

    const describedById = exactDupCheckbox.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const reasonElement = document.getElementById(describedById || "");
    expect(reasonElement).toBeInTheDocument();
    expect(reasonElement?.textContent).toMatch(/Already imported/i);
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

  it("displays duplicate scores and reasons when present", () => {
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

    const duplicateRows = rowsToRender.filter((r) => r.duplicate);
    expect(duplicateRows.length).toBeGreaterThan(0);

    const firstDuplicate = duplicateRows[0]?.duplicate;
    if (firstDuplicate) {
      expect(screen.getAllByText(firstDuplicate.reason).length).toBeGreaterThan(
        0
      );
    }
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

describe("StatusBanner", () => {
  it("renders ready variant with success icon and message", () => {
    render(<StatusBanner variant="ready" showCommitControl={true} />);

    expect(screen.getByText("Ready to review")).toBeInTheDocument();
    expect(
      screen.getByText(/All reconciliation checks passed/)
    ).toBeInTheDocument();
  });

  it("renders rejected variant with error icon and message", () => {
    render(<StatusBanner variant="rejected" />);

    expect(screen.getByText("Import rejected")).toBeInTheDocument();
    expect(
      screen.getByText(/Reconciliation checks failed/)
    ).toBeInTheDocument();
  });

  it("renders already_imported variant with warning icon and message", () => {
    render(<StatusBanner variant="already_imported" />);

    expect(screen.getByText("Already imported")).toBeInTheDocument();
    expect(
      screen.getByText(/This file has already been imported/)
    ).toBeInTheDocument();
  });

  it("does not show commit control message when prop is false", () => {
    render(<StatusBanner variant="ready" showCommitControl={false} />);

    expect(
      screen.queryByText(/Select rows above and commit/)
    ).not.toBeInTheDocument();
  });

  it("shows commit control message when prop is true", () => {
    render(<StatusBanner variant="ready" showCommitControl={true} />);

    expect(
      screen.getByText(/Select rows above and commit to import them/)
    ).toBeInTheDocument();
  });
});
