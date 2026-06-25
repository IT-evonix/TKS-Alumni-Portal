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

export function useTravelPostBookmark(postId: string) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}/bookmark`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to toggle bookmark");
      return res.json() as Promise<{ bookmarked: boolean; bookmarks_count: number }>;
    },
    onMutate: async () => {
      if (inFlight.current) throw new Error("In flight");
      inFlight.current = true;

      await queryClient.cancelQueries({ queryKey: ["travel-posts"] });
      await queryClient.cancelQueries({ queryKey: ["travel-post", postId] });
      await queryClient.cancelQueries({ queryKey: ["travel-bookmarks"] });

      const snapshot = {
        feed: queryClient.getQueryData(["travel-posts"]),
        detail: queryClient.getQueryData(["travel-post", postId]),
      };

      const updatePost = (p: any) => {
        if (p.id !== postId) return p;
        const bookmarked = !p.viewer_has_bookmarked;
        return { ...p, viewer_has_bookmarked: bookmarked, bookmarks_count: Math.max(0, p.bookmarks_count + (bookmarked ? 1 : -1)) };
      };

      queryClient.setQueriesData({ queryKey: ["travel-posts"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map(updatePost);
        if (old?.posts) return { ...old, posts: old.posts.map(updatePost) };
        return old;
      });

      queryClient.setQueryData(["travel-post", postId], (old: any) => {
        if (!old) return old;
        const bookmarked = !old.viewer_has_bookmarked;
        return { ...old, viewer_has_bookmarked: bookmarked, bookmarks_count: Math.max(0, old.bookmarks_count + (bookmarked ? 1 : -1)) };
      });

      return snapshot;
    },
    onError: (_err, _vars, context: any) => {
      if (context?.feed !== undefined) queryClient.setQueriesData({ queryKey: ["travel-posts"] }, context.feed);
      if (context?.detail !== undefined) queryClient.setQueryData(["travel-post", postId], context.detail);
    },
    onSettled: () => {
      inFlight.current = false;
      queryClient.invalidateQueries({ queryKey: ["travel-bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["travel-post", postId] });
    },
  });

  return mutation;
}
