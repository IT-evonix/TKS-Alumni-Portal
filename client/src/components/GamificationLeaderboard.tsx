import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Medal, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

interface LeaderboardEntry {
  user_id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  graduationYear: string | null;
  total_points: number;
  current_streak_days: number;
  badgesCount?: number;
  badgeScore?: number;
  topBadges?: any[];
  uniqueBadges?: any[];
}

// Small shield icon component  
function ShieldIcon({ badge, size = 16 }: { badge: any; size?: number }) {
  const tierGradient =
    badge.tier === "platinum" ? "from-purple-400 to-purple-700" :
    badge.tier === "gold"     ? "from-yellow-400 to-amber-600" :
    badge.tier === "silver"   ? "from-slate-300 to-slate-500" :
    badge.tier === "bronze"   ? "from-orange-500 to-orange-800" : "from-primary/60 to-primary";

  return (
    <div
      className="relative shrink-0 flex items-center justify-center drop-shadow-sm"
      style={{ width: size, height: size * 1.14 }}
      title={`${badge.name} (${badge.tier})`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-b ${tierGradient}`}
        style={{ clipPath: "polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)" }}
      />
      <div
        className="absolute inset-[2px] flex items-center justify-center"
        style={{ clipPath: "polygon(10% 0, 90% 0, 100% 15%, 100% 75%, 50% 100%, 0 75%, 0 15%)" }}
      >
        {badge.icon_url && !badge.icon_url.startsWith("http") ? (
          <span className="text-white leading-none" style={{ fontSize: size * 0.45 }}>{badge.icon_url}</span>
        ) : badge.icon_url ? (
          <img src={badge.icon_url} alt="" style={{ width: size * 0.55, height: size * 0.55, objectFit: "contain" }} />
        ) : (
          <Trophy className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
        )}
      </div>
    </div>
  );
}

export function GamificationLeaderboard() {
  const [pointsLeaderboard, setPointsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [badgesLeaderboard, setBadgesLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/gamification/leaderboard", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPointsLeaderboard(data.pointsLeaderboard || []);
          setBadgesLeaderboard(data.badgesLeaderboard || []);
        }
      } catch (err) {
        console.error("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();

    let timeoutId: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fetchLeaderboard, 500);
    };

    const channel = supabase
      .channel("gamification-leaderboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_scores" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges" }, debouncedFetch)
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (pointsLeaderboard.length === 0 && badgesLeaderboard.length === 0) return null;

  const renderUser = (user: any, idx: number, mode: "points" | "badges") => {
    const badges: any[] = user.uniqueBadges || user.topBadges || [];
    const previewBadges = badges.slice(0, 3);

    return (
      <div
        key={user.user_id}
        className="flex items-center gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
      >
        {/* Rank */}
        <div className="relative font-bold text-lg w-5 shrink-0 text-center text-slate-400 group-hover:text-amber-500">
          {idx === 0 ? <Medal className="w-5 h-5 mx-auto text-amber-500" /> :
           idx === 1 ? <Medal className="w-5 h-5 mx-auto text-slate-400" /> :
           idx === 2 ? <Medal className="w-5 h-5 mx-auto text-orange-400" /> :
           <span className="text-xs">#{idx + 1}</span>}
        </div>

        {/* Avatar */}
        <div className="relative shrink-0">
          <button
            type="button"
            className="shrink-0 cursor-pointer block"
            onClick={() => setLocation(`/profile/${user.user_id}`)}
          >
            <Avatar className={`w-8 h-8 border-2 shadow-sm ${idx === 0 ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-white dark:border-slate-800'}`}>
              <AvatarImage src={user.profilePicture || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {user.firstName[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          </button>
          {idx === 0 && (
            <div className="absolute -top-3 -right-2 text-sm drop-shadow-md z-10 pointer-events-none" title="Top Ranker">
              👑
            </div>
          )}
        </div>
        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            className="text-sm font-medium truncate text-left w-full hover:text-emerald-600 transition-colors cursor-pointer"
            onClick={() => setLocation(`/profile/${user.user_id}`)}
          >
            {user.firstName} {user.lastName}
          </button>
          <div className="flex items-center gap-1 mt-0.5">
            {/* Streak only in meta row */}
            {user.current_streak_days > 1 && (
              <span className="flex items-center text-orange-500 text-[10px]" title={`${user.current_streak_days} day streak`}>
                <Flame className="w-3 h-3 fill-orange-500 mr-0.5" />{user.current_streak_days}
              </span>
            )}
          </div>
        </div>

        {/* Right column — pts for points mode, badge shields for badges mode */}
        {mode === "points" ? (
          <div className="shrink-0 text-right">
            <div className="text-sm font-bold text-primary">{user.total_points}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">pts</div>
          </div>
        ) : (
          badges.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity cursor-pointer"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-0.5">
                    {previewBadges.map((b, i) => (
                      <ShieldIcon key={i} badge={b} size={15} />
                    ))}
                    {badges.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-400">+{badges.length - 3}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-amber-600">{badges.length} badge{badges.length !== 1 ? 's' : ''}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" className="w-64 p-0 shadow-2xl border-slate-200/60 dark:border-slate-800 overflow-hidden rounded-xl z-50">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 px-3 py-2 border-b border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                    {user.firstName}'s Badges ({badges.length})
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[200px] overflow-y-auto">
                  {badges.map((b: any, i: number) => {
                    const tierText =
                      b.tier === "platinum" ? "text-purple-600 dark:text-purple-400" :
                      b.tier === "gold"     ? "text-amber-600 dark:text-amber-400" :
                      b.tier === "silver"   ? "text-slate-500 dark:text-slate-400" :
                      b.tier === "bronze"   ? "text-orange-600 dark:text-orange-400" : "text-primary";
                    return (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <ShieldIcon badge={b} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[12px] text-slate-800 dark:text-slate-100 leading-tight">{b.name}</div>
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${tierText}`}>{b.tier || "Special"}</div>
                          {b.description && (
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{b.description}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          ) : null
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-sm bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/10 dark:to-slate-950 border-amber-100 dark:border-amber-900/30">
      <Tabs defaultValue="points" className="w-full">
        <CardHeader className="pb-3 pt-4 px-4 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center text-amber-900 dark:text-amber-500">
              <Trophy className="w-4 h-4 mr-2" /> Top Alumni
            </CardTitle>
            <TabsList className="h-7 bg-amber-100/50 dark:bg-amber-900/30">
              <TabsTrigger value="points" className="text-[10px] px-2 py-0.5 h-auto data-[state=active]:bg-white data-[state=active]:text-emerald-600">Points</TabsTrigger>
              <TabsTrigger value="badges" className="text-[10px] px-2 py-0.5 h-auto data-[state=active]:bg-white data-[state=active]:text-amber-600">Badges</TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TabsContent value="points" className="m-0 border-0 outline-none">
            <div className="divide-y divide-amber-100/50 dark:divide-amber-900/20">
              {pointsLeaderboard.slice(0, 4).map((user, idx) => renderUser(user, idx, "points"))}
            </div>
          </TabsContent>
          <TabsContent value="badges" className="m-0 border-0 outline-none">
            <div className="divide-y divide-amber-100/50 dark:divide-amber-900/20">
              {badgesLeaderboard.slice(0, 4).map((user, idx) => renderUser(user, idx, "badges"))}
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
