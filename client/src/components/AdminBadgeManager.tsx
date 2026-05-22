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
import { Trash2, Plus, Edit2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
}

export function AdminBadgeManager() {
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Partial<BadgeRecord> | null>(null);
  const [saving, setSaving] = useState(false);
  
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

  const toggleBadge = async (id: string, currentState: boolean) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/gamification/admin/badges/${id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBadges(badges.map(b => b.id === id ? { ...b, is_enabled: !currentState } : b));
        toast({ title: "Updated", description: "Badge status updated successfully." });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to toggle badge", variant: "destructive" });
    }
  };

  const deleteBadge = async (id: string) => {
    if (!confirm("Are you sure you want to delete this badge?")) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/gamification/admin/badges/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBadges(badges.filter(b => b.id !== id));
        fetchBadges(); // Refresh analytics
        toast({ title: "Deleted", description: "Badge deleted successfully." });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete badge", variant: "destructive" });
    }
  };

  const handleSaveBadge = async () => {
    if (!editingBadge?.name || !editingBadge?.category) return;
    try {
      setSaving(true);
      const token = localStorage.getItem("auth_token");
      
      // Default missing boolean values
      const payload = {
        ...editingBadge,
        is_enabled: editingBadge.is_enabled !== undefined ? editingBadge.is_enabled : true,
        required_score: Number(editingBadge.required_score) || 0
      };

      const isUpdate = !!editingBadge.id;
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
      
      toast({ title: "Success", description: `Badge ${isUpdate ? 'updated' : 'created'} successfully.` });
      setIsDialogOpen(false);
      fetchBadges();
    } catch (err) {
      toast({ title: "Error", description: "Failed to save badge", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    setEditingBadge({
      name: "", description: "", category: "common", series_type: "login", required_score: 0, tier: "bronze", is_enabled: true
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (badge: BadgeRecord) => {
    setEditingBadge(badge);
    setIsDialogOpen(true);
  };

  if (loading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchBadges}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create Badge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border mt-4">
            <Table>
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
                {badges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No badges found. Create one to get started!
                    </TableCell>
                  </TableRow>
                ) : (
                  badges.map((badge) => (
                    <TableRow key={badge.id}>
                      <TableCell className="font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 cursor-help">
                              <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-xs
                                ${badge.tier === 'gold' ? 'bg-amber-100 text-amber-700' :
                                  badge.tier === 'silver' ? 'bg-slate-100 text-slate-700' :
                                    badge.tier === 'bronze' ? 'bg-orange-100 text-orange-700' : 
                                    badge.tier === 'platinum' ? 'bg-slate-800 text-white' : 'bg-primary/10'}
                              `}>
                                {badge.tier ? badge.tier.charAt(0).toUpperCase() : 'B'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{badge.name}</div>
                                {badge.description && <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{badge.description}</div>}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px] p-3 shadow-lg">
                            <p className="font-bold text-sm mb-1 text-foreground">{badge.name}</p>
                            <p className="text-xs leading-relaxed text-muted-foreground">{badge.description || "No description provided."}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.category === 'common' ? 'secondary' : 'default'} className="capitalize">
                          {badge.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{badge.series_type || 'N/A'}</TableCell>
                      <TableCell>{badge.required_score > 0 ? (
                        <span className="text-primary font-bold">{badge.required_score} points</span>
                      ) : (
                        <span className="text-muted-foreground italic">Auto</span>
                      )}</TableCell>
                      <TableCell>
                        <Switch
                          checked={badge.is_enabled}
                          onCheckedChange={() => toggleBadge(badge.id, badge.is_enabled)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(badge)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteBadge(badge.id)} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                onChange={e => setEditingBadge(prev => ({...prev, name: e.target.value}) as any)}
                placeholder="e.g., Expert Networker" 
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input 
                value={editingBadge?.description || ''} 
                onChange={e => setEditingBadge(prev => ({...prev, description: e.target.value}) as any)}
                placeholder="Short description of how to earn this..." 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select 
                  value={editingBadge?.category || 'common'} 
                  onValueChange={v => setEditingBadge(prev => ({...prev, category: v}) as any)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">Common (One-time)</SelectItem>
                    <SelectItem value="series">Series (Rank-based)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Type / Trigger</Label>
                <Select 
                  value={editingBadge?.series_type || 'login'} 
                  onValueChange={v => setEditingBadge(prev => ({...prev, series_type: v}) as any)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="login">Login / System</SelectItem>
                    <SelectItem value="profile">Profile Completion</SelectItem>
                    <SelectItem value="thread">Thread Interactions</SelectItem>
                    <SelectItem value="event">Event RSVPs</SelectItem>
                    <SelectItem value="connection">Connections</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {editingBadge?.category === 'series' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Required Score/Points</Label>
                  <Input 
                    type="number"
                    value={editingBadge?.required_score || 0} 
                    onChange={e => setEditingBadge(prev => ({...prev, required_score: Number(e.target.value)}) as any)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tier</Label>
                  <Select 
                    value={editingBadge?.tier || 'bronze'} 
                    onValueChange={v => setEditingBadge(prev => ({...prev, tier: v}) as any)}
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
    </div>
    </TooltipProvider>
  );
}
