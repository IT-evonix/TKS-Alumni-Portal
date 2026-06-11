import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Users, MapPin, Calendar, ArrowLeft, Loader2, CheckCircle2, Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

export default function TravelChapterPage() {
  const [, params] = useRoute('/travel-chapters/:id');
  const chapterId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [messageText, setMessageText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </AppLayout>
    );
  }

  if (error || !chapter) {
    return (
      <AppLayout>
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
    <AppLayout>
      <div className="max-w-[1600px] mx-auto pb-8 h-[calc(100vh-64px)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="pt-6 px-4 md:px-8 shrink-0">
          <button
            onClick={() => setLocation('/travel-chapters')}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Global Network
          </button>

          {/* Compact Header Banner */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#008060] via-emerald-700 to-emerald-900 shadow-xl mb-6 h-[180px] md:h-[200px] flex items-end group">
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
                  <span className="flex items-center bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm"><Users className="w-4 h-4 mr-1.5" /> {chapter.members?.length || 0} Members</span>
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
        <div className="flex-1 px-4 md:px-8 pb-4 min-h-0">
          <div className="flex flex-col lg:flex-row h-full gap-6">
            
            {/* Left Side: Chapter Details & Members (Scrollable) */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar space-y-6">
              
              {/* About */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#008060]/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">About</h2>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line break-words">
                  {chapter.description || `Welcome to the official travel chapter for ${chapter.city}. Connect with fellow alumni, organize meetups, and expand your professional network globally.`}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5 text-gray-400" /> Est. {new Date(chapter.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-gray-400" /> {chapter.city} Hub</span>
                </div>
              </div>

              {/* Members */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shrink-0">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-[#008060]" />
                  Members ({chapter.members?.length || 0})
                </h3>

                {chapter.members?.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {chapter.members.map((member: any) => (
                      <div key={member.userId} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-emerald-200 transition-colors">
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
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">No members yet. Be the first to join!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Group Chat UI */}
            <div className="w-full lg:w-[55%] xl:w-[60%] flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#008060]">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Chapter Discussion</h3>
                    <p className="text-xs text-gray-500">Real-time chat with {chapter.city} members</p>
                  </div>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30 custom-scrollbar flex flex-col gap-4 relative">
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
                  <>
                    {messages.map((msg: any, idx: number) => {
                      const isMe = msg.user_id === user?.id;
                      const showAvatar = !isMe && (idx === 0 || messages[idx - 1].user_id !== msg.user_id);
                      
                      return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex max-w-[80%] gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar for others */}
                            {!isMe ? (
                              <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 overflow-hidden mt-auto">
                                {showAvatar && (
                                  msg.user?.profilePicture ? (
                                    <img src={msg.user.profilePicture} alt="User" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-[#008060] font-bold text-xs">
                                      {msg.user?.firstName?.charAt(0)}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="w-8 shrink-0"></div> // Spacer for alignment
                            )}

                            {/* Message Bubble */}
                            <div className="flex flex-col">
                              {!isMe && showAvatar && (
                                <span className="text-[10px] text-gray-400 font-bold ml-1 mb-1">{msg.user?.firstName} {msg.user?.lastName}</span>
                              )}
                              <div 
                                className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap shadow-sm ${
                                  isMe 
                                    ? 'bg-gradient-to-br from-[#10b981] to-[#008060] text-white rounded-br-sm' 
                                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                                }`}
                              >
                                {msg.content}
                              </div>
                              <span className={`text-[9px] text-gray-400 mt-1 flex ${isMe ? 'justify-end mr-1' : 'ml-1'}`}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </>
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
    </AppLayout>
  );
}
