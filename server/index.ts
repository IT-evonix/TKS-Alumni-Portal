import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerNotificationEnhancementRoutes } from "./routes/notification-enhancements-routes";
import { registerPerformanceAnalyticsRoutes } from "./routes/performance-analytics-routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import { Server } from "socket.io";
import { supabase, checkSupabaseConnection } from "./supabase";
import { initializeScheduler } from "./scheduler";
import { config } from "./config";
import { initializeDb } from "./db";

const app = express();

// Trust Plesk/nginx reverse proxy so req.protocol and req.ip are correct
app.set('trust proxy', 1);

// Redirect www. to canonical domain (SSL cert only covers non-www)
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    const canonicalHost = host.replace(/^www\./, '');
    return res.redirect(301, `${req.protocol}://${canonicalHost}${req.originalUrl}`);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Graceful shutdown handler
function setupGracefulShutdown(httpServer: any) {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      httpServer.close(() => {
        console.log('✅ HTTP server closed');
      });

      // Give ongoing requests 10s to complete
      setTimeout(() => {
        console.log('⏱️ Forcing shutdown after timeout');
        process.exit(0);
      }, 10000);
    });
  });
}

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
  // Don't exit in production, log and continue
  if (config.nodeEnv !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Exit on uncaught exceptions
  process.exit(1);
});

// Main startup function
(async () => {
  try {
    console.log('🚀 Starting TKS Alumni Portal...');
    console.log(`📍 Environment: ${config.nodeEnv}`);
    console.log(`🔌 Port: ${config.port}`);

    // Step 1: Initialize database
    console.log('\n1️⃣ Initializing database...');
    await initializeDb();

    // Step 2: Verify Supabase connection
    console.log('\n2️⃣ Verifying Supabase connection...');
    const supabaseOk = await checkSupabaseConnection();
    if (!supabaseOk) {
      console.warn('⚠️ WARNING: Supabase connection check failed');
      console.warn('Some features may not work correctly');
    } else {
      console.log('✅ Supabase connected');
    }

    // Step 3: Register routes
    console.log('\n3️⃣ Registering routes...');
    const httpServer = await registerRoutes(app);
    registerNotificationEnhancementRoutes(app);
    registerPerformanceAnalyticsRoutes(app);

    // Step 4: Setup Vite or static serving
    console.log('\n4️⃣ Setting up frontend serving...');
    if (config.nodeEnv === "development") {
      await setupVite(app, httpServer);
      console.log('✅ Vite dev server ready');
    } else {
      serveStatic(app);
      console.log('✅ Static files configured');
    }

    // Global error handler — must be registered after all routes and middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error('❌ Unhandled error:', {
        status,
        message,
        stack: err.stack,
        url: _req.url,
        method: _req.method,
      });

      res.status(status).json({
        error: message,
        ...(config.nodeEnv === 'development' && { stack: err.stack })
      });
    });

    // Step 5: Setup Socket.IO
    console.log('\n5️⃣ Setting up Socket.IO...');
    const productionOrigin = process.env.BASE_URL || process.env.TKS_URL;
    if (config.nodeEnv === 'production' && !productionOrigin) {
      console.warn('⚠️ WARNING: BASE_URL is not set in production. Socket.IO CORS will be restrictive. Set BASE_URL env var.');
    }
    const io = new Server(httpServer, {
      cors: {
        origin: config.nodeEnv === 'production'
          ? (productionOrigin ? [productionOrigin] : false)
          : '*',
        credentials: true
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io/'
    });

    const connectedUsers = new Map<string, string>();

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
          log(`[Socket.IO] User ${userId} joined room: user:${userId}`);
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

    (global as any).io = io;
    (global as any).connectedUsers = connectedUsers;
    console.log('✅ Socket.IO ready');

    // Step 7: Initialize scheduler
    console.log('\n7️⃣ Initializing scheduler...');
    initializeScheduler();
    console.log('✅ Scheduler initialized');

    // Step 8: Start listening
    console.log('\n8️⃣ Starting server...');
    httpServer.listen(config.port, "0.0.0.0", () => {
      console.log(`\n✅ Server running on port ${config.port}`);
      console.log(`🌐 URL: http://localhost:${config.port}`);
      console.log(`🏥 Health: http://localhost:${config.port}/health`);
      console.log('\n✨ Ready to accept connections!\n');
    });

    // Setup graceful shutdown
    setupGracefulShutdown(httpServer);

  } catch (error) {
    console.error('\n💀 FATAL ERROR during startup:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
})();