import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

interface LeaderboardEntry {
  user_id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  graduationYear: string | null;
  total_points: number;
  thread_score: number;
  event_score: number;
  connection_score: number;
  current_streak_days: number;
  badgesCount?: number;
}

export function GamificationLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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
          setLeaderboard(data.leaderboard || []);
        }
      } catch (err) {
        console.error("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();

    const channel = supabase
      .channel('gamification-leaderboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_scores' },
        () => { fetchLeaderboard(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_badges' },
        () => { fetchLeaderboard(); }
      )
      .subscribe();

    return () => {
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
          {[1,2,3].map(i => (
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

  if (leaderboard.length === 0) return null;

  return (
    <Card className="shadow-sm bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/10 dark:to-slate-950 border-amber-100 dark:border-amber-900/30">
      <CardHeader className="pb-3 pt-4 px-4 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
        <CardTitle className="text-sm font-bold flex items-center justify-between text-amber-900 dark:text-amber-500">
          <span className="flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Top Alumni
          </span>
          <span className="text-xs font-normal text-amber-700/70 dark:text-amber-500/70">
            This Month
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-amber-100/50 dark:divide-amber-900/20">
          {leaderboard.slice(0, 5).map((user, idx) => (
            <div 
              key={user.user_id} 
              className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group"
              onClick={() => setLocation(`/profile/${user.user_id}`)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative font-bold text-lg w-6 text-center text-slate-400 group-hover:text-amber-500">
                  {idx === 0 ? <Medal className="w-5 h-5 mx-auto text-amber-500" /> : 
                   idx === 1 ? <Medal className="w-5 h-5 mx-auto text-slate-400" /> : 
                   idx === 2 ? <Medal className="w-5 h-5 mx-auto text-orange-400" /> : 
                   `#${idx + 1}`}
                </div>
                <Avatar className="w-9 h-9 border-2 border-white dark:border-slate-800 shadow-sm">
                  <AvatarImage src={user.profilePicture || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user.firstName[0]}{user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>{user.graduationYear || 'Alumni'}</span>
                    {user.current_streak_days > 1 && (
                      <span className="flex items-center text-orange-500" title={`${user.current_streak_days} day streak`}>
                        <Flame className="w-3 h-3 ml-1 fill-orange-500" /> {user.current_streak_days}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end shrink-0 ml-2">
                <div className="text-right">
                  <div className="text-sm font-bold text-primary">{user.total_points}</div>
                  <div className="text-[10px] leading-none text-muted-foreground uppercase tracking-wider">pts</div>
                </div>
                {user.badgesCount !== undefined && user.badgesCount > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded text-[10px] font-bold" title={`${user.badgesCount} Badges Earned`}>
                    <Trophy className="w-3 h-3" />
                    <span>{user.badgesCount}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
