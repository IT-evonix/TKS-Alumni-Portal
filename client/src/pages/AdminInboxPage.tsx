import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import { MessageAttachment } from "@/components/chat/MessageAttachment";
import { parseMessageContent } from "@/lib/messageUtils";
import { formatDateTimeIST, formatTimeIST } from "@/lib/dateUtils";
import { socket } from "@/lib/socket";
import {
  ArrowLeft,
  Bell,
  LogOut,
  Search,
  Send,
  MessageSquare,
  User,
  ChevronLeft,
  Clock,
  Paperclip,
  X,
} from "lucide-react";
import { Message, Conversation } from "@/components/chat/types";

interface AdminConversation {
  userId: string;
  username: string;
  email: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export const AdminInboxPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { adminUser, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<AdminConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Admin Inbox - TKS Alumni Portal";
    fetchMessages();
  }, [adminUser]);

  useEffect(() => {
    if (!adminUser?.id) return;
    if (!socket.connected) {
      socket.auth = { token: adminUser.id };
      socket.connect();
    }
    const handleNewMessage = (data: any) => {
      if (data.receiverId === adminUser.id || data.senderId === adminUser.id) {
        fetchMessages();
      }
    };
    socket.on("new_message", handleNewMessage);
    return () => { socket.off("new_message", handleNewMessage); };
  }, [adminUser?.id]);

  useEffect(() => {
    buildConversations();
  }, [allMessages, adminUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConv?.messages]);

  useEffect(() => {
    selectedConvRef.current = selectedConv?.userId || null;
  }, [selectedConv?.userId]);

  const fetchMessages = async () => {
    if (!adminUser?.id) return;
    try {
      const res = await fetch("/api/admin/inbox", {
        headers: { "user-id": adminUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setAllMessages(data.messages || []);
      }
    } catch (e) {
      console.error("Admin inbox fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const buildConversations = () => {
    const adminId = adminUser?.id;
    if (!adminId) return;

    const map = new Map<string, AdminConversation>();

    allMessages.forEach((msg) => {
      const otherUserId = msg.sender_id === adminId ? msg.receiver_id : msg.sender_id;
      const otherUser = msg.sender_id === adminId ? msg.receiver : msg.sender;
      if (!otherUserId || otherUserId === adminId) return;

      if (!map.has(otherUserId)) {
        map.set(otherUserId, {
          userId: otherUserId,
          username: otherUser?.username || otherUser?.email || "User",
          email: otherUser?.email || "",
          lastMessage: "",
          lastMessageTime: msg.created_at,
          unreadCount: 0,
          messages: [],
        });
      }

      const conv = map.get(otherUserId)!;
      if (otherUser && conv.username === "User") {
        conv.username = otherUser.username || otherUser.email || "User";
        conv.email = otherUser.email || "";
      }
      if (!conv.messages.some((m) => m.id === msg.id)) {
        conv.messages.push(msg);
      }
      if (new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
        conv.lastMessageTime = msg.created_at;
      }
      if (msg.receiver_id === adminId && !msg.is_read) {
        conv.unreadCount++;
      }
    });

    map.forEach((conv) => {
      conv.messages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latest = conv.messages[conv.messages.length - 1];
      if (latest) conv.lastMessage = latest.content;
    });

    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );
    setConversations(sorted);

    // Update selected conversation in-place
    const openId = selectedConvRef.current;
    if (openId) {
      const updated = sorted.find((c) => c.userId === openId);
      if (updated) {
        setSelectedConv(updated);
        if (updated.unreadCount > 0) markAsRead(updated);
      }
    }
  };

  const markAsRead = async (conv: AdminConversation) => {
    const adminId = adminUser?.id;
    if (!adminId) return;
    const unread = conv.messages.filter((m) => m.receiver_id === adminId && !m.is_read);
    if (!unread.length) return;

    setAllMessages((prev) =>
      prev.map((m) => (unread.find((u) => u.id === m.id) ? { ...m, is_read: true } : m))
    );
    await Promise.all(
      unread.map((msg) =>
        fetch(`/api/messages/${msg.id}/read`, {
          method: "PUT",
          headers: { "user-id": adminId },
        })
      )
    );
  };

  const handleSelectConv = (conv: AdminConversation) => {
    setSelectedConv(conv);
    setReplyingTo(null);
    setMessageText("");
    if (conv.unreadCount > 0) markAsRead(conv);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedConv || !adminUser?.id) return;

    if (replyingTo) {
      setSending(true);
      try {
        const res = await fetch(`/api/messages/${replyingTo.id}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "user-id": adminUser.id },
          body: JSON.stringify({ content: messageText.trim() }),
        });
        if (res.ok) {
          setMessageText("");
          setReplyingTo(null);
          fetchMessages();
        } else {
          toast({ title: "Error", description: "Failed to send reply", variant: "destructive" });
        }
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-id": adminUser.id },
        body: JSON.stringify({
          receiverId: selectedConv.userId,
          subject: "Admin Reply",
          content: messageText.trim(),
          senderName: adminUser.username || "Admin",
        }),
      });
      if (res.ok) {
        setMessageText("");
        fetchMessages();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to send", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminUser?.id) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/messages/upload", {
        method: "POST",
        headers: { "user-id": adminUser.id },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setMessageText((prev) => prev + `\n[📎 ${data.fileName}](${data.url})`);
      }
    } catch {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return formatTimeIST(dateString);
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days}d ago`;
      return formatDateTimeIST(dateString).split(",")[0];
    } catch {
      return dateString;
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminId = adminUser?.id;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar currentPage="inbox" />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 sticky top-0 z-40 shadow-sm flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/admin/dashboard")}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                Inbox
                {totalUnread > 0 && (
                  <Badge className="bg-red-500 text-white text-xs px-2 py-0.5">
                    {totalUnread}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-gray-500">Direct messages from students & alumni</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative z-[70]">
              <Button
                variant="ghost"
                size="icon"
                className={`relative min-w-[44px] min-h-[44px] rounded-full ${
                  unreadCount > 0
                    ? "text-[#008060] ring-2 ring-[#008060]/30"
                    : "text-gray-600 hover:text-[#008060]"
                }`}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
              {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
            </div>
            <Button
              variant="outline"
              className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              onClick={logoutAdmin}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{adminUser?.username || "Admin"}</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-semibold">
                  {adminUser?.username?.charAt(0).toUpperCase() || "A"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main chat layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Conversation list */}
          <div
            className={`w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col ${
              selectedConv ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-7 h-7 border-2 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No conversations yet</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Students can message you via the portal
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredConversations.map((conv) => {
                    const isSelected = selectedConv?.userId === conv.userId;
                    const parsed = parseMessageContent(conv.lastMessage);
                    const preview = parsed.text
                      ? parsed.text.slice(0, 60)
                      : parsed.attachments.length
                      ? "📎 Attachment"
                      : "";

                    return (
                      <button
                        key={conv.userId}
                        onClick={() => handleSelectConv(conv)}
                        className={`w-full text-left px-4 py-4 flex items-start gap-3 transition-colors hover:bg-gray-50 ${
                          isSelected ? "bg-[#008060]/5 border-r-2 border-[#008060]" : ""
                        }`}
                      >
                        <div className="w-11 h-11 flex-shrink-0 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {(conv.username[0] || "U").toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span
                              className={`text-sm font-semibold truncate ${
                                isSelected ? "text-[#008060]" : "text-gray-900"
                              }`}
                            >
                              {conv.username}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {formatTime(conv.lastMessageTime)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{conv.email}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-500 truncate max-w-[160px]">
                              {preview}
                            </p>
                            {conv.unreadCount > 0 && (
                              <Badge className="ml-2 bg-[#008060] text-white text-[10px] px-1.5 py-0 h-4 min-w-[16px] flex items-center justify-center rounded-full flex-shrink-0">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat window */}
          <div
            className={`flex-1 flex flex-col min-w-0 bg-[#f8fafc] ${
              !selectedConv ? "hidden lg:flex items-center justify-center" : "flex"
            }`}
          >
            {!selectedConv ? (
              <div className="text-center text-gray-400">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a conversation from the left to start chatting</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setSelectedConv(null)}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {(selectedConv.username[0] || "U").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {selectedConv.username}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{selectedConv.email}</p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {selectedConv.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-16">
                      <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">No messages yet. Start the conversation.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pb-2">
                      {selectedConv.messages.map((msg) => {
                        const isMine = msg.sender_id === adminId;
                        const parsed = parseMessageContent(msg.content);
                        return (
                          <div key={msg.id} className="space-y-1">
                            <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[72%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                  isMine
                                    ? "bg-[#008060] text-white rounded-tr-sm"
                                    : "bg-white text-gray-900 border border-gray-100 rounded-tl-sm"
                                }`}
                              >
                                {parsed.text && (
                                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                    {parsed.text}
                                  </p>
                                )}
                                {parsed.attachments.length > 0 && (
                                  <div className={`flex flex-col gap-2 ${parsed.text ? "mt-2" : ""}`}>
                                    {parsed.attachments.map((att, i) => (
                                      <MessageAttachment key={i} attachment={att} />
                                    ))}
                                  </div>
                                )}
                                <div
                                  className={`flex items-center gap-1.5 mt-1.5 text-[11px] ${
                                    isMine ? "text-white/70 justify-end" : "text-gray-400"
                                  }`}
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDateTimeIST(msg.created_at)}
                                  {isMine && (
                                    <span className="ml-1">{msg.is_read ? "✓✓" : "✓"}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Reactions */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div
                                className={`flex flex-wrap gap-1 ${
                                  isMine ? "justify-end mr-1" : "justify-start ml-1"
                                }`}
                              >
                                {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => {
                                  const count = msg.reactions!.filter((r) => r.emoji === emoji).length;
                                  return (
                                    <span
                                      key={emoji}
                                      className="bg-white border border-gray-200 rounded-full px-2 py-0.5 text-xs flex items-center gap-1 shadow-sm"
                                    >
                                      {emoji}
                                      <span className="text-gray-500 text-[10px]">{count}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Replies */}
                            {msg.replies && msg.replies.length > 0 && (
                              <div
                                className={`ml-4 space-y-1 border-l-2 border-gray-200 pl-3 ${
                                  isMine ? "items-end" : "items-start"
                                }`}
                              >
                                {msg.replies.map((reply) => (
                                  <div key={reply.id} className="bg-white/80 border border-gray-100 rounded-lg p-2 text-xs shadow-sm">
                                    <span className="font-semibold text-[#008060]">
                                      {reply.sender?.username || "Unknown"}
                                    </span>
                                    <span className="text-gray-400 ml-2">
                                      {formatTimeIST(reply.created_at)}
                                    </span>
                                    <p className="text-gray-700 mt-0.5">{reply.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply button for non-admin messages */}
                            {!isMine && (
                              <div className="flex justify-start pl-1">
                                <button
                                  onClick={() => setReplyingTo(replyingTo?.id === msg.id ? null : msg)}
                                  className="text-[11px] text-gray-400 hover:text-[#008060] transition-colors"
                                >
                                  {replyingTo?.id === msg.id ? "Cancel reply" : "↩ Reply"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Reply indicator */}
                {replyingTo && (
                  <div className="flex-shrink-0 mx-4 mb-0 px-3 py-2 bg-[#008060]/5 border border-[#008060]/20 rounded-t-lg flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#008060]">Replying to:</p>
                      <p className="text-xs text-gray-600 truncate">
                        {parseMessageContent(replyingTo.content).text?.slice(0, 80) || "Attachment"}
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Input area */}
                <div
                  className={`flex-shrink-0 bg-white border-t border-gray-200 p-4 flex gap-3 items-end ${
                    replyingTo ? "rounded-t-none" : ""
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-gray-400 hover:text-[#008060]"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      replyingTo
                        ? "Type your reply... (Enter to send)"
                        : "Type a message... (Enter to send, Shift+Enter for new line)"
                    }
                    className="flex-1 min-h-[44px] max-h-32 resize-none border-gray-200 focus:border-[#008060] focus:ring-[#008060]/20 text-sm"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sending || uploading}
                    className="flex-shrink-0 bg-[#008060] hover:bg-[#006e53] w-10 h-10 p-0 rounded-full"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
