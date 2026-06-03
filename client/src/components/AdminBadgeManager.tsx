import React, { useEffect, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Edit2, RefreshCw, Trophy, Award, Star, Medal, Shield, Sparkles, LogIn, UserCircle, MessageSquare, Calendar, Network, Briefcase, HelpCircle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader } from "@/components/ui/loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger, PopoverClose
} from "@/components/ui/popover";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface BadgeRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  series_type: string;
  required_score: number;
  tier: string;
  is_enabled: boolean;
  groupedIds?: string[];
  tiers?: Record<string, any>;
}

interface AdminBadgeManagerProps {
  searchQuery?: string;
}

export function AdminBadgeManager({ searchQuery = "" }: AdminBadgeManagerProps) {
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Partial<BadgeRecord> | null>(null);
  const [tierScores, setTierScores] = useState<Record<string, string>>({ bronze: '', silver: '', gold: '', platinum: '' });
  const [saving, setSaving] = useState(false);
  const [badgeToDelete, setBadgeToDelete] = useState<any | null>(null);

  const { toast } = useToast();

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      const statsRes = await fetch('/api/gamification/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (statsRes.ok) setAnalytics(await statsRes.json());

      const res = await fetch('/api/gamification/admin/badges', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load badges");
      const data = await res.json();
      setBadges(data.badges || []);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load badge management data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  const toggleBadge = async (badge: any, currentState: boolean) => {
    try {
      const token = localStorage.getItem("auth_token");
      const idsToToggle = badge.groupedIds || [badge.id];
      const promises = idsToToggle.map((id: string) =>
        fetch(`/api/gamification/admin/badges/${id}/toggle`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      const results = await Promise.all(promises);
      if (results.every(r => r.ok)) {
        // Optimistic UI update
        setBadges(prev => prev.map(b =>
          idsToToggle.includes(b.id) ? { ...b, is_enabled: !currentState } : b
        ));

        fetchBadges();
        toast({ title: "Updated", description: "Badge status updated successfully." });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to toggle badge", variant: "destructive" });
    }
  };

  const confirmDelete = (badge: any) => {
    setBadgeToDelete(badge);
  };

  const executeDelete = async () => {
    if (!badgeToDelete) return;
    const idsToDelete = badgeToDelete.groupedIds || [badgeToDelete.id];
    setBadgeToDelete(null);
    try {
      const token = localStorage.getItem("auth_token");
      const promises = idsToDelete.map((id: string) =>
        fetch(`/api/gamification/admin/badges/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      await Promise.all(promises);
      fetchBadges(); // Refresh analytics
      toast({ title: "Deleted", description: "Badge(s) deleted successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete badge", variant: "destructive" });
    }
  };

  const handleSaveBadge = async () => {
    if (!editingBadge?.name || !editingBadge?.category) return;
    try {
      setSaving(true);
      const token = localStorage.getItem("auth_token");

      const isUpdate = !!editingBadge.id || (editingBadge.groupedIds && editingBadge.groupedIds.length > 0);

      if (['series'].includes(editingBadge.category || '')) {
        const promises = [];
        for (const tier of ['bronze', 'silver', 'gold', 'platinum']) {
          const scoreStr = tierScores[tier];
          const existingTierBadge = isUpdate && editingBadge.tiers ? editingBadge.tiers[tier] : null;

          if (scoreStr !== '' && Number(scoreStr) >= 0) {
            const payload = {
              ...editingBadge,
              seriesType: editingBadge.series_type,
              requiredScore: Number(scoreStr) || 0,
              tier,
              is_enabled: true
            };
            delete payload.groupedIds;
            delete payload.tiers;

            if (existingTierBadge) {
              promises.push(
                fetch(`/api/gamification/admin/badges/${existingTierBadge.id}`, {
                  method: "PUT",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
                })
              );
            } else {
              promises.push(
                fetch('/api/gamification/admin/badges', {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
                })
              );
            }
          } else if (existingTierBadge) {
            promises.push(
              fetch(`/api/gamification/admin/badges/${existingTierBadge.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
              })
            );
          }
        }

        if (promises.length === 0) {
          toast({ title: "Validation Error", description: "Please provide points for at least one tier.", variant: "destructive" });
          setSaving(false);
          return;
        }

        const results = await Promise.all(promises);
        if (results.some(r => !r.ok)) throw new Error("Failed to save some badges");
      } else {
        // Default missing boolean values
        const payload = {
          ...editingBadge,
          seriesType: editingBadge.series_type,
          requiredScore: Number(editingBadge.required_score) || 0,
          is_enabled: editingBadge.is_enabled !== undefined ? editingBadge.is_enabled : true,
        };

        const url = isUpdate
          ? `/api/gamification/admin/badges/${editingBadge.id}`
          : '/api/gamification/admin/badges';

        const res = await fetch(url, {
          method: isUpdate ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to save badge");
      }

      toast({ title: "Success", description: `Badge(s) ${isUpdate ? 'updated' : 'created'} successfully.` });
      setIsDialogOpen(false);
      fetchBadges();
    } catch (err) {
      toast({ title: "Error", description: "Failed to save badge", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    setTierScores({ bronze: '', silver: '', gold: '', platinum: '' });
    setEditingBadge({
      name: "", description: "", category: "common", series_type: "thread", required_score: 0, tier: "bronze", is_enabled: true
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (badge: any) => {
    if (['series'].includes(badge.category) && badge.groupedIds) {
      const newScores = { bronze: '', silver: '', gold: '', platinum: '' };
      for (const t of ['bronze', 'silver', 'gold', 'platinum']) {
        if (badge.tiers && badge.tiers[t]) {
          newScores[t as keyof typeof newScores] = String(badge.tiers[t].required_score);
        }
      }
      setTierScores(newScores);
      setEditingBadge(badge);
    } else {
      setTierScores({ bronze: '', silver: '', gold: '', platinum: '' });
      setEditingBadge(badge);
    }
    setIsDialogOpen(true);
  };

  const filteredBadges = badges.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.series_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedBadges = Object.values(
    filteredBadges.reduce((acc, badge) => {
      if (badge.category === 'deleted') return acc;
      if (['series'].includes(badge.category)) {
        const key = `${badge.name}-${badge.category}`;
        if (!acc[key]) {
          acc[key] = { ...badge, groupedIds: [badge.id], tiers: { [badge.tier]: badge } };
        } else {
          acc[key].groupedIds.push(badge.id);
          acc[key].tiers[badge.tier] = badge;
          acc[key].is_enabled = acc[key].is_enabled || badge.is_enabled;
        }
      } else {
        acc[badge.id] = { ...badge, groupedIds: [badge.id], tiers: {} };
      }
      return acc;
    }, {} as Record<string, any>)
  );

  const getBadgeIcon = (badge: BadgeRecord) => {
    if (badge.series_type === 'login') return <LogIn className="w-5 h-5" />;
    if (badge.series_type === 'profile') return <UserCircle className="w-5 h-5" />;
    if (badge.series_type === 'thread') return <MessageSquare className="w-5 h-5" />;
    if (badge.series_type === 'event') return <Calendar className="w-5 h-5" />;
    if (badge.series_type === 'connection') return <Network className="w-5 h-5" />;
    if (badge.series_type === 'job') return <Briefcase className="w-5 h-5" />;
    if (badge.tier === 'gold') return <Trophy className="w-5 h-5" />;
    if (badge.tier === 'silver') return <Medal className="w-5 h-5" />;
    if (badge.tier === 'bronze') return <Award className="w-5 h-5" />;
    if (badge.tier === 'platinum') return <Star className="w-5 h-5 fill-current" />;
    return <Shield className="w-5 h-5" />;
  };

  // The global loading return was removed to preserve layout, handled in TableBody instead

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="py-4">
              <CardTitle className="text-3xl">{analytics?.totalBadges || 0}</CardTitle>
              <CardDescription>Total System Badges</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-3xl">{analytics?.uniqueUsersWithBadges || 0}</CardTitle>
              <CardDescription>Users With Badges</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-3xl">{analytics?.totalAwarded || 0}</CardTitle>
              <CardDescription>Total Badges Awarded</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Badge Management</CardTitle>
              <CardDescription>Create and configure badges rules for the platform</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchBadges}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button size="sm" onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" /> Create Badge
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-full relative bg-primary/5 border-primary/20 hover:bg-primary/10 group">
                    <HelpCircle className="h-5 w-5 text-primary animate-bounce group-hover:animate-none" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 border-primary/20 bg-white dark:bg-slate-950 shadow-xl relative z-50" align="end">
                  <PopoverClose className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                    <X className="h-4 w-4 text-primary" />
                    <span className="sr-only">Close</span>
                  </PopoverClose>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary border-b border-primary/10 pb-2 pr-6">
                      <HelpCircle className="h-5 w-5" />
                      <h4 className="font-semibold">How Badges Work</h4>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-3">
                      <p>
                        <strong className="text-foreground">Common (Single-Activity):</strong> One-off badges for completing a specific action.
                      </p>
                      <p>
                        <strong className="text-foreground">Series (Rank-based/Auto):</strong> Progression tiers (Bronze, Silver, Gold, Platinum). Use Auto-Fill to create all 4 tiers at once. The system will automatically upgrade users as their points increase!
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border mt-4 overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Badge</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-96">
                        <Loader text="Loading Gamification Engine..." className="h-full" />
                      </TableCell>
                    </TableRow>
                  ) : groupedBadges.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        No badges found. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedBadges.map((badge) => (
                      <TableRow key={badge.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all duration-200 group border-b border-slate-100 dark:border-slate-800/50">
                        <TableCell className="font-medium p-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-4 cursor-help">
                                <div
                                  className="relative flex shrink-0 items-center justify-center drop-shadow-md transition-transform group-hover:scale-105"
                                  style={{ width: '44px', height: '52px' }}
                                >
                                  {/* Shield Outer Rim (Border) */}
                                  <div
                                    className={`absolute inset-0 
                                    ${(badge.tier === 'gold' || badge.groupedIds) ? 'bg-gradient-to-b from-amber-200 via-yellow-500 to-amber-700' :
                                        badge.tier === 'silver' ? 'bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600' :
                                          badge.tier === 'bronze' ? 'bg-gradient-to-b from-orange-300 via-orange-700 to-amber-900' :
                                            badge.tier === 'platinum' ? 'bg-gradient-to-b from-fuchsia-300 via-purple-600 to-purple-950' : 'bg-primary'}
                                  `}
                                    style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
                                  />
                                  {/* Shield Inner Face */}
                                  <div
                                    className={`absolute inset-[3px] flex items-center justify-center
                                    ${(badge.tier === 'gold' || badge.groupedIds) ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                                        badge.tier === 'silver' ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                                          badge.tier === 'bronze' ? 'bg-gradient-to-br from-orange-600 to-orange-800' :
                                            badge.tier === 'platinum' ? 'bg-gradient-to-br from-purple-500 to-purple-900' : 'bg-background'}
                                  `}
                                    style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
                                  >
                                    {/* Inner subtle glow */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                    <div className="text-white relative z-10 filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] pb-1 scale-110">
                                      {getBadgeIcon(badge)}
                                    </div>
                                  </div>
                                </div>
                                <div className="min-w-0 flex flex-col justify-center max-w-[140px] sm:max-w-[200px]">
                                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-base" title={badge.name}>{badge.name}</div>
                                  {badge.description && <div className="text-[11px] font-medium text-slate-500 truncate">{badge.description}</div>}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px] p-4 shadow-xl border-slate-200/50 dark:border-slate-800 break-words">
                              <div className="flex items-start gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <p className="font-bold text-sm text-foreground break-all">{badge.name}</p>
                              </div>
                              <p className="text-xs leading-relaxed text-muted-foreground break-words">{badge.description || "No description provided."}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize border shadow-sm px-2.5 py-0.5 text-[10px] font-bold tracking-wider
                          ${badge.category === 'series' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' :
                                'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'}
                        `}>
                            {badge.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="capitalize text-sm font-semibold text-slate-600 dark:text-slate-400">
                              {badge.series_type === 'connection' ? 'Network Connections' : badge.series_type === 'job' ? 'Job Postings' : badge.series_type || 'Custom'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {badge.groupedIds && Object.keys(badge.tiers).length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-w-[200px]">
                              {['bronze', 'silver', 'gold', 'platinum'].map(t => {
                                const tData = badge.tiers[t];
                                if (!tData) return null;
                                return (
                                  <div
                                    key={t}
                                    className="relative flex shrink-0 items-center justify-center drop-shadow-sm transition-transform hover:scale-110"
                                    style={{ width: '28px', height: '32px' }}
                                    title={`${t.charAt(0).toUpperCase() + t.slice(1)} Tier: ${tData.required_score} pts`}
                                  >
                                    {/* Outer Rim */}
                                    <div
                                      className={`absolute inset-0 
                                      ${t === 'gold' ? 'bg-gradient-to-b from-amber-200 via-yellow-500 to-amber-700' :
                                          t === 'silver' ? 'bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600' :
                                            t === 'bronze' ? 'bg-gradient-to-b from-orange-300 via-orange-700 to-amber-900' :
                                              'bg-gradient-to-b from-fuchsia-300 via-purple-600 to-purple-950'}
                                    `}
                                      style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
                                    />
                                    {/* Inner Face */}
                                    <div
                                      className={`absolute inset-[2px] flex items-center justify-center flex-col leading-none
                                      ${t === 'gold' ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                                          t === 'silver' ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                                            t === 'bronze' ? 'bg-gradient-to-br from-orange-600 to-orange-800' :
                                              'bg-gradient-to-br from-purple-500 to-purple-900'}
                                    `}
                                      style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                      <span className="text-[7.5px] font-black text-white/90 relative z-10 filter drop-shadow-md">{t.charAt(0).toUpperCase()}</span>
                                      <span className="text-[10.5px] font-bold text-white relative z-10 filter drop-shadow-md">{tData.required_score}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : badge.required_score > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">{badge.required_score} pts</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm font-medium italic">Dynamic / Manual</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={badge.is_enabled}
                              onCheckedChange={() => toggleBadge(badge, badge.is_enabled)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${badge.is_enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {badge.is_enabled ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(badge)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => confirmDelete(badge)} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Badge Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBadge?.id ? 'Edit Badge' : 'Create New Badge'}</DialogTitle>
              <DialogDescription>Configure the rules and styling for this badge.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={editingBadge?.name || ''}
                  onChange={e => setEditingBadge(prev => ({ ...prev, name: e.target.value }) as any)}
                  placeholder="e.g., Expert Networker"
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input
                  value={editingBadge?.description || ''}
                  onChange={e => setEditingBadge(prev => ({ ...prev, description: e.target.value }) as any)}
                  placeholder="Short description of how to earn this..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select
                    value={editingBadge?.category || 'common'}
                    onValueChange={v => setEditingBadge(prev => ({ ...prev, category: v }) as any)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common (Single-Activity)</SelectItem>
                      <SelectItem value="series">Series (Rank-based/Auto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Type / Trigger</Label>
                  <Select
                    value={editingBadge?.series_type || 'thread'}
                    onValueChange={v => setEditingBadge(prev => ({ ...prev, series_type: v }) as any)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thread">Thread Interactions</SelectItem>
                      <SelectItem value="event">Event RSVPs</SelectItem>
                      <SelectItem value="connection">Network Connections</SelectItem>
                      <SelectItem value="job">Job Postings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {['series', 'common'].includes(editingBadge?.category || '') && (
                !editingBadge?.id && editingBadge?.category === 'series' ? (
                  <div className="grid gap-2 border-t pt-4 mt-2">
                    <Label>Required Points per Tier (Leave empty to skip tier)</Label>

                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 mb-2 mt-1">
                      <Label className="text-xs font-semibold text-primary/80 mb-2 block">Quick Auto-Fill Tiers</Label>
                      <div className="flex flex-col gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          placeholder="Enter Base Points (e.g. 10)"
                          onChange={e => {
                            const val = e.target.value;
                            const num = Number(val);
                            if (val !== '' && num >= 0) {
                              setTierScores({
                                bronze: String(Math.round(num)),
                                silver: String(Math.round(num * 1.5)),
                                gold: String(Math.round(num * 2)),
                                platinum: String(Math.round(num * 3))
                              });
                            }
                          }}
                          className="h-8 text-sm bg-background"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          Automatically calculates: Bronze (1x), Silver (1.5x), Gold (2x), Platinum (3x)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-1">
                      {(['bronze', 'silver', 'gold', 'platinum'] as const).map(t => (
                        <div key={t} className="grid gap-2">
                          <Label className="capitalize">{t}</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder={`Points for ${t}`}
                            value={tierScores[t] || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '' || Number(val) >= 0) {
                                setTierScores(prev => ({ ...prev, [t]: val }));
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {editingBadge?.category === 'series' && (
                      <div className="grid gap-2">
                        <Label>Required Score/Points</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editingBadge?.required_score || 0}
                          onChange={e => setEditingBadge(prev => ({ ...prev, required_score: Math.max(0, Number(e.target.value)) }) as any)}
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label>Tier</Label>
                      <Select
                        value={editingBadge?.tier || 'bronze'}
                        onValueChange={v => setEditingBadge(prev => ({ ...prev, tier: v }) as any)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bronze">Bronze</SelectItem>
                          <SelectItem value="silver">Silver</SelectItem>
                          <SelectItem value="gold">Gold</SelectItem>
                          <SelectItem value="platinum">Platinum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              )}

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBadge} disabled={!editingBadge?.name || saving}>
                {saving ? "Saving..." : "Save Badge"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <AlertDialog open={!!badgeToDelete} onOpenChange={(open) => !open && setBadgeToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the gamification badge from the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete Badge</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
