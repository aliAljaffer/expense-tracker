import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  it("posts to the logout route so the browser follows its redirect", () => {
    render(<SignOutButton />);

    const form = screen.getByRole("button", { name: "Sign out" }).closest("form");

    expect(form).toHaveAttribute("action", "/api/auth/logout");
    expect(form).toHaveAttribute("method", "post");
  });
});
