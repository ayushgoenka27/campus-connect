import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Community from "../pages/Community";
import api from "../api/client";

const mockUser = {
  id: 1,
  full_name: "Ayush Goenka",
  username: "teststudent01",
  profile_image: null,
  course: "B.Tech",
  branch: "Computer Science",
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const samplePosts = [
  {
    id: 10,
    content: "Annual Hackathon starts Friday!",
    image_url: "https://example.com/hackathon.png",
    author: {
      id: 2,
      full_name: "Priya Sharma",
      username: "priya_s",
      profile_image: null,
      course: "B.Tech",
      branch: "AI",
    },
    like_count: 3,
    comment_count: 1,
    is_liked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 11,
    content: "Looking for study group in library",
    image_url: null,
    author: mockUser,
    like_count: 0,
    comment_count: 0,
    is_liked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe("Community page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads feed posts and supports debounced keyword search and clear search", async () => {
    api.get.mockImplementation((url, config) => {
      if (url === "/posts/" && config?.params?.search === "hackathon") {
        return Promise.resolve({
          data: { posts: [samplePosts[0]], total: 1 },
        });
      }
      if (url === "/posts/" && config?.params?.search === "nonexistent") {
        return Promise.resolve({
          data: { posts: [], total: 0 },
        });
      }
      return Promise.resolve({
        data: { posts: samplePosts, total: 2 },
      });
    });

    const user = userEvent.setup();
    render(<Community />);

    expect(await screen.findByText("Annual Hackathon starts Friday!")).toBeInTheDocument();
    expect(screen.getByText("Looking for study group in library")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search community posts");
    await user.type(searchInput, "hackathon");

    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith("/posts/", {
          params: { skip: 0, limit: 10, search: "hackathon" },
        });
      },
      { timeout: 1500 }
    );

    expect(await screen.findByText("Annual Hackathon starts Friday!")).toBeInTheDocument();
    expect(screen.queryByText("Looking for study group in library")).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "nonexistent");

    expect(await screen.findByText('No posts matching "nonexistent"')).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: /clear search/i });
    expect(clearButtons.length).toBeGreaterThanOrEqual(2);
    await user.click(clearButtons[1]);

    await waitFor(() => {
      expect(screen.getByText("Looking for study group in library")).toBeInTheDocument();
    });
  });

  it("allows author to edit post content and image URL while hiding controls on peer posts", async () => {
    api.get.mockResolvedValue({ data: { posts: samplePosts, total: 2 } });
    api.patch.mockResolvedValue({
      data: {
        ...samplePosts[1],
        content: "Updated study group time: 6 PM",
        image_url: "https://example.com/room.jpg",
        updated_at: new Date(Date.now() + 1000).toISOString(),
      },
    });

    const user = userEvent.setup();
    render(<Community />);

    expect(await screen.findByText("Looking for study group in library")).toBeInTheDocument();

    // Only 1 Edit button and 1 Delete button (for mockUser's own post, not Priya's)
    const editButtons = screen.getAllByRole("button", { name: "Edit post" });
    expect(editButtons).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Delete post" })).toHaveLength(1);

    await user.click(editButtons[0]);
    const contentBox = screen.getByDisplayValue("Looking for study group in library");
    await user.clear(contentBox);
    await user.type(contentBox, "Updated study group time: 6 PM");
    await user.type(screen.getByLabelText("Edit post image URL"), "https://example.com/room.jpg");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/posts/11", {
        content: "Updated study group time: 6 PM",
        image_url: "https://example.com/room.jpg",
      });
    });
    expect(await screen.findByText("Updated study group time: 6 PM")).toBeInTheDocument();
    expect(screen.getByAltText("Attachment by Ayush Goenka")).toHaveAttribute(
      "src",
      "https://example.com/room.jpg"
    );
  });

  it("validates image URL client-side and creates a post with a valid image URL", async () => {
    api.get.mockResolvedValue({ data: { posts: [], total: 0 } });
    api.post.mockResolvedValue({
      data: {
        id: 55,
        content: "Check out this robotics lab update!",
        image_url: "https://example.com/lab.jpg",
        author: mockUser,
        like_count: 0,
        comment_count: 0,
        is_liked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    const user = userEvent.setup();
    render(<Community />);

    await screen.findByText("No posts yet");

    await user.type(
      screen.getByPlaceholderText("Share something with your campus..."),
      "Check out this robotics lab update!"
    );

    await user.click(screen.getByRole("button", { name: /add image url/i }));
    const imageInput = screen.getByLabelText("Post image URL");

    // Invalid URL shows validation message and disables Post button
    await user.type(imageInput, "ftp://bad-url");
    expect(
      await screen.findByText(/Image URL must start with http:\/\/ or https:\/\//i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^post$/i })).toBeDisabled();

    // Valid URL clears error and enables submit
    await user.clear(imageInput);
    await user.type(imageInput, "https://example.com/lab.jpg");

    const submitBtn = screen.getByRole("button", { name: /^post$/i });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/posts/", {
        content: "Check out this robotics lab update!",
        image_url: "https://example.com/lab.jpg",
      });
    });

    expect(
      await screen.findByText("Check out this robotics lab update!")
    ).toBeInTheDocument();
  });

  it("renders graceful fallback when a post image fails to load and shows error retry state", async () => {
    api.get
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ data: { posts: [samplePosts[0]], total: 1 } });

    const user = userEvent.setup();
    render(<Community />);

    expect(
      await screen.findByText("Failed to load community posts. Please try again.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));

    const img = await screen.findByAltText("Attachment by Priya Sharma");
    expect(img).toHaveAttribute("src", "https://example.com/hackathon.png");

    fireEvent.error(img);
    expect(await screen.findByTestId("post-image-fallback")).toBeInTheDocument();
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
  });
});
