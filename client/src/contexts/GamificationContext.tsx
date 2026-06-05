import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export interface BadgeRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  series_type: string;
  required_score: number;
  tier: string;
  icon_url: string;
}

export interface EarnedBadge {
  id: string;
  earned_at: string;
  is_featured: boolean;
  gamification_badges: BadgeRecord;
}

export interface ProgressRecord {
  badge: BadgeRecord;
  currentScore: number;
  requiredScore: number;
  remaining: number;
  percentComplete: number;
}

interface GamificationContextType {
  earnedBadges: EarnedBadge[];
  progress: ProgressRecord[];
  scores: any;
  globalRank: number;
  globalBadgeRank: number;
  loading: boolean;
  error: string;
  refreshGamification: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();

  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [scores, setScores] = useState<any>({});
  const [globalRank, setGlobalRank] = useState<number>(0);
  const [globalBadgeRank, setGlobalBadgeRank] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const prevScoresRef = useRef<any>(null);
  const prevBadgesCountRef = useRef<number>(0);

  const fetchGamificationProfile = async (showToasts = false) => {
    if (!userId) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/gamification/users/${userId}/profile?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "user-id": userId
        }
      });

      if (!res.ok) throw new Error("Failed to load gamification data");

      const data = await res.json();
      
      // Compare and Toast
      if (showToasts) {
        if (prevScoresRef.current && data.scores) {
          const oldPoints = prevScoresRef.current.total_points || 0;
          const newPoints = data.scores.total_points || 0;
          if (newPoints > oldPoints) {
            toast({
              title: "🎉 Points Earned!",
              description: `You just earned ${newPoints - oldPoints} points!`,
              variant: "default",
              className: "bg-emerald-50 border-emerald-200 text-emerald-800",
            });
          }
        }
        
        const oldBadgesCount = prevBadgesCountRef.current;
        const newBadgesCount = (data.earnedBadges || []).length;
        if (newBadgesCount > oldBadgesCount && oldBadgesCount > 0) {
           // Find the new badge
           const newBadge = data.earnedBadges[0]?.gamification_badges;
           if (newBadge) {
             toast({
               title: "🏆 New Badge Unlocked!",
               description: `You earned the ${newBadge.name} badge!`,
               variant: "default",
               className: "bg-amber-50 border-amber-200 text-amber-800",
             });
           }
        }
      }

      setEarnedBadges(data.earnedBadges || []);
      setProgress(data.progress || []);
      setScores(data.scores || {});
      setGlobalRank(data.globalRank || 0);
      setGlobalBadgeRank(data.globalBadgeRank || 0);
      
      prevScoresRef.current = data.scores || {};
      prevBadgesCountRef.current = (data.earnedBadges || []).length;

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading gamification data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchGamificationProfile(false);

      let timeoutId: NodeJS.Timeout;
      const debouncedFetch = () => {
        console.log("[GamificationContext] Socket triggered!");
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          fetchGamificationProfile(true);
        }, 500);
      };

      const handleNewNotification = ((event: CustomEvent) => {
        const notification = event.detail;
        if (notification && notification.type && notification.type.startsWith('gamification')) {
          console.log("[GamificationContext] Received gamification notification via Socket.IO, refreshing...");
          debouncedFetch();
        }
      }) as EventListener;

      window.addEventListener('new-notification', handleNewNotification);

      const channel = supabase
        .channel(`gamification-global-${userId}`)
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
        window.removeEventListener('new-notification', handleNewNotification);
        supabase.removeChannel(channel);
        clearTimeout(timeoutId);
      };
    } else {
      setEarnedBadges([]);
      setProgress([]);
      setScores({});
      setGlobalRank(0);
      setGlobalBadgeRank(0);
      setLoading(false);
    }
  }, [userId]);

  return (
    <GamificationContext.Provider
      value={{
        earnedBadges,
        progress,
        scores,
        globalRank,
        globalBadgeRank,
        loading,
        error,
        refreshGamification: () => fetchGamificationProfile(false)
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};
