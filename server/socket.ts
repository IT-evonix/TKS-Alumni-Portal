
import { Server } from "socket.io";
import { supabase } from "./supabase";
import { log } from "./vite";

export const connectedUsers = new Map<string, string>();

export function setupSocketIO(io: Server) {
  io.on("connection", async (socket) => {
    log(`[Socket.IO] Client connected: ${socket.id}`);

    const userId = socket.handshake.auth?.token;
    if (userId) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (user) {
        log(`[Socket.IO] User authenticated: ${userId}`);
        socket.data.userId = userId;
        connectedUsers.set(userId, socket.id);
        socket.join(`user:${userId}`);
      } else {
        log(`[Socket.IO] Invalid user ID: ${userId}`);
        socket.disconnect();
        return;
      }
    }

    socket.on("authenticate", async (authUserId: string) => {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (user) {
        log(`[Socket.IO] User re-authenticated: ${authUserId}`);
        socket.data.userId = authUserId;
        connectedUsers.set(authUserId, socket.id);
        socket.join(`user:${authUserId}`);
      } else {
        log(`[Socket.IO] Invalid authentication attempt: ${authUserId}`);
        socket.disconnect();
      }
    });

    socket.on("disconnect", () => {
      log(`[Socket.IO] Client disconnected: ${socket.id}`);
      if (socket.data.userId) {
        connectedUsers.delete(socket.data.userId);
      }
    });
  });

  return { io, connectedUsers };
}
