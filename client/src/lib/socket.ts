import { io } from "socket.io-client";

// Create a singleton socket instance
// We don't auto-connect by default, we'll connect when we have a user ID
export const socket = io({
    path: "/socket.io",
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});
