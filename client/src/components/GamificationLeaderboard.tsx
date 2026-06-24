import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Medal, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useGamification } from "@/contexts/GamificationContext";

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
      badge.tier === "gold" ? "from-yellow-400 to-amber-600" :
        badge.tier === "silver" ? "from-slate-300 to-slate-500" :
          badge.tier === "bronze" ? "from-orange-500 to-orange-800" : "from-cyan-400 to-teal-500";

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
  const { alumni } = useAuth();
  const { scores, globalRank } = useGamification();
  const myPoints: number = scores?.total_points || 0;
  const myFirstName = alumni?.first_name || "You";
  const myProfilePicture = (() => {
    if (alumni?.profile_picture && alumni.profile_picture.trim() !== '') return alumni.profile_picture;
    const seed = encodeURIComponent(`${alumni?.first_name || ''} ${alumni?.last_name || ''}`);
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
  })();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`/api/gamification/leaderboard?t=${Date.now()}`, {
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
      console.log("[GamificationLeaderboard] Socket triggered!");
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fetchLeaderboard, 500);
    };

    const handleNewNotification = ((event: CustomEvent) => {
      const notification = event.detail;
      if (notification && notification.type && notification.type.startsWith('gamification')) {
        console.log("[GamificationLeaderboard] Received gamification notification via Socket.IO, refreshing...");
        debouncedFetch();
      }
    }) as EventListener;

    window.addEventListener('new-notification', handleNewNotification);

    const channel = supabase
      .channel("gamification-leaderboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_scores" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges" }, debouncedFetch)
      .subscribe();

    return () => {
      window.removeEventListener('new-notification', handleNewNotification);
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-[14px] p-4" style={{ border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-[13px] font-semibold text-gray-900">Community Leaders</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-14" />
              </div>
              <Skeleton className="h-4 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (pointsLeaderboard.length === 0 && badgesLeaderboard.length === 0) return null;

  const renderUser = (user: any, idx: number, mode: "points" | "badges") => {
    const badges: any[] = user.uniqueBadges || user.topBadges || [];
    const previewBadges = badges.slice(0, 3);
    const isTopRank = idx === 0;
    const ringColors = ['border-amber-400', 'border-gray-300', 'border-orange-300', 'border-gray-200'];

    return (
      <div
        key={user.user_id}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors group ${isTopRank ? 'bg-amber-50/60' : 'hover:bg-gray-50'}`}
        style={isTopRank ? { border: '1px solid #fde68a' } : {}}
      >
        {/* Rank */}
        <div className="w-5 shrink-0 text-center">
          {idx === 0 ? <Medal className="w-4 h-4 mx-auto text-amber-500" /> :
            idx === 1 ? <Medal className="w-4 h-4 mx-auto text-slate-400" /> :
              idx === 2 ? <Medal className="w-4 h-4 mx-auto text-orange-400" /> :
                <span className="text-[11px] font-bold text-gray-400">#{idx + 1}</span>}
        </div>

        {/* Avatar */}
        <div className="relative shrink-0">
          <button type="button" onClick={() => setLocation(`/profile/${user.user_id}`)}>
            <Avatar className={`w-8 h-8 border-2 ${ringColors[idx] || 'border-gray-200'}`}>
              <AvatarImage src={user.profilePicture || ""} />
              <AvatarFallback className="bg-[#e6f5f0] text-[#008060] text-xs font-semibold">
                {user.firstName[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          </button>
          {isTopRank && <div className="absolute -top-2.5 -right-1.5 text-xs pointer-events-none">👑</div>}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            className="text-[13px] font-medium truncate text-left w-full hover:text-[#008060] transition-colors"
            onClick={() => setLocation(`/profile/${user.user_id}`)}
          >
            {user.firstName} {user.lastName}
          </button>
          {user.current_streak_days > 1 && (
            <span className="flex items-center text-orange-500 text-[10px]">
              <Flame className="w-2.5 h-2.5 fill-orange-500 mr-0.5" />{user.current_streak_days}d
            </span>
          )}
        </div>

        {/* Score */}
        {mode === "points" ? (
          <div className="shrink-0 text-right">
            <div className="text-[14px] font-bold" style={{ color: 'var(--brand-primary)' }}>{user.total_points}</div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wide">pts</div>
          </div>
        ) : (
          badges.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="shrink-0 flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    {previewBadges.map((b, i) => <ShieldIcon key={i} badge={b} size={14} />)}
                    {badges.length > 3 && <span className="text-[10px] font-bold text-gray-400">+{badges.length - 3}</span>}
                  </div>
                  <span className="text-[9px] font-bold text-amber-600">{badges.length} badge{badges.length !== 1 ? 's' : ''}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" className="w-64 p-0 shadow-2xl rounded-xl z-50 overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="bg-amber-50 px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid #fde68a' }}>
                  <Trophy className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">{user.firstName}'s Badges ({badges.length})</span>
                </div>
                <div className="flex flex-col divide-y max-h-[200px] overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                  {badges.map((b: any, i: number) => {
                    const tierText = b.tier === "platinum" ? "text-purple-600" : b.tier === "gold" ? "text-amber-600" : b.tier === "silver" ? "text-slate-500" : b.tier === "bronze" ? "text-orange-600" : "text-cyan-600";
                    return (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors">
                        <ShieldIcon badge={b} size={26} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[12px] text-gray-800 leading-tight">{b.name}</div>
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${tierText}`}>{b.tier || "Special"}</div>
                          {b.description && <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{b.description}</div>}
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
    <div className="bg-white rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
      <Tabs defaultValue="points" className="w-full">
        {/* Header */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-[13px] font-semibold text-gray-900">Community Leaders</span>
            </div>
            <TabsList className="h-7 p-0.5 rounded-full" style={{ background: 'var(--surface-subtle)' }}>
              <TabsTrigger value="points" className="text-[10px] px-2.5 h-6 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#008060] font-medium">Points</TabsTrigger>
              <TabsTrigger value="badges" className="text-[10px] px-2.5 h-6 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-600 font-medium">Badges</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Your standing strip */}
        {myPoints > 0 && (
          <div
            className="mx-3 my-2 px-3 py-2 rounded-xl flex items-center gap-2.5"
            style={{ background: 'linear-gradient(90deg, #e6f5f0 0%, #f0faf6 100%)', border: '1px solid rgba(0,128,96,0.15)' }}
          >
            <Avatar className="w-7 h-7 border-2 border-[#008060]/30 shrink-0">
              <AvatarImage src={myProfilePicture} alt="Your avatar" />
              <AvatarFallback className="bg-[#008060] text-white text-[10px] font-bold">
                {(alumni?.first_name?.[0] || '?')}{(alumni?.last_name?.[0] || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-700 truncate">Your standing</p>
              <p className="text-[11px] text-gray-500 truncate">{myFirstName}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[13px] font-bold" style={{ color: 'var(--brand-primary)' }}>{myPoints.toLocaleString()}</div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wide">#{globalRank > 0 ? globalRank : '—'}</div>
            </div>
          </div>
        )}

        <div className="p-2">
          <TabsContent value="points" className="m-0 border-0 outline-none space-y-0.5">
            {pointsLeaderboard.slice(0, 3).map((user, idx) => renderUser(user, idx, "points"))}
          </TabsContent>
          <TabsContent value="badges" className="m-0 border-0 outline-none space-y-0.5">
            {badgesLeaderboard.slice(0, 3).map((user, idx) => renderUser(user, idx, "badges"))}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
