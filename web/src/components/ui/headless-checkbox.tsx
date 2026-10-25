"use client";

import { Checkbox as HeadlessCheckbox, Field, Label } from "@headlessui/react";

interface HeadlessCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  ariaLabel?: string;
  indeterminate?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel,
  indeterminate = false,
}: HeadlessCheckboxProps) {
  return (
    <Field>
      <div
        className="import-checkbox"
        data-checked={checked}
        data-disabled={disabled}
        data-indeterminate={indeterminate}
      >
        <HeadlessCheckbox
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-label={ariaLabel || label}
          className="import-checkbox__control"
        >
          {checked && (
            <svg
              className="import-checkbox__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {indeterminate && (
            <svg
              className="import-checkbox__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </HeadlessCheckbox>
        {label && (
          <Label className="import-checkbox__label">
            {label}
          </Label>
        )}
      </div>
    </Field>
  );
}
