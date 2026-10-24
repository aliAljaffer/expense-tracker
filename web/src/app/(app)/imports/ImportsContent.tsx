"use client";

import { useState } from "react";
import { type ImportPreview } from "@/lib/api/types";
import { UploadForm } from "./UploadForm";
import { ReviewScreen } from "./ReviewScreen";

export function ImportsContent() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleReset() {
    setPreview(null);
    setUploadError(null);
  }

  if (preview) {
    return (
      <div className="stack--loose">
        <ReviewScreen preview={preview} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div className="stack--xl">
      <div className="card">
        <h2 className="panel__title" style={{ marginBottom: "var(--space-4)" }}>Upload</h2>

        {uploadError && (
          <div className="banner banner--error" style={{ marginBottom: "var(--space-4)" }}>
            <svg className="banner__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="banner__content">
              <p className="banner__text">{uploadError}</p>
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
