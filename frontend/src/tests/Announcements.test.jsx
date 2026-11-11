import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Announcements from "../pages/Announcements";
import client from "../api/client";

let currentUserRole = "student";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      full_name: "Test User",
      username: "testuser",
      role: currentUserRole,
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

const sampleAnnouncements = [
  {
    id: 1,
    title: "Mid-Term Examination Schedule Announced",
    content: "Examinations begin next Monday. Check department portal for seat allotment.",
    category: "academic",
    is_published: true,
    is_pinned: true,
    author: {
      id: 99,
      full_name: "Academic Dean",
      username: "dean_acad",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Campus Wi-Fi Maintenance Tonight",
    content: "Scheduled downtime from 11 PM to 2 AM across all hostels.",
    category: "urgent",
    is_published: true,
    is_pinned: false,
    author: {
      id: 98,
      full_name: "IT Services",
      username: "it_admin",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe("Announcements Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserRole = "student";
    client.get.mockResolvedValue({
      data: {
        total: sampleAnnouncements.length,
        items: sampleAnnouncements,
      },
    });
  });

  it("loads and renders announcements with titles, categories, and author names", async () => {
    render(<Announcements />);

    expect(screen.getByText("Campus Announcements")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Mid-Term Examination Schedule Announced")
      ).toBeInTheDocument();
      expect(screen.getByText("Campus Wi-Fi Maintenance Tonight")).toBeInTheDocument();
      expect(screen.getByText("Academic Dean")).toBeInTheDocument();
      expect(screen.getByText("IT Services")).toBeInTheDocument();
    });

    // Pinned badge on the first item
    expect(screen.getByText("Pinned")).toBeInTheDocument();

    // Verify student cannot see admin action button
    expect(screen.queryByText("Post Announcement")).not.toBeInTheDocument();
  });

  it("filters announcements by category when category tab is clicked", async () => {
    const user = userEvent.setup();
    render(<Announcements />);

    await waitFor(() => {
      expect(
        screen.getByText("Mid-Term Examination Schedule Announced")
      ).toBeInTheDocument();
    });

    // Click on 'Urgent' tab
    const urgentTab = screen.getByRole("button", { name: /urgent/i });
    await user.click(urgentTab);

    await waitFor(() => {
      expect(client.get).toHaveBeenCalledWith("/announcements", {
        params: { category: "urgent" },
      });
    });
  });

  it("renders admin creation button and edit/delete controls when user is admin", async () => {
    currentUserRole = "admin";
    render(<Announcements />);

    await waitFor(() => {
      expect(screen.getByText("Post Announcement")).toBeInTheDocument();
      expect(screen.getAllByTitle("Edit announcement").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Delete announcement").length).toBeGreaterThan(0);
    });
  });

  it("opens create modal and submits new announcement as admin", async () => {
    currentUserRole = "admin";
    const user = userEvent.setup();
    client.post.mockResolvedValue({
      data: {
        id: 3,
        title: "Hackathon Registration Open",
        content: "Register on the student portal before Friday.",
        category: "events",
        is_published: true,
        is_pinned: false,
        author: { id: 1, full_name: "Test User", username: "testuser" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    render(<Announcements />);

    const postBtn = await screen.findByText("Post Announcement");
    await user.click(postBtn);

    // Modal opens
    expect(screen.getByText("Post New Announcement")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/end semester exam/i);
    const contentInput = screen.getByPlaceholderText(/provide all relevant details/i);

    await user.type(titleInput, "Hackathon Registration Open");
    await user.type(contentInput, "Register on the student portal before Friday.");

    const submitBtn = screen.getByRole("button", { name: "Post Notice" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith(
        "/announcements",
        expect.objectContaining({
          title: "Hackathon Registration Open",
          content: "Register on the student portal before Friday.",
        })
      );
    });
  });
});
