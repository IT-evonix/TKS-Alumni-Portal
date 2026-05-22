
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Alumni } from '../../../shared/supabase';
import { buildClientUrl } from '@/lib/base-url';

interface AuthContextType {
  user: User | null;
  adminUser: User | null;
  alumni: Alumni | null;
  faculty: any | null;
  student: any | null;
  admin: any | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  logoutAdmin: () => void;
  logoutUser: () => void;
  isLoading: boolean;
  error: string | null;
  hasRole: (roles: string | string[]) => boolean;
  isAlumni: boolean;
  isStudent: boolean;
  isFaculty: boolean;
  isAdministrator: boolean;
  setAdminSession: (adminData: User, token?: string) => void;
  refreshAlumni: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = React.useState<User | null>(null);
  const [alumni, setAlumni] = React.useState<Alumni | null>(null);
  const [adminUser, setAdminUser] = React.useState<User | null>(null); // Separate admin state
  const [faculty, setFaculty] = React.useState<any | null>(null);
  const [student, setStudent] = React.useState<any | null>(null);
  const [admin, setAdmin] = React.useState<any | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // -- REFACTORING TO USE REFS FOR STABLE ACCESS INSIDE EFFECT --
  const userRef = React.useRef(user);
  const adminUserRef = React.useRef(adminUser);

  // Keep refs synced with state
  React.useEffect(() => { userRef.current = user; }, [user]);
  React.useEffect(() => { adminUserRef.current = adminUser; }, [adminUser]);

  // Handle LinkedIn sign-in success redirect: /feed?linkedin_signin=success&token=...
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin_signin') !== 'success') return;
    const token = params.get('token');
    if (!token) return;

    // Clean URL immediately
    window.history.replaceState({}, '', '/feed');

