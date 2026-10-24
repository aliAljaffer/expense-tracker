import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and drops falsy values", () => {
    expect(cn("pill", false, undefined, "pill--pass", null)).toBe("pill pill--pass");
  });
});
