/**
 * Pagination helper utilities for page math and rendering.
 */

export const DEFAULT_PER_PAGE = 25;
export const PER_PAGE_OPTIONS = [10, 25, 50, 100, 200];

interface PaginationParams {
  total: number;
  page: number;
  perPage: number;
}

interface PaginationInfo {
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  fromRow: number;
  toRow: number;
  clampedPage: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}

export function calculatePagination(params: PaginationParams): PaginationInfo {
  const { total, page, perPage } = params;

  if (total === 0) {
    return {
      total: 0,
      page: 1,
      perPage,
      pageCount: 0,
      fromRow: 0,
      toRow: 0,
      clampedPage: 1,
      isFirstPage: true,
      isLastPage: true,
    };
  }

  const pageCount = Math.ceil(total / perPage);
  const clampedPage = Math.max(1, Math.min(page, pageCount));
  const fromRow = (clampedPage - 1) * perPage + 1;
  const toRow = Math.min(clampedPage * perPage, total);

  return {
    total,
    page: clampedPage,
    perPage,
    pageCount,
    fromRow,
    toRow,
    clampedPage,
    isFirstPage: clampedPage === 1,
    isLastPage: clampedPage === pageCount,
  };
}

interface PageListOptions {
  currentPage: number;
  totalPages: number;
}

export function generatePageList(options: PageListOptions): (number | string)[] {
  const { currentPage, totalPages } = options;

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [1];

  if (currentPage > 3) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return pages;
}

export function validatePerPage(value: number, options: number[] = PER_PAGE_OPTIONS): number {
  if (options.includes(value)) {
    return value;
  }
  return DEFAULT_PER_PAGE;
}

export function clampPage(page: number, total: number, perPage: number): number {
  if (total === 0) return 1;
  const pageCount = Math.ceil(total / perPage);
  return Math.max(1, Math.min(page, pageCount));
}
