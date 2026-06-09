import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeading } from "@/components/common/PageHeading";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Star, TrendingUp, Medal, Flame, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface LeaderboardUser {
  user_id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  total_points: number;
  badgesCount: number;
  current_streak_days: number;
  topBadges?: any[];
  uniqueBadges?: any[];
  badgeScore?: number;
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

export function LeaderboardPage() {
  const [pointsLeaderboard, setPointsLeaderboard] = useState<LeaderboardUser[]>([]);
  const [badgesLeaderboard, setBadgesLeaderboard] = useState<LeaderboardUser[]>([]);
  const [activeTab, setActiveTab] = useState<"points" | "badges">("points");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    document.title = "Leaderboard - TKS Alumni Portal";
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/gamification/leaderboard", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
        if (res.ok) {
          const data = await res.json();
          setPointsLeaderboard(data.pointsLeaderboard || []);
          setBadgesLeaderboard(data.badgesLeaderboard || []);
        }
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    } finally {
      setLoading(false);
    }
  };

  const activeLeaderboard = activeTab === "points" ? pointsLeaderboard : badgesLeaderboard;

  const filteredLeaderboard = activeLeaderboard.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-amber-400 bg-amber-50 border-amber-200";
      case 2: return "text-slate-400 bg-slate-50 border-slate-200";
      case 3: return "text-orange-400 bg-orange-50 border-orange-200";
      default: return "text-emerald-600 bg-emerald-50 border-emerald-100";
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-6 h-6 text-amber-500 fill-amber-500" />;
      case 2: return <Medal className="w-6 h-6 text-slate-400 fill-slate-400" />;
      case 3: return <Medal className="w-6 h-6 text-orange-500 fill-orange-500" />;
      default: return <span className="font-bold text-lg">{rank}</span>;
    }
  };

  return (
    <AppLayout currentPage="feed">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center p-4 bg-emerald-100 rounded-full mb-2">
            <Trophy className="w-10 h-10 text-emerald-600" />
          </div>
          <PageHeading firstWord="Hall of" secondWord="Fame" className="mb-0" />
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Discover the most active and inspiring members of our alumni community. Compete for the most points or collect the highest value badges!
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "points" | "badges")} className="w-full md:w-auto">
            <TabsList className="bg-slate-100/50 p-1 rounded-xl w-full md:w-auto grid grid-cols-2">
              <TabsTrigger value="points" className="rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
                <Flame className="w-4 h-4 mr-2" /> Top Earners (XP)
              </TabsTrigger>
              <TabsTrigger value="badges" className="rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">
                <Trophy className="w-4 h-4 mr-2" /> Prestige Board (Badges)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search alumni..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200 rounded-xl h-10 focus-visible:ring-emerald-500"
            />
          </div>
        </div>

        {/* Top 3 Podium (Desktop only) */}
        {!loading && filteredLeaderboard.length >= 3 && (
          <div className="hidden md:flex items-end justify-center gap-6 mt-12 mb-16 pt-12">
            {/* 2nd Place */}
            <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-100">
              <div className="relative mb-4">
                <Avatar className="w-20 h-20 border-4 border-slate-300 shadow-lg shadow-slate-200">
                  <AvatarImage src={filteredLeaderboard[1]?.profilePicture || ''} />
                  <AvatarFallback className="bg-slate-100 text-slate-600 text-2xl font-bold">{filteredLeaderboard[1]?.firstName[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-3 -right-3 bg-slate-100 border-2 border-white w-8 h-8 rounded-full flex items-center justify-center font-black text-slate-600 text-sm shadow-sm">2</div>
              </div>
              <h3 className="font-bold text-slate-700">{filteredLeaderboard[1]?.firstName}</h3>
              {activeTab === "points" ? (
                <p className="text-sm font-semibold text-emerald-600">{filteredLeaderboard[1]?.total_points} XP</p>
              ) : (
                <p className="text-sm font-semibold text-amber-600 flex items-center gap-1"><Trophy className="w-3.5 h-3.5"/> {(filteredLeaderboard[1] as any)?.badgeScore} Val</p>
              )}
              <div className="w-24 h-32 bg-gradient-to-t from-slate-100 to-transparent mt-4 rounded-t-xl" />
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center animate-in slide-in-from-bottom-12 duration-700 z-10">
              <Trophy className="w-12 h-12 text-amber-400 fill-amber-400 mb-2 drop-shadow-md animate-bounce" style={{ animationDuration: '3s' }} />
              <div className="relative mb-4">
                <Avatar className="w-28 h-28 border-4 border-amber-400 shadow-xl shadow-amber-200/50 ring-4 ring-amber-50">
                  <AvatarImage src={filteredLeaderboard[0]?.profilePicture || ''} />
                  <AvatarFallback className="bg-amber-50 text-amber-600 text-4xl font-bold">{filteredLeaderboard[0]?.firstName[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-4 -right-4 bg-gradient-to-br from-amber-300 to-amber-500 border-2 border-white w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-md">1</div>
              </div>
              <h3 className="font-black text-lg text-slate-800">{filteredLeaderboard[0]?.firstName} {filteredLeaderboard[0]?.lastName}</h3>
              {activeTab === "points" ? (
                <p className="text-base font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-2 border border-emerald-100 shadow-sm">{filteredLeaderboard[0]?.total_points} XP</p>
              ) : (
                <p className="text-base font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full mt-2 border border-amber-100 shadow-sm flex items-center gap-1"><Trophy className="w-4 h-4"/> {(filteredLeaderboard[0] as any)?.badgeScore} Value</p>
              )}
              <div className="w-32 h-40 bg-gradient-to-t from-amber-50 to-transparent mt-6 rounded-t-xl" />
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-200">
              <div className="relative mb-4">
                <Avatar className="w-20 h-20 border-4 border-orange-300 shadow-lg shadow-orange-200/50">
                  <AvatarImage src={filteredLeaderboard[2]?.profilePicture || ''} />
                  <AvatarFallback className="bg-orange-50 text-orange-600 text-2xl font-bold">{filteredLeaderboard[2]?.firstName[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-3 -right-3 bg-orange-100 border-2 border-white w-8 h-8 rounded-full flex items-center justify-center font-black text-orange-600 text-sm shadow-sm">3</div>
              </div>
              <h3 className="font-bold text-slate-700">{filteredLeaderboard[2]?.firstName}</h3>
              {activeTab === "points" ? (
                <p className="text-sm font-semibold text-emerald-600">{filteredLeaderboard[2]?.total_points} XP</p>
              ) : (
                <p className="text-sm font-semibold text-amber-600 flex items-center gap-1"><Trophy className="w-3.5 h-3.5"/> {(filteredLeaderboard[2] as any)?.badgeScore} Val</p>
              )}
              <div className="w-24 h-24 bg-gradient-to-t from-orange-50 to-transparent mt-4 rounded-t-xl" />
            </div>
          </div>
        )}

        {/* List View */}
        <Card className="border-0 shadow-xl shadow-slate-200/40 rounded-2xl overflow-hidden bg-white/50 backdrop-blur-xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredLeaderboard.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Trophy className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p>No alumni found matching your search.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {filteredLeaderboard.map((user, idx) => {
                  const rank = idx + 1;
                  return (
                    <div 
                      key={user.user_id} 
                      className={`group flex items-center gap-4 p-4 sm:p-5 hover:bg-white transition-colors duration-200 ${rank <= 3 ? 'bg-white/80' : ''}`}
                    >
                      <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-transform duration-300 group-hover:scale-110 ${getRankColor(rank)}`}>
                        {getRankIcon(rank)}
                      </div>
                      
                      <Avatar className="w-12 sm:w-14 h-12 sm:h-14 border-2 border-white shadow-sm shrink-0">
                        <AvatarImage src={user.profilePicture || ''} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">{user.firstName[0]}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate group-hover:text-emerald-600 transition-colors">
                          {user.firstName} {user.lastName}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-slate-500">
                          {activeTab === "points" ? (
                            <span className="flex items-center gap-1 font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                              <Star className="w-3.5 h-3.5" /> {user.total_points} XP
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100">
                              <Trophy className="w-3.5 h-3.5" /> {(user as any).badgeScore} Value
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Flame className={`w-3.5 h-3.5 ${user.current_streak_days > 0 ? 'text-orange-500 fill-orange-500' : 'text-slate-300'}`} />
                            {user.current_streak_days} Day Streak
                          </span>
                        </div>
                      </div>
                      
                      {/* Badges Preview */}
                      {(() => {
                        const badges = user.uniqueBadges || user.topBadges || [];
                        const previewBadges = badges.slice(0, 3);
                        return badges.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="hidden sm:flex items-center gap-1 border-l pl-4 border-slate-100 hover:opacity-80 transition-opacity cursor-pointer text-left"
                              >
                                <div className="flex -space-x-1.5">
                                  {previewBadges.map((badge: any, i: number) => (
                                    <div key={i} className="relative z-10 hover:z-20 hover:-translate-y-0.5 transition-transform">
                                      <ShieldIcon badge={badge} size={18} />
                                    </div>
                                  ))}
                                  {badges.length > 3 && (
                                    <div className="w-5 h-5.5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center shadow-sm relative z-10 text-[9px] font-bold text-slate-500">
                                      +{badges.length - 3}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-slate-400 ml-2">
                                  {badges.length} {badges.length === 1 ? 'Badge' : 'Badges'}
                                </span>
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
                                      <ShieldIcon badge={b} size={24} />
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
                        ) : (
                          <div className="hidden sm:flex items-center gap-1 border-l pl-4 border-slate-100 text-slate-300">
                            <span className="text-xs font-medium italic">No Badges</span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
