import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminDashboard from "../pages/AdminDashboard";
import client from "../api/client";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 99,
      full_name: "Admin User",
      username: "admin_super",
      role: "admin",
    },
  }),
}));

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockStats = {
  total_users: 12,
  active_users: 10,
  total_posts: 45,
  total_announcements: 6,
  pending_reports: 2,
};

const mockUsers = [
  {
    id: 1,
    full_name: "John Doe",
    username: "johndoe",
    email: "john@campus.edu",
    role: "student",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 99,
    full_name: "Admin User",
    username: "admin_super",
    email: "admin@campus.edu",
    role: "admin",
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const mockReports = [
  {
    id: 1,
    target_type: "post",
    target_id: 101,
    target_preview: "Inappropriate spam message",
    reason: "spam",
    details: "Commercial advertising",
    status: "pending",
    action_taken: null,
    reviewed_at: null,
    created_at: new Date().toISOString(),
  },
];

describe("Admin Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockImplementation((url) => {
      if (url === "/admin/stats") {
        return Promise.resolve({ data: mockStats });
      }
      if (url === "/admin/users") {
        return Promise.resolve({
          data: { total: mockUsers.length, items: mockUsers },
        });
      }
      if (url === "/admin/reports") {
        return Promise.resolve({
          data: { total: mockReports.length, items: mockReports },
        });
      }
      return Promise.reject(new Error("Not found"));
    });
  });

  it("renders metric cards with correct numbers from API", async () => {
    render(<AdminDashboard />);

    expect(screen.getByText("Administrator Console")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument(); // Total users
      expect(screen.getByText("10")).toBeInTheDocument(); // Active users
      expect(screen.getByText("45")).toBeInTheDocument(); // Total posts
      expect(screen.getByText("6")).toBeInTheDocument(); // Notices
      expect(screen.getAllByText("2").length).toBeGreaterThan(0); // Pending reports & users badge
    });
  });

  it("renders users list with role, status, and deactivation button", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("@johndoe • john@campus.edu")).toBeInTheDocument();
    });

    // Check action buttons: Deactivate for John Doe, Protected for self
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
  });

  it("switches to Moderation Queue tab and displays reported items with action buttons", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);

    const reportsTab = screen.getByRole("button", { name: /moderation queue/i });
    await user.click(reportsTab);

    await waitFor(() => {
      expect(screen.getByText("Report #1")).toBeInTheDocument();
      expect(screen.getByText("Inappropriate spam message")).toBeInTheDocument();
      expect(screen.getByText("Commercial advertising")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /hide content/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});
