import React, { useEffect, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Trophy, UserPlus, Flame, Trash2, Loader2, Settings2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

interface UserRanking {
  user_id: string;
  total_points: number;
  thread_score: number;
  event_score: number;
  connection_score: number;
  job_score: number;
  current_streak_days: number;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
  badgesCount: number;
  badgeScore?: number;
  created_at?: string;
  uniqueBadges?: any[];
}

interface BadgeRecord {
  id: string;
  name: string;
  category: string;
  series_type: string;
  tier: string;
  description?: string;
  required_score?: number;
}

interface AdminUserRankingsProps {
  searchQuery?: string;
}

export function AdminUserRankings({ searchQuery = "" }: AdminUserRankingsProps) {
  const [users, setUsers] = useState<UserRanking[]>([]);
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("points");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Assignment Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRanking | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Owned Badges State
  const [userOwnedBadges, setUserOwnedBadges] = useState<BadgeRecord[]>([]);
  const [loadingOwnedBadges, setLoadingOwnedBadges] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch('/api/gamification/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load user rankings.", variant: "destructive" });
    }
  };

  const fetchBadges = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch('/api/gamification/admin/badges', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const initData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchBadges()]);
    setLoading(false);
  };

  useEffect(() => {
    initData();
  }, []);

  const handleManageClick = async (user: UserRanking) => {
    setSelectedUser(user);
    setSelectedBadgeId("");
    setIsDialogOpen(true);
    setLoadingOwnedBadges(true);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/gamification/admin/users/${user.user_id}/badges`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserOwnedBadges(data.badges || []);
      }
    } catch (err) {
      console.error("Failed to load user badges", err);
    } finally {
      setLoadingOwnedBadges(false);
    }
  };

  const revokeUserBadge = async (badgeId: string) => {
    if (!selectedUser) return;

    try {
      setRevokingId(badgeId);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/gamification/admin/users/${selectedUser.user_id}/badges/${badgeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke badge");

      toast({ title: "Success", description: "Badge revoked successfully!" });

      // Update state locally
      const badgeToRevoke = userOwnedBadges.find(b => b.id === badgeId);
      const pointsToDeduct = badgeToRevoke?.required_score || 0;

      setUserOwnedBadges(prev => prev.filter(b => b.id !== badgeId));
      setUsers(users.map(u => u.user_id === selectedUser.user_id ? {
        ...u,
        badgesCount: Math.max(0, u.badgesCount - 1),
        total_points: Math.max(0, u.total_points - pointsToDeduct)
      } : u));
    } catch (err: any) {
      toast({ title: "Revocation Failed", description: err.message, variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  const submitBadgeAssignment = async () => {
    if (!selectedUser || !selectedBadgeId) return;

    try {
      setAssigning(true);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/gamification/admin/users/${selectedUser.user_id}/badges`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ badgeId: selectedBadgeId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign badge");

      toast({ title: "Success", description: "Badge assigned successfully!" });

      // Update count locally
      const pointsToAdd = data.badge?.required_score || 0;
      setUsers(users.map(u => u.user_id === selectedUser.user_id ? {
        ...u,
        badgesCount: u.badgesCount + 1,
        total_points: u.total_points + pointsToAdd
      } : u));

      // Add to owned list
      const newlyAssigned = badges.find(b => b.id === selectedBadgeId);
      if (newlyAssigned) {
        setUserOwnedBadges(prev => [...prev, newlyAssigned]);
      }
      setSelectedBadgeId("");
    } catch (err: any) {
      toast({ title: "Assignment Failed", description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  // Global loader replaced by inline table loader

  const filteredUsers = users.filter(u => 
    u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (activeTab === "badges") {
      if (b.badgeScore !== a.badgeScore) return (b.badgeScore || 0) - (a.badgeScore || 0);
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.badgesCount !== a.badgesCount) return b.badgesCount - a.badgesCount;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    }
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.badgeScore !== a.badgeScore) return (b.badgeScore || 0) - (a.badgeScore || 0);
    if (b.badgesCount !== a.badgesCount) return b.badgesCount - a.badgesCount;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const paginatedUsers = sortedUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Alumni Rankings</CardTitle>
            <CardDescription>View leaderboard and manually award badges to specific users.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="points" value={activeTab} onValueChange={(val) => { setActiveTab(val); setCurrentPage(1); }}>
            <TabsList className="mb-4 bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-xl">
              <TabsTrigger value="points" className="rounded-lg text-sm font-semibold px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-sm">Top Points</TabsTrigger>
              <TabsTrigger value="badges" className="rounded-lg text-sm font-semibold px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">Top Badges</TabsTrigger>
            </TabsList>
            
            <div className="rounded-xl border overflow-hidden bg-white dark:bg-slate-950/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Total Points</TableHead>
                  <TableHead className="text-center">Badges Earned</TableHead>
                  <TableHead className="text-center">Current Streak</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-96">
                      <Loader text="Loading Alumni Rankings..." className="h-full" />
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user, idx) => {
                    const actualRank = (currentPage - 1) * itemsPerPage + idx + 1;
                    const rankStyles = actualRank === 1 ? 'bg-gradient-to-b from-amber-200 to-amber-400 text-amber-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-400' :
                                       actualRank === 2 ? 'bg-gradient-to-b from-slate-200 to-slate-300 text-slate-800 shadow-md shadow-slate-500/20 ring-1 ring-slate-400' :
                                       actualRank === 3 ? 'bg-gradient-to-b from-orange-200 to-orange-400 text-orange-950 shadow-md shadow-orange-500/20 ring-1 ring-orange-400' :
                                       'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700';

                    return (
                      <TableRow key={user.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all duration-300 group border-b border-slate-100 dark:border-slate-800/50">
                        <TableCell className="text-center">
                          <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${rankStyles}`}>
                            #{actualRank}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className={`h-10 w-10 shadow-sm ${actualRank === 1 ? 'ring-2 ring-amber-400 ring-offset-2' : actualRank === 2 ? 'ring-2 ring-slate-400 ring-offset-2' : actualRank === 3 ? 'ring-2 ring-orange-400 ring-offset-2' : 'border border-slate-200 dark:border-slate-700'}`}>
                                <AvatarImage src={user.profilePicture || ''} />
                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-sm">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              {actualRank === 1 && (
                                <div className="absolute -top-3 -right-2 text-xl drop-shadow-md z-10" title="Top Ranker">👑</div>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">{user.firstName} {user.lastName}</div>
                              <div className="text-[11px] font-medium text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            <span className="text-primary font-bold text-sm bg-primary/5 px-2.5 py-0.5 rounded border border-primary/10">{user.total_points}</span>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">pts</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {user.badgesCount > 0 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className="inline-flex items-center cursor-pointer px-2 py-0.5 border text-xs font-semibold tracking-wide rounded-md hover:bg-amber-100 transition-colors bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                                  <Trophy className="w-3.5 h-3.5 mr-1 text-amber-500" /> 
                                  {user.badgesCount}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-0 shadow-2xl border-slate-200/60 dark:border-slate-800 overflow-hidden rounded-xl">
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 px-4 py-2.5 border-b border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                                  <Trophy className="w-3.5 h-3.5 text-amber-600" />
                                  <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                                    {user.uniqueBadges?.length || 0} Earned Badge{(user.uniqueBadges?.length || 0) !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[260px] overflow-y-auto">
                                  {user.uniqueBadges && user.uniqueBadges.length > 0 ? user.uniqueBadges.map((b: any, i: number) => {
                                    const tierGradient = b.tier === 'platinum' ? 'from-purple-400 to-purple-700' :
                                      b.tier === 'gold' ? 'from-yellow-400 to-amber-600' :
                                      b.tier === 'silver' ? 'from-slate-300 to-slate-500' :
                                      b.tier === 'bronze' ? 'from-orange-500 to-orange-800' : 'from-cyan-400 to-teal-500';
                                    const tierBg = b.tier === 'platinum' ? 'bg-purple-50 dark:bg-purple-950/20' :
                                      b.tier === 'gold' ? 'bg-amber-50 dark:bg-amber-950/20' :
                                      b.tier === 'silver' ? 'bg-slate-50 dark:bg-slate-900' :
                                      b.tier === 'bronze' ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-cyan-50 dark:bg-cyan-950/20';
                                    const tierText = b.tier === 'platinum' ? 'text-purple-700 dark:text-purple-400' :
                                      b.tier === 'gold' ? 'text-amber-700 dark:text-amber-400' :
                                      b.tier === 'silver' ? 'text-slate-600 dark:text-slate-400' :
                                      b.tier === 'bronze' ? 'text-orange-700 dark:text-orange-400' : 'text-cyan-600 dark:text-cyan-400';
                                    return (
                                      <div key={i} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${i === 0 ? tierBg : ''}`}>
                                        {/* Shield Icon */}
                                        <div
                                          className="relative shrink-0 flex items-center justify-center drop-shadow-sm"
                                          style={{ width: '32px', height: '36px' }}
                                        >
                                          <div
                                            className={`absolute inset-0 bg-gradient-to-b ${tierGradient}`}
                                            style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
                                          />
                                          <div
                                            className="absolute inset-[3px] bg-gradient-to-br from-white/30 to-transparent flex items-center justify-center"
                                            style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
                                          >
                                            {b.icon_url && !b.icon_url.startsWith('http') ? (
                                              <span className="text-white text-sm leading-none relative z-10">{b.icon_url}</span>
                                            ) : b.icon_url ? (
                                              <img src={b.icon_url} alt="" className="w-4 h-4 object-contain relative z-10" />
                                            ) : (
                                              <Trophy className="w-3.5 h-3.5 text-white relative z-10 drop-shadow" />
                                            )}
                                          </div>
                                        </div>
                                        {/* Badge Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-[12px] text-slate-800 dark:text-slate-100 leading-tight truncate">{b.name}</div>
                                          <div className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${tierText}`}>{b.tier || 'Special'}</div>
                                          {b.description && (
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{b.description}</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }) : (
                                    <div className="px-4 py-3 text-xs text-muted-foreground">No badges found.</div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Badge variant="outline" className="px-2 py-0.5 border text-xs font-semibold tracking-wide rounded-md bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
                              <Trophy className="w-3.5 h-3.5 mr-1 text-slate-400" /> 
                              0
                            </Badge>
                          )}

                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center text-xs font-semibold">
                            {user.current_streak_days > 0 ? (
                              <div className="flex items-center bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800 px-2 py-0.5 rounded-md">
                                <Flame className="w-3.5 h-3.5 text-orange-500 mr-1 fill-orange-500" /> 
                                <span>{user.current_streak_days}d</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Button size="sm" variant="ghost" className="opacity-70 group-hover:opacity-100 transition-all duration-300 bg-primary/5 text-primary hover:text-primary hover:bg-primary/15 border border-primary/10 hover:border-primary/30 shadow-sm" onClick={() => handleManageClick(user)}>
                            <Settings2 className="w-4 h-4 mr-2" />
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </Tabs>

          {totalPages > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between px-2">
              <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, users.length)} of {users.length} users
              </div>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={currentPage === i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className="cursor-pointer"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage User Badges</DialogTitle>
            <DialogDescription>
              View, assign, and revoke badges for <strong className="text-primary">{selectedUser?.firstName} {selectedUser?.lastName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Currently Earned Badges</h4>
              <div className="border rounded-md min-h-[100px] max-h-[250px] overflow-y-auto p-2 bg-slate-50 space-y-2">
                {loadingOwnedBadges ? (
                  <div className="flex items-center justify-center h-[80px]">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : userOwnedBadges.length === 0 ? (
                  <div className="flex items-center justify-center h-[80px] text-sm text-muted-foreground">
                    No badges earned yet.
                  </div>
                ) : (
                  userOwnedBadges.map(badge => (
                    <div key={badge.id} className="flex items-center justify-between p-2 bg-white border rounded shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 shrink-0 rounded-full ${badge.tier === 'platinum' ? 'bg-cyan-400' : badge.tier === 'gold' ? 'bg-amber-400' : badge.tier === 'silver' ? 'bg-slate-400' : badge.tier === 'bronze' ? 'bg-orange-500' : 'bg-cyan-500'}`}></span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{badge.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {badge.category} • {badge.tier}
                            {badge.required_score !== undefined ? ` • ${badge.required_score} pts` : ''}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 shrink-0"
                        onClick={() => revokeUserBadge(badge.id)}
                        disabled={revokingId === badge.id}
                      >
                        {revokingId === badge.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2 mt-4 pt-4 border-t">
              <h4 className="text-sm font-semibold">Assign New Badge</h4>
              <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a badge...">
                    {selectedBadgeId ? badges.find(b => b.id === selectedBadgeId)?.name : "Select a badge..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {badges.map(badge => (
                    <SelectItem key={badge.id} value={badge.id} className="cursor-pointer">
                      <div className="flex flex-col gap-0.5 py-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 shrink-0 rounded-full ${badge.tier === 'platinum' ? 'bg-cyan-400' : badge.tier === 'gold' ? 'bg-amber-400' : badge.tier === 'silver' ? 'bg-slate-400' : badge.tier === 'bronze' ? 'bg-orange-500' : 'bg-cyan-500'}`}></span>
                          <span className="font-medium">{badge.name}</span>
                          <span className="text-muted-foreground text-[10px] uppercase ml-1">
                            ({badge.tier}{badge.required_score !== undefined ? ` - ${badge.required_score} pts` : ''})
                          </span>
                        </div>
                        {badge.description && <div className="text-xs text-muted-foreground pl-4 line-clamp-2 max-w-[300px]">{badge.description}</div>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitBadgeAssignment} disabled={!selectedBadgeId || assigning}>
              {assigning ? "Assigning..." : "Award Badge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
