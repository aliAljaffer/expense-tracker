"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Listbox } from "@headlessui/react";
import { Checkbox } from "@/components/ui/headless-checkbox";
import { updateTransactionCategory } from "@/lib/api/categories";
import type { Category, Transaction } from "@/lib/api/types";

type SaveState = "idle" | "saving" | "saved" | "error";

// Headless UI opens the listbox on Space and arrows but eats Enter, which the
// button would otherwise show as a no-op.
function openWithEnter(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.currentTarget.click();
}

function Chevron() {
  return (
    <svg className="category-editor__chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg className="category-editor__check" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const KEEP_OPEN = "data-category-editor-keep-open";

// The listbox closes on a pointer down outside its options. The checkbox shares
// the panel, so the window capture handler stops that event before the listbox
// sees it, and the click still reaches the checkbox.
function Keeper() {
  useLayoutEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`[${KEEP_OPEN}]`)) {
        event.stopPropagation();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  return null;
}

interface CategoryCellProps {
  transaction: Transaction;
  categories: Category[];
}

export function CategoryCell({ transaction, categories }: CategoryCellProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState<number | null>(transaction.category_id);
  const [applyToMerchant, setApplyToMerchant] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const known = categories.find((category) => category.id === value);
  const label = value === null
    ? "Uncategorised"
    : known?.name ?? transaction.category_name ?? "Uncategorised";

  // The table wrapper scrolls horizontally and clips an absolutely positioned
  // panel inside a cell, so the panel is fixed to the button measured on open.
  const capturePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPanelStyle({
        "--panel-top": `${rect.bottom}px`,
        "--panel-left": `${rect.left}px`,
      } as CSSProperties);
    }
  };

  const persist = async (categoryId: number | null, apply: boolean) => {
    setState("saving");
    try {
      await updateTransactionCategory(transaction.id, categoryId, apply);
      setState("saved");
      return true;
    } catch {
      setState("error");
      return false;
    }
  };

  const change = async (next: number | null) => {
    if (next === value) {
      setState("idle");
      return;
    }
    const previous = value;
    setValue(next);
    if (!(await persist(next, applyToMerchant))) setValue(previous);
  };

  return (
    <Listbox value={value} onChange={change} disabled={state === "saving"}>
      {({ open }) => (
        <div className="category-editor">
          <Listbox.Button
            ref={buttonRef}
            className="category-editor__button"
            onClick={capturePosition}
            onKeyDown={(event) => {
              capturePosition();
              openWithEnter(event);
            }}
          >
            <span className="visually-hidden">Category: </span>
            <span className="category-editor__value">{label}</span>
            <Chevron />
          </Listbox.Button>

          {state === "saving" && (
            <span className="category-editor__status" role="status">Saving</span>
          )}
          {state === "saved" && (
            <span className="category-editor__status" role="status">Saved</span>
          )}
          {state === "error" && (
            <span className="category-editor__status category-editor__status--error" role="alert">
              Could not save
            </span>
          )}

          {open && (
            <div className="category-editor__panel" style={panelStyle}>
              <Keeper />
              <Listbox.Options static modal={false} className="category-editor__options">
                <Listbox.Option value={null} className="category-editor__option">
                  <span>Uncategorised</span>
                  <Check />
                </Listbox.Option>
                {categories.map((category) => (
                  <Listbox.Option key={category.id} value={category.id} className="category-editor__option">
                    <span>{category.name}</span>
                    <Check />
                  </Listbox.Option>
                ))}
              </Listbox.Options>

              {transaction.merchant_id !== null && (
                <div className="category-editor__apply" {...{ [KEEP_OPEN]: "" }}>
                  <Checkbox
                    checked={applyToMerchant}
                    onChange={setApplyToMerchant}
                    label="Apply to every row from this merchant"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Listbox>
  );
}
