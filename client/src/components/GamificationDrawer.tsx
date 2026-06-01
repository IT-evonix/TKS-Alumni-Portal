import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Award, Star, Lock, Trophy, MessageSquare, Users, User, Calendar, LogIn, Flame, X } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

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

const renderShieldIcon = (badge: BadgeRecord) => {
  if (!badge.tier) return null;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center drop-shadow-md transition-transform group-hover:scale-105"
      style={{ width: '50px', height: '60px' }}
    >
      {/* Shield Outer Rim (Border) */}
      <div
        className={`absolute inset-0 
        ${(badge.tier === 'gold') ? 'bg-gradient-to-b from-amber-200 via-yellow-500 to-amber-700' :
            badge.tier === 'silver' ? 'bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600' :
              badge.tier === 'bronze' ? 'bg-gradient-to-b from-orange-300 via-orange-700 to-amber-900' :
                badge.tier === 'platinum' ? 'bg-gradient-to-b from-fuchsia-300 via-purple-600 to-purple-950' : 'bg-emerald-500'}
      `}
        style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
      />
      {/* Shield Inner Face */}
      <div
        className={`absolute inset-[3px] flex items-center justify-center
        ${(badge.tier === 'gold') ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
            badge.tier === 'silver' ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
              badge.tier === 'bronze' ? 'bg-gradient-to-br from-orange-600 to-orange-800' :
                badge.tier === 'platinum' ? 'bg-gradient-to-br from-purple-500 to-purple-900' : 'bg-background'}
      `}
        style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)' }}
      >
        {/* Inner subtle glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div className="text-white relative z-10 filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] pb-1 scale-110">
          {getBadgeIcon(badge.series_type, "w-6 h-6")}
        </div>
      </div>
    </div>
  );
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

interface GamificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GamificationDrawer({ isOpen, onClose }: GamificationDrawerProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [scores, setScores] = useState<any>({});
  const [globalRank, setGlobalRank] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGamificationProfile = async () => {
      if (!userId) return;
      try {
        setLoading(true);
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

    if (isOpen && userId) {
      fetchGamificationProfile();

      let timeoutId: NodeJS.Timeout;
      const debouncedFetch = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          fetchGamificationProfile();
        }, 500);
      };

      const channel = supabase
        .channel(`gamification-profile-drawer-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${userId}` },
          () => { debouncedFetch(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_scores', filter: `user_id=eq.${userId}` },
          () => { debouncedFetch(); }
        )
        .subscribe();

      return () => {
        clearTimeout(timeoutId);
        supabase.removeChannel(channel);
      };
    }
  }, [userId, isOpen]);

  const level = Math.floor((scores.total_points || 0) / 500) + 1;
  const currentLevelXP = (scores.total_points || 0) % 500;
  const levelProgress = (currentLevelXP / 500) * 100;

  // Streak calculation from DB
  const streak = scores?.current_streak_days || 0;

  // Process progress to only show the next available tier for each series
  const filteredProgress = React.useMemo(() => {
    const seriesMap = new Map<string, ProgressRecord>();
    const otherProgress: ProgressRecord[] = [];

    progress.forEach(p => {
      if (!p.badge) return;
      if (p.badge.category === 'series' || p.badge.category === 'competitive') {
        const existing = seriesMap.get(p.badge.series_type);
        if (!existing || p.badge.required_score < existing.badge.required_score) {
          seriesMap.set(p.badge.series_type, p);
        }
      } else {
        otherProgress.push(p);
      }
    });

    return [...Array.from(seriesMap.values()), ...otherProgress].sort((a, b) => b.percentComplete - a.percentComplete);
  }, [progress]);

  // Process earned badges to only show the highest unlocked tier for series and competitive
  const filteredEarnedBadges = React.useMemo(() => {
    const seriesMap = new Map<string, EarnedBadge>();
    const otherBadges: EarnedBadge[] = [];

    earnedBadges.forEach(eb => {
      const badge = eb.gamification_badges;
      if (!badge) return;
      if (badge.category === 'series' || badge.category === 'competitive') {
        const existing = seriesMap.get(badge.series_type);
        if (!existing || (existing.gamification_badges.required_score || 0) < (badge.required_score || 0)) {
          seriesMap.set(badge.series_type, eb);
        }
      } else {
        otherBadges.push(eb);
      }
    });

    return [...Array.from(seriesMap.values()), ...otherBadges].sort(
      (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
    );
  }, [earnedBadges]);

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-4xl mx-auto h-[85vh] sm:h-[80vh] p-0 flex flex-col bg-white border-0 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden [&>button]:hidden z-[300] gap-0">

          {/* Header Section (Light Theme) */}
          <div className="relative bg-white border-b border-slate-100 p-6 sm:px-8 sm:pt-8 sm:pb-6 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full h-8 w-8 z-10"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-2">

              {/* Level & XP Info */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Star className="h-8 w-8 text-amber-500 fill-amber-500 drop-shadow-sm animate-[spin_4s_linear_infinite]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Level {level} Explorer</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    {/* <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-200">
                      {scores.total_points || 0} XP
                    </Badge> */}
                    {globalRank > 0 && (
                      <span className="text-sm font-semibold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        <Star className="w-3.5 h-3.5 fill-slate-400 text-slate-400" />
                        Rank #{globalRank}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Streak & Stats Row */}
              <div className="flex gap-4 sm:min-w-[250px]">
                <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3 shadow-sm">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Daily Streak</div>
                    <div className="font-black text-slate-700">{streak} Days</div>
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3 shadow-sm">
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <Award className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Badges</div>
                    <div className="font-black text-slate-700">{filteredEarnedBadges.length}</div>
                  </div>
                </div>
              </div>

            </div>

            {/* <div className="space-y-1.5 mt-6 max-w-md">
            <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>Progress to Level {level + 1}</span>
              <span className="text-emerald-600">{currentLevelXP} / 500 XP</span>
            </div>
            <Progress value={levelProgress} className="h-2.5 bg-slate-100 [&>div]:bg-emerald-500 shadow-inner" />
          </div> */}
          </div>

          {/* Badges Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:px-8 space-y-8 bg-slate-50/50">

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader text="Loading Rewards..." />
              </div>
            ) : error ? (
              <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded-xl text-sm font-medium">{error}</div>
            ) : (
              <>
                {/* Earned Badges Section */}
                <div>
                  <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    Unlocked Achievements
                  </h3>

                  {filteredEarnedBadges.length === 0 ? (
                    <div className="text-center p-8 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <Award className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-500 font-medium">No badges yet. Start participating to earn rewards!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredEarnedBadges.map(eb => (
                        <Tooltip key={eb.id}>
                          <TooltipTrigger asChild>
                            <div className="relative group bg-white border border-emerald-100 rounded-xl p-4 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-300 overflow-hidden cursor-help">
                              {/* Glow effect for unlocked */}
                              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                              {eb.gamification_badges.tier ? (
                                <div className="mb-3 relative z-10">
                                  {renderShieldIcon(eb.gamification_badges)}
                                </div>
                              ) : (
                                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center border-2 border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)] mb-3 relative z-10 group-hover:scale-110 transition-transform duration-300">
                                  {eb.gamification_badges.icon_url && eb.gamification_badges.icon_url.startsWith('http') ? (
                                    <img src={eb.gamification_badges.icon_url} alt="icon" className="w-7 h-7 object-contain drop-shadow-md" />
                                  ) : (
                                    getBadgeIcon(eb.gamification_badges.series_type, `w-7 h-7 ${eb.gamification_badges.tier === 'gold' ? 'text-amber-500' : eb.gamification_badges.tier === 'silver' ? 'text-slate-500' : 'text-emerald-600'} drop-shadow-sm`)
                                  )}
                                </div>
                              )}

                              <h4 className="font-bold text-slate-800 text-sm mb-1 relative z-10 line-clamp-2 leading-tight min-h-[36px] flex items-center justify-center w-full px-1">
                                <span>{eb.gamification_badges.name} {eb.gamification_badges.tier && <span className="capitalize text-slate-500">({eb.gamification_badges.tier})</span>}</span>
                              </h4>
                              <Badge variant="secondary" className="text-[9px] uppercase tracking-wider bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-bold mb-2 shrink-0">Unlocked</Badge>
                              <p className="text-xs text-slate-500 line-clamp-2 relative z-10 leading-snug px-1 break-words w-full">{eb.gamification_badges.description}</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[250px] p-3 shadow-xl bg-white text-slate-800 border-emerald-100 break-words z-[400]">
                            <p className="font-bold text-sm text-emerald-700 mb-1 break-all">{eb.gamification_badges.name}</p>
                            <p className="text-xs text-slate-600 leading-relaxed">{eb.gamification_badges.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>

                {/* Locked / In Progress Section */}
                {filteredProgress.length > 0 && (
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-slate-400" />
                      In Progress
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredProgress.map((item, idx) => (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <div className="bg-white border border-slate-100 border-dashed rounded-xl p-4 flex flex-col items-center text-center shadow-sm hover:border-slate-300 transition-colors cursor-help overflow-hidden">
                              {item.badge.tier ? (
                                <div className="mb-3 relative z-10 grayscale-[0.8] opacity-60">
                                  {renderShieldIcon(item.badge)}
                                </div>
                              ) : (
                                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center border-2 border-slate-100 shadow-[0_0_15px_rgba(0,0,0,0.03)] mb-3 relative z-10 grayscale">
                                  {item.badge.icon_url && item.badge.icon_url.startsWith('http') ? (
                                    <img src={item.badge.icon_url} alt="icon" className="w-7 h-7 object-contain opacity-40 drop-shadow-sm" />
                                  ) : (
                                    getBadgeIcon(item.badge.series_type, "w-7 h-7 text-slate-300 drop-shadow-sm")
                                  )}
                                </div>
                              )}

                              <h4 className="font-bold text-slate-600 text-sm mb-1 relative z-10 line-clamp-2 leading-tight min-h-[36px] flex items-center justify-center w-full px-1">
                                <span>{item.badge.name} {item.badge.tier && <span className="capitalize text-slate-400">({item.badge.tier})</span>}</span>
                              </h4>
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-slate-500 border-slate-200 font-bold mb-2 shrink-0">Locked</Badge>

                              <div className="w-full mt-auto pt-2">
                                {item.badge.category === 'common' || item.requiredScore === 0 ? (
                                  <div className="text-[10px] text-slate-500 font-medium text-center italic mt-3">
                                    Action Required
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1.5">
                                      <span>{item.percentComplete}%</span>
                                      <span>{item.currentScore}/{item.requiredScore}</span>
                                    </div>
                                    <Progress value={item.percentComplete} className="h-1.5 bg-slate-100 [&>div]:bg-slate-400" />
                                  </>
                                )}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[250px] p-3 shadow-xl bg-white text-slate-800 border-slate-200 break-words z-[400]">
                            <p className="font-bold text-sm text-slate-700 mb-1 break-all">{item.badge.name}</p>
                            <p className="text-xs text-slate-600 leading-relaxed mb-2">{item.badge.description}</p>
                            <div className="text-[10px] bg-slate-50 p-1.5 rounded text-slate-500 font-medium">
                              {item.badge.category === 'common' || item.requiredScore === 0 
                                ? "Complete the required action to unlock this badge!" 
                                : `Need ${item.remaining} more to unlock this badge!`
                              }
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

