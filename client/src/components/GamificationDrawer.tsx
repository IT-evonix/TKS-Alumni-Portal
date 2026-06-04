import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useGamification } from "@/contexts/GamificationContext";
import { Award, Star, Lock, Trophy, MessageSquare, Users, User, Calendar, LogIn, Flame, X, Sparkles, Unlock } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const getBadgeIcon = (seriesType: string, className: string) => {
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
  is_enabled?: boolean;
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

interface GamificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GamificationDrawer({ isOpen, onClose }: GamificationDrawerProps) {
  const {
    earnedBadges,
    progress,
    scores,
    globalRank,
    globalBadgeRank,
    loading,
    error,
    refreshGamification
  } = useGamification();

  React.useEffect(() => {
    if (isOpen) {
      refreshGamification();
    }
  }, [isOpen, refreshGamification]);

  const level = Math.floor((scores.total_points || 0) / 500) + 1;
  const currentLevelXP = (scores.total_points || 0) % 500;
  const levelProgress = (currentLevelXP / 500) * 100;

  // Streak calculation from DB
  const streak = scores?.current_streak_days || 0;

  // Process progress to only show the next available tier for each series
  const filteredProgress = React.useMemo(() => {
    // 1. Find the highest required score of the earned badges for each series_type
    const highestEarnedScoreMap = new Map<string, number>();
    earnedBadges.forEach(eb => {
      const badge = eb.gamification_badges;
      if (!badge) return;
      if (badge.category === 'series') {
        const key = `${badge.series_type}_${badge.name}`;
        const existingScore = highestEarnedScoreMap.get(key) || 0;
        if (badge.required_score > existingScore) {
          highestEarnedScoreMap.set(key, badge.required_score);
        }
      }
    });

    const seriesMap = new Map<string, ProgressRecord>();
    const otherProgress: ProgressRecord[] = [];

    progress.forEach(p => {
      if (!p.badge) return;
      if (p.badge.category === 'series') {
        const key = `${p.badge.series_type}_${p.badge.name}`;
        // Only consider locked badges that are ABOVE the user's highest earned badge in this series
        const highestEarnedScore = highestEarnedScoreMap.get(key) || 0;
        if (p.badge.required_score <= highestEarnedScore) {
          return; // Skip this lower tier locked badge (user already surpassed it or has a higher one)
        }

        const existing = seriesMap.get(key);
        // We want the NEXT available tier, which is the one with the SMALLEST required score among the remaining locked badges
        if (!existing || p.badge.required_score < existing.badge.required_score) {
          seriesMap.set(key, p);
        }
      } else {
        otherProgress.push(p);
      }
    });

    const tierWeight: Record<string, number> = {
      platinum: 4,
      gold: 3,
      silver: 2,
      bronze: 1
    };

    return [...Array.from(seriesMap.values()), ...otherProgress].sort((a, b) => {
      const aWeight = tierWeight[a.badge?.tier?.toLowerCase() || ''] || 0;
      const bWeight = tierWeight[b.badge?.tier?.toLowerCase() || ''] || 0;
      if (bWeight !== aWeight) {
        return bWeight - aWeight; // Platinum > Gold > Silver > Bronze
      }
      return b.percentComplete - a.percentComplete;
    });
  }, [progress, earnedBadges]);

  // Process earned badges to only show the highest unlocked tier for series and competitive
  const filteredEarnedBadges = React.useMemo(() => {
    const seriesMap = new Map<string, EarnedBadge>();
    const otherMap = new Map<string, EarnedBadge>();

    (earnedBadges || []).forEach(eb => {
      const badge = eb?.gamification_badges;
      if (!badge) return;

      const cat = (badge.category || '').toLowerCase().trim();
      if (cat === 'series') {
        const key = `${badge.series_type}_${badge.name}`;
        const existing = seriesMap.get(key);
        if (!existing || (existing.gamification_badges?.required_score || 0) < (badge.required_score || 0)) {
          seriesMap.set(key, eb);
        }
      } else {
        // Deduplicate common badges by badge ID
        if (!otherMap.has(badge.id)) {
          otherMap.set(badge.id, eb);
        }
      }
    });

    const tierWeight: Record<string, number> = {
      platinum: 4,
      gold: 3,
      silver: 2,
      bronze: 1
    };

    return [...Array.from(seriesMap.values()), ...Array.from(otherMap.values())].sort((a, b) => {
      const aWeight = tierWeight[a.gamification_badges?.tier?.toLowerCase() || ''] || 0;
      const bWeight = tierWeight[b.gamification_badges?.tier?.toLowerCase() || ''] || 0;
      if (bWeight !== aWeight) {
        return bWeight - aWeight; // Platinum > Gold > Silver > Bronze
      }
      const aTime = a.earned_at ? new Date(a.earned_at).getTime() : 0;
      const bTime = b.earned_at ? new Date(b.earned_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [earnedBadges]);

  // Split earned badges into series/rank-based and common/one-off ones
  const rankBasedBadges = React.useMemo(() => {
    const res = filteredEarnedBadges.filter(eb => {
      const cat = (eb.gamification_badges?.category || '').toLowerCase().trim();
      return cat === 'series';
    });
    console.log('[GamificationDrawer] rankBasedBadges:', res);
    return res;
  }, [filteredEarnedBadges]);

  const commonBadges = React.useMemo(() => {
    const res = filteredEarnedBadges.filter(eb => {
      const cat = (eb.gamification_badges?.category || '').toLowerCase().trim();
      return cat === 'common' || !eb.gamification_badges?.category;
    });
    console.log('[GamificationDrawer] commonBadges:', res);
    return res;
  }, [filteredEarnedBadges]);

  console.log('[GamificationDrawer] filteredEarnedBadges:', filteredEarnedBadges);

  const renderBadgeCard = (eb: EarnedBadge) => {
    console.log('[GamificationDrawer] renderBadgeCard:', eb.gamification_badges.name, 'series_type:', eb.gamification_badges.series_type, 'streak:', streak);
    const isLegacy = eb.gamification_badges.is_enabled === false;
    return (
      <Tooltip key={eb.id}>
        <TooltipTrigger asChild>
          <div className={`relative group bg-white border rounded-xl p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-help h-full justify-between ${
            isLegacy 
              ? 'border-amber-200 hover:border-amber-400 bg-gradient-to-br from-amber-50/30 to-white' 
              : eb.gamification_badges.tier 
                ? 'border-emerald-100 hover:border-emerald-300' 
                : 'border-cyan-100 hover:border-cyan-300'
          }`}>
            {/* Glow effect for unlocked */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${isLegacy ? 'bg-amber-500/5' : eb.gamification_badges.tier ? 'bg-emerald-500/5' : 'bg-cyan-500/5'}`} />

            {/* Legacy Tag */}
            {isLegacy && (
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 z-20 group-hover:border-amber-300 transition-colors shadow-sm" title="This badge is rare and no longer obtainable">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-[10px] font-bold text-amber-700">Legacy</span>
              </div>
            )}

            {eb.gamification_badges.series_type === 'login' && (
              <div className={`absolute top-3 ${isLegacy ? 'left-3' : 'right-3'} flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 z-20 group-hover:border-slate-200 transition-colors`} title="Current Streak">
                <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                <span className="text-[10px] font-bold text-slate-600">{streak || 0} Streak</span>
              </div>
            )}

            <div className="flex flex-col items-center w-full flex-1 pt-2">

              {eb.gamification_badges.tier ? (
                <div className="mb-3 relative z-10 shrink-0">
                  {renderShieldIcon(eb.gamification_badges)}
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-cyan-50 flex items-center justify-center border-2 border-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)] mb-3 relative z-10 group-hover:scale-110 transition-transform duration-300 shrink-0">
                  {eb.gamification_badges.icon_url && eb.gamification_badges.icon_url.startsWith('http') ? (
                    <img src={eb.gamification_badges.icon_url} alt="icon" className="w-7 h-7 object-contain drop-shadow-md" />
                  ) : (
                    getBadgeIcon(eb.gamification_badges.series_type, `w-7 h-7 text-cyan-600 drop-shadow-sm`)
                  )}
                </div>
              )}

              <h4 className="font-bold text-slate-800 text-sm mb-1.5 relative z-10 line-clamp-2 leading-tight min-h-[36px] flex items-center justify-center w-full px-1 capitalize">
                <span>{eb.gamification_badges.name} {eb.gamification_badges.tier && <span className="capitalize text-slate-500 font-semibold">({eb.gamification_badges.tier})</span>}</span>
              </h4>
              <p className="text-xs text-slate-500 line-clamp-2 relative z-10 leading-snug px-1 break-words w-full mb-4">{eb.gamification_badges.description}</p>
            </div>

            <div className="w-full mt-auto pt-2 flex justify-center shrink-0">
              <Badge variant="secondary" className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${eb.gamification_badges.tier ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100'}`}>Unlocked</Badge>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className={`max-w-[250px] p-3 shadow-xl bg-white text-slate-800 break-words z-[400] ${eb.gamification_badges.tier ? 'border-emerald-100' : 'border-cyan-100'}`}>
          <p className={`font-bold text-sm mb-1 break-all ${eb.gamification_badges.tier ? 'text-emerald-700' : 'text-cyan-700'}`}>{eb.gamification_badges.name}</p>
          <p className="text-xs text-slate-600 leading-relaxed">{eb.gamification_badges.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

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
                <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm relative group cursor-default hover:scale-105 transition-all duration-300">
                  <Trophy className="h-8 w-8 text-amber-500 fill-amber-500 drop-shadow-sm group-hover:animate-[wiggle_1s_ease-in-out_infinite] transition-transform duration-300" strokeWidth={1.5} />
                  <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse drop-shadow-sm" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Level {level} Explorer</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-sm font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                      {scores.total_points || 0} Points
                    </span>
                    {globalRank > 0 && (
                      <span className="text-sm font-semibold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100" title="Points Rank">
                        <Star className="w-3.5 h-3.5 fill-slate-400 text-slate-400" />
                        Points Rank #{globalRank}
                      </span>
                    )}
                    {globalBadgeRank > 0 && (
                      <span className="text-sm font-semibold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100" title="Badge Rank">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        Badge Rank #{globalBadgeRank}
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
                    <Unlock className="w-5 h-5 text-amber-500" />
                    Unlocked Achievements
                  </h3>

                  {filteredEarnedBadges.length === 0 ? (
                    <div className="text-center p-8 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <Award className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-500 font-medium">No badges yet. Start participating to earn rewards!</p>
                    </div>
                  ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredEarnedBadges.map(eb => renderBadgeCard(eb))}
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
                            <div className="relative group bg-white border border-slate-100 border-dashed rounded-xl p-5 flex flex-col items-center text-center shadow-sm hover:border-slate-300 transition-colors cursor-help overflow-hidden h-full justify-between">
                                {item.badge.series_type === 'login' && (
                                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 z-20 group-hover:border-slate-200 transition-colors" title="Current Streak">
                                    <Flame className="w-3 h-3 text-slate-400 fill-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-500">{streak || 0} Streak</span>
                                  </div>
                                )}

                              <div className="flex flex-col items-center w-full flex-1 pt-2">

                                {item.badge.tier ? (
                                  <div className="mb-3 relative z-10 grayscale-[0.8] opacity-60 shrink-0">
                                    {renderShieldIcon(item.badge)}
                                  </div>
                                ) : (
                                  <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center border-2 border-slate-100 shadow-[0_0_15px_rgba(0,0,0,0.03)] mb-3 relative z-10 grayscale shrink-0">
                                    {item.badge.icon_url && item.badge.icon_url.startsWith('http') ? (
                                      <img src={item.badge.icon_url} alt="icon" className="w-7 h-7 object-contain opacity-40 drop-shadow-sm" />
                                    ) : (
                                      getBadgeIcon(item.badge.series_type, "w-7 h-7 text-slate-300 drop-shadow-sm")
                                    )}
                                  </div>
                                )}

                                <h4 className="font-bold text-slate-600 text-sm mb-1.5 relative z-10 line-clamp-2 leading-tight min-h-[36px] flex items-center justify-center w-full px-1 capitalize">
                                  <span>{item.badge.name} {item.badge.tier && <span className="capitalize text-slate-400 font-semibold">({item.badge.tier})</span>}</span>
                                </h4>
                                <p className="text-xs text-slate-400 line-clamp-2 relative z-10 leading-snug px-1 break-words w-full mb-4">{item.badge.description}</p>
                              </div>

                              <div className="w-full mt-auto pt-2 flex flex-col items-center shrink-0">
                                <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-slate-400 border-slate-200 font-bold px-2 py-0.5 rounded-md mb-2">Locked</Badge>

                                <div className="w-full min-h-[22px] flex items-center justify-center">
                                  {item.badge.category === 'common' || item.requiredScore === 0 ? (
                                    <div className="text-[9px] text-slate-400 font-semibold italic">
                                      Action Required
                                    </div>
                                  ) : (
                                    <div className="w-full">
                                      <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                                        <span>{item.percentComplete}%</span>
                                        <span>{item.currentScore}/{item.requiredScore}</span>
                                      </div>
                                      <Progress value={item.percentComplete} className="h-1 bg-slate-100 [&>div]:bg-slate-400" />
                                    </div>
                                  )}
                                </div>
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

