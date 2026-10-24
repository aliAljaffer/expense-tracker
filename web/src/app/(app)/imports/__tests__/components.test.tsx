import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewScreen } from "../ReviewScreen";
import { commitImport, cancelImport } from "../actions";
import fixture from "../../../../../test/fixtures/preview.json";
import { type ImportPreview } from "@/lib/api/types";

vi.mock("../actions");
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("ReviewScreen", () => {
  it("shows commit button for pending status", () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    render(<ReviewScreen preview={preview} />);

    const commitButton = screen.getByRole("button", { name: /commit/i });
    expect(commitButton).toBeInTheDocument();
    expect(commitButton).not.toBeDisabled();
  });

  it("hides commit button for rejected status", () => {
    const preview = fixture.rejected as ImportPreview;
    render(<ReviewScreen preview={preview} />);

    const commitButton = screen.queryByRole("button", { name: /commit/i });
    expect(commitButton).not.toBeInTheDocument();
  });

  it("hides commit button for already_imported status", () => {
    const preview = fixture.already_imported as ImportPreview;
    render(<ReviewScreen preview={preview} />);

    const commitButton = screen.queryByRole("button", { name: /commit/i });
    expect(commitButton).not.toBeInTheDocument();
  });

  it("calls commitImport with default selection from fixture", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ inserted: 7 });

    render(<ReviewScreen preview={preview} />);
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

    render(<ReviewScreen preview={preview} />);
    const user = userEvent.setup();

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    const [, selectedIds] = vi.mocked(commitImport).mock.calls[0];
    expect(selectedIds).toContain(0);
  });

  it("calls cancelImport when cancel button clicked", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(cancelImport).mockResolvedValue({ success: true });

    render(<ReviewScreen preview={preview} />);
    const user = userEvent.setup();

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(cancelImport).toHaveBeenCalledWith(preview.import_id);
  });

  it("shows inserted count after successful commit", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ inserted: 7 });

    render(<ReviewScreen preview={preview} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    expect(await screen.findByText(/7 rows? imported successfully/i)).toBeInTheDocument();
  });

  it("shows error message on commit failure", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(commitImport).mockResolvedValue({ error: "API error" });

    render(<ReviewScreen preview={preview} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    await user.click(commitButton);

    expect(await screen.findByText("API error")).toBeInTheDocument();
  });

  it("shows error message on cancel failure", async () => {
    const preview = fixture.alrajhi_ok as ImportPreview;
    vi.mocked(cancelImport).mockResolvedValue({ error: "Cancel failed" });

    render(<ReviewScreen preview={preview} />);
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

    render(<ReviewScreen preview={preview} />);
    const user = userEvent.setup();

    const commitButton = screen.getByRole("button", { name: /commit/i });
    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    await user.click(commitButton);

    expect(commitButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });
});
