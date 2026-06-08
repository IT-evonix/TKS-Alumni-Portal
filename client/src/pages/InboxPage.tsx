import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Search } from "lucide-react";
import { useLocation } from "wouter";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";
import { validateTextLength, sanitizeString } from "@/utils/validation";

// Types
import { Message, Conversation, AlumniUser } from "@/components/chat/types";

// Components
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { socket } from "@/lib/socket";

export const InboxPage = (): JSX.Element => {
  // Navigation & Auth
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Data State
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<AlumniUser[]>([]);

  // UI State
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState(""); // For searching USERS in compose
  const [conversationSearchQuery, setConversationSearchQuery] = useState(""); // For searching CONVERSATIONS
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Whether we are currently fast-opening a conversation from URL (show skeleton)
  const [isOpeningFromUrl, setIsOpeningFromUrl] = useState<boolean>(() => {
    return !!(new URLSearchParams(window.location.search).get('user') || new URLSearchParams(window.location.search).get('userId'));
  });

  // Selected user for "Compose"
  const [selectedUser, setSelectedUser] = useState<AlumniUser | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<AlumniUser[]>([]);
  const [blocks, setBlocks] = useState<{ blockerId: string, blockedId: string }[]>([]);

  // Refs
  const selectedConversationIdRef = useRef<string | null>(null);
  const openedFromUrlRef = useRef<string | null>(null);
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
    const userId = user?.id || localStorage.getItem('userId') || '';
    const token = localStorage.getItem('auth_token') || '';

    return {
      ...extraHeaders,
      'user-id': userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // --- Effects ---

  useEffect(() => {
    document.title = "Messages - TKS Alumni Portal";
    fetchAllMessages();
    fetchAllUsers();
    fetchBlocks();

    // Fast-open: immediately open chat from URL params without waiting for loading state
    const searchParams = new URLSearchParams(window.location.search);
    const targetUserId = searchParams.get("user") || searchParams.get("userId");
    const prefillMsg = searchParams.get("msg");

    if (prefillMsg) setMessageText(decodeURIComponent(prefillMsg));

    if (targetUserId && openedFromUrlRef.current !== targetUserId) {
      openedFromUrlRef.current = targetUserId;
      (async () => {
        try {
          const res = await fetch(`/api/alumni/public/${targetUserId}`, {
            headers: getAuthHeaders(),
          });
          if (!res.ok) { openedFromUrlRef.current = null; setIsOpeningFromUrl(false); return; }
          const data = await res.json();
          const p = data.profile;
          if (!p || !p.user_id) { openedFromUrlRef.current = null; setIsOpeningFromUrl(false); return; }
          const uid = p.user_id;
          const newConv: Conversation = {
            userId: uid,
            username: p.email || uid,
            email: p.email || '',
            firstName: p.first_name ?? p.firstName ?? '',
            lastName: p.last_name ?? p.lastName ?? '',
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            messages: []
          };
          setSelectedConversation(newConv);
          setConversations(prev => (prev.some(c => c.userId === uid) ? prev : [newConv, ...prev]));
          window.history.replaceState({}, '', '/inbox');
        } catch (e) {
          console.error("Inbox: fast-open from URL", e);
        } finally {
          openedFromUrlRef.current = null;
          setIsOpeningFromUrl(false);
        }
      })();
    }
  }, []);

  // Real-time message updates via Socket.IO (replaces polling)
  useEffect(() => {
    if (!user?.id) return;

    // Connect socket if not connected
    if (!socket.connected) {
      socket.auth = { token: user.id };
      socket.connect();
    }

    const handleNewMessage = (data: any) => {
      // Only update if message is for current user
      if (data.receiverId === user.id || data.senderId === user.id) {
        // Refresh messages to get latest
        fetchAllMessages();
        // Refresh conversations
        buildConversations();
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [user?.id]);

  useEffect(() => {
    if (allMessages.length > 0 || user) {
      buildConversations();
    }
  }, [allMessages, user, allUsers, blocks]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.userId || null;
  }, [selectedConversation?.userId]);

  // Handle URL query parameter (e.g. ?user=123) — merge existing conv details once allUsers loads
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const targetUserIdFromQuery = searchParams.get("user") || searchParams.get("userId");
    const targetUserIdFromStorage = sessionStorage.getItem('openConversationId');
    const targetUserId = targetUserIdFromQuery || targetUserIdFromStorage;

    if (!targetUserId || loading) return;

    // Enrich already-opened conversation with full user details once allUsers is loaded
    const targetUser = allUsers.find(u => u.id === targetUserId);
    if (targetUser) {
      setSelectedConversation(prev => {
        if (prev?.userId !== targetUserId) return prev;
        return {
          ...prev,
          username: targetUser.username,
          email: targetUser.email,
          firstName: targetUser.first_name,
          lastName: targetUser.last_name,
          profilePicture: targetUser.profile_picture,
        };
      });
      if (targetUserIdFromStorage) sessionStorage.removeItem('openConversationId');
      return;
    }

    // Fallback for direct chat links with username/email params
    const targetUsernameFromQuery = searchParams.get("username");
    const targetEmailFromQuery = searchParams.get("email");
    if (targetUserIdFromQuery && (targetUsernameFromQuery || targetEmailFromQuery)) {
      const fallbackConv: Conversation = {
        userId: targetUserIdFromQuery,
        username: targetUsernameFromQuery || targetEmailFromQuery || "User",
        email: targetEmailFromQuery || "",
        firstName: targetUsernameFromQuery || "User",
        lastName: "",
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        messages: []
      };
      setSelectedConversation(fallbackConv);
      setConversations(prev => (prev.some(c => c.userId === fallbackConv.userId) ? prev : [fallbackConv, ...prev]));
      window.history.replaceState({}, '', '/inbox');
      if (targetUserIdFromStorage) sessionStorage.removeItem('openConversationId');
    }
  }, [allUsers, conversations, loading]);

  // Handle User Search (for Compose)
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers([]);
      return;
    }
    const query = searchQuery.trim().toLowerCase();
    const currentUserId = user?.id || localStorage.getItem('userId');
    const filtered = allUsers
      .filter(u => u.id !== currentUserId)
      .filter(u => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        return (
          fullName.includes(query) ||
          (u.username || '').toLowerCase().includes(query) ||
          (u.email || '').toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
    setFilteredUsers(filtered);
  }, [searchQuery, allUsers]);

  // --- Data Fetching ---

  const fetchAllUsers = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/alumni/search?limit=1000', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.alumni.map((a: any) => ({
          id: a.user_id,
          username: a.user?.username || a.email,
          email: a.email,
          first_name: a.first_name,
          last_name: a.last_name,
          phone: a.phone,
          profile_picture: a.profile_picture,
          batch: a.batch,
          current_city: a.current_city,
          current_company: a.current_company,
          current_role: a.current_role || a.current_position,
          industry: a.industry
        })));
      }
    } catch (e) { console.error(e); }
  };

  const fetchBlocks = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/users/blocks', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        // Map database snake_case to frontend camelCase
        const mappedBlocks = (data.blocks || []).map((b: any) => ({
          blockerId: b.blocker_id,
          blockedId: b.blocked_id
        }));
        setBlocks(mappedBlocks);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAllMessages = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const [inboxRes, sentRes] = await Promise.all([
        fetch('/api/messages/inbox', { headers: { 'user-id': userId || '' } }),
        fetch('/api/messages/sent', { headers: { 'user-id': userId || '' } })
      ]);

      if (inboxRes.ok && sentRes.ok) {
        const inboxData = await inboxRes.json();
        const sentData = await sentRes.json();
        const combined = [
          ...(inboxData.messages || []),
          ...(sentData.messages || [])
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAllMessages(combined);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- Logic Helpers ---

  const buildConversations = () => {
    const currentUserId = user?.id || localStorage.getItem('userId');
    const conversationMap = new Map<string, Conversation>();

    // Create a lookup for user details including profile pictures
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    allMessages.forEach(msg => {
      const otherUserId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
      const otherUser = msg.sender_id === currentUserId ? msg.receiver : msg.sender;
      if (!otherUser) return;

      if (!conversationMap.has(otherUserId)) {
        // Try to get rich details from allUsers map, fallback to message details
        const details = userMap.get(otherUserId);

        conversationMap.set(otherUserId, {
          userId: otherUserId,
          username: details?.username || otherUser.username,
          email: details?.email || otherUser.email,
          firstName: details?.first_name || otherUser.first_name || otherUser.username?.split(' ')[0],
          lastName: details?.last_name || otherUser.last_name || otherUser.username?.split(' ')[1],
          phone: details?.phone || undefined,
          profilePicture: details?.profile_picture || undefined,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          unreadCount: 0,
          messages: [],
          isBlocked: blocks.some(b => b.blockerId === otherUserId && b.blockedId === currentUserId),
          hasBlocked: blocks.some(b => b.blockerId === currentUserId && b.blockedId === otherUserId),
        });
      }
      const conv = conversationMap.get(otherUserId)!;
      // Update counts and status for existing conversation
      conv.isBlocked = blocks.some(b => b.blockerId === otherUserId && b.blockedId === currentUserId);
      conv.hasBlocked = blocks.some(b => b.blockerId === currentUserId && b.blockedId === otherUserId);
      if (!conv.messages.some(m => m.id === msg.id)) {
        conv.messages.push(msg);
      }
      if (new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
        conv.lastMessage = msg.content;
        conv.lastMessageTime = msg.created_at;
      }
      if (msg.receiver_id === currentUserId && !msg.is_read) {
        conv.unreadCount++;
      }
    });

    // Sort messages in each conv and ensure lastMessage/lastMessageTime come from the latest message
    conversationMap.forEach(conv => {
      conv.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const latest = conv.messages[conv.messages.length - 1];
      if (latest) {
        conv.lastMessage = latest.content;
        conv.lastMessageTime = latest.created_at;
      }
    });

    const convArray = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    setConversations(convArray);

    // Update selected conversation in-place
    const openId = selectedConversationIdRef.current;
    if (openId) {
      const updated = convArray.find(c => c.userId === openId);
      if (updated) {
        setSelectedConversation(prev => {
          // Logic to preserve some state if needed, or just replace
          return updated;
        });
        // Mark as read if unread count > 0
        if (updated.unreadCount > 0) {
          markMessagesAsRead(updated);
        }
      }
    }
  };

  const markMessagesAsRead = async (conv: Conversation) => {
    const currentUserId = user?.id || localStorage.getItem('userId');
    const unreadMessages = conv.messages.filter(m => m.receiver_id === currentUserId && !m.is_read);

    if (unreadMessages.length === 0) return;

    // Optimistic Update for immediate UI response
    setAllMessages(prev => prev.map(m =>
      unreadMessages.find(um => um.id === m.id) ? { ...m, is_read: true } : m
    ));

    // Async persistent update to DB
    await Promise.all(
      unreadMessages.map(msg =>
        fetch(`/api/messages/${msg.id}/read`, {
          method: 'PUT',
          headers: { 'user-id': currentUserId || '' }
        })
      )
    );
  };

  // --- Handlers ---

  const handleSendMessage = async () => {
    // Validate message content
    if (!messageText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    // Validate message length
    const validation = validateTextLength(messageText, 'Message', 1, 5000);
    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    const userId = user?.id || localStorage.getItem('userId');

    // Handle Message Edit
    if (editingMessage) {
      setSending(true);
      try {
        const response = await fetch(`/api/messages/${editingMessage.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId || ''
          },
          body: JSON.stringify({ content: messageText })
        });

        if (response.ok) {
          setMessageText("");
          setEditingMessage(null);
          fetchAllMessages();
          toast({ title: "Success", description: "Message updated" });
        } else {
          const errorData = await response.json();
          toast({
            title: "Error",
            description: errorData.error || "Failed to update message",
            variant: "destructive"
          });
        }
      } catch (e) {
        toast({ title: "Error", description: "Failed to update message", variant: "destructive" });
      } finally {
        setSending(false);
      }
      return;
    }

    // Handle Threaded Reply
    if (replyingTo) {
      setSending(true);
      try {
        const response = await fetch(`/api/messages/${replyingTo.id}/replies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId || ''
          },
          body: JSON.stringify({ content: messageText })
        });

        if (response.ok) {
          setMessageText("");
          setReplyingTo(null);
          fetchAllMessages(); // Refresh to show new reply
        } else {
          toast({ title: "Error", description: "Failed to send reply", variant: "destructive" });
        }
      } catch (e) {
        toast({ title: "Error", description: "Failed to send reply", variant: "destructive" });
      } finally {
        setSending(false);
      }
      return;
    }

    // Handle Normal Message
    const receiverId = isComposeOpen && selectedUser ? selectedUser.id : selectedConversation?.userId;
    if (!receiverId) return;

    // Preventive check for blocks
    const hasBlockedAny = blocks.some(b => b.blockerId === userId && b.blockedId === receiverId);
    const isBlockedAny = blocks.some(b => b.blockerId === receiverId && b.blockedId === userId);

    if (hasBlockedAny || isBlockedAny) {
      toast({
        title: "Cannot Send",
        description: hasBlockedAny ? "You have blocked this user." : "This user has blocked you.",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId || '' },
        body: JSON.stringify({
          receiverId,
          subject: 'Chat Message',
          content: sanitizeString(messageText.trim()),
          senderName: user?.username
        })
      });

      if (response.ok) {
        setMessageText("");
        setSearchQuery("");
        setSelectedUser(null);
        setFilteredUsers([]);
        setIsComposeOpen(false); // This will trigger onOpenChange which also clears state
        fetchAllMessages(); // Trigger refresh
        toast({
          title: "Success",
          description: "Message sent successfully",
        });
      } else {
        const errorInfo = await handleAPIError(response);
        throw errorInfo;
      }
    } catch (e) {
      logError(e, 'InboxPage.handleSendMessage');
      toast({ 
        title: "Error", 
        description: getUserFriendlyError(e), 
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId || '' },
        body: JSON.stringify({ emoji })
      });
      if (response.ok) fetchAllMessages();
    } catch (e) {
      console.error("Reaction error:", e);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'user-id': userId || '' }
      });
      if (response.ok) {
        fetchAllMessages();
      } else {
        toast({ title: "Error", description: "Could not delete message", variant: "destructive" });
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const handleEditClick = (msg: Message) => {
    setEditingMessage(msg);
    setMessageText(msg.content);
    setReplyingTo(null); // Clear reply state if editing
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/messages/upload', {
        method: 'POST',
        headers: { 'user-id': user?.id || '' },
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        setMessageText(prev => prev + `\n[📎 ${data.fileName}](${data.url})`);
      }
    } catch (e) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleBlockUser = async (targetUserId: string) => {
    if (!confirm("Are you sure you want to block this user? They will no longer be able to message you.")) return;
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/users/block/${targetUserId}`, {
        method: 'POST',
        headers: { 'user-id': userId || '' }
      });
      if (response.ok) {
        toast({ title: "User Blocked", description: "You will no longer receive messages from this user." });
        fetchBlocks();
      }
    } catch (e) { console.error(e); }
  };

  const handleUnblockUser = async (targetUserId: string) => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/users/unblock/${targetUserId}`, {
        method: 'POST',
        headers: { 'user-id': userId || '' }
      });
      if (response.ok) {
        toast({ title: "User Unblocked", description: "You can now receive messages from this user." });
        fetchBlocks();
      }
    } catch (e) { console.error(e); }
  };

  const handleConversationSelect = (conv: Conversation) => {
    setSelectedConversation(conv);
    if (conv.unreadCount > 0) {
      markMessagesAsRead(conv);
    }
    // On mobile, this will switch view
  };

  // --- Filtered Conversations ---
  const filteredConversations = conversations.filter(c =>
    c.username.toLowerCase().includes(conversationSearchQuery.toLowerCase()) ||
    (c.firstName + ' ' + c.lastName).toLowerCase().includes(conversationSearchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="h-full flex bg-white overflow-hidden">
        {/* Sidebar */}
        <div className={`w-full lg:w-auto lg:flex-shrink-0 transition-all duration-300 ${selectedConversation || isOpeningFromUrl ? 'hidden lg:block' : 'block'}`}>
          {isOpeningFromUrl ? (
            /* Full sidebar skeleton while fast-opening */
            <div className="w-full lg:w-[320px] h-full flex flex-col border-r border-gray-100 bg-white">
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                <div className="w-24 h-5 bg-gray-200 rounded animate-pulse" />
                <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
              </div>
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="w-full h-9 bg-gray-100 rounded-lg animate-pulse" />
              </div>
              {/* Skeleton conversation entry — highlighted as active */}
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border-l-4 border-[#008060]">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-28 h-3.5 bg-gray-200 rounded animate-pulse" />
                  <div className="w-40 h-3 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
              {/* More faint rows below */}
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 opacity-50">
                  <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-3 bg-gray-100 rounded animate-pulse" />
                    <div className="w-36 h-2.5 bg-gray-50 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <ConversationList
            conversations={filteredConversations}
            selectedConversationId={selectedConversation?.userId || null}
            onSelect={handleConversationSelect}
            searchQuery={conversationSearchQuery}
            onSearchChange={setConversationSearchQuery}
            onNewMessage={() => setIsComposeOpen(true)}
            currentUserId={user?.id || ''}
          />
          )}
        </div>

        {/* Chat Window */}
        <div className={`flex-1 flex flex-col min-w-0 bg-[#f8fafc] ${!selectedConversation && !isOpeningFromUrl ? 'hidden lg:flex' : 'flex'}`}>
          {isOpeningFromUrl && !selectedConversation ? (
            // Loading skeleton while fast-opening from URL
            <div className="flex flex-col h-full">
              {/* Header skeleton */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex flex-col gap-2">
                  <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-20 h-3 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
              {/* Messages area skeleton */}
              <div className="flex-1 p-6 space-y-4 overflow-hidden">
                {[1,2,3].map(i => (
                  <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                    <div className={`w-48 h-10 rounded-2xl bg-gray-200 animate-pulse ${i % 2 === 0 ? 'bg-emerald-100' : ''}`} />
                  </div>
                ))}
              </div>
              {/* Input skeleton */}
              <div className="px-4 py-3 border-t border-gray-100 bg-white">
                <div className="w-full h-12 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            </div>
          ) : (
          <ChatWindow
            conversation={selectedConversation}
            messageText={messageText}
            isSending={sending}
            isUploading={uploading}
            onMessageChange={setMessageText}
            onSendMessage={handleSendMessage}
            onFileUpload={handleFileUpload}
            onBack={() => setSelectedConversation(null)}
            currentUserId={user?.id || ''}
            onReply={(msg) => { setReplyingTo(msg); setEditingMessage(null); }}
            onReact={handleReact}
            onDeleteMessage={handleDeleteMessage}
            onEdit={handleEditClick}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            editingMessage={editingMessage}
            onCancelEdit={() => { setEditingMessage(null); setMessageText(""); }}
            onBlock={handleBlockUser}
            onUnblock={handleUnblockUser}
          />
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog 
        open={isComposeOpen} 
        onOpenChange={(open) => {
          setIsComposeOpen(open);
          // Clear all compose-related state when dialog closes
          if (!open) {
            setSearchQuery('');
            setSelectedUser(null);
            setFilteredUsers([]);
            setMessageText('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="relative z-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search alumni..."
                  className="pl-9"
                />
              </div>
              {filteredUsers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                  {filteredUsers.map(u => (
                    <div
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setSearchQuery(`${u.first_name} ${u.last_name}`); setFilteredUsers([]); }}
                      className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                        {(u.first_name?.[0] || u.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-gray-500">{u.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md border border-green-100">
                <div className="text-sm font-medium text-green-800">To: {selectedUser.first_name} {selectedUser.last_name}</div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={() => { setSelectedUser(null); setSearchQuery(''); }}>
                  &times;
                </Button>
              </div>
            )}

            <Textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[100px]"
            />

            <Button onClick={handleSendMessage} disabled={!selectedUser || !messageText.trim() || sending} className="w-full bg-[#008060] hover:bg-[#006e53]">
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};
