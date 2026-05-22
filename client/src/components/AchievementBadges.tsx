import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Star, Lock, Trophy, MessageSquare, Users, User, Calendar, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";

const getBadgeIcon = (seriesType: string, className: string) => {
  switch (seriesType) {
    case 'login': return <LogIn className={className} />;
    case 'profile': return <User className={className} />;
    case 'thread': return <MessageSquare className={className} />;
    case 'connection': return <Users className={className} />;
    case 'event': return <Calendar className={className} />;
    default: return <Trophy className={className} />;
  }
};

interface BadgeRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  series_type: string;
  required_score: number;
  tier: string;
  icon_url: string;
}

interface EarnedBadge {
  id: string;
  earned_at: string;
  is_featured: boolean;
  gamification_badges: BadgeRecord;
}

interface ProgressRecord {
  badge: BadgeRecord;
  currentScore: number;
  requiredScore: number;
  remaining: number;
  percentComplete: number;
}

export function AchievementBadges({ userId }: { userId: string }) {
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [scores, setScores] = useState<any>({});
  const [globalRank, setGlobalRank] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGamificationProfile = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`/api/gamification/users/${userId}/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "user-id": userId
          }
        });

        if (!res.ok) throw new Error("Failed to load badges");

        const data = await res.json();
        setEarnedBadges(data.earnedBadges || []);
        setProgress(data.progress || []);
        setScores(data.scores || {});
        setGlobalRank(data.globalRank || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading badges");
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchGamificationProfile();

      const channel = supabase
        .channel(`gamification-profile-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${userId}` },
          () => { fetchGamificationProfile(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_scores', filter: `user_id=eq.${userId}` },
          () => { fetchGamificationProfile(); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Skeleton className="h-24 w-24 rounded-lg" />
            <Skeleton className="h-24 w-24 rounded-lg" />
            <Skeleton className="h-24 w-24 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4 border rounded-md">Error: {error}</div>;
  }

  // Group earned badges
  const commonBadges = earnedBadges.filter(b => b.gamification_badges?.category === 'common');
  const seriesBadges = earnedBadges.filter(b => b.gamification_badges?.category === 'series');

  // Sort progress by how close they are based on percentage
  const allProgress = [...progress].sort((a, b) => b.percentComplete - a.percentComplete);

  return (
    <TooltipProvider>
      <Card className="mt-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-primary/20 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                Legacy Rewards
              </CardTitle>
              <CardDescription>Badges earned through community participation</CardDescription>
            </div>
            <div className="flex items-center gap-6">
              {globalRank > 0 && (
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Global Rank</div>
                  <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-200 to-amber-500 rounded-lg shadow-inner border border-amber-300">
                    <span className="text-xl font-black text-amber-950">#{globalRank}</span>
                  </div>
                </div>
              )}
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Total Points</div>
                <div className="text-3xl font-black text-primary">{scores.total_points || 0}</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="earned" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="earned">Earned Badges</TabsTrigger>
              <TabsTrigger value="locked">Locked & Progress</TabsTrigger>
            </TabsList>

            <TabsContent value="earned" className="pt-4">
              {earnedBadges.length === 0 ? (
                <div className="text-center p-8 text-slate-500">
                  <Star className="h-12 w-12 mx-auto text-slate-300 mb-2 opacity-50" />
                  <p>No badges earned yet. Participate to unlock achievements!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Series Badges Group */}
                  {seriesBadges.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center text-slate-700 dark:text-slate-300">
                        <Award className="w-4 h-4 mr-2 text-blue-500" /> Rank Series
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {seriesBadges.map(eb => (
                          <div key={eb.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex gap-4 items-center hover:border-primary/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600 shrink-0">
                              {eb.gamification_badges.icon_url && eb.gamification_badges.icon_url.startsWith('http') ? (
                                <img src={eb.gamification_badges.icon_url} alt="icon" className="w-6 h-6 object-contain" />
                              ) : (
                                getBadgeIcon(eb.gamification_badges.series_type, `w-5 h-5 ${eb.gamification_badges.tier === 'gold' ? 'text-amber-500' : eb.gamification_badges.tier === 'silver' ? 'text-slate-500' : eb.gamification_badges.tier === 'bronze' ? 'text-orange-600' : 'text-primary'}`)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="font-medium truncate pr-2 flex items-center gap-1.5">
                                  {eb.gamification_badges.name}
                                  {eb.is_featured && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
                                </h4>
                                <Badge variant="outline" className={`capitalize text-[10px] tracking-wider font-semibold whitespace-nowrap ${eb.gamification_badges.tier === 'gold' ? 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' : eb.gamification_badges.tier === 'silver' ? 'text-slate-700 border-slate-300 bg-slate-50 dark:bg-slate-800 dark:text-slate-300' : eb.gamification_badges.tier === 'bronze' ? 'text-orange-800 border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400' : 'text-primary'}`}>
                                  {eb.gamification_badges.tier}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">{eb.gamification_badges.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Common Badges Group */}
                  {commonBadges.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center text-slate-700 dark:text-slate-300">
                        <Star className="w-4 h-4 mr-2 text-indigo-500" /> Milestones
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {commonBadges.map(eb => (
                          <div key={eb.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex gap-4 items-center hover:border-primary/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600 shrink-0">
                              {eb.gamification_badges.icon_url && eb.gamification_badges.icon_url.startsWith('http') ? (
                                <img src={eb.gamification_badges.icon_url} alt="icon" className="w-6 h-6 object-contain" />
                              ) : (
                                getBadgeIcon(eb.gamification_badges.series_type, "w-5 h-5 text-indigo-500")
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="font-medium truncate pr-2">{eb.gamification_badges.name}</h4>
                                <Badge variant="outline" className="text-[10px] text-slate-500 capitalize whitespace-nowrap">
                                  {eb.gamification_badges.series_type}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">{eb.gamification_badges.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="locked" className="pt-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-3">Locked & Progressing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allProgress.length > 0 ? allProgress.map((item, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex gap-4 items-center hover:border-primary/50 transition-colors cursor-help">
                          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 shrink-0">
                            {item.badge.icon_url && item.badge.icon_url.startsWith('http') ? (
                              <img src={item.badge.icon_url} alt="icon" className="w-6 h-6 object-contain opacity-50 grayscale" />
                            ) : (
                              getBadgeIcon(item.badge.series_type, "w-5 h-5 text-slate-400")
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="font-medium truncate pr-2">{item.badge.name}</h4>
                              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                {item.currentScore} / {item.requiredScore}
                              </span>
                            </div>
                            <Progress value={item.percentComplete} className="h-2" />
                            <p className="text-[11px] text-muted-foreground mt-2 truncate">
                              {item.percentComplete > 0 ? (
                                <>Just <strong className="text-primary">{item.remaining}</strong> more to unlock!</>
                              ) : (
                                <>Not started yet</>
                              )}
                            </p>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px] p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getBadgeIcon(item.badge.series_type, "w-4 h-4 text-primary")}
                            <h4 className="font-bold text-sm">{item.badge.name}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {item.badge.description}
                          </p>
                          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-medium">
                              <span className="text-primary">Requirement:</span> Earn {item.requiredScore} {item.badge.series_type} points to unlock.
                            </p>
                            <p className="text-xs font-medium mt-1 text-amber-600 dark:text-amber-500">
                              You need {item.remaining} more to get this badge!
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )) : (
                    <p className="text-sm text-muted-foreground col-span-full text-center p-8 border border-dashed rounded-lg">
                      No locked badges available. You might have earned them all!
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
