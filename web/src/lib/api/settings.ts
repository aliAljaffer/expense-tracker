export interface SettingsResponse {
  reminder_email: string;
  salary_payers: string;
}

export interface TestReminderResponse {
  sent: boolean;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error) {
      return data.error;
    }
  } catch {
    // Fall through to the caller's message when the body is not JSON.
  }

  return fallback;
}

export async function getSettings(): Promise<SettingsResponse> {
  const response = await fetch("/api/bff/settings");

  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to load settings"));
  }

  return response.json();
}

export async function saveReminderEmail(email: string): Promise<SettingsResponse> {
  return putSettings({ reminder_email: email }, "Failed to save reminder email");
}

export async function saveSalaryPayers(payers: string): Promise<SettingsResponse> {
  return putSettings({ salary_payers: payers }, "Failed to save salary payers");
}

async function putSettings(
  patch: { reminder_email?: string; salary_payers?: string },
  fallback: string
): Promise<SettingsResponse> {
  const response = await fetch("/api/bff/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response, fallback));
  }

  return response.json();
}

export async function sendTestReminder(): Promise<TestReminderResponse> {
  const response = await fetch("/api/bff/settings/reminder/test", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to send test email"));
  }

  return response.json();
}
