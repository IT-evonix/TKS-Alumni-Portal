import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { ArrowLeft, Search, MessageSquare, User, Clock, ChevronDown, ChevronUp, Download, Bell, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatDateTimeIST, formatTimeIST } from "@/lib/dateUtils";
import { parseMessageContent } from "@/lib/messageUtils";
import { MessageAttachment } from "@/components/chat/MessageAttachment";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

interface MessageReply {
  id: string;
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    username: string;
    email: string;
  };
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  subject: string;
  content: string;
  is_read: boolean;
  created_at: string;
  reactions?: MessageReaction[];
  replies?: MessageReply[];
}

interface UserConversation {
  userId: string;
  username: string;
  email: string;
  messageCount: number;
  lastMessageTime: string;
}

interface ConversationThread {
  otherUserId: string;
  otherUsername: string;
  otherEmail: string;
  messages: Message[];
}

export const AdminMessagesPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, adminUser, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [users, setUsers] = useState<UserConversation[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserConversation | null>(null);
  const [conversationThreads, setConversationThreads] = useState<ConversationThread[]>([]);
  const [showConversationsDialog, setShowConversationsDialog] = useState(false);
  const [expandedConversations, setExpandedConversations] = useState<string[]>([]);

  useEffect(() => {
    fetchAllMessages();
  }, [adminUser]);

  // Automatic logout on tab close for admins (not on refresh)
  useEffect(() => {
    const handleUnload = () => {
      sessionStorage.setItem('adminRefresh', Date.now().toString());
    };

    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  const fetchAllMessages = async () => {
    try {
      const userId = adminUser?.id;
      if (!userId) return;

      const response = await fetch('/api/admin/messages/all', {
        headers: {
          'user-id': userId
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAllMessages(data.messages || []);
        processUsers(data.messages || []);
      } else {
        throw new Error('Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processUsers = (messages: Message[]) => {
    const userMap = new Map<string, UserConversation>();

    messages.forEach(msg => {
      // Process sender
      if (!userMap.has(msg.sender_id)) {
        userMap.set(msg.sender_id, {
          userId: msg.sender_id,
          username: (msg as any).sender?.username || 'Unknown',
          email: (msg as any).sender?.email || '',
          messageCount: 0,
          lastMessageTime: msg.created_at
        });
      }
      const senderData = userMap.get(msg.sender_id)!;
      senderData.messageCount++;
      if (new Date(msg.created_at) > new Date(senderData.lastMessageTime)) {
        senderData.lastMessageTime = msg.created_at;
      }

      // Process receiver
      if (!userMap.has(msg.receiver_id)) {
        userMap.set(msg.receiver_id, {
          userId: msg.receiver_id,
          username: (msg as any).receiver?.username || 'Unknown',
          email: (msg as any).receiver?.email || '',
          messageCount: 0,
          lastMessageTime: msg.created_at
        });
      }
      const receiverData = userMap.get(msg.receiver_id)!;
      receiverData.messageCount++;
      if (new Date(msg.created_at) > new Date(receiverData.lastMessageTime)) {
        receiverData.lastMessageTime = msg.created_at;
      }
    });

    setUsers(Array.from(userMap.values()).sort((a, b) =>
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    ));
  };

  const handleUserClick = (userConv: UserConversation) => {
    setSelectedUser(userConv);

    // Group messages by conversation partner
    const threadMap = new Map<string, ConversationThread>();

    const userMessages = allMessages.filter(msg =>
      msg.sender_id === userConv.userId || msg.receiver_id === userConv.userId
    );

    userMessages.forEach(msg => {
      const otherUserId = msg.sender_id === userConv.userId ? msg.receiver_id : msg.sender_id;

      if (!threadMap.has(otherUserId)) {
        const otherUser = msg.sender_id === userConv.userId
          ? (msg as any).receiver
          : (msg as any).sender;

        threadMap.set(otherUserId, {
          otherUserId,
          otherUsername: otherUser?.username || 'Unknown',
          otherEmail: otherUser?.email || '',
          messages: []
        });
      }

      threadMap.get(otherUserId)!.messages.push(msg);
    });

    // Sort messages within each thread
    threadMap.forEach(thread => {
      thread.messages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    setConversationThreads(Array.from(threadMap.values()));
    setShowConversationsDialog(true);
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        // Today - show time in IST
        return formatTimeIST(dateString);
      } else if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return `${days} days ago`;
      } else {
        // Older dates - show date in IST
        const istDate = formatDateTimeIST(dateString);
        return istDate.split(',')[0]; // Get date part only
      }
    } catch {
      return dateString;
    }
  };

  const exportConversations = (userConv: UserConversation) => {
    // Get all conversations for this user
    const userMessages = allMessages.filter(msg =>
      msg.sender_id === userConv.userId || msg.receiver_id === userConv.userId
    );

    // Group by conversation partner
    const threadMap = new Map<string, ConversationThread>();

    userMessages.forEach(msg => {
      const otherUserId = msg.sender_id === userConv.userId ? msg.receiver_id : msg.sender_id;

      if (!threadMap.has(otherUserId)) {
        const otherUser = msg.sender_id === userConv.userId
          ? (msg as any).receiver
          : (msg as any).sender;

        threadMap.set(otherUserId, {
          otherUserId,
          otherUsername: otherUser?.username || 'Unknown',
          otherEmail: otherUser?.email || '',
          messages: []
        });
      }

      threadMap.get(otherUserId)!.messages.push(msg);
    });

    // Sort messages within each thread
    threadMap.forEach(thread => {
      thread.messages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    const threads = Array.from(threadMap.values());

    // Create formatted text export
    let exportText = `=================================================\n`;
    exportText += `MESSAGE EXPORT FOR: ${userConv.username}\n`;
    exportText += `Email: ${userConv.email}\n`;
    exportText += `Total Messages: ${userConv.messageCount}\n`;
    exportText += `Export Date: ${formatDateTimeIST(new Date().toISOString())}\n`;
    exportText += `=================================================\n\n`;

    threads.forEach((thread, index) => {
      exportText += `\n${'='.repeat(80)}\n`;
      exportText += `CONVERSATION ${index + 1} of ${threads.length}\n`;
      exportText += `With: ${thread.otherUsername} (${thread.otherEmail})\n`;
      exportText += `Total Messages: ${thread.messages.length}\n`;
      exportText += `${'='.repeat(80)}\n\n`;

      thread.messages.forEach((msg, msgIndex) => {
        const isSentByUser = msg.sender_id === userConv.userId;
        const sender = isSentByUser ? userConv.username : thread.otherUsername;
        const timestamp = formatDateTimeIST(msg.created_at);

        exportText += `${'-'.repeat(80)}\n`;
        exportText += `Message ${msgIndex + 1}\n`;
        exportText += `From: ${sender}\n`;
        exportText += `Date: ${timestamp}\n`;
        if (msg.subject && msg.subject !== 'No subject') {
          exportText += `Subject: ${msg.subject}\n`;
        }
        exportText += `Status: ${msg.is_read ? 'Read' : 'Unread'}\n`;
        exportText += `${'-'.repeat(80)}\n`;
        exportText += `${msg.content}\n`;
        exportText += `\n`;
      });
    });

    exportText += `\n${'='.repeat(80)}\n`;
    exportText += `END OF EXPORT\n`;
    exportText += `${'='.repeat(80)}\n`;

    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `messages_${userConv.username.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Conversations exported to ${filename}`,
    });
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Shared Admin Sidebar */}
      <AdminSidebar currentPage="messages" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/admin/dashboard")}
                className="hover:bg-gray-100"
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative z-[70]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[44px] min-h-[44px] rounded-full transition-colors ${
                    unreadCount > 0
                      ? "text-[#008060] hover:bg-[#008060]/10 hover:text-[#006b51] ring-2 ring-[#008060]/30"
                      : "text-gray-600 hover:text-[#008060] hover:bg-gray-100"
                  }`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                  <Bell className="w-5 h-5" strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>

                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>
              <Button
                variant="outline"
                className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                onClick={() => {
                  logoutAdmin();
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{adminUser?.username || 'Admin'}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold">{adminUser?.username?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 bg-gradient-to-br from-gray-50 to-white overflow-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">User Messages</h1>
            <p className="text-sm text-gray-600">View all message conversations across users</p>
          </div>

          {/* Search */}
          <Card className="mb-4 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#008060]" />
                Users with Messages ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((userConv) => (
                    <div
                      key={userConv.userId}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-[#008060] hover:bg-[#008060]/5 transition-all"
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => handleUserClick(userConv)}
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{userConv.username}</h3>
                          <p className="text-sm text-gray-500 truncate">{userConv.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-[#008060]/10 text-[#008060]">
                          {userConv.messageCount} messages
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(userConv.lastMessageTime)}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportConversations(userConv);
                          }}
                          className="ml-2 text-[#008060] hover:bg-[#008060] hover:text-white border-[#008060]/30"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Export
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Conversations Dialog */}
      <Dialog open={showConversationsDialog} onOpenChange={setShowConversationsDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-[#008060]" />
              Conversations for {selectedUser?.username}
            </DialogTitle>
            <p className="text-sm text-gray-500">{selectedUser?.email}</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {conversationThreads.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No conversations found</p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {conversationThreads.map((thread) => (
                  <AccordionItem
                    key={thread.otherUserId}
                    value={thread.otherUserId}
                    className="border-2 border-gray-200 rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="bg-gradient-to-r from-[#008060]/10 to-[#006b51]/10 px-6 py-4 hover:no-underline hover:from-[#008060]/20 hover:to-[#006b51]/20 transition-colors">
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            Conversation with {thread.otherUsername}
                          </h3>
                          <p className="text-xs text-gray-600 truncate">{thread.otherEmail}</p>
                        </div>
                        <Badge variant="outline" className="bg-[#008060]/10 text-[#008060] border-[#008060]/30">
                          {thread.messages.length} messages
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="space-y-3 pt-4">
                        {thread.messages.map((msg, idx) => {
                          const isSentBySelectedUser = msg.sender_id === selectedUser?.userId;
                          const parsedContent = parseMessageContent(msg.content);
                          return (
                            <div key={msg.id} className="space-y-2">
                              <div className={`flex ${isSentBySelectedUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] ${isSentBySelectedUser ? 'bg-[#008060] text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3 shadow-sm`}>
                                  {msg.subject && msg.subject !== 'No subject' && (
                                    <p className={`text-xs font-semibold mb-1 ${isSentBySelectedUser ? 'text-white/90' : 'text-gray-600'}`}>
                                      📧 {msg.subject}
                                    </p>
                                  )}

                                  {/* Text Content */}
                                  {parsedContent.text && (
                                    <p className="text-sm whitespace-pre-wrap break-words">{parsedContent.text}</p>
                                  )}

                                  {/* Attachments */}
                                  {parsedContent.attachments.length > 0 && (
                                    <div className={`flex flex-col gap-2 ${parsedContent.text ? 'mt-3' : ''}`}>
                                      {parsedContent.attachments.map((att, i) => (
                                        <MessageAttachment key={i} attachment={att} />
                                      ))}
                                    </div>
                                  )}

                                  {/* Metadata (Time & Status) */}
                                  <div className="flex items-center gap-2 mt-2 text-xs opacity-75">
                                    <Clock className="w-3 h-3" />
                                    {formatDateTimeIST(msg.created_at)}
                                    {isSentBySelectedUser && (
                                      <span className="ml-1">{msg.is_read ? '✓✓' : '✓'}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Reactions Display */}
                              {msg.reactions && msg.reactions.length > 0 && (
                                <div className={`flex flex-wrap gap-1.5 ${isSentBySelectedUser ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                                  {Array.from(new Set(msg.reactions.map(r => r.emoji))).map((emoji) => {
                                    const emojiReactions = msg.reactions?.filter(r => r.emoji === emoji) || [];
                                    return (
                                      <div
                                        key={emoji}
                                        className="bg-white hover:bg-gray-50 border border-gray-200 shadow-sm rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5"
                                        title={emojiReactions.map(r => r.user?.username || 'Unknown').join(', ')}
                                      >
                                        <span className="text-sm">{emoji}</span>
                                        <span className="text-[10px] text-gray-600 font-medium">
                                          {emojiReactions.length}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Replies Display */}
                              {msg.replies && msg.replies.length > 0 && (
                                <div className={`flex flex-col gap-2 ${isSentBySelectedUser ? 'items-end ml-auto max-w-[85%]' : 'items-start mr-auto max-w-[85%]'}`}>
                                  {msg.replies.map((reply) => (
                                    <div
                                      key={reply.id}
                                      className={`flex flex-col p-2.5 rounded-lg bg-white/80 border border-gray-200 shadow-sm ${isSentBySelectedUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-[#008060] uppercase tracking-wider">
                                          {reply.sender?.username || 'Unknown'}
                                        </span>
                                        <span className="text-[9px] text-gray-400 font-medium">
                                          {formatTimeIST(reply.created_at)}
                                        </span>
                                      </div>
                                      <p className="text-[13px] text-gray-700 leading-relaxed">
                                        {reply.content}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {idx < thread.messages.length - 1 && (
                                <Separator className="my-2" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};