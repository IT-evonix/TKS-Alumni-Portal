/**
 * React Query Hooks
 * Pre-configured hooks for common data fetching patterns
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

const FEED_PAGE_SIZE = 20;

function authHeaders(): Record<string, string> {
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('auth_token');
  return {
    'user-id': userId || '',
    Authorization: `Bearer ${token || ''}`,
  };
}

/**
 * Generic query hook with default options
 */
export function useAppQuery<TData = unknown, TError = Error>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for fetching posts
 */
export function usePosts(options?: { limit?: number; offset?: number }) {
  return useAppQuery(
    ['posts', options?.limit, options?.offset],
    async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/posts?${params}`, {
        headers: {
          'user-id': userId || '',
          'Authorization': `Bearer ${token || ''}`
        },
      });
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      return data.posts || [];
    },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes for posts
    }
  );
}

/**
 * Hook for fetching feed posts with real server-side infinite scroll
 * (each page is a genuine offset-paginated request, not a client-side slice).
 */
export function usePostsInfinite(searchTerm?: string) {
  return useInfiniteQuery({
    queryKey: ['posts', 'infinite', searchTerm ?? null],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: String(FEED_PAGE_SIZE),
        offset: String(pageParam),
      });
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/posts?${params}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json() as Promise<{
        posts: any[];
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
      }>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.posts.length : undefined,
    staleTime: 20 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for posting a comment with an optimistic update: the comment appears
 * immediately in ['comments', postId] and is reconciled with the server
 * response instead of triggering a full refetch.
 */
export function usePostComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to post comment');
      }
      return response.json();
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });
      const previousComments = queryClient.getQueryData(['comments', postId]);
      const userId = localStorage.getItem('userId') || '';
      const tempId = `temp-${Date.now()}`;

      const optimisticComment = {
        id: tempId,
        content,
        created_at: new Date().toISOString(),
        replies_count: 0,
        user: { id: userId, username: '', email: '' },
        _optimistic: true,
      };

      queryClient.setQueryData(['comments', postId], (old: any) => ({
        comments: [...(old?.comments || []), optimisticComment],
      }));

      return { previousComments, tempId };
    },
    onSuccess: (data, _content, context) => {
      queryClient.setQueryData(['comments', postId], (old: any) => ({
        comments: (old?.comments || []).map((c: any) =>
          c.id === context?.tempId ? data.comment : c,
        ),
      }));
    },
    onError: (_err, _content, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
    },
  });
}

/**
 * Hook for fetching notifications
 */
export function useNotifications(options?: { limit?: number; unreadOnly?: boolean }) {
  return useAppQuery(
    ['notifications', options?.limit, options?.unreadOnly],
    async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.unreadOnly) params.append('unreadOnly', 'true');

      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/notifications?${params}`, {
        headers: {
          'user-id': userId || '',
          'Authorization': `Bearer ${token || ''}`
        },
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      return data.notifications || [];
    },
    {
      staleTime: 1 * 60 * 1000, // 1 minute for notifications
      refetchInterval: 30 * 1000, // Refetch every 30 seconds
    }
  );
}

/**
 * Hook for fetching messages
 */
export function useMessages() {
  return useAppQuery(
    ['messages'],
    async () => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messages', {
        headers: {
          'user-id': userId || '',
          'Authorization': `Bearer ${token || ''}`
        },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.messages || [];
    },
    {
      staleTime: 30 * 1000, // 30 seconds for messages
    }
  );
}

/**
 * Hook for creating a post
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { content: string; imageUrl?: string }) => {
      const userId = localStorage.getItem('userId');
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || '',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create post');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate posts query to refetch
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

/**
 * Hook for liking a post
 */
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'user-id': userId || '',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
      });
      if (!response.ok) throw new Error('Failed to like post');
      return response.json();
    },
    onMutate: async (postId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const previousPosts = queryClient.getQueryData(['posts']);

      queryClient.setQueryData(['posts'], (old: any[]) => {
        if (!old) return old;
        return old.map((post) =>
          post.id === postId
            ? {
              ...post,
              likes_count: (post.likes_count || 0) + 1,
              isLikedByUser: true,
            }
            : post
        );
      });

      return { previousPosts };
    },
    onError: (err, postId, context) => {
      // Rollback on error
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

/**
 * Hook for sending a message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { receiverId: string; content: string; subject?: string }) => {
      const userId = localStorage.getItem('userId');
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || '',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

/**
 * Prefetch query data
 */
export function prefetchQuery<TData = unknown>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>
) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000,
  });
}
