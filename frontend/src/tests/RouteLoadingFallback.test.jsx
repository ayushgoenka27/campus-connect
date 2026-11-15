import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RouteLoadingFallback from "../components/RouteLoadingFallback";

describe("RouteLoadingFallback Component (P7-09)", () => {
  it("renders with accessible role and polite aria-live announcement", () => {
    render(<RouteLoadingFallback />);

    const fallback = screen.getByRole("status");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveAttribute("aria-live", "polite");
    expect(fallback).toHaveAttribute("aria-label", "Loading page content");
    expect(
      screen.getByText("Loading page content, please wait...")
    ).toBeInTheDocument();
  });
});

