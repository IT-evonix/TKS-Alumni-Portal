import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientConfig } from "@/lib/config";

function getHeaders() {
  const token = localStorage.getItem("auth_token") || "";
  return {
    "Content-Type": "application/json",
    "user-id": localStorage.getItem("userId") || "",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useTravelPostLike(postId: string) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}/like`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to toggle like");
      return res.json() as Promise<{ liked: boolean; likes_count: number }>;
    },
    onMutate: async () => {
      if (inFlight.current) throw new Error("In flight");
      inFlight.current = true;

      await queryClient.cancelQueries({ queryKey: ["travel-posts"] });
      await queryClient.cancelQueries({ queryKey: ["travel-post", postId] });

      const snapshot = {
        feed: queryClient.getQueryData(["travel-posts"]),
        detail: queryClient.getQueryData(["travel-post", postId]),
      };

      // Optimistic update in feed cache
      queryClient.setQueriesData({ queryKey: ["travel-posts"] }, (old: any) => {
        if (!old) return old;
        const updatePost = (p: any) => {
          if (p.id !== postId) return p;
          const liked = !p.viewer_has_liked;
          return { ...p, viewer_has_liked: liked, likes_count: Math.max(0, p.likes_count + (liked ? 1 : -1)) };
        };
        if (Array.isArray(old)) return old.map(updatePost);
        if (old?.posts) return { ...old, posts: old.posts.map(updatePost) };
        return old;
      });

      // Optimistic update in detail cache
      queryClient.setQueryData(["travel-post", postId], (old: any) => {
        if (!old) return old;
        const liked = !old.viewer_has_liked;
        return { ...old, viewer_has_liked: liked, likes_count: Math.max(0, old.likes_count + (liked ? 1 : -1)) };
      });

      return snapshot;
    },
    onError: (_err, _vars, context: any) => {
      if (context?.feed !== undefined) queryClient.setQueriesData({ queryKey: ["travel-posts"] }, context.feed);
      if (context?.detail !== undefined) queryClient.setQueryData(["travel-post", postId], context.detail);
    },
    onSettled: () => {
      inFlight.current = false;
      queryClient.invalidateQueries({ queryKey: ["travel-post", postId] });
    },
  });

  return mutation;
}
