import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsForm } from "../SettingsForm";
import * as settingsApi from "@/lib/api/settings";

vi.mock("@/lib/api/settings");

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the saved reminder email", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({
      reminder_email: "owner@example.com",
      salary_payers: "",
    });

    render(<SettingsForm />);

    expect(await screen.findByLabelText("Reminder email")).toHaveValue("owner@example.com");
    expect(screen.getByRole("button", { name: "Send test email" })).toBeEnabled();
  });

  it("keeps test email disabled until an address is saved", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({ reminder_email: "", salary_payers: "" });

    render(<SettingsForm />);

    expect(await screen.findByRole("button", { name: "Send test email" })).toBeDisabled();
  });

  it("saves a valid address and shows a success message", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({ reminder_email: "", salary_payers: "" });
    vi.mocked(settingsApi.saveReminderEmail).mockResolvedValue({
      reminder_email: "owner@example.com",
      salary_payers: "",
    });

    render(<SettingsForm />);
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Reminder email");

    await user.type(input, "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(settingsApi.saveReminderEmail).toHaveBeenCalledWith("owner@example.com");
    expect(await screen.findByText("Reminder email saved.")).toBeInTheDocument();
  });

  it("rejects an empty address without calling the API", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({ reminder_email: "", salary_payers: "" });

    render(<SettingsForm />);
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Reminder email");

    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(settingsApi.saveReminderEmail).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a reminder email address.")).toBeInTheDocument();
  });

  it("surfaces the server error for an invalid address", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({ reminder_email: "", salary_payers: "" });
    vi.mocked(settingsApi.saveReminderEmail).mockRejectedValue(
      new Error("invalid email address")
    );

    render(<SettingsForm />);
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Reminder email");

    await user.type(input, "not-an-email");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("invalid email address")).toBeInTheDocument();
  });

  it("sends a test email and shows a success message", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({
      reminder_email: "owner@example.com",
      salary_payers: "",
    });
    vi.mocked(settingsApi.sendTestReminder).mockResolvedValue({ sent: true });

    render(<SettingsForm />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Send test email" }));

    expect(settingsApi.sendTestReminder).toHaveBeenCalled();
    expect(
      await screen.findByText("Test email sent to owner@example.com.")
    ).toBeInTheDocument();
  });

  it("shows the server error when the test email fails", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({
      reminder_email: "owner@example.com",
      salary_payers: "",
    });
    vi.mocked(settingsApi.sendTestReminder).mockRejectedValue(
      new Error("smtp unavailable")
    );

    render(<SettingsForm />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Send test email" }));

    expect(await screen.findByText("smtp unavailable")).toBeInTheDocument();
  });

  it("loads and saves salary payers", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({
      reminder_email: "owner@example.com",
      salary_payers: "Saudi Azm",
    });
    vi.mocked(settingsApi.saveSalaryPayers).mockResolvedValue({
      reminder_email: "owner@example.com",
      salary_payers: "Saudi Azm, ACME",
    });

    render(<SettingsForm />);
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Salary payers");

    expect(input).toHaveValue("Saudi Azm");

    await user.type(input, ", ACME");
    await user.click(screen.getByRole("button", { name: "Save payers" }));

    expect(settingsApi.saveSalaryPayers).toHaveBeenCalledWith("Saudi Azm, ACME");
    expect(await screen.findByText("Salary payers saved.")).toBeInTheDocument();
  });
});
