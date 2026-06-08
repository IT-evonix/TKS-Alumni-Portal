import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Users, MapPin, Calendar, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function TravelChapterPage() {
  const [, params] = useRoute('/travel-chapters/:id');
  const chapterId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-green-1" />
        </div>
      </AppLayout>
    );
  }

  if (error || !chapter) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-gray-800">Chapter Not Found</h2>
          <button onClick={() => setLocation('/alumni-map')} className="text-primary-green-1 mt-4 hover:underline">
            Go back to map
          </button>
        </div>
      </AppLayout>
    );
  }

  const isMember = chapter.isMember;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">

        <button
          onClick={() => setLocation('/travel-chapters')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Global Network
        </button>

        {/* Header Banner */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#008060] via-emerald-700 to-emerald-900 shadow-xl mb-12 h-[260px] md:h-[300px] flex items-end group">
          {/* Subtle Map/Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}></div>

          <img
            src={chapter.cover_image || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop"}
            alt={chapter.name}
            className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          <div className="relative p-6 md:p-10 w-full flex flex-col md:flex-row items-start md:items-end justify-between gap-6 z-10">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border border-white/20 shadow-sm">
                  Global Chapter
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 drop-shadow-sm">
                {chapter.name}
              </h1>
              <div className="flex flex-wrap items-center gap-5 text-white/90 font-medium text-sm md:text-base">
                <span className="flex items-center bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm"><MapPin className="w-4 h-4 mr-1.5" /> {chapter.city}, {chapter.country}</span>
                <span className="flex items-center bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm"><Users className="w-4 h-4 mr-1.5" /> {chapter.members?.length || 0} Members</span>
              </div>
            </div>

            <div>
              {isMember ? (
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center bg-[#008060]/90 backdrop-blur-md px-5 py-3 rounded-xl text-white font-semibold border border-emerald-400/30 shadow-lg">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> You are a member
                  </div>
                  <button
                    onClick={() => leaveMutation.mutate()}
                    className="text-sm text-gray-300 hover:text-white underline decoration-gray-500 hover:decoration-white transition-all font-medium"
                  >
                    Leave Chapter
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending}
                  className="bg-white text-gray-900 hover:bg-gray-100 hover:scale-105 active:scale-95 shadow-xl transition-all duration-300 font-bold py-3.5 px-10 rounded-xl flex items-center"
                >
                  {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Chapter'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#008060]/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-5">About the {chapter.name}</h2>
              <div className="max-h-[350px] overflow-y-auto pr-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                <p className="text-gray-600 leading-relaxed whitespace-pre-line break-words" style={{ wordBreak: 'break-word' }}>
                  {chapter.description || `Welcome to the official travel chapter for ${chapter.city}. Connect with fellow alumni, organize meetups, and expand your professional network globally.`}
                </p>
              </div>
            </div>

            {/* Members Grid */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary-green-1" />
                Chapter Members ({chapter.members?.length || 0})
              </h3>

              {chapter.members?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {chapter.members.map((member: any) => (
                    <div key={member.userId} className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 mr-4">
                        {member.profilePicture ? (
                          <img src={member.profilePicture} alt={member.firstName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary-green-1/10 text-primary-green-1 font-bold text-lg">
                            {member.firstName?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{member.currentRole || 'Alumni'} {member.currentCompany && `at ${member.currentCompany}`}</p>
                      </div>
                      {member.role === 'admin' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-green-1 bg-primary-green-1/10 px-2 py-1 rounded-md ml-2">Admin</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-500">No members yet. Be the first to join!</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Quick Stats/Info */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Chapter Details</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{chapter.city}</p>
                    <p className="text-xs text-gray-500">{chapter.country}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Established</p>
                    <p className="text-xs text-gray-500">{new Date(chapter.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coming Soon Feature */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
              <h3 className="font-bold text-indigo-900 mb-2">Local Events</h3>
              <p className="text-sm text-indigo-700/80 leading-relaxed mb-4">
                Soon you will be able to host and discover local meetups directly from this chapter page.
              </p>
              <div className="inline-block bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                Coming Soon
              </div>
            </div>

          </div>

        </div>
      </div>
    </AppLayout>
  );
}
