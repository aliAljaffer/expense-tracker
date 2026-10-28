import { describe, it, expect } from "vitest";
import { calculatePagination, generatePageList } from "./pagination";

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
});
