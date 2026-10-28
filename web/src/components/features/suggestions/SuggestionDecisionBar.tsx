"use client";

import { useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import type { SuggestionDecision } from "@/lib/api/types";

interface SuggestionDecisionBarProps {
  decision: SuggestionDecision;
  onDecide: (decision: SuggestionDecision) => Promise<void>;
}

export function SuggestionDecisionBar({ decision, onDecide }: SuggestionDecisionBarProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: SuggestionDecision) {
    setIsSaving(true);
    setError(null);
    try {
      await onDecide(next);
      setIsConfirming(false);
    } catch {
      setError("Could not save the decision. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="suggestion-decision">
      {decision === "" && (
        <>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => apply("acknowledged")}
            disabled={isSaving}
          >
            Acknowledge
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setIsConfirming(true)}
            disabled={isSaving}
          >
            Dismiss
          </button>
        </>
      )}

      {decision === "acknowledged" && (
        <>
          <span className="suggestion-decision__state">Acknowledged</span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => apply("")}
            disabled={isSaving}
          >
            Undo
          </button>
        </>
      )}

      {decision === "dismissed" && (
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => apply("")}
          disabled={isSaving}
        >
          Undo
        </button>
      )}

      {error ? (
        <p className="suggestion-decision__error" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={isConfirming}
        onClose={() => setIsConfirming(false)}
        className="suggestion-dialog"
      >
        <DialogBackdrop className="suggestion-dialog__backdrop" />
        <div className="suggestion-dialog__positioner">
          <DialogPanel className="suggestion-dialog__panel">
            <DialogTitle className="suggestion-dialog__title">
              Dismiss this suggestion?
            </DialogTitle>
            <p className="suggestion-dialog__text">
              The data stays available. You can undo this at any time.
            </p>
            <div className="suggestion-dialog__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setIsConfirming(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => apply("dismissed")}
                disabled={isSaving}
              >
                Dismiss
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
