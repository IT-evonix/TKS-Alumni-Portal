/**
 * Real-time Updates Hook
 * Listens to Socket.IO events for real-time updates across the app
 */

import { useEffect, useCallback } from 'react';
import { socket } from '@/lib/socket';

export interface RealtimeUpdateHandlers {
  onPostLike?: (data: { postId: string; likesCount: number; isLiked: boolean; userId: string }) => void;
  onPostComment?: (data: { postId: string; commentId: string; comment: any; userId: string }) => void;
  onPostUpdated?: (data: { postId: string; content: string }) => void;
  onCommentReply?: (data: { commentId: string; replyId: string; reply: any }) => void;
  onNewPost?: (data: { post: any }) => void;
  onPostDeleted?: (data: { postId: string }) => void;
  onMessageReceived?: (data: { message: any }) => void;
}

/**
 * Hook to listen for real-time updates via Socket.IO
 */
export function useRealtimeUpdates(handlers: RealtimeUpdateHandlers) {
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    // Post like updates
    if (handlers.onPostLike) {
      const handlePostLike = (data: any) => {
        handlers.onPostLike?.(data);
      };
      socket.on('post_like', handlePostLike);
    }

    // Post comment updates
    if (handlers.onPostComment) {
      const handlePostComment = (data: any) => {
        handlers.onPostComment?.(data);
      };
      socket.on('post_comment', handlePostComment);
    }

    // Post updated
    if (handlers.onPostUpdated) {
      const handlePostUpdated = (data: any) => {
        handlers.onPostUpdated?.(data);
      };
      socket.on('post_updated', handlePostUpdated);
    }

    // Comment reply
    if (handlers.onCommentReply) {
      const handleCommentReply = (data: any) => {
        handlers.onCommentReply?.(data);
      };
      socket.on('comment_reply', handleCommentReply);
    }

    // New post
    if (handlers.onNewPost) {
      const handleNewPost = (data: any) => {
        handlers.onNewPost?.(data);
      };
      socket.on('new_post', handleNewPost);
    }

    // Post deleted
    if (handlers.onPostDeleted) {
      const handlePostDeleted = (data: any) => {
        handlers.onPostDeleted?.(data);
      };
      socket.on('post_deleted', handlePostDeleted);
    }

    // New message
    if (handlers.onMessageReceived) {
      const handleMessageReceived = (data: any) => {
        handlers.onMessageReceived?.(data);
      };
      socket.on('new_message', handleMessageReceived);
    }

    return () => {
      // Cleanup listeners
      if (handlers.onPostLike) socket.off('post_like');
      if (handlers.onPostComment) socket.off('post_comment');
      if (handlers.onPostUpdated) socket.off('post_updated');
      if (handlers.onCommentReply) socket.off('comment_reply');
      if (handlers.onNewPost) socket.off('new_post');
      if (handlers.onPostDeleted) socket.off('post_deleted');
      if (handlers.onMessageReceived) socket.off('new_message');
    };
  }, [handlers]);
}

/**
 * Emit real-time update event (for local updates that should sync to other clients)
 */
export function emitRealtimeUpdate(event: string, data: any) {
  if (socket.connected) {
    socket.emit(event, data);
  }
}
