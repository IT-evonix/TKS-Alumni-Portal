import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { supabase } from '../supabase';

const JWT_SECRET = config.jwtSecret;

async function authenticateByUserIdHeader(req: Request, requireAdminRole = false): Promise<{
  id: string;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
} | null> {
  const headerUserId = (req.headers['user-id'] as string | undefined)?.trim();
  if (!headerUserId) return null;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, user_role, is_admin')
    .eq('id', headerUserId)
    .single();

  if (error || !user?.id) return null;

  const isAdmin = user.is_admin === true || user.user_role === 'administrator';
  if (requireAdminRole && !isAdmin) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.user_role,
    is_admin: isAdmin,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Token-first auth; fallback to legacy user-id header for backward compatibility.
  if (!token) {
    const fallbackUser = await authenticateByUserIdHeader(req, false);
    if (!fallbackUser) {
      console.warn(`[Security] Missing Authorization header accessing ${req.path}`);
      return res.status(401).json({ error: "Authentication required" });
    }

    req.headers['user-id'] = fallbackUser.id;
    (req as any).user = {
      id: fallbackUser.id,
      email: fallbackUser.email,
      role: fallbackUser.role,
      is_admin: fallbackUser.is_admin,
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Check if token is expired (jwt.verify throws if expired, but extra check is fine)
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // COMPATIBILITY LAYER:
    // Overwrite the user-id header with the TRUSTED userId from the token.
    // This ensures downstream legacy code uses the verified ID, not a spoofed header.
    req.headers['user-id'] = decoded.userId;

    // Attach user to request object
    (req as any).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      is_admin: decoded.isAdmin
    };

    next();
  } catch (error) {
    // Graceful fallback for expired/invalid token when legacy user-id header is present.
    const fallbackUser = await authenticateByUserIdHeader(req, false);
    if (fallbackUser) {
      req.headers['user-id'] = fallbackUser.id;
      (req as any).user = {
        id: fallbackUser.id,
        email: fallbackUser.email,
        role: fallbackUser.role,
        is_admin: fallbackUser.is_admin,
      };
      return next();
    }

    console.error("[Security] Invalid Token:", error);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Like requireAuth, but also accepts the JWT via a `?token=` query param.
// Only for endpoints loaded by plain <img>/<video> tags, which cannot send an Authorization header.
export async function requireAuthForMedia(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    const fallbackUser = await authenticateByUserIdHeader(req, false);
    if (!fallbackUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.headers['user-id'] = fallbackUser.id;
    (req as any).user = {
      id: fallbackUser.id,
      email: fallbackUser.email,
      role: fallbackUser.role,
      is_admin: fallbackUser.is_admin,
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.headers['user-id'] = decoded.userId;
    (req as any).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      is_admin: decoded.isAdmin
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    const fallbackAdmin = await authenticateByUserIdHeader(req, true);
    if (!fallbackAdmin) {
      console.warn(`[Security] Admin access attempt without token: ${req.path}`);
      return res.status(401).json({ error: "Authentication required" });
    }

    req.headers['user-id'] = fallbackAdmin.id;
    (req as any).user = {
      id: fallbackAdmin.id,
      email: fallbackAdmin.email,
      role: fallbackAdmin.role,
      is_admin: true,
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Check admin role from token first (fast fail)
    const isAdmin = decoded.isAdmin === true || decoded.role === 'administrator';

    // Double check with DB for critical admin actions (optional but recommended for Admin)
    // For now, trusting the token is standard JWT practice, but let's allow DB check optionally
    // or just rely on the token for performance. 
    // Given the critical nature, we can do a DB check or just trust the token (User asked for JWT).
    // Let's trust the token but ensure we verify it properly.

    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // COMPATIBILITY LAYER
    req.headers['user-id'] = decoded.userId;

    (req as any).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      is_admin: decoded.isAdmin
    };

    next();
  } catch (error) {
    const fallbackAdmin = await authenticateByUserIdHeader(req, true);
    if (fallbackAdmin) {
      req.headers['user-id'] = fallbackAdmin.id;
      (req as any).user = {
        id: fallbackAdmin.id,
        email: fallbackAdmin.email,
        role: fallbackAdmin.role,
        is_admin: true,
      };
      return next();
    }

    console.error("[Security] Admin Auth Error:", error);
    return res.status(401).json({ error: "Invalid or expired admin session" });
  }
}
