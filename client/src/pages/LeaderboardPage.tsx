import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Star, TrendingUp, Medal, Flame, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface LeaderboardUser {
  user_id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  total_points: number;
  badgesCount: number;
  current_streak_days: number;
  topBadges?: any[];
}

export function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
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
        // Since backend only returns top 5, we use what we get. If we want more, backend needs an update.
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaderboard = leaderboard.filter(u => 
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
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            Hall of Fame
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Discover the most active and inspiring members of our alumni community. Earn points, unlock badges, and climb the ranks!
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <Tabs defaultValue="all-time" className="w-full md:w-auto">
            <TabsList className="bg-slate-100/50 p-1 rounded-xl w-full md:w-auto grid grid-cols-3">
              <TabsTrigger value="weekly" className="rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">Monthly</TabsTrigger>
              <TabsTrigger value="all-time" className="rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">All Time</TabsTrigger>
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
              <p className="text-sm font-semibold text-emerald-600">{filteredLeaderboard[1]?.total_points} XP</p>
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
              <p className="text-base font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-2 border border-emerald-100 shadow-sm">{filteredLeaderboard[0]?.total_points} XP</p>
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
              <p className="text-sm font-semibold text-emerald-600">{filteredLeaderboard[2]?.total_points} XP</p>
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
                          <span className="flex items-center gap-1 font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                            <Star className="w-3.5 h-3.5" /> {user.total_points} XP
                          </span>
                          <span className="flex items-center gap-1">
                            <Flame className={`w-3.5 h-3.5 ${user.current_streak_days > 0 ? 'text-orange-500 fill-orange-500' : 'text-slate-300'}`} />
                            {user.current_streak_days} Day Streak
                          </span>
                        </div>
                      </div>
                      
                      {/* Badges Preview */}
                      <div className="hidden sm:flex items-center gap-1 border-l pl-4 border-slate-100">
                        <div className="flex -space-x-2">
                          {user.topBadges && user.topBadges.length > 0 ? user.topBadges.map((badge, i) => (
                            <div key={i} className="w-8 h-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center shadow-sm relative z-10 hover:z-20 hover:-translate-y-1 transition-transform" title={badge.name}>
                              {badge.icon_url && badge.icon_url.startsWith('http') ? (
                                <img src={badge.icon_url} alt="" className="w-4 h-4 object-contain" />
                              ) : (
                                <Star className="w-4 h-4 text-emerald-500" />
                              )}
                            </div>
                          )) : (
                            <div className="w-8 h-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center shadow-sm">
                              <Star className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-400 ml-2">
                          {user.badgesCount} {user.badgesCount === 1 ? 'Badge' : 'Badges'}
                        </span>
                      </div>
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
