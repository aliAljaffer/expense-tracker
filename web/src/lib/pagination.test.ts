import { describe, it, expect } from "vitest";
import {
  calculatePagination,
  generatePageList,
  validatePerPage,
  clampPage,
  DEFAULT_PER_PAGE,
} from "./pagination";

describe("pagination", () => {
  describe("calculatePagination", () => {
    it("handles zero total", () => {
      const result = calculatePagination({ total: 0, page: 1, perPage: 25 });
      expect(result.total).toBe(0);
      expect(result.pageCount).toBe(0);
      expect(result.fromRow).toBe(0);
      expect(result.toRow).toBe(0);
      expect(result.isFirstPage).toBe(true);
      expect(result.isLastPage).toBe(true);
    });

    it("clamps page to valid range", () => {
      const result = calculatePagination({ total: 100, page: 10, perPage: 25 });
      expect(result.clampedPage).toBe(4);
      expect(result.isLastPage).toBe(true);
    });

    it("calculates row ranges correctly", () => {
      const result = calculatePagination({ total: 100, page: 2, perPage: 25 });
      expect(result.fromRow).toBe(26);
      expect(result.toRow).toBe(50);
    });

    it("handles last page partial rows", () => {
      const result = calculatePagination({ total: 120, page: 5, perPage: 25 });
      expect(result.fromRow).toBe(101);
      expect(result.toRow).toBe(120);
    });

    it("recognizes first page", () => {
      const result = calculatePagination({ total: 100, page: 1, perPage: 25 });
      expect(result.isFirstPage).toBe(true);
      expect(result.isLastPage).toBe(false);
    });
  });

  describe("generatePageList", () => {
    it("shows all pages when total is 7 or less", () => {
      expect(generatePageList({ currentPage: 3, totalPages: 7 })).toEqual([
        1, 2, 3, 4, 5, 6, 7,
      ]);
    });

    it("puts an ellipsis on both sides in the middle", () => {
      expect(generatePageList({ currentPage: 5, totalPages: 10 })).toEqual([
        1, "...", 4, 5, 6, "...", 10,
      ]);
    });

    it("omits the left ellipsis near start", () => {
      expect(generatePageList({ currentPage: 3, totalPages: 10 })).toEqual([
        1, 2, 3, 4, "...", 10,
      ]);
    });

    it("omits the right ellipsis near end", () => {
      expect(generatePageList({ currentPage: 8, totalPages: 10 })).toEqual([
        1, "...", 7, 8, 9, 10,
      ]);
    });
  });

  describe("validatePerPage", () => {
    it("accepts valid per-page values", () => {
      expect(validatePerPage(10)).toBe(10);
      expect(validatePerPage(25)).toBe(25);
      expect(validatePerPage(100)).toBe(100);
    });

    it("returns default for invalid values", () => {
      expect(validatePerPage(15)).toBe(DEFAULT_PER_PAGE);
      expect(validatePerPage(99)).toBe(DEFAULT_PER_PAGE);
    });

    it("respects custom options", () => {
      expect(validatePerPage(15, [10, 15, 20])).toBe(15);
      expect(validatePerPage(25, [10, 15, 20])).toBe(DEFAULT_PER_PAGE);
    });
  });

  describe("clampPage", () => {
    it("returns 1 for zero total", () => {
      expect(clampPage(5, 0, 25)).toBe(1);
    });

    it("clamps below 1 and above the last page, keeping valid pages", () => {
      expect(clampPage(0, 100, 25)).toBe(1);
      expect(clampPage(2, 100, 25)).toBe(2);
      expect(clampPage(10, 100, 25)).toBe(4);
    });
  });
});
