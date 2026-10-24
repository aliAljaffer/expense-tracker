"use client";

import { useState } from "react";
import { type ImportPreview } from "@/lib/api/types";
import { UploadForm } from "./UploadForm";
import { ReviewScreen } from "./ReviewScreen";

export function ImportsContent() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (preview) {
    return (
      <div className="space-y-6">
        <ReviewScreen preview={preview} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
        <h2 className="mb-4 text-lg font-medium">Upload</h2>

        {uploadError && (
          <div className="mb-4 rounded-lg border border-[var(--color-feedback-error-border)] bg-[var(--color-feedback-error-bg)] p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 text-[var(--color-feedback-error-icon)]">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="text-sm text-[var(--color-feedback-error-text)]">{uploadError}</div>
            </div>
          </div>
        )}

        <UploadForm
          onUploadComplete={(p) => {
            setUploadError(null);
            setPreview(p);
          }}
          onError={(msg) => {
            setUploadError(msg);
            setPreview(null);
          }}
        />
      </div>
    </div>
  );
}
