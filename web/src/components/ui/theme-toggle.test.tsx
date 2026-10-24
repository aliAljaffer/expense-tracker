import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "";
  });

  it("renders with light theme initially when localStorage is empty", () => {
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: "Dark theme" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("renders with dark theme when localStorage holds dark before mount", () => {
    window.localStorage.setItem("grooszy-theme", "dark");

    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: "Dark theme" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("moves the document to the dark theme and remembers it", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: "Dark theme" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("grooszy-theme")).toBe("dark");
  });

  it("toggles back to light theme", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("grooszy-theme", "dark");
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: "Dark theme" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await user.click(button);

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("grooszy-theme")).toBe("light");
  });
});
