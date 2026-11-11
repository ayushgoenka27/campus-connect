import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Discover from "../pages/Discover";
import Connections from "../pages/Connections";
import api from "../api/client";

const currentUser = {
  id: 1,
  full_name: "Ayush Goenka",
  username: "teststudent01",
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Discover connection states and optimistic connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all connection states including Connect for rejected users and rolls back on failure", async () => {
    api.get.mockResolvedValue({
      data: [
        currentUser,
        {
          id: 2,
          full_name: "Priya Sharma",
          username: "priya_s",
          connection_status: null,
          connection_id: null,
        },
        {
          id: 3,
          full_name: "Rahul Verma",
          username: "rahul_v",
          connection_status: "pending_sent",
          connection_id: 10,
        },
        {
          id: 4,
          full_name: "Neha Singh",
          username: "neha_s",
          connection_status: "pending_received",
          connection_id: 11,
        },
        {
          id: 5,
          full_name: "Kabir Roy",
          username: "kabir_r",
          connection_status: "accepted",
          connection_id: 12,
        },
        {
          id: 6,
          full_name: "Riya Patel",
          username: "riya_p",
          connection_status: "rejected",
          connection_id: 13,
        },
      ],
    });

    api.post.mockRejectedValueOnce(new Error("Server error"));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Discover />
      </MemoryRouter>
    );

    expect(await screen.findByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("Request Sent")).toBeInTheDocument();
    expect(screen.getByText("Respond to Request")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();

    // Both null (Priya) and rejected (Riya) render active Connect buttons
    const connectButtons = screen.getAllByRole("button", { name: /^connect$/i });
    expect(connectButtons).toHaveLength(2);

    // Click Connect for Priya -> API rejects -> rolls back back to 2 Connect buttons + error toast
    await user.click(connectButtons[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/connections/2");
    });
    expect(
      await screen.findByText("Failed to send request to Priya Sharma.")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^connect$/i })).toHaveLength(2);
  });
});

describe("Connections page actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles Accept, Decline, and Cancel Sent actions across tabs", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/connections/accepted") {
        return Promise.resolve({
          data: [
            {
              connection_id: 100,
              status: "accepted",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              user: { id: 2, full_name: "Connected Peer", username: "conn_peer" },
            },
          ],
        });
      }
      if (url === "/connections/requests") {
        return Promise.resolve({
          data: [
            {
              connection_id: 101,
              status: "pending",
              created_at: new Date().toISOString(),
              user: { id: 3, full_name: "Incoming Peer", username: "inc_peer" },
            },
            {
              connection_id: 102,
              status: "pending",
              created_at: new Date().toISOString(),
              user: { id: 4, full_name: "Declined Peer", username: "dec_peer" },
            },
          ],
        });
      }
      if (url === "/connections/sent") {
        return Promise.resolve({
          data: [
            {
              connection_id: 103,
              status: "pending",
              created_at: new Date().toISOString(),
              user: { id: 5, full_name: "Outgoing Peer", username: "out_peer" },
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    api.patch.mockResolvedValue({ data: { message: "updated" } });
    api.delete.mockResolvedValue({ data: { message: "removed" } });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/connections?tab=requests"]}>
        <Connections />
      </MemoryRouter>
    );

    expect(await screen.findByText("Incoming Peer")).toBeInTheDocument();
    expect(screen.getByText("Declined Peer")).toBeInTheDocument();

    // Accept Incoming Peer
    const acceptButtons = screen.getAllByRole("button", { name: /^accept$/i });
    await user.click(acceptButtons[0]);
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/connections/101?action=accepted");
    });

    // Decline remaining request
    await user.click(screen.getByRole("button", { name: /^decline$/i }));
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/connections/102?action=rejected");
    });

    // Switch to Sent tab and Cancel request
    await user.click(screen.getByRole("button", { name: /sent/i }));
    expect(await screen.findByText("Outgoing Peer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel request/i }));
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/connections/103");
    });
  });
});
