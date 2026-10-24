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
      xhr.withCredentials = true;
      xhr.send(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      onError(message);
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack--normal">
      <div className="field">
        <label htmlFor="statement-file" className="field__label">
          Statement file
        </label>
        <input
          ref={fileInputRef}
          id="statement-file"
          type="file"
          accept=".xlsx,.pdf"
          disabled={isLoading}
          className="import-file-input"
          required
        />
        <p className="field__hint">
          Upload an Alinma XLSX or Al Rajhi PDF export
        </p>
      </div>

      {isLoading && uploadProgress > 0 && (
        <div className="import-upload-progress">
          <div className="import-upload-progress__info">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="import-upload-progress__bar">
            <div
              className="import-upload-progress__fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className={`btn btn--primary ${isLoading ? "disabled" : ""}`}
      >
        {isLoading ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
