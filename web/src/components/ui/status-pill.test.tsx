import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it("renders the label with the tone class", () => {
    render(<StatusPill tone="pass">Serving</StatusPill>);

    expect(screen.getByText("Serving")).toHaveClass("pill", "pill--pass");
  });
});
