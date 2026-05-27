import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Network, 
  MessageSquare, 
  Rss, 
  Calendar, 
  Save, 
  RefreshCw 
} from "lucide-react";

interface PointRule {
  id: string;
  action_key: string;
  points: number;
  description: string;
  category: string;
}

export function AdminPointRules() {
  const [rules, setRules] = useState<PointRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/gamification/admin/point-rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load point rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load point configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleUpdate = async (key: string, points: number) => {
    try {
      setSavingKey(key);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/gamification/admin/point-rules/${key}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ points }),
      });

      if (!res.ok) throw new Error("Failed to update rule");
      
      const data = await res.json();
      setRules(rules.map((r) => (r.action_key === key ? data.rule : r)));
      
      toast({
        title: "Rule Updated",
        description: `Successfully updated points for ${key.replace('_', ' ')}.`,
      });
    } catch (err) {
      toast({
        title: "Update Failed",
        description: "Could not update the point rule.",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handlePointChange = (key: string, value: string) => {
    const parsed = parseInt(value, 10);
    const newPoints = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setRules(rules.map((r) => (r.action_key === key ? { ...r, points: newPoints } : r)));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  // Categorize rules
  const networkRules = rules.filter(r => r.category === 'networking');
  const communityRules = rules.filter(r => r.category === 'community');
  const eventRules = rules.filter(r => r.category === 'events');

  const getIcon = (key: string) => {
    switch (key) {
      case 'network_connect': return <Network className="w-5 h-5 text-indigo-500" />;
      case 'thread_create': return <MessageSquare className="w-5 h-5 text-amber-500" />;
      case 'post_reply': return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'feed_create': return <Rss className="w-5 h-5 text-orange-500" />;
      case 'event_rsvp': return <Calendar className="w-5 h-5 text-emerald-500" />;
      default: return <MessageSquare className="w-5 h-5 text-gray-500" />;
    }
  };

  const getGradient = (category: string) => {
    switch (category) {
      case 'networking': return "from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-950 border-indigo-100 dark:border-indigo-900/30";
      case 'community': return "from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-950 border-amber-100 dark:border-amber-900/30";
      case 'events': return "from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-950 border-emerald-100 dark:border-emerald-900/30";
      default: return "";
    }
  };

  const renderRuleSection = (title: string, categoryRules: PointRule[], categoryKey: string) => {
    if (categoryRules.length === 0) return null;
    return (
      <Card className={`shadow-sm bg-gradient-to-b ${getGradient(categoryKey)} overflow-hidden transition-all duration-300 hover:shadow-md`}>
        <CardHeader className="border-b bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            {title}
          </CardTitle>
          <CardDescription>Configure points awarded for {title.toLowerCase()} actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {categoryRules.map((rule) => (
              <div key={rule.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 gap-4 hover:bg-white/60 dark:hover:bg-slate-900/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                    {getIcon(rule.action_key)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-base capitalize">
                      {rule.action_key.replace('_', ' ')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                      {rule.description || `Points awarded for ${rule.action_key.replace('_', ' ')}.`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 sm:ml-auto bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Points</span>
                    <Input
                      type="number"
                      min="0"
                      className="w-24 text-lg font-bold text-center h-10 border-0 focus-visible:ring-1 focus-visible:ring-primary bg-gray-50 dark:bg-slate-800"
                      value={rule.points}
                      onChange={(e) => handlePointChange(rule.action_key, e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={() => handleUpdate(rule.action_key, rule.points)}
                    disabled={savingKey === rule.action_key}
                    className="h-10 px-4 shrink-0 transition-all hover:scale-105 active:scale-95"
                    variant={savingKey === rule.action_key ? "outline" : "default"}
                  >
                    {savingKey === rule.action_key ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {savingKey === rule.action_key ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Point Rules Engine</h2>
          <p className="text-muted-foreground mt-1">Control exactly how many points users earn for their engagement.</p>
        </div>
        <Button variant="outline" onClick={fetchRules} disabled={loading} className="shrink-0 shadow-sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {rules.length === 0 && !loading && (
        <Card className="border-dashed border-2 bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Network className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">No Rules Found</h3>
            <p className="text-muted-foreground max-w-md">
              The gamification point rules have not been configured in the database yet. 
              Please ensure the backend migration script has been run to populate the default rules.
            </p>
          </CardContent>
        </Card>
      )}

      {renderRuleSection("Networking", networkRules, "networking")}
      {renderRuleSection("Community & Content", communityRules, "community")}
      {renderRuleSection("Events", eventRules, "events")}

    </div>
  );
}
