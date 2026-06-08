import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Check, X, MapPin, Loader2, Users, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminTravelChaptersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { adminUser, logoutAdmin } = useAuth();

  const { data: chapters, isLoading } = useQuery({
    queryKey: ['admin-travel-chapters'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/travel-chapters/admin');
      if (!res.ok) throw new Error("Failed to fetch chapters");
      return res.json();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await apiRequest('PUT', `/api/travel-chapters/${id}/status`, { status });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-travel-chapters'] });
      toast({ title: "Success", description: data.message });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const pendingChapters = chapters?.filter((c: any) => c.status === 'pending') || [];
  const approvedChapters = chapters?.filter((c: any) => c.status === 'approved') || [];

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <AdminSidebar currentPage="travel-chapters" />

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
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">Manage Travel Chapters</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                onClick={logoutAdmin}
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

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-12">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Travel Chapters</h1>
                <p className="text-sm text-gray-500 mt-1">Review and manage community proposed travel chapters.</p>
              </div>

              {/* Pending Chapters */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                  Pending Approvals ({pendingChapters.length})
                </h2>
                
                {pendingChapters.length === 0 ? (
                  <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500 shadow-sm">
                    No pending requests at the moment.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingChapters.map((chapter: any) => (
                      <div key={chapter.id} className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">{chapter.name}</h3>
                            <p className="text-sm text-gray-500 flex items-center mt-1">
                              <MapPin className="w-3.5 h-3.5 mr-1" /> {chapter.city}, {chapter.country}
                            </p>
                          </div>
                          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded">Pending</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                          "{chapter.description}"
                        </p>
                        <p className="text-xs text-gray-400 mb-4 font-medium">Proposed by: {chapter.creator?.username || 'Unknown'}</p>
                        
                        <div className="flex gap-3">
                          <Button 
                            onClick={() => updateStatusMutation.mutate({ id: chapter.id, status: 'approved' })}
                            className="flex-1 bg-[#008060] hover:bg-[#006b51] text-white shadow-sm"
                            size="sm"
                          >
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            onClick={() => updateStatusMutation.mutate({ id: chapter.id, status: 'rejected' })}
                            variant="outline"
                            className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                            size="sm"
                          >
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Approved Chapters */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                  Active Chapters ({approvedChapters.length})
                </h2>
                
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/80 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-gray-600">Chapter</th>
                        <th className="px-6 py-4 font-semibold text-gray-600">Location</th>
                        <th className="px-6 py-4 font-semibold text-gray-600">Members</th>
                        <th className="px-6 py-4 font-semibold text-gray-600">Created</th>
                        <th className="px-6 py-4 font-semibold text-gray-600 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {approvedChapters.map((chapter: any) => (
                        <tr key={chapter.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{chapter.name}</td>
                          <td className="px-6 py-4 text-gray-500">{chapter.city}, {chapter.country}</td>
                          <td className="px-6 py-4">
                            <span className="flex items-center text-[#008060] font-medium">
                              <Users className="w-4 h-4 mr-1.5" /> {chapter.members?.[0]?.count || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{new Date(chapter.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              onClick={() => updateStatusMutation.mutate({ id: chapter.id, status: 'rejected' })}
                              variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              Revoke
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {approvedChapters.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No active chapters yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
