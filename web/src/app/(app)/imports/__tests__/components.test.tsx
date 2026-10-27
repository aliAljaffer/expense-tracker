import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewScreen } from "../ReviewScreen";
import { commitImport, cancelImport } from "../actions";
import fixture from "../../../../../test/fixtures/preview.json";
import { type ImportPreview } from "@/lib/api/types";

vi.mock("../actions");
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ReviewScreen", () => {
  const mockOnReset = vi.fn();

  it("shows action bar with commit button for pending status", () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);

    expect(screen.getByText(/of.*rows selected/i)).toBeInTheDocument();
    const commitButton = screen.getByRole("button", { name: /commit/i });
    expect(commitButton).toBeInTheDocument();
  });

  it("hides action bar for rejected status", () => {
    const preview = fixture.rejected as ImportPreview;
    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);

    expect(screen.queryByText(/of.*rows selected/i)).not.toBeInTheDocument();
  });

  it("hides action bar for already_imported status", () => {
    const preview = fixture.already_imported as ImportPreview;
    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);

    expect(screen.queryByText(/of.*rows selected/i)).not.toBeInTheDocument();
  });

  it("calls commitImport with default selection from fixture", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ inserted: 7 });

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    expect(commitImport).toHaveBeenCalledWith(preview.import_id, expect.any(Array));
    const [, selectedIds] = vi.mocked(commitImport).mock.calls[0];
    expect(selectedIds).toHaveLength(preview.summary.default_rows);
  });

  it("calls commitImport with held row after owner toggles it", async () => {
    const preview = fixture.alinma_anomaly as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ inserted: 1 });

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);
    const user = userEvent.setup();

    const rowCheckbox = screen.getByRole("checkbox", { name: /select row/i });
    await user.click(rowCheckbox);

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    const [, selectedIds] = vi.mocked(commitImport).mock.calls[0];
    expect(selectedIds).toContain(0);
  });

  it("calls cancelImport and onReset when cancel button clicked", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    const mockReset = vi.fn();
    vi.mocked(cancelImport).mockResolvedValue({ success: true });

    render(<ReviewScreen preview={preview} onReset={mockReset} />);
    const user = userEvent.setup();

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(cancelImport).toHaveBeenCalledWith(preview.import_id);
    expect(mockReset).toHaveBeenCalled();
  });

  it("shows inserted count and View overview link after successful commit", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ inserted: 7 });

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    expect(await screen.findByText(/7 rows? imported successfully/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view overview/i })).toBeInTheDocument();
  });

  it("shows Import another statement button that calls onReset", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    const mockReset = vi.fn();
    vi.mocked(commitImport).mockResolvedValue({ inserted: 1 });

    render(<ReviewScreen preview={preview} onReset={mockReset} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    const importAnotherButton = await screen.findByRole("button", { name: /import another/i });
    await user.click(importAnotherButton);

    expect(mockReset).toHaveBeenCalled();
  });

  it("shows error message on commit failure", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ error: "API error" });

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    expect(await screen.findByText("API error")).toBeInTheDocument();
  });

  it("shows error message on cancel failure", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(cancelImport).mockResolvedValue({ error: "Cancel failed" });

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);
    const user = userEvent.setup();

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(await screen.findByText("Cancel failed")).toBeInTheDocument();
  });

  it("disables buttons during commit", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(commitImport).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ inserted: 1 }), 100))
    );

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    await user.click(commitButton);

    expect(commitButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it("disables commit button when zero rows selected", () => {
    const rows = [
      {
        posted_date: "2026-01-01",
        description_raw: "Test",
        debit: 100,
        credit: 0,
        balance_after: 900,
        kind: "card_purchase",
        fingerprint: "abc",
        default_selected: false,
      },
    ];
    const preview = {
      ...fixture.alrajhi_ok,
      rows,
      summary: { ...fixture.alrajhi_ok.summary, default_rows: 0 },
    } as ImportPreview;

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);

    const commitButton = screen.getByRole("button", { name: /commit/i });
    expect(commitButton).toBeDisabled();
  });

  it("keeps selection across pages and commits ids from every page", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      posted_date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      description_raw: `Row ${i}`,
      debit: 100,
      credit: 0,
      balance_after: 1000 - i * 10,
      kind: "card_purchase",
      fingerprint: `fp-${i}`,
      default_selected: true,
    }));
    const preview = {
      ...fixture.alrajhi_ok,
      rows,
      summary: { ...fixture.alrajhi_ok.summary, rows: 30, default_rows: 30 },
    } as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ inserted: 29 });

    render(<ReviewScreen preview={preview} onReset={mockOnReset} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("checkbox", { name: /select row 2026-01-25/i }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Showing 26 to 30 of 30 rows/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^commit/i }));

    const [, selectedIds] = vi.mocked(commitImport).mock.calls[0];
    expect(selectedIds).toHaveLength(29);
    expect(selectedIds).toContain(0);
    expect(selectedIds).not.toContain(24);
  });
});
