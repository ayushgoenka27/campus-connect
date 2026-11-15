import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "../components/ErrorBoundary";

function ProblemChild({ shouldThrow = false }) {
  if (shouldThrow) {
    throw new Error("Internal secret crash state: database connection timeout");
  }
  return <div>Healthy Child Content</div>;
}

describe("ErrorBoundary Component (P7-06)", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Suppress React error boundary console.error logs during test
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children normally when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Healthy Child Content")).toBeInTheDocument();
  });

  it("catches render errors and displays user-friendly recovery UI without leaking internals", () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Friendly message present
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/An unexpected interface error occurred/i)
    ).toBeInTheDocument();

    // Recovery action buttons
    expect(screen.getByRole("button", { name: /Reload Page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Return Home/i })).toBeInTheDocument();

    // Internal error details (e.g. database timeout string) must NOT be leaked to user
    expect(
      screen.queryByText(/Internal secret crash state/i)
    ).not.toBeInTheDocument();
  });

  it("triggers page reload when user clicks Reload Page button", async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();

    // Override location.reload
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadMock, href: "/" },
    });

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadBtn = screen.getByRole("button", { name: /Reload Page/i });
    await user.click(reloadBtn);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
