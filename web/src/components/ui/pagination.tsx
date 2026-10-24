"use client";

import { useRef, useState } from "react";
import { Listbox } from "@headlessui/react";
import {
  calculatePagination,
  generatePageList,
  PER_PAGE_OPTIONS,
  DEFAULT_PER_PAGE,
} from "@/lib/pagination";

interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  perPageOptions?: number[];
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  previousHref?: string;
  nextHref?: string;
  pageHrefs?: (page: number) => string;
}

export function Pagination({
  total,
  page,
  perPage,
  perPageOptions = PER_PAGE_OPTIONS,
  onPageChange,
  onPerPageChange,
  previousHref,
  nextHref,
  pageHrefs,
}: PaginationProps) {
  const info = calculatePagination({ total, page, perPage });
  const pageList = generatePageList({
    currentPage: info.clampedPage,
    totalPages: info.pageCount,
  });

  const [isListboxOpen, setIsListboxOpen] = useState(false);
  const listboxButtonRef = useRef<HTMLButtonElement>(null);

  const displayText =
    total === 0
      ? "No rows"
      : total === 1
        ? "1 row"
        : `${total} rows`;

  const showingText =
    total === 0
      ? ""
      : `Showing ${info.fromRow} to ${info.toRow} of ${total} rows`;

  const isValidPerPage = perPageOptions.includes(perPage);
  const displayPerPage = isValidPerPage ? perPage : DEFAULT_PER_PAGE;

  return (
    <div className="pagination">
      <div className="pagination__content">
        {total > 0 && (
          <div className="pagination__info">
            <span className="pagination__showing">{showingText}</span>
          </div>
        )}

        {total > 0 && info.pageCount > 1 && (
          <div className="pagination__controls">
            {previousHref ? (
              <a href={previousHref} className="pagination__button pagination__button--prev">
                Previous
              </a>
            ) : (
              <button
                onClick={() => onPageChange?.(info.clampedPage - 1)}
                disabled={info.isFirstPage}
                className="pagination__button pagination__button--prev"
              >
                Previous
              </button>
            )}

            <div className="pagination__pages">
              {pageList.map((p, idx) => {
                if (p === "...") {
                  return (
                    <span key={`ellipsis-${idx}`} className="pagination__ellipsis">
                      ...
                    </span>
                  );
                }

                const pageNum = p as number;
                const isActive = pageNum === info.clampedPage;

                return pageHrefs ? (
                  <a
                    key={pageNum}
                    href={pageHrefs(pageNum)}
                    className={`pagination__page ${isActive ? "pagination__page--active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {pageNum}
                  </a>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={`pagination__page ${isActive ? "pagination__page--active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {nextHref ? (
              <a href={nextHref} className="pagination__button pagination__button--next">
                Next
              </a>
            ) : (
              <button
                onClick={() => onPageChange?.(info.clampedPage + 1)}
                disabled={info.isLastPage}
                className="pagination__button pagination__button--next"
              >
                Next
              </button>
            )}
          </div>
        )}

        <div className="pagination__picker">
          <label htmlFor="per-page-listbox" className="pagination__picker-label">
            Rows per page:
          </label>
          <Listbox
            value={displayPerPage}
            onChange={onPerPageChange}
            disabled={total === 0}
          >
            <div className="pagination__listbox-wrapper">
              <Listbox.Button
                ref={listboxButtonRef}
                id="per-page-listbox"
                className="pagination__listbox-button"
                onClick={() => setIsListboxOpen(!isListboxOpen)}
                data-open={isListboxOpen}
              >
                <span className="pagination__listbox-value">{displayPerPage}</span>
                <svg
                  className="pagination__listbox-chevron"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Listbox.Button>

              <Listbox.Options className="pagination__listbox-options" data-open={isListboxOpen}>
                {perPageOptions.map((option) => (
                  <Listbox.Option
                    key={option}
                    value={option}
                    className="pagination__listbox-option"
                    data-selected={option === displayPerPage}
                  >
                    {option}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>
      </div>
    </div>
  );
}
