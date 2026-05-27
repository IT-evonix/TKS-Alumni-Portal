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
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

interface UserRanking {
  user_id: string;
  total_points: number;
  thread_score: number;
  event_score: number;
  connection_score: number;
  current_streak_days: number;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
  badgesCount: number;
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

export function AdminUserRankings() {
  const [users, setUsers] = useState<UserRanking[]>([]);
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

  const totalPages = Math.ceil(users.length / itemsPerPage);
  const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
          <div className="rounded-md border mt-4">
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
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user, idx) => {
                    const actualRank = (currentPage - 1) * itemsPerPage + idx + 1;
                    const rankStyles = actualRank === 1 ? 'bg-gradient-to-br from-amber-100 to-amber-300 text-amber-900 border-amber-400 shadow-amber-300/50 shadow-md' :
                                       actualRank === 2 ? 'bg-gradient-to-br from-slate-100 to-slate-300 text-slate-800 border-slate-400 shadow-slate-300/50 shadow-md' :
                                       actualRank === 3 ? 'bg-gradient-to-br from-orange-100 to-orange-300 text-orange-900 border-orange-400 shadow-orange-300/50 shadow-md' :
                                       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-transparent';

                    return (
                      <TableRow key={user.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all duration-200 group border-b border-slate-100 dark:border-slate-800/50">
                        <TableCell className="text-center font-bold">
                          <div className={`mx-auto w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${rankStyles}`}>
                            #{actualRank}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium p-4">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <Avatar className={`h-12 w-12 border-2 shadow-sm ${actualRank === 1 ? 'border-amber-400' : actualRank === 2 ? 'border-slate-400' : actualRank === 3 ? 'border-orange-400' : 'border-slate-200 dark:border-slate-700'}`}>
                                <AvatarImage src={user.profilePicture || ''} />
                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-lg">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              {actualRank === 1 && (
                                <div className="absolute -top-3.5 -right-2 text-2xl drop-shadow-md z-10" title="Top Ranker">👑</div>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">{user.firstName} {user.lastName}</div>
                              <div className="text-xs font-medium text-muted-foreground mt-0.5">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            <span className="text-primary font-black text-lg bg-primary/10 px-3 py-1 rounded-lg border border-primary/20 shadow-sm">{user.total_points}</span>
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">pts</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`px-3 py-1.5 shadow-sm border text-xs font-bold tracking-wider
                            ${user.badgesCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'}
                          `}>
                            <Trophy className={`w-4 h-4 mr-1.5 ${user.badgesCount > 0 ? 'text-amber-500 fill-amber-100 dark:fill-amber-900/50' : 'text-slate-400'}`} /> 
                            {user.badgesCount} {user.badgesCount === 1 ? 'Badge' : 'Badges'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center text-sm font-medium">
                            {user.current_streak_days > 0 ? (
                              <div className="flex items-center bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800 px-3 py-1 rounded-full shadow-sm">
                                <Flame className="w-4 h-4 text-orange-500 mr-1.5 fill-orange-500" /> 
                                <span className="font-bold">{user.current_streak_days} days</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 font-black">-</span>
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
                        <span className={`w-3 h-3 shrink-0 rounded-full ${badge.tier === 'platinum' ? 'bg-cyan-400' : badge.tier === 'gold' ? 'bg-amber-400' : badge.tier === 'silver' ? 'bg-slate-400' : badge.tier === 'bronze' ? 'bg-orange-500' : 'bg-primary'}`}></span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{badge.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{badge.category} • {badge.tier}</span>
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
                          <span className={`w-2 h-2 shrink-0 rounded-full ${badge.tier === 'platinum' ? 'bg-cyan-400' : badge.tier === 'gold' ? 'bg-amber-400' : badge.tier === 'silver' ? 'bg-slate-400' : badge.tier === 'bronze' ? 'bg-orange-500' : 'bg-primary'}`}></span>
                          <span className="font-medium">{badge.name}</span>
                          <span className="text-muted-foreground text-[10px] uppercase ml-1">({badge.tier})</span>
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
