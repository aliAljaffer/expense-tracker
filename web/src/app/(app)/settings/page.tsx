import type { Metadata } from "next";
import { SettingsForm } from "@/components/features/settings/SettingsForm";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="overview-page">
      <div className="overview-section">
        <h1 className="overview-page__title">Settings</h1>
        <p className="overview-page__lede">
          Reminder delivery, and which transfers count as salary.
        </p>
      </div>

      <SettingsForm />
    </div>
  );
}