    localStorage.setItem('auth_token', token);
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('auth/me failed')))
      .then(data => {
        setUser(data.user);
        setAlumni(data.alumni || null);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userId', data.user.id);
        if (data.alumni) localStorage.setItem('alumni', JSON.stringify(data.alumni));
        const authChannel = new BroadcastChannel('auth_sync');
        authChannel.postMessage({ type: 'LOGIN_USER' });
        authChannel.close();
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        window.location.href = '/login?linkedin_error=token_exchange_failed';
      });
  }, []); // run once on mount

  React.useEffect(() => {
    // Determine if we're in admin context based on URL
    const isAdminContext = window.location.pathname.startsWith('/admin');

    // Check for existing regular user session
    const storedUser = localStorage.getItem('user');
    // Check for existing admin session
    const storedAdminUser = localStorage.getItem('adminUser');

    // Load regular user session if it exists
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        // Only set as regular user if it's not a direct admin session 
        // (to maintain the separate state handles)
        if (!userData.is_admin && userData.user_role !== "administrator") {
          setUser(userData);

          const storedAlumni = localStorage.getItem('alumni');
          if (storedAlumni) {
            try {
              setAlumni(JSON.parse(storedAlumni));
            } catch (e) {
              localStorage.removeItem('alumni');
            }
          }
        }
      } catch (error) {
        localStorage.removeItem('user');
      }
    }

    // Load admin session if it exists (allows admin to access alumni features too)
    if (storedAdminUser) {
      try {
        const adminData = JSON.parse(storedAdminUser);
        if (adminData.is_admin || adminData.user_role === "administrator") {
          setAdminUser(adminData);
        }
      } catch (error) {
        localStorage.removeItem('adminUser');
      }
    }

    setIsLoading(false);

    // Initialize BroadcastChannel
    const authChannel = new BroadcastChannel('auth_sync');

    authChannel.onmessage = (event) => {
      const { type } = event.data;
      const currentIsAdminContext = window.location.pathname.startsWith('/admin');

      console.log(`[AuthSync] Received ${type}`);

      switch (type) {
        case 'LOGIN_ADMIN':
          // If we are in a User context and an Admin login happened elsewhere, logout the user
          // This enforces mutual exclusion: Can't be User here if I am Admin there.
          if (!currentIsAdminContext && userRef.current) {
            console.warn('[AuthSync] Admin login detected in another tab. Logging out User session locally.');
            logoutUser(false); // false = don't broadcast, to avoid loops
          }
          break;

        case 'LOGIN_USER':
          // If we are in an Admin context and a User login happened elsewhere, logout the admin
          if (currentIsAdminContext && adminUserRef.current) {
            console.warn('[AuthSync] User login detected in another tab. Logging out Admin session locally.');
            logoutAdmin(false); // false = don't broadcast
          }
          break;

        case 'LOGOUT_ADMIN':
          // If we are in Admin context, logout.
          if (currentIsAdminContext && adminUserRef.current) {
            console.log('[AuthSync] Admin logout detected in another tab. Logging out locally.');
            logoutAdmin(false);
          }
          break;

        case 'LOGOUT_USER':
          // If we are in User context, logout.
          if (!currentIsAdminContext && userRef.current) {
            console.log('[AuthSync] User logout detected in another tab. Logging out locally.');
            logoutUser(false);
          }
          break;
      }
    };

    // Listen for storage changes with context awareness (Legacy fallback & same-role sync)
    const handleStorageChange = (e: StorageEvent) => {
      // Determine current context
      const currentIsAdminContext = window.location.pathname.startsWith('/admin');

      // Only process user storage changes if NOT in admin context
      if (e.key === 'user' && !currentIsAdminContext) {
        if (e.newValue) {
          try {
            const userData = JSON.parse(e.newValue);
            if (!userData.is_admin && userData.user_role !== "administrator") {
              setUser(userData);
              // fetchCurrentUser(userData.id, false); // Optional: re-verify
            }
          } catch (error) {
            console.error('Error parsing updated user:', error);
          }
        } else {
          // User was logged out in another tab
          setUser(null);
          setAlumni(null);
          localStorage.removeItem('alumni');
        }
      }

      // Only process admin storage changes if IN admin context
      if (e.key === 'adminUser' && currentIsAdminContext) {
        if (e.newValue) {
          try {
            const adminData = JSON.parse(e.newValue);
            if (adminData.is_admin || adminData.user_role === "administrator") {
              setAdminUser(adminData);
              // fetchCurrentUser(adminData.id, true);
            }
          } catch (error) {
            console.error('Error parsing updated admin user:', error);
          }
        } else {
          // Admin was logged out in another tab
          setAdminUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Listen for manual profile updates to refresh context
    const handleProfileUpdate = () => {
      console.log('[AuthContext] Profile update event detected, refreshing...');
      const currentUser = userRef.current;
      if (currentUser?.id) {
        fetchCurrentUser(currentUser.id, false);
      }
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      authChannel.close();
    };
  }, []);

  // ... (keeping the storage listener separate or merged is fine, I'll merge minimal changes)

  const fetchCurrentUser = async (userId: string, isAdmin: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'user-id': userId,
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (!response.ok) {
        // Only logout on 401 (unauthorized), not on other errors
        if (response.status === 401) {
          console.warn('Session expired or invalid, logging out');
          if (isAdmin) {
            localStorage.removeItem('adminUser');
            setAdminUser(null);
          } else {
            localStorage.removeItem('user');
            localStorage.removeItem('alumni');
            setUser(null);
            setAlumni(null);
          }
        } else {
          // For other errors (500, 503, etc.), keep the session
          console.error('Error fetching user data, but keeping session:', response.status);
        }
        return;
      }

      const data = await response.json();
      if (isAdmin) {
        setAdminUser(data.user);
        // Update localStorage to keep session fresh
        localStorage.setItem('adminUser', JSON.stringify(data.user));
      } else {
        setUser(data.user);
        setAlumni(data.alumni);
        // Update localStorage to keep session fresh
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.alumni) {
          localStorage.setItem('alumni', JSON.stringify(data.alumni));
        }
      }
    } catch (error) {
      // Network errors shouldn't log the user out
      console.error('Network error fetching current user, keeping session:', error);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Determine endpoint based on where we are calling from or just try both?
      // Actually, standard login is for users. Admin login is usually separate.
      // But here we need to know IF it's an admin login to save to correct storage.
      // We'll rely on the response to tell us.

      // NOTE: Context login function is generic. For strict separation, 
      // AdminLoginPage should call a slightly different flow or we check role here.

      // Let's assume this is generic login. We will check role after success.
      // However, the backend /api/auth/login routes are separate for admin vs user usually
      // IF usage matches AdminLoginPage calling a special fetch, we need to handle that.

      // Since `useAuth().login` is used by generic LoginPage, we keep it for User.
      // AdminLoginPage might need its own custom call OR we adapt this.
      // Let's adapt: try `api/auth/login`. If it fails, maybe it's admin?
      // Actually, usually Admin Login page uses `api/auth/admin/login`.

      // If the USER is calling `login` from `LoginPage`, they want `user` session.
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Ensure we're not in admin context
        const isAdminContext = window.location.pathname.startsWith('/admin');

        if (isAdminContext) {
          console.warn('Attempted to set user session in admin context');
          throw new Error('Please use admin login for admin panel');
        }

        // Clear any existing admin session to prevent conflicts
        setAdminUser(null);
        localStorage.removeItem('adminUser');

        // Set user session
        setUser(data.user);
        setAlumni(data.alumni);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.alumni) {
          localStorage.setItem('alumni', JSON.stringify(data.alumni));
        }
        localStorage.setItem('userId', data.user.id);
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }

        // Broadcast success
        const authChannel = new BroadcastChannel('auth_sync');
        authChannel.postMessage({ type: 'LOGIN_USER' });
        authChannel.close();

        return true;
      } else {
        // If standard login failed, check if it was an admin login attempt via simple login?
        // No, User request implies we strictly separate sessions.
        // Admin login page usually handles its own fetch call. 
        // If `loading` is shared, we should exposing a specific `adminLogin` or generally `setUser` from outside.
        // But for now, let's stick to standard user login here.
        console.error('Login failed:', data.error);
        throw new Error(data.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Network error');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for Admin Login Page to manually set admin session
  const setAdminSession = (adminData: User, token?: string) => {
    // Only allow setting admin session in admin context
    const isAdminContext = window.location.pathname.startsWith('/admin');

    if (!isAdminContext) {
      console.warn('Attempted to set admin session outside admin context');
      return;
    }

    // Clear any existing user session to prevent conflicts
    setUser(null);
    setAlumni(null);
    localStorage.removeItem('user');
    localStorage.removeItem('userId');

    // Set admin session
    setAdminUser(adminData);
    localStorage.setItem('adminUser', JSON.stringify(adminData));
    if (token) {
      localStorage.setItem('auth_token', token);
    }

    // Broadcast success
    const authChannel = new BroadcastChannel('auth_sync');
    authChannel.postMessage({ type: 'LOGIN_ADMIN' });
    authChannel.close();
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();
      if (response.ok) return true;
      else {
        setError(data.error || 'Registration failed');
        return false;
      }
    } catch (error) {
      setError('Network error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear both user and admin sessions
    if (user) {
      logoutUser(true);
    }
    if (adminUser) {
      logoutAdmin(true);
    }
  };

  const logoutAdmin = (broadcast = true) => {
    // Admin-specific logout
    setAdminUser(null);
    localStorage.removeItem('adminUser');
    localStorage.removeItem('auth_token');

    if (broadcast) {
      const authChannel = new BroadcastChannel('auth_sync');
      authChannel.postMessage({ type: 'LOGOUT_ADMIN' });
      authChannel.close();
    }

    window.location.href = buildClientUrl('/admin/login');
  };

  const logoutUser = (broadcast = true) => {
    // User-specific logout
    setUser(null);
    setAlumni(null);
    localStorage.removeItem('user');
    localStorage.removeItem('alumni');
    localStorage.removeItem('userId');
    localStorage.removeItem('auth_token');

    if (broadcast) {
      const authChannel = new BroadcastChannel('auth_sync');
      authChannel.postMessage({ type: 'LOGOUT_USER' });
      authChannel.close();
    }

    window.location.href = '/login';
  };

  const hasRole = (roles: string | string[]): boolean => {
    const targetUser = adminUser || user; // Check admin first, then user
    if (!targetUser) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(targetUser.user_role);
  };

  // derived state based on which user is active in which context
  // This is tricky. ProtectedRoute needs to know WHICH user to check.
  // We will expose both, and letting ProtectedRoute decide.

  const isAlumni = user?.user_role === 'alumni';
  const isStudent = user?.user_role === 'student';
  const isFaculty = user?.user_role === 'faculty';
  // Admin check checks ADMIN user
  const isAdministrator = adminUser?.user_role === 'administrator' || adminUser?.is_admin === true;

  return (
    <AuthContext.Provider value={{
      user,
      adminUser,
      alumni,
      faculty,
      student,
      admin,
      login,
      register,
      logout,
      logoutAdmin: () => logoutAdmin(true),
      logoutUser: () => logoutUser(true),
      isLoading,
      error,
      hasRole,
      isAlumni,
      isStudent,
      isFaculty,
      isAdministrator,
      setAdminSession,
      refreshAlumni: async () => {
        const currentUser = userRef.current;
        if (currentUser?.id) {
          console.log('[AuthContext] refreshAlumni called for user:', currentUser.id);
          await fetchCurrentUser(currentUser.id, false);
        }
      }
    } as any}>
      {children}
    </AuthContext.Provider>
  );
}
