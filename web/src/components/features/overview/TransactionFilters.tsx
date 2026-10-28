"use client";

import type { KeyboardEvent } from "react";
import { Listbox } from "@headlessui/react";
import { useRouter, useSearchParams } from "next/navigation";

interface FilterOption {
  label: string;
  param?: "bucket" | "kind";
  value?: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { label: "All transactions" },
  { label: "Income", param: "bucket", value: "income" },
  { label: "Spending", param: "bucket", value: "spending" },
  { label: "Transfers", param: "bucket", value: "transfers" },
  { label: "Card payments", param: "bucket", value: "card_payments" },
  { label: "Uncategorised", param: "bucket", value: "uncategorised" },
  { label: "Refunds", param: "bucket", value: "refunds" },
  { label: "Card purchase", param: "kind", value: "card_purchase" },
  { label: "Online purchase", param: "kind", value: "online_purchase" },
  { label: "International purchase", param: "kind", value: "intl_purchase" },
  { label: "Bill payment", param: "kind", value: "bill_payment" },
  { label: "Cash withdrawal", param: "kind", value: "cash_withdrawal" },
  { label: "Fee", param: "kind", value: "fee" },
];

const ALL = "";

function optionToken(option: FilterOption): string {
  return option.param && option.value ? `${option.param}:${option.value}` : ALL;
}

function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) return month;
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
}

function Chevron() {
  return (
    <svg className="transactions-filters__chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Headless UI opens the listbox on Space and arrows but eats Enter, which the
// button would otherwise show as a no-op.
function openWithEnter(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.currentTarget.click();
}

interface TransactionFiltersProps {
  months: string[];
}

export function TransactionFilters({ months }: TransactionFiltersProps) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const month = currentSearchParams.get("month") ?? "";
  const bucket = currentSearchParams.get("bucket") ?? "";
  const kind = currentSearchParams.get("kind") ?? "";
  const from = currentSearchParams.get("from") ?? "";
  const to = currentSearchParams.get("to") ?? "";

  const monthOptions = month && !months.includes(month) ? [month, ...months] : months;
  const currentToken = bucket ? `bucket:${bucket}` : kind ? `kind:${kind}` : ALL;
  const activeLabel = FILTER_OPTIONS.find((option) => optionToken(option) === currentToken)?.label;
  const hasFilter = Boolean(month || bucket || kind || from || to);
  const dateRange = from === to && from
    ? from
    : [from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(" ");
  const activeText = [
    dateRange,
    dateRange ? "" : month ? monthLabel(month) : "",
    activeLabel && activeLabel !== "All transactions" ? activeLabel : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const navigate = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(currentSearchParams);
    update(params);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const changeMonth = (value: string) =>
    navigate((params) => {
      if (value) params.set("month", value);
      else params.delete("month");
      // from and to win over month when the fetch builds its date range.
      params.delete("from");
      params.delete("to");
    });

  const changeFilter = (token: string) =>
    navigate((params) => {
      params.delete("bucket");
      params.delete("kind");
      const [param, value] = token.split(":");
      if (param && value) params.set(param, value);
    });

  const clear = () =>
    navigate((params) => {
      ["month", "bucket", "kind", "from", "to"].forEach((key) => params.delete(key));
    });

  const selectedMonth = monthOptions.includes(month) ? month : ALL;

  return (
    <div className="transactions-filters cluster">
      <div className="transactions-filters__controls">
        <div className="transactions-filters__field">
          <span className="transactions-filters__label" aria-hidden="true">
            Month
          </span>
          <Listbox value={selectedMonth} onChange={changeMonth}>
            <div className="transactions-filters__menu">
              <Listbox.Button
                className="transactions-filters__button"
                onKeyDown={openWithEnter}
              >
                <span className="visually-hidden">Month: </span>
                <span className="transactions-filters__value">
                  {selectedMonth ? monthLabel(selectedMonth) : "All months"}
                </span>
                <Chevron />
              </Listbox.Button>
              <Listbox.Options className="transactions-filters__options">
                <Listbox.Option value={ALL} className="transactions-filters__option">
                  <span>All months</span>
                </Listbox.Option>
                {monthOptions.map((option) => (
                  <Listbox.Option key={option} value={option} className="transactions-filters__option">
                    <span>{monthLabel(option)}</span>
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        <div className="transactions-filters__field">
          <span className="transactions-filters__label" aria-hidden="true">
            Filter
          </span>
          <Listbox value={currentToken} onChange={changeFilter}>
            <div className="transactions-filters__menu">
              <Listbox.Button
                className="transactions-filters__button"
                onKeyDown={openWithEnter}
              >
                <span className="visually-hidden">Filter: </span>
                <span className="transactions-filters__value">{activeLabel ?? "All transactions"}</span>
                <Chevron />
              </Listbox.Button>
              <Listbox.Options className="transactions-filters__options">
                {FILTER_OPTIONS.map((option) => {
                  const token = optionToken(option);
                  return (
                    <Listbox.Option key={token || "all"} value={token} className="transactions-filters__option">
                      <span>{option.label}</span>
                      <svg
                        className="transactions-filters__check"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Listbox.Option>
                  );
                })}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>
      </div>

      {hasFilter && activeText && (
        <p className="transactions-filters__active">
          <span>Showing: {activeText}</span>
          <button type="button" className="transactions-filters__clear" onClick={clear}>
            Clear
          </button>
        </p>
      )}
    </div>
  );
}
