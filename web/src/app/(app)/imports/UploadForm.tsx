"use client";

import { useState, useRef } from "react";
import { type ImportPreview } from "@/lib/api/types";

interface UploadFormProps {
  onUploadComplete: (preview: ImportPreview) => void;
  onError: (message: string) => void;
}

export function UploadForm({ onUploadComplete, onError }: UploadFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      onError("Please select a file");
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setUploadProgress((event.loaded / event.total) * 100);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200 || xhr.status === 422) {
          try {
            const preview = JSON.parse(xhr.responseText) as ImportPreview;
            onUploadComplete(preview);
          } catch {
            onError("Invalid response from server");
          }
        } else if (xhr.status === 401) {
          onError("Session expired, please sign in again");
        } else {
          onError(`Upload failed: HTTP ${xhr.status}`);
        }
        setIsLoading(false);
      });

      xhr.addEventListener("error", () => {
        onError("Network error during upload");
        setIsLoading(false);
      });

      xhr.addEventListener("abort", () => {
        onError("Upload cancelled");
        setIsLoading(false);
      });

      const formData = new FormData();
      formData.append("file", file);

      xhr.open("POST", "/api/imports");
      xhr.send(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      onError(message);
      setIsLoading(false);
    }
  }

  const buttonState = isLoading ? "loading" : "ready";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="statement-file" className="block text-sm font-medium">
          Statement file
        </label>
        <input
          ref={fileInputRef}
          id="statement-file"
          type="file"
          accept=".xlsx,.pdf"
          disabled={isLoading}
          className="block w-full text-sm"
          required
        />
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Upload an Alinma XLSX or Al Rajhi PDF export
        </p>
      </div>

      {isLoading && uploadProgress > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--color-surface-sunken)]">
            <div
              className="h-2 rounded-full bg-[var(--color-action-primary)]"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className={`px-4 py-2 rounded-md font-medium transition-colors ${
          buttonState === "loading"
            ? "bg-[var(--color-surface-disabled)] text-[var(--color-text-disabled)] cursor-not-allowed"
            : "bg-[var(--color-action-primary)] text-[var(--color-text-on-action)] hover:bg-[var(--color-action-primary-hover)] active:bg-[var(--color-action-primary-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)]"
        }`}
      >
        {isLoading ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
