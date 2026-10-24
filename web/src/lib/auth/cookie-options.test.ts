import { describe, it, expect } from "vitest";
import { cookieSecure } from "./cookie-options";

describe("cookieSecure", () => {
  it("is true for an https origin", () => {
    expect(cookieSecure("https://grooszy.alialjaffer.com")).toBe(true);
  });

  it("is false for a plain http origin such as a port-forward", () => {
    expect(cookieSecure("http://127.0.0.1:3000")).toBe(false);
  });

  it("defaults to true when the origin is missing or invalid", () => {
    expect(cookieSecure(undefined)).toBe(true);
    expect(cookieSecure("not a url")).toBe(true);
  });
});
