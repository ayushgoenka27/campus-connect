import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Messages from "../pages/Messages";
import client from "../api/client";

// Stub scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

let mockWsCallbacks = {};
const mockSendChatMessage = vi.fn();
const mockSendMarkRead = vi.fn();
const mockSendTyping = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      full_name: "Student Alpha",
      username: "student_alpha",
      role: "student",
    },
    token: "mock-jwt-token",
  }),
}));

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: ({ onNewMessage, onReadReceipt, onTyping } = {}) => {
    mockWsCallbacks = { onNewMessage, onReadReceipt, onTyping };
    return {
      isConnected: true,
      isUserOnline: (id) => id === 2,
      onlineUserIds: new Set([2]),
      sendChatMessage: mockSendChatMessage,
      sendMarkRead: mockSendMarkRead,
      sendTyping: mockSendTyping,
      currentUserId: 1,
    };
  },
}));

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const sampleConversations = [
  {
    id: 10,
    user1_id: 1,
    user2_id: 2,
    peer: {
      id: 2,
      full_name: "Student Beta",
      username: "student_beta",
      profile_image: null,
      department: "Computer Science",
    },
    last_message: {
      id: 101,
      conversation_id: 10,
      sender_id: 2,
      recipient_id: 1,
      content: "Hey Alpha, did you finish the assignment?",
      status: "delivered",
      is_read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    unread_count: 1,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 11,
    user1_id: 1,
    user2_id: 3,
    peer: {
      id: 3,
      full_name: "Charlie Davis",
      username: "charlie_d",
      profile_image: null,
      department: "Mechanical",
    },
    last_message: {
      id: 99,
      conversation_id: 11,
      sender_id: 1,
      recipient_id: 3,
      content: "See you at the library!",
      status: "read",
      is_read: true,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    unread_count: 0,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

const sampleMessagesConv10 = [
  {
    id: 100,
    conversation_id: 10,
    sender_id: 1,
    recipient_id: 2,
    content: "Hi Beta! Are you working on Campus Connect?",
    status: "read",
    is_read: true,
    read_at: new Date(Date.now() - 4000000).toISOString(),
    created_at: new Date(Date.now() - 4200000).toISOString(),
  },
  {
    id: 101,
    conversation_id: 10,
    sender_id: 2,
    recipient_id: 1,
    content: "Hey Alpha, did you finish the assignment?",
    status: "delivered",
    is_read: false,
    read_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe("Messages Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendChatMessage.mockReturnValue(true);
    client.get.mockImplementation((url) => {
      if (url === "/conversations" || url === "/api/v1/conversations") {
        return Promise.resolve({ data: { items: [...sampleConversations], total: 2 } });
      }
      if (url.startsWith("/conversations/10/messages") || url.startsWith("/api/v1/conversations/10/messages")) {
        return Promise.resolve({ data: { items: [...sampleMessagesConv10], total: 2, has_more: false } });
      }
      if (url === "/connections/accepted" || url === "/api/v1/connections/accepted") {
        return Promise.resolve({
          data: [
            {
              id: 99,
              user_id: 4,
              user: {
                id: 4,
                full_name: "Dana Scully",
                username: "scully",
                department: "Biology",
              },
            },
          ],
        });
      }
      return Promise.reject(new Error(`Unhandled GET url: ${url}`));
    });

    client.patch.mockResolvedValue({ data: { status: "success", marked_count: 1 } });
    client.post.mockResolvedValue({
      data: {
        id: 102,
        conversation_id: 10,
        sender_id: 1,
        recipient_id: 2,
        content: "Yes, just submitted it!",
        status: "sent",
        is_read: false,
        created_at: new Date().toISOString(),
      },
    });
  });

  it("renders conversation list and shows peer name, last message, and unread badge", async () => {
    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    // Verify conversations loaded in sidebar
    await waitFor(() => {
      expect(screen.getByText("Student Beta")).toBeInTheDocument();
      expect(screen.getByText("Charlie Davis")).toBeInTheDocument();
    });

    // Verify unread badge of 1 for Student Beta
    expect(screen.getByText("1")).toBeInTheDocument();

    // Verify last message preview
    expect(screen.getByText("Hey Alpha, did you finish the assignment?")).toBeInTheDocument();

    // Empty state on right pane
    expect(screen.getByText("Select a conversation")).toBeInTheDocument();
  });

  it("opens conversation on click, displays messages with sent/read checkmarks, and auto-marks as read", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Student Beta")).toBeInTheDocument();
    });

    // Click on Student Beta conversation
    await user.click(screen.getByText("Student Beta"));

    // Messages should load in the thread
    await waitFor(() => {
      expect(screen.getByText("Hi Beta! Are you working on Campus Connect?")).toBeInTheDocument();
      // Appears in sidebar preview and inside the active thread
      expect(screen.getAllByText("Hey Alpha, did you finish the assignment?").length).toBeGreaterThanOrEqual(1);
    });

    // Mark as read should have been called via WebSocket and PATCH endpoint
    expect(mockSendMarkRead).toHaveBeenCalledWith(10);
    expect(client.patch).toHaveBeenCalledWith("/conversations/10/read");
  });

  it("sends a message via input and adds it to the thread", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Student Beta")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Student Beta"));

    await waitFor(() => {
      expect(screen.getByText("Hi Beta! Are you working on Campus Connect?")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Message Student Beta/i);
    await user.type(input, "Yes, just submitted it!");

    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    await user.click(sendBtn);

    // Verify sendChatMessage was called with conversation ID and text
    expect(mockSendChatMessage).toHaveBeenCalledWith(10, "Yes, just submitted it!", expect.any(String));

    // Message should be displayed in the thread optimistically
    await waitFor(() => {
      expect(screen.getByText("Yes, just submitted it!")).toBeInTheDocument();
    });

    // Input should be cleared
    expect(input).toHaveValue("");
  });

  it("filters conversations using search query", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Student Beta")).toBeInTheDocument();
      expect(screen.getByText("Charlie Davis")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search conversations/i);
    await user.type(searchInput, "charlie");

    expect(screen.queryByText("Student Beta")).not.toBeInTheDocument();
    expect(screen.getByText("Charlie Davis")).toBeInTheDocument();
  });

  it("handles incoming real-time message dynamically", async () => {
    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Student Beta")).toBeInTheDocument();
    });

    // Simulate incoming WS message from Charlie
    const incomingMsg = {
      id: 200,
      conversation_id: 11,
      sender_id: 3,
      recipient_id: 1,
      content: "Hey, see you in 10 mins!",
      status: "delivered",
      is_read: false,
      created_at: new Date().toISOString(),
    };

    mockWsCallbacks.onNewMessage(incomingMsg);

    // Verify preview is updated
    await waitFor(() => {
      expect(screen.getByText("Hey, see you in 10 mins!")).toBeInTheDocument();
    });
  });
});
