import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import NotificationsDropdown from "../components/NotificationsDropdown";
import Resources from "../pages/Resources";
import Events from "../pages/Events";
import Settings from "../pages/Settings";
import client from "../api/client";

let currentUserRole = "student";
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockUpdateToken = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      full_name: "Ayush Student",
      username: "ayush_stu",
      email: "ayush@campus.edu",
      role: currentUserRole,
    },
    login: mockLogin,
    logout: mockLogout,
    updateToken: mockUpdateToken,
    token: "mock-jwt-token",
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

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(),
}));

function renderWithRouter(component) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe("Phase 6 Frontend Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserRole = "student";
  });

  // 1. NotificationsDropdown tests
  describe("NotificationsDropdown Component", () => {
    it("renders bell and displays unread badge count", async () => {
      client.get.mockImplementation((url) => {
        if (url === "/notifications/unread-count") {
          return Promise.resolve({ data: { unread_count: 3 } });
        }
        if (url.startsWith("/notifications")) {
          return Promise.resolve({
            data: {
              items: [
                {
                  id: 101,
                  type: "connection_request",
                  title: "Connection Request",
                  content: "Rahul sent you a connection request",
                  is_read: false,
                  created_at: new Date().toISOString(),
                },
              ],
              total: 1,
              unread_count: 1,
            },
          });
        }
        return Promise.reject(new Error("not found"));
      });

      renderWithRouter(<NotificationsDropdown />);

      // Badge displays "3"
      await waitFor(() => {
        expect(screen.getByText("3")).toBeInTheDocument();
      });

      // Click bell to toggle dropdown open
      const user = userEvent.setup();
      const bellBtn = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellBtn);

      // Verify dropdown content loaded
      await waitFor(() => {
        expect(screen.getByText("Rahul sent you a connection request")).toBeInTheDocument();
      });
    });

    it("marks all notifications as read on click", async () => {
      client.get.mockImplementation((url) => {
        if (url === "/notifications/unread-count") {
          return Promise.resolve({ data: { unread_count: 2 } });
        }
        if (url.startsWith("/notifications")) {
          return Promise.resolve({
            data: {
              items: [
                {
                  id: 101,
                  type: "announcement",
                  title: "Holiday Announcement",
                  content: "Campus closed tomorrow",
                  is_read: false,
                  created_at: new Date().toISOString(),
                },
              ],
              total: 1,
              unread_count: 1,
            },
          });
        }
        return Promise.reject(new Error("not found"));
      });
      client.patch.mockResolvedValue({ data: { updated_count: 2 } });

      renderWithRouter(<NotificationsDropdown />);
      const user = userEvent.setup();
      const bellBtn = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellBtn);

      await waitFor(() => {
        expect(screen.getByText("Mark all read")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Mark all read"));
      expect(client.patch).toHaveBeenCalledWith("/notifications/read-all");
    });
  });

  // 2. Resources Page tests
  describe("Resources Page", () => {
    const sampleResources = [
      {
        id: 1,
        title: "CSE Semester 4 Syllabus",
        description: "Official departmental syllabus",
        category: "syllabus",
        resource_type: "official_doc",
        url: "https://campus.edu/syllabus.pdf",
        created_at: new Date().toISOString(),
      },
    ];

    it("renders resources list with category filter and search", async () => {
      client.get.mockResolvedValue({
        data: { items: sampleResources, total: 1 },
      });

      renderWithRouter(<Resources />);

      await waitFor(() => {
        expect(screen.getByText("CSE Semester 4 Syllabus")).toBeInTheDocument();
        expect(screen.getByText("Open Resource").closest("a")).toHaveAttribute(
          "href",
          "https://campus.edu/syllabus.pdf"
        );
      });

      // Student does not see "Add Resource"
      expect(screen.queryByText("Add Resource")).not.toBeInTheDocument();
    });

    it("allows administrators to see Add Resource button and open modal", async () => {
      currentUserRole = "admin";
      client.get.mockResolvedValue({
        data: { items: sampleResources, total: 1 },
      });

      renderWithRouter(<Resources />);

      await waitFor(() => {
        expect(screen.getByText("Add Resource")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Add Resource"));

      expect(screen.getByText("Create Campus Resource")).toBeInTheDocument();
    });
  });

  // 3. Events Page tests
  describe("Events Page", () => {
    const sampleEvents = [
      {
        id: 50,
        title: "Campus Hackathon 2026",
        description: "Annual coding hackathon",
        category: "hackathon",
        location: "Auditorium Main",
        start_date: new Date(Date.now() + 86400000).toISOString(),
        capacity: 100,
        attendee_count: 42,
        is_rsvped: false,
        my_rsvp_status: null,
      },
    ];

    it("renders events and allows student to RSVP", async () => {
      client.get.mockResolvedValue({
        data: { items: sampleEvents, total: 1 },
      });
      client.post.mockResolvedValue({
        data: { is_rsvped: true, rsvp_status: "attending", attendee_count: 43 },
      });

      renderWithRouter(<Events />);

      await waitFor(() => {
        expect(screen.getByText("Campus Hackathon 2026")).toBeInTheDocument();
        expect(screen.getByText("42 attending (Max 100)")).toBeInTheDocument();
        expect(screen.getByText("RSVP Attend")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("RSVP Attend"));

      expect(client.post).toHaveBeenCalledWith("/events/50/rsvp", {
        status: "attending",
      });
    });
  });

  // 4. Settings Page tests
  describe("Settings Page", () => {
    it("renders settings and validates password matching before submission", async () => {
      renderWithRouter(<Settings />);

      expect(screen.getByText("Change Password")).toBeInTheDocument();
      expect(screen.getByText("Session Invalidation")).toBeInTheDocument();

      const user = userEvent.setup();
      const currentPass = screen.getByPlaceholderText("Enter current password");
      const newPass = screen.getByPlaceholderText("Enter new password");
      const confirmPass = screen.getByPlaceholderText("Confirm new password");
      const submitBtn = screen.getByRole("button", { name: /Update Password/i });

      // Mismatch
      await user.type(currentPass, "Current123!");
      await user.type(newPass, "NewPass123!");
      await user.type(confirmPass, "MismatchPass!");
      await user.click(submitBtn);

      expect(
        screen.getByText("New password and confirm password do not match.")
      ).toBeInTheDocument();
      expect(client.post).not.toHaveBeenCalled();

      // Successful password change
      client.post.mockResolvedValue({
        data: {
          message: "Password changed successfully",
          access_token: "new-access-token",
        },
      });

      await user.clear(confirmPass);
      await user.type(confirmPass, "NewPass123!");
      await user.click(submitBtn);

      expect(client.post).toHaveBeenCalledWith("/auth/change-password", {
        current_password: "Current123!",
        new_password: "NewPass123!",
        confirm_password: "NewPass123!",
      });

      await waitFor(() => {
        expect(
          screen.getByText(/All other active sessions and tokens have been revoked/i)
        ).toBeInTheDocument();
      });
    });
  });
});
