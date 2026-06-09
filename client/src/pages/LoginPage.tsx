import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, GraduationCap, Home, AlertCircle } from "lucide-react";
import { validateEmail } from "@/utils/validation";
import { getUserFriendlyError, logError } from "@/utils/errorHandler";
import { buildClientUrl } from "@/lib/base-url";

const LINKEDIN_ERROR_MESSAGES: Record<string, string> = {
  no_email: "LinkedIn didn't share your email. Please sign in with email and password.",
  no_sub: "LinkedIn returned an invalid account identifier. Please try again.",
  no_account_linked: "No portal account is linked to this LinkedIn profile. If you have an existing account, sign in with email & password, then connect LinkedIn from your Profile Settings.",
  signup_pending: "Your account request is already pending admin review. Please wait for approval.",
  signup_rejected: "Your application was not approved. Please contact the school administration.",
  already_linked_other: "This LinkedIn account is already linked to a different portal account.",
  account_blocked: "Your account has been suspended. Please contact an administrator.",
  admin_not_allowed: "Admin accounts must sign in through the admin portal.",
  token_exchange_failed: "LinkedIn sign-in failed. Please try again or use email and password.",
  invalid_state: "LinkedIn sign-in session was invalid. Please try again.",
  not_configured: "LinkedIn sign-in is not available right now. Please use email and password.",
};

