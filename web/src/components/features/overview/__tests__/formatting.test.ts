import { describe, it, expect } from "vitest";
import { formatSAR, displaySAR } from "@/lib/api/types";

describe("SAR formatting", () => {
  it("formats halalas to SAR correctly", () => {
    expect(formatSAR(0)).toBe("0.00");
    expect(formatSAR(100)).toBe("1.00");
    expect(formatSAR(575)).toBe("5.75");
    expect(formatSAR(2575)).toBe("25.75");
    expect(formatSAR(100000)).toBe("1000.00");
  });

  it("displays SAR with symbol and thousands separator", () => {
    expect(displaySAR(0)).toBe("0.00 SAR");
    expect(displaySAR(100)).toBe("1.00 SAR");
    expect(displaySAR(575)).toBe("5.75 SAR");
    expect(displaySAR(2575)).toBe("25.75 SAR");
    expect(displaySAR(100000)).toBe("1,000.00 SAR");
    expect(displaySAR(1234567)).toBe("12,345.67 SAR");
  });
});
