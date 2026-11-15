import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Circle,
  MessageCircle,
  Plus,
  Search,
  Send,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";

function formatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [inputContent, setInputContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [connections, setConnections] = useState([]);
  const [isLoadingConn, setIsLoadingConn] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Active conversation object
  const activeConv = useMemo(() => {
    return conversations.find((c) => c.id === activeConvId) || null;
  }, [conversations, activeConvId]);

  // Load conversations
  const loadConversations = useCallback(() => {
    client
      .get("/conversations")
      .then((res) => {
        setConversations(res.data.items || []);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        setIsLoadingConvs(false);
      });
  }, []);

  const startConversationWithUser = useCallback((targetUserId) => {
    client
      .post("/conversations", {
        recipient_id: targetUserId,
      })
      .then((res) => {
        const newConv = res.data;
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === newConv.id);
          if (exists) return prev;
          return [newConv, ...prev];
        });
        setActiveConvId(newConv.id);
        setShowNewModal(false);
      })
      .catch((err) => {
        alert(err.response?.data?.detail || "Could not start conversation");
      });
  }, []);

  // Handle incoming real-time messages
  const handleNewMessage = useCallback((msg) => {
    // 1. Update active message thread if open
    setActiveConvId((currActiveId) => {
      if (currActiveId === msg.conversation_id) {
        setMessages((prev) => {
          // Check for optimistic duplicate by client_msg_id or id
          const exists = prev.some(
            (m) =>
              m.id === msg.id ||
              (msg.client_msg_id && m.client_msg_id === msg.client_msg_id)
          );
          if (exists) {
            return prev.map((m) =>
              msg.client_msg_id && m.client_msg_id === msg.client_msg_id
                ? msg
                : m
            );
          }
          return [...prev, msg];
        });
      }
      return currActiveId;
    });

    // 2. Update conversation list preview & unread counts
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === msg.conversation_id);
      if (idx === -1) {
        // Refresh conversation list to get new conversation
        loadConversations();
        return prev;
      }

      const updated = [...prev];
      const conv = { ...updated[idx] };
      conv.last_message = msg;
      conv.updated_at = msg.created_at;

      // Increment unread count if message is for current user and this conv isn't open
      if (msg.recipient_id === user?.id && activeConvId !== msg.conversation_id) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }

      // Move conversation to top
      updated.splice(idx, 1);
      return [conv, ...updated];
    });
  }, [user?.id, activeConvId, loadConversations]);

  // Handle read receipts
  const handleReadReceipt = useCallback((receipt) => {
    setActiveConvId((currActiveId) => {
      if (currActiveId === receipt.conversation_id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === user?.id
              ? { ...m, is_read: true, status: "read", read_at: receipt.read_at }
              : m
          )
        );
      }
      return currActiveId;
    });
  }, [user?.id]);

  // Handle typing indicator
  const handleTyping = useCallback((event) => {
    setActiveConvId((currActiveId) => {
      if (currActiveId === event.conversation_id) {
        setPeerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setPeerTyping(false);
        }, 2500);
      }
      return currActiveId;
    });
  }, []);

  // Initialize WebSocket
  const {
    isConnected,
    isUserOnline,
    sendChatMessage,
    sendMarkRead,
    sendTyping,
  } = useWebSocket({
    onNewMessage: handleNewMessage,
    onReadReceipt: handleReadReceipt,
    onTyping: handleTyping,
  });

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle URL query parameter ?user_id=123 (e.g. from profile or discover page)
  useEffect(() => {
    const targetUserId = searchParams.get("user_id");
    if (targetUserId) {
      const uid = parseInt(targetUserId, 10);
      if (!isNaN(uid)) {
        startConversationWithUser(uid);
      }
      // Remove query param to keep URL clean
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, startConversationWithUser]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;

    let isCancelled = false;

    async function loadThread() {
      setIsLoadingMsgs(true);
      try {
        const res = await client.get(`/conversations/${activeConvId}/messages?limit=40`);
        if (!isCancelled) {
          setMessages(res.data.items || []);
          setHasMore(res.data.has_more || false);

          // Mark as read immediately
          sendMarkRead(activeConvId);
          client.patch(`/conversations/${activeConvId}/read`).catch(() => {});

          // Reset unread count in sidebar
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConvId ? { ...c, unread_count: 0 } : c))
          );
        }
      } catch {
        if (!isCancelled) setMessages([]);
      } finally {
        if (!isCancelled) setIsLoadingMsgs(false);
      }
    }

    loadThread();

    return () => {
      isCancelled = true;
    };
  }, [activeConvId, sendMarkRead]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, peerTyping]);

  // Load earlier messages (pagination)
  const loadEarlierMessages = async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;
    const oldestId = messages[0].id;
    setIsLoadingMore(true);
    try {
      const res = await client.get(
        `/conversations/${activeConvId}/messages?before_id=${oldestId}&limit=30`
      );
      setMessages((prev) => [...(res.data.items || []), ...prev]);
      setHasMore(res.data.has_more || false);
    } catch {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send a message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = inputContent.trim();
    if (!content || !activeConvId || isSending) return;

    const clientMsgId = `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setInputContent("");
    setIsSending(true);

    // Optimistic UI message
    const optimistic = {
      id: -Date.now(),
      conversation_id: activeConvId,
      sender_id: user.id,
      recipient_id: activeConv.peer.id,
      content,
      status: "sending",
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
      client_msg_id: clientMsgId,
    };
    setMessages((prev) => [...prev, optimistic]);

    // Try WebSocket send first
    const wsSent = sendChatMessage(activeConvId, content, clientMsgId);

    if (!wsSent) {
      // REST fallback
      try {
        const res = await client.post(`/conversations/${activeConvId}/messages`, {
          content,
          client_msg_id: clientMsgId,
        });
        setMessages((prev) =>
          prev.map((m) => (m.client_msg_id === clientMsgId ? res.data : m))
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.client_msg_id === clientMsgId ? { ...m, status: "failed" } : m
          )
        );
      }
    }

    setIsSending(false);
  };

  // Start new conversation modal helpers
  const handleOpenNewModal = async () => {
    setShowNewModal(true);
    setIsLoadingConn(true);
    try {
      const res = await client.get("/connections/accepted");
      setConnections(res.data || []);
    } catch {
      setConnections([]);
    } finally {
      setIsLoadingConn(false);
    }
  };

  // Filtered conversations
  const filteredConvs = useMemo(() => {
    if (!searchText.trim()) return conversations;
    const term = searchText.toLowerCase();
    return conversations.filter(
      (c) =>
        c.peer?.full_name?.toLowerCase().includes(term) ||
        c.peer?.username?.toLowerCase().includes(term)
    );
  }, [conversations, searchText]);

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ── Left Sidebar (Conversations List) ───────────────────── */}
      <div
        className={`flex w-full flex-col border-r border-slate-200 bg-slate-50/50 md:w-80 lg:w-96 ${
          activeConvId ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Sidebar Header */}
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Messages</h2>
              {/* Live Gateway Status Pill */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isConnected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
                title={isConnected ? "Real-time gateway active" : "Reconnecting to gateway..."}
              >
                {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isConnected ? "Live" : "Connecting"}
              </span>
            </div>

            <button
              onClick={handleOpenNewModal}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
              title="New message with connected student"
            >
              <Plus size={14} />
              <span>New</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoadingConvs ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 rounded bg-slate-200" />
                    <div className="h-2.5 w-40 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <MessageCircle size={24} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {searchText ? "No matches found" : "No conversations yet"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {searchText
                  ? "Try searching for a different peer."
                  : "Message students you are connected with."}
              </p>
              {!searchText && (
                <button
                  onClick={handleOpenNewModal}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Plus size={14} /> Start Chat
                </button>
              )}
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const peer = conv.peer;
              const online = isUserOnline(peer?.id);
              const isActive = conv.id === activeConvId;

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`flex w-full items-center gap-3 p-3.5 text-left transition ${
                    isActive
                      ? "bg-indigo-50/70 border-l-4 border-l-indigo-600"
                      : "hover:bg-slate-100/70"
                  }`}
                >
                  {/* Avatar + Online Dot */}
                  <div className="relative flex-shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600">
                      {peer?.profile_image ? (
                        <img
                          src={peer.profile_image}
                          alt={peer.full_name}
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        peer?.full_name?.charAt(0) || "U"
                      )}
                    </div>
                    {online && (
                      <span
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"
                        title="Online"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {peer?.full_name}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {formatTime(conv.last_message?.created_at || conv.updated_at)}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <p
                        className={`truncate text-xs ${
                          conv.unread_count > 0
                            ? "font-semibold text-slate-900"
                            : "text-slate-500"
                        }`}
                      >
                        {conv.last_message ? (
                          <>
                            {conv.last_message.sender_id === user.id && "You: "}
                            {conv.last_message.content}
                          </>
                        ) : (
                          <span className="italic text-slate-400">No messages yet</span>
                        )}
                      </p>

                      {conv.unread_count > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Pane (Active Chat Window) ────────────────────── */}
      <div
        className={`flex flex-1 flex-col bg-slate-50/20 ${
          activeConvId ? "flex" : "hidden md:flex"
        }`}
      >
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveConvId(null);
                    setMessages([]);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>

                {/* Avatar with live status */}
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
                    {activeConv.peer?.profile_image ? (
                      <img
                        src={activeConv.peer.profile_image}
                        alt={activeConv.peer.full_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      activeConv.peer?.full_name?.charAt(0) || "U"
                    )}
                  </div>
                  {isUserOnline(activeConv.peer?.id) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeConv.peer?.full_name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isUserOnline(activeConv.peer?.id) ? (
                      <span className="font-medium text-emerald-600">Online</span>
                    ) : (
                      <span>@{activeConv.peer?.username}</span>
                    )}
                    {activeConv.peer?.branch && ` · ${activeConv.peer.branch}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Pagination button */}
              {hasMore && (
                <div className="text-center py-2">
                  <button
                    onClick={loadEarlierMessages}
                    disabled={isLoadingMore}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200 shadow-xs hover:bg-slate-50 transition"
                  >
                    {isLoadingMore ? "Loading..." : "Load earlier messages"}
                  </button>
                </div>
              )}

              {isLoadingMsgs ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Loading chat history...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <MessageCircle size={22} />
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-slate-800">
                    Say hello to {activeConv.peer?.full_name}!
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs">
                    Start collaborating, share course notes, or ask academic questions.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;

                  return (
                    <div
                      key={msg.id || msg.client_msg_id}
                      className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                          isOwn
                            ? "bg-indigo-600 text-white rounded-br-xs"
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>

                      {/* Timestamp & Status indicators */}
                      <div
                        className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-slate-400 ${
                          isOwn ? "justify-end" : "justify-start"
                        }`}
                      >
                        <span>{formatTime(msg.created_at)}</span>
                        {isOwn && (
                          <span>
                            {msg.status === "sending" ? (
                              <Circle size={10} className="animate-spin text-slate-400" />
                            ) : msg.is_read || msg.status === "read" ? (
                              <CheckCheck size={13} className="text-indigo-600" title="Read" />
                            ) : (
                              <Check size={13} className="text-slate-400" title="Sent" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {peerTyping && (
                <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-bounce [animation-delay:0.2s] rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-bounce [animation-delay:0.4s] rounded-full bg-slate-400" />
                  </span>
                  <span>{activeConv.peer?.full_name} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-slate-200 bg-white p-3 sm:p-4"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Message ${activeConv.peer?.full_name}...`}
                  value={inputContent}
                  onChange={(e) => {
                    setInputContent(e.target.value);
                    sendTyping(activeConv.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <button
                  type="submit"
                  disabled={!inputContent.trim() || isSending}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Empty selection state */
          <div className="hidden h-full flex-col items-center justify-center p-8 text-center md:flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MessageCircle size={32} />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-800">
              Select a conversation
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Choose an existing chat from the left sidebar or start a new conversation with a connected student.
            </p>
            <button
              onClick={handleOpenNewModal}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Plus size={15} /> Start New Chat
            </button>
          </div>
        )}
      </div>

      {/* ── Modal: Start New Conversation ──────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                New Conversation
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Per university guidelines, you can only message accepted student connections.
            </p>

            <div className="mt-4 max-h-72 overflow-y-auto divide-y divide-slate-100">
              {isLoadingConn ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Loading connections...
                </div>
              ) : connections.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs font-medium text-slate-600">
                    No accepted connections found.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Go to the Discover tab to connect with peers first!
                  </p>
                </div>
              ) : (
                connections.map((c) => {
                  const peer = c.peer || c.user;
                  if (!peer) return null;

                  return (
                    <button
                      key={c.connection_id || c.id}
                      onClick={() => startConversationWithUser(peer.id)}
                      className="flex w-full items-center justify-between p-3 text-left hover:bg-indigo-50/50 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                          {peer.full_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            {peer.full_name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            @{peer.username}
                            {peer.branch && ` · ${peer.branch}`}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-indigo-600">
                        Chat →
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
