import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Users, MapPin, Calendar, ArrowLeft, Loader2, CheckCircle2, Send, MessageSquare, Edit2, Trash2, X, Check, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TravelChapterPage() {
  const [, params] = useRoute('/travel-chapters/:id');
  const chapterId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [messageText, setMessageText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [activeLeftTab, setActiveLeftTab] = useState<'about' | 'members'>('about');
  const [activeMobileView, setActiveMobileView] = useState<'chat' | 'info'>('chat');
  const [messageToDelete, setMessageToDelete] = useState<{ id: string, forEveryone: boolean } | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('hiddenChapterMessages');
    return stored ? JSON.parse(stored) : [];
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hideMessageForMe = (msgId: string) => {
    const updated = [...hiddenMessageIds, msgId];
    setHiddenMessageIds(updated);
    localStorage.setItem('hiddenChapterMessages', JSON.stringify(updated));
    toast({ title: "Message hidden", description: "This message has been deleted for you." });
  };

  const { data: chapter, isLoading, error } = useQuery({
    queryKey: ['travel-chapter', chapterId],
    queryFn: async () => {
      if (!chapterId) throw new Error("No chapter ID");
      const res = await apiRequest('GET', `/api/travel-chapters/${chapterId}`);
      if (!res.ok) throw new Error("Failed to fetch chapter");
      return res.json();
    },
    enabled: !!chapterId
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['travel-chapter-messages', chapterId],
    queryFn: async () => {
      if (!chapterId) return [];
      const res = await apiRequest('GET', `/api/travel-chapters/${chapterId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!chapterId && !!chapter?.isMember,
    refetchInterval: 5000, // Poll every 5 seconds for real-time feel
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/travel-chapters/${chapterId}/join`);
      if (!res.ok) throw new Error("Failed to join");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-chapter', chapterId] });
      toast({ title: "Success", description: "You have joined the chapter!" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/travel-chapters/${chapterId}/leave`);
      if (!res.ok) throw new Error("Failed to leave");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-chapter', chapterId] });
      toast({ title: "Success", description: "You have left the chapter." });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest('POST', `/api/travel-chapters/${chapterId}/messages`, { content });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ['travel-chapter-messages', chapterId] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ msgId, content }: { msgId: string, content: string }) => {
      const res = await apiRequest('PATCH', `/api/travel-chapters/${chapterId}/messages/${msgId}`, { content });
      if (!res.ok) throw new Error("Failed to edit message");
      return res.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditText("");
      queryClient.invalidateQueries({ queryKey: ['travel-chapter-messages', chapterId] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const res = await apiRequest('DELETE', `/api/travel-chapters/${chapterId}/messages/${msgId}`);
      if (!res.ok) throw new Error("Failed to delete message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-chapter-messages', chapterId] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    sendMessageMutation.mutate(messageText);
  };

  if (isLoading) {
    return (
      <AppLayout currentPage="travel-chapters">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </AppLayout>
    );
  }

  if (error || !chapter) {
    return (
      <AppLayout currentPage="travel-chapters">
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-gray-800">Chapter Not Found</h2>
          <button onClick={() => setLocation('/travel-chapters')} className="text-[#008060] mt-4 hover:underline">
            Go back to map
          </button>
        </div>
      </AppLayout>
    );
  }

  const isMember = chapter.isMember;

  return (
    <AppLayout currentPage="travel-chapters">
      <div className="max-w-[1600px] mx-auto pb-6 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className={`pt-6 px-4 md:px-8 shrink-0 ${activeMobileView === 'chat' ? 'hidden lg:block' : 'block'}`}>
          <button
            onClick={() => setLocation('/travel-chapters')}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Global Network
          </button>

          {/* Compact Header Banner */}
          <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-[#008060] via-emerald-700 to-emerald-900 shadow-xl mb-6 h-[180px] md:h-[200px] flex items-end group">
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}></div>
            <img
              src={chapter.cover_image || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop"}
              alt={chapter.name}
              className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            <div className="relative p-6 w-full flex flex-col md:flex-row items-start md:items-end justify-between gap-4 z-10">
              <div className="text-white">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 drop-shadow-sm">
                  {chapter.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-white/90 font-medium text-sm">
                  <span className="flex items-center bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm"><MapPin className="w-4 h-4 mr-1.5" /> {chapter.city}, {chapter.country}</span>
                  <span 
                    onClick={() => {
                      setActiveLeftTab('members');
                      setActiveMobileView('info');
                    }}
                    className="flex items-center bg-black/30 hover:bg-black/50 cursor-pointer px-3 py-1.5 rounded-lg backdrop-blur-sm transition-colors"
                  >
                    <Users className="w-4 h-4 mr-1.5" /> {chapter.members?.length || 0} Members
                  </span>
                </div>
              </div>

              <div>
                {isMember ? (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center bg-[#10b981]/90 backdrop-blur-md px-4 py-2 rounded-xl text-white text-sm font-semibold border border-emerald-400/30 shadow-lg">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Member
                    </div>
                    <button
                      onClick={() => leaveMutation.mutate()}
                      className="text-xs text-gray-300 hover:text-white underline decoration-gray-500 hover:decoration-white transition-all font-medium"
                    >
                      Leave Chapter
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="bg-white text-[#008060] hover:bg-emerald-50 hover:scale-105 active:scale-95 shadow-xl transition-all duration-300 font-bold py-2.5 px-8 rounded-xl flex items-center"
                  >
                    {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Chapter'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Split View Content */}
        <div className={`flex-1 min-h-0 ${activeMobileView === 'chat' ? 'px-0 pb-0 pt-0 lg:px-8 lg:pb-4' : 'px-4 md:px-8 pb-4'}`}>
          <div className="flex flex-col lg:flex-row h-full gap-6">
            
            {/* Left Side: Chapter Details & Members (Tabbed Panel) */}
            <div className={`w-full lg:w-[45%] xl:w-[40%] flex-col h-full gap-4 shrink-0 ${activeMobileView === 'info' ? 'flex' : 'hidden lg:flex'}`}>
              
              {/* Mobile back to chat button */}
              <div className="flex items-center justify-between lg:hidden shrink-0">
                <button
                  onClick={() => setActiveMobileView('chat')}
                  className="flex items-center text-xs font-bold text-[#008060] bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Chapter Chat
                </button>
              </div>
              
              {/* Segmented Control / Tabs */}
              <div className="flex bg-gray-100/80 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setActiveLeftTab('about')}
                  className={`flex-1 py-2.5 text-xs md:text-sm font-bold rounded-lg transition-all ${
                    activeLeftTab === 'about'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  About Hub
                </button>
                <button
                  onClick={() => setActiveLeftTab('members')}
                  className={`flex-1 py-2.5 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeLeftTab === 'members'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-4 h-4 text-[#008060]" />
                  Members ({chapter.members?.length || 0})
                </button>
              </div>

              {/* Tab Content */}
              {activeLeftTab === 'about' ? (
                /* About */
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group flex-1 min-h-[300px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#008060]/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">About</h2>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line break-words">
                    {chapter.description || `Welcome to the official travel chapter for ${chapter.city}. Connect with fellow alumni, organize meetups, and expand your professional network globally.`}
                  </p>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5 text-gray-400" /> Est. {new Date(chapter.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-gray-400" /> {chapter.city} Hub</span>
                  </div>
                </div>
              ) : (
                /* Members List */
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col flex-1 min-h-[300px] overflow-y-auto custom-scrollbar">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-[#008060]" />
                    Members ({chapter.members?.length || 0})
                  </h3>

                  {chapter.members?.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {chapter.members.map((member: any) => (
                        <div key={member.userId} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-emerald-200 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 overflow-hidden flex-shrink-0 mr-3">
                            {member.profilePicture ? (
                              <img src={member.profilePicture} alt={member.firstName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                                {member.firstName?.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900 truncate">{member.firstName} {member.lastName}</p>
                            <p className="text-xs text-gray-500 truncate">{member.currentRole || 'Alumni'} {member.currentCompany && `at ${member.currentCompany}`}</p>
                          </div>
                          {member.role === 'admin' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#008060] bg-emerald-100 px-2 py-1 rounded-md ml-2">Host</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500">No members yet. Be the first to join!</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Side: Group Chat UI */}
            <div className={`w-full lg:w-[55%] xl:w-[60%] flex-col h-full bg-white lg:rounded-xl lg:border border-gray-200 lg:shadow-sm overflow-hidden ${activeMobileView === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile Back Button to map */}
                  <button
                    onClick={() => setLocation('/travel-chapters')}
                    className="lg:hidden mr-2 p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    title="Back to Global Network"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#008060] flex-shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate">{chapter.name}</h3>
                    <p className="text-xs text-gray-500 truncate">Real-time chat</p>
                  </div>
                </div>

                {/* Mobile Info toggle button */}
                <button
                  onClick={() => setActiveMobileView('info')}
                  className="lg:hidden p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="View Chapter Info"
                >
                  <Info className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar flex flex-col gap-4 relative">
                {!isMember ? (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-[#008060]">
                      <Users className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Join to Chat</h3>
                    <p className="text-gray-600 mb-6 max-w-md">You must be a member of the {chapter.city} travel chapter to view and participate in the discussion.</p>
                    <button
                      onClick={() => joinMutation.mutate()}
                      disabled={joinMutation.isPending}
                      className="bg-[#008060] text-white hover:bg-[#006b51] shadow-lg transition-all font-bold py-3 px-8 rounded-xl"
                    >
                      {joinMutation.isPending ? "Joining..." : "Join Chapter"}
                    </button>
                  </div>
                ) : isLoadingMessages ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
                    <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">No messages yet.<br/>Start the conversation!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 p-4">
                    {messages.filter((msg: any) => !hiddenMessageIds.includes(msg.id)).map((msg: any, idx: number, visibleArray: any[]) => {
                      const isMe = msg.user_id === user?.id;
                      const isAdmin = !!((user as any)?.role === "administrator" || user?.is_admin);
                      const canEdit = isMe;
                      const canDeleteForEveryone = isMe || isAdmin;
                      const canDeleteForMe = !isMe;
                      const isEditing = editingId === msg.id;

                      const showAvatar = !isMe && (idx === 0 || visibleArray[idx - 1].user_id !== msg.user_id);
                      
                      // Supabase returns UTC without 'Z', append it to parse correctly
                      const utcDateString = msg.created_at.endsWith('Z') ? msg.created_at : `${msg.created_at}Z`;
                      const formattedTime = new Date(utcDateString).toLocaleTimeString('en-IN', { 
                        timeZone: 'Asia/Kolkata', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true
                      });
                      
                      return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex max-w-[75%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar for others */}
                            {!isMe ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-100 shrink-0 overflow-hidden mt-auto border border-emerald-200">
                                {showAvatar && (
                                  msg.user?.profilePicture ? (
                                    <img src={msg.user.profilePicture} alt="User" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-xs uppercase">
                                      {msg.user?.firstName?.charAt(0) || '?'}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="w-8 shrink-0"></div> // Spacer for alignment
                            )}

                            {/* Message Bubble */}
                            <div className="flex flex-col relative group/msg">
                              {!isMe && showAvatar && (
                                <span className="text-xs text-gray-500 font-medium ml-1 mb-1">{msg.user?.firstName} {msg.user?.lastName}</span>
                              )}

                              {isEditing ? (
                                <div className={`flex flex-col gap-2 p-3 shadow-sm w-full min-w-[250px] ${
                                  isMe 
                                    ? 'bg-emerald-50 border border-emerald-200 rounded-xl rounded-br-sm' 
                                    : 'bg-white border border-gray-200 rounded-xl rounded-bl-sm'
                                }`}>
                                  <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-[#008060] resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex justify-end gap-2 mt-1">
                                    <button 
                                      onClick={() => setEditingId(null)}
                                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => editMutation.mutate({ msgId: msg.id, content: editText })}
                                      disabled={!editText.trim() || editMutation.isPending}
                                      className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded disabled:opacity-50"
                                    >
                                      {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative flex items-center group/bubble">
                                  {isMe && (
                                    <div className="absolute right-full top-0 mr-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-gray-100 shadow-sm rounded-lg p-1 z-10">
                                      {canEdit && (
                                        <button 
                                          onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}
                                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                          title="Edit message"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {(canDeleteForEveryone || canDeleteForMe) && (
                                        <button 
                                          onClick={() => setMessageToDelete({ id: msg.id, forEveryone: canDeleteForEveryone })}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title={canDeleteForEveryone ? "Delete for everyone" : "Delete for me"}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  <div 
                                    className={`px-4 py-2 text-[15px] leading-relaxed shadow-sm break-words ${
                                      isMe 
                                        ? 'bg-[#008060] text-white rounded-xl rounded-br-sm' 
                                        : 'bg-white border border-gray-100 text-gray-800 rounded-xl rounded-bl-sm'
                                    }`}
                                  >
                                    {msg.content}
                                    {msg.updated_at && msg.updated_at !== msg.created_at && (
                                      <span className={`text-[10px] ml-2 italic opacity-80 ${isMe ? 'text-emerald-100' : 'text-gray-400'}`}>
                                        (edited)
                                      </span>
                                    )}
                                  </div>

                                  {!isMe && (
                                    <div className="absolute left-full top-0 ml-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-gray-100 shadow-sm rounded-lg p-1 z-10">
                                      {canEdit && (
                                        <button 
                                          onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}
                                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                          title="Edit message"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {(canDeleteForEveryone || canDeleteForMe) && (
                                        <button 
                                          onClick={() => setMessageToDelete({ id: msg.id, forEveryone: canDeleteForEveryone })}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title={canDeleteForEveryone ? "Delete for everyone" : "Delete for me"}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <span className={`text-[10px] text-gray-400 mt-1 flex ${isMe ? 'justify-end mr-1' : 'ml-1'}`}>
                                {formattedTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              {isMember && (
                <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message to the chapter..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/20 focus:border-[#008060] transition-all"
                      disabled={sendMessageMutation.isPending}
                    />
                    <button
                      type="submit"
                      disabled={!messageText.trim() || sendMessageMutation.isPending}
                      className="w-12 h-12 bg-[#008060] hover:bg-[#006b51] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all shrink-0"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </form>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              {messageToDelete?.forEveryone 
                ? "Are you sure you want to delete this message for everyone? This action cannot be undone." 
                : "Delete this message for yourself? It will remain visible to other chapter members."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
              onClick={() => {
                if (messageToDelete) {
                  if (messageToDelete.forEveryone) {
                    deleteMutation.mutate(messageToDelete.id);
                  } else {
                    hideMessageForMe(messageToDelete.id);
                  }
                  setMessageToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