export const LoginPage = (): JSX.Element => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { login, user, adminUser } = useAuth();
  const { toast } = useToast();

  React.useEffect(() => {
    document.title = "Login - TKS Alumni Portal";
  }, []);

  // Read LinkedIn error from URL param and display it
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const liErr = params.get('linkedin_error');
    if (liErr) {
      setLinkedinError(LINKEDIN_ERROR_MESSAGES[liErr] || "LinkedIn sign-in failed. Please try again or use email and password.");
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      setLocation('/feed');
    } else if (adminUser) {
      setLocation('/admin/dashboard');
    }
  }, [user, adminUser, setLocation]);

  // Secret key combination to access admin login (Ctrl+Shift+A)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        window.location.assign(buildClientUrl('/admin/login'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);

  const handleSignIn = async () => {
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error || "Please enter a valid email address.");
      return;
    }

    // Validate password
    if (!password || !password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await login(email.trim().toLowerCase(), password);

      if (success) {
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect');
        const sessionRedirect = sessionStorage.getItem('redirectAfterLogin');

        const isSafeRedirect = (url: string) => {
          try {
            const decoded = decodeURIComponent(url);
            return decoded.startsWith('/') && !decoded.startsWith('//');
          } catch {
            return false;
          }
        };

        if (redirectUrl && isSafeRedirect(redirectUrl)) {
          setLocation(decodeURIComponent(redirectUrl));
        } else if (sessionRedirect && isSafeRedirect(sessionRedirect)) {
          sessionStorage.removeItem('redirectAfterLogin');
          setLocation(sessionRedirect);
        } else {
          setLocation("/feed");
        }
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } catch (err: any) {
      logError(err, 'LoginPage.handleSignIn');
      if (err.message && err.message.includes("blocked")) {
        setError(err.message);
      } else {
        setError(getUserFriendlyError(err) || "An error occurred during login. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSignIn();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSignIn();
  };

  return (
    // Main Container: h-screen maintains the "app-like" feel
    <div className="flex h-screen w-full bg-white overflow-hidden">

      {/* Left Side - Login Form (Scrollable) */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto overflow-x-hidden flex flex-col relative z-10 scrollbar-hide">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none"></div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-12 min-h-min">
          <div className="w-full max-w-[420px] space-y-6 animate-fade-up">

            {/* Header / Logo & Navigation */}
            <div className="space-y-4 text-center">
              <div className="flex justify-between items-center mb-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-primary-green-1 font-bold flex items-center gap-2 group/home">
                    <Home className="w-4 h-4 group-hover/home:-translate-x-1 transition-transform" />
                    Home
                  </Button>
                </Link>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-100 to-transparent mx-4"></div>
              </div>

              <Link href="/" className="inline-block group cursor-pointer">
                <div className="relative">
                  <img
                    src="/tks_logo.png"
                    alt="TKS Logo"
                    className="w-24 h-24 sm:w-32 sm:h-32 md:w-32 md:h-32 lg:w-32 lg:h-32 object-contain mx-auto group-hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                  />
                </div>
              </Link>

              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-gray-900 tracking-tight">
                  Welcome Back
                </h1>
                <p className="text-gray-500 text-sm sm:text-base xl:text-lg leading-relaxed max-w-sm mx-auto font-medium">
                  Sign in to reconnect with your batchmates and explore new opportunities.
                </p>
              </div>
            </div>

            {/* LinkedIn Error */}
            {linkedinError && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3" role="alert">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-amber-800 leading-snug">{linkedinError}</p>
              </div>
            )}

            {/* Login Form */}
            <div className="space-y-6">
              <div className="space-y-4">
                {/* Email */}
                <div className="space-y-2 group">
                  <label htmlFor="login-email" className="text-base font-bold text-gray-800 flex items-center gap-2 transition-colors group-focus-within:text-primary-green-1">
                    <Mail className="w-5 h-5" />
                    Email Address
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      id="login-email"
                      placeholder="e.g. your.name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleKeyPress}
                      className="peer w-full pl-4 pr-4 py-6 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-green-1/10 focus:border-primary-green-1 transition-all bg-white font-medium"
                      disabled={isLoading}
                      aria-required="true"
                      aria-invalid={!!error && !email.includes('@')}
                      autoComplete="email"
                    />
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent peer-focus:border-primary-green-1/10 pointer-events-none" aria-hidden="true"></div>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2 group">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="text-base font-bold text-gray-800 flex items-center gap-2 transition-colors group-focus-within:text-primary-green-1">
                      <Lock className="w-5 h-5" />
                      Password
                    </label>
                    <Link href="/forgot-password">
                      <span className="text-xs font-semibold text-primary-green-1 hover:text-primary-green-2 cursor-pointer hover:underline">
                        Forgot Password?
                      </span>
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      id="login-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyPress}
                      className="w-full pl-4 pr-12 py-6 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-green-1/10 focus:border-primary-green-1 transition-all bg-white font-medium"
                      disabled={isLoading}
                      aria-required="true"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary-green-1 p-1 rounded-md hover:bg-gray-50 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-shake" role="alert">
                  <div className="bg-red-100 p-1 rounded-full text-red-600 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-medium text-red-600 leading-snug">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full bg-primary-green-1 hover:bg-primary-green-2 text-white py-6 rounded-xl font-bold text-lg shadow-lg shadow-green-900/10 hover:shadow-xl hover:shadow-green-900/20 active:scale-[0.98] transition-all group"
                  disabled={isLoading}
                  aria-label="Sign in to portal"
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In to Portal
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>

                {/* Or divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500 font-medium tracking-wider">Or continue with</span>
                  </div>
                </div>

                {/* LinkedIn Sign-In */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { window.location.href = '/api/auth/linkedin/login'; }}
                  className="w-full border-2 border-[#0A66C2]/20 hover:border-[#0A66C2] hover:bg-[#0A66C2]/5 text-[#0A66C2] py-6 rounded-xl font-semibold transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    Continue with LinkedIn
                  </span>
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500 font-medium tracking-wider">New to the community?</span>
                  </div>
                </div>

                <Link href="/signup">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-2 border-gray-100 hover:border-primary-green-1 hover:bg-primary-green-1/5 text-gray-700 hover:text-primary-green-1 py-6 rounded-xl font-semibold transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-gray-400 group-hover:text-primary-green-1 transition-colors" />
                      Create Alumni Account
                    </span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 mt-8">
              &copy; {new Date().getFullYear()} The Kalyani School. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative overflow-hidden bg-[#001a14] flex-col justify-end">
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20 z-10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(166,206,57,0.18),transparent_40%)] z-10"></div>

        <div className="absolute inset-0 z-0">
          <img
            src="/auth_hero_students.png"
            alt="Alumni Community"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content Overlay */}
        <div className="relative z-20 w-full p-8 xl:p-12 animate-fade-up">
          <div className="relative max-w-md">
            <div className="relative p-6 xl:p-8 rounded-3xl bg-black/45 backdrop-blur-xl border border-white/30 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"></div>
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-0.5 w-6 bg-gradient-to-r from-primary-green-1 to-primary-yellow"></div>
                  <span className="px-2 py-1 rounded-full bg-black/35 border border-white/20 text-[11px] font-black uppercase tracking-[0.25em] text-emerald-100">Legacy & Tradition</span>
                </div>

                <p className="text-xl xl:text-2xl font-semibold text-white leading-relaxed italic tracking-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.75)]">
                  "Reconnect with the mentors who guided you, the friends who stood by you, and the school that shaped you."
                </p>

                <div className="flex items-center gap-4 pt-5 border-t border-white/20">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-br from-primary-green-1 to-primary-yellow rounded-xl blur-sm opacity-50"></div>
                    <div className="relative w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center font-black text-primary-yellow text-sm border border-white/10">TKS</div>
                  </div>
                  <div>
                    <p className="text-base font-black tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">The Kalyani School</p>
                    <p className="text-[11px] font-bold text-emerald-200 uppercase tracking-[0.25em]">
                      Official Alumni Network
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
