import { describe, it, expect } from "vitest";
import { formatSAR, displaySAR } from "../types";

describe("formatSAR", () => {
  it("formats zero halalas correctly", () => {
    expect(formatSAR(0)).toBe("0.00");
  });

  it("formats single halala correctly", () => {
    expect(formatSAR(1)).toBe("0.01");
  });

  it("formats 100 halalas (1 SAR) correctly", () => {
    expect(formatSAR(100)).toBe("1.00");
  });

  it("formats 2575 halalas (25.75 SAR) correctly", () => {
    expect(formatSAR(2575)).toBe("25.75");
  });

  it("formats 100000 halalas (1000 SAR) correctly", () => {
    expect(formatSAR(100000)).toBe("1000.00");
  });

  it("formats large amounts correctly", () => {
    expect(formatSAR(1234567)).toBe("12345.67");
  });

  it("pads single fils with leading zero", () => {
    expect(formatSAR(105)).toBe("1.05");
    expect(formatSAR(110)).toBe("1.10");
  });

  it("uses integer math only, no floating point", () => {
    const result = formatSAR(2575);
    expect(result).toBe("25.75");
    expect(typeof result).toBe("string");
    expect(result.split(".")[1]).toBe("75");
  });

  it("keeps the sign and the fils in front of a negative amount", () => {
    expect(formatSAR(-1250)).toBe("-12.50");
    expect(formatSAR(-5)).toBe("-0.05");
  });
});

describe("displaySAR", () => {
  it("formats with SAR symbol and no thousands separator for small amounts", () => {
    expect(displaySAR(0)).toBe("0.00 SAR");
    expect(displaySAR(100)).toBe("1.00 SAR");
    expect(displaySAR(2575)).toBe("25.75 SAR");
  });

  it("adds thousands separator for amounts >= 1000 SAR", () => {
    expect(displaySAR(100000)).toBe("1,000.00 SAR");
  });

  it("adds multiple thousands separators for large amounts", () => {
    expect(displaySAR(1234567)).toBe("12,345.67 SAR");
    expect(displaySAR(12345678)).toBe("123,456.78 SAR");
  });

  it("formats exactly as displayed in real statements", () => {
    const alinmaOpening = 100000;
    const alinmaClosing = 97000;
    const alrajhiOpening = 0;
    const alrajhiClosing = 44567;

    expect(displaySAR(alinmaOpening)).toBe("1,000.00 SAR");
    expect(displaySAR(alinmaClosing)).toBe("970.00 SAR");
    expect(displaySAR(alrajhiOpening)).toBe("0.00 SAR");
    expect(displaySAR(alrajhiClosing)).toBe("445.67 SAR");
  });

  it("includes SAR symbol at the end", () => {
    const result = displaySAR(2575);
    expect(result.endsWith(" SAR")).toBe(true);
  });

  it("shows a dash when the statement carried no amount", () => {
    expect(displaySAR(null)).toBe("-");
    expect(displaySAR(undefined)).toBe("-");
  });

  it("formats a negative amount with one sign", () => {
    expect(displaySAR(-1250)).toBe("-12.50 SAR");
    expect(displaySAR(-123456)).toBe("-1,234.56 SAR");
  });
});
