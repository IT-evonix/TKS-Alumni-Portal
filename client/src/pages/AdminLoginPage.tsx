import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
  Home,
} from "lucide-react";

type AdminOtpChallenge = {
  challengeId: string;
  email: string;
  expiresAt?: string;
};

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}*@${domain}`;
  }
  return `${localPart[0]}${"*".repeat(Math.max(localPart.length - 2, 1))}${localPart[localPart.length - 1]}@${domain}`;
}

function getOtpExpiryText(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return "OTP expired";
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Expires in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export const AdminLoginPage = (): JSX.Element => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpChallenge, setOtpChallenge] = useState<AdminOtpChallenge | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { adminUser, isAdministrator, setAdminSession } = useAuth();
  const { toast } = useToast();

  const isOtpStep = !!otpChallenge;

  React.useEffect(() => {
    document.title = "Admin Login - TKS Alumni Portal";
  }, []);

  React.useEffect(() => {
    if (adminUser && isAdministrator) {
      setLocation("/admin/dashboard");
    }
  }, [adminUser, isAdministrator, setLocation]);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const finishLogin = (data: any) => {
    setAdminSession(data.user, data.token);
    toast({
      title: "Admin login successful",
      description: `Welcome, ${data.user.username}`,
    });

    const params = new URLSearchParams(window.location.search);
    const redirectUrl = params.get("redirect");

    if (redirectUrl) {
      setTimeout(() => setLocation(decodeURIComponent(redirectUrl)), 500);
    } else {
      setTimeout(() => setLocation("/admin/dashboard"), 500);
    }
  };

  const handleAdminLogin = async () => {
    setIsLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Admin email is required");
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid admin email address");
      setIsLoading(false);
      return;
    }

    if (!password || password.trim() === "") {
      setError("Password is required");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await response.json();

      if (response.ok && data.requiresOtp) {
        setOtp("");
        setOtpChallenge({
          challengeId: data.challengeId,
          email: data.email || normalizedEmail,
          expiresAt: data.expiresAt,
        });
        setResendCooldown(30);
        toast({
          title: "OTP sent",
          description: `A verification code was sent to ${maskEmail(data.email || normalizedEmail)}`,
        });
        return;
      }

      if (response.ok && data.user) {
        finishLogin(data);
        return;
      }

      if (data.isNotAdmin) {
        toast({
          title: "Access Denied",
          description: "This portal is for administrators only.",
          variant: "destructive",
        });
        setTimeout(() => setLocation("/login"), 2000);
        return;
      }

      setError(data.debug ? `${data.error} (${data.debug})` : (data.error || "Invalid credentials"));
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpChallenge) return;

    setIsLoading(true);
    setError(null);

    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter the 6-digit OTP");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: otpChallenge.challengeId,
          otp,
        }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        finishLogin(data);
        return;
      }

      if (data.isNotAdmin) {
        toast({
          title: "Access Denied",
          description: "This portal is for administrators only.",
          variant: "destructive",
        });
        setTimeout(() => setLocation("/login"), 2000);
        return;
      }

      setError(data.error || "Invalid OTP");
    } catch (err: any) {
      setError(err.message || "An error occurred while verifying OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const resetOtpStep = () => {
    setOtp("");
    setOtpChallenge(null);
    setResendCooldown(0);
    setError(null);
  };

  const handleResendOtp = async () => {
    if (!otpChallenge || resendCooldown > 0 || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/admin/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: otpChallenge.challengeId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.requiresOtp) {
        setOtp("");
        setOtpChallenge({
          challengeId: data.challengeId,
          email: data.email || otpChallenge.email,
          expiresAt: data.expiresAt,
        });
        setResendCooldown(30);
        toast({
          title: "OTP resent",
          description: `A new verification code was sent to ${maskEmail(data.email || otpChallenge.email)}`,
        });
        return;
      }

      setError(data.error || "Failed to resend OTP");
    } catch (err: any) {
      setError(err.message || "An error occurred while resending OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isOtpStep) {
        handleVerifyOtp();
      } else {
        handleAdminLogin();
      }
    }
  };

  const otpExpiryText = getOtpExpiryText(otpChallenge?.expiresAt);

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <div className="w-full lg:w-1/2 h-full overflow-y-auto overflow-x-hidden flex flex-col relative z-10 scrollbar-hide">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none"></div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-12 min-h-min">
          <div className="w-full max-w-[420px] space-y-6 animate-fade-up">
            <div className="space-y-4 text-center">
              <div className="flex justify-between items-center mb-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-[#008060] font-bold flex items-center gap-2 group/home">
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
                    className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain mx-auto group-hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                  />
                </div>
              </Link>

              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-[#008060]" />
                  <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-gray-900 tracking-tight text-balance">
                    Admin Portal
                  </h1>
                </div>
                <p className="text-gray-500 text-sm sm:text-base xl:text-lg leading-relaxed max-w-sm mx-auto font-medium">
                  {isOtpStep
                    ? "Enter the verification code sent to your admin email to complete sign-in."
                    : "Secure gateway for administrators to manage the alumni network."}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {!isOtpStep ? (
                <div className="space-y-4">
                  <div className="space-y-2 group">
                    <label className="text-base font-bold text-gray-800 flex items-center gap-2 transition-colors group-focus-within:text-[#008060]">
                      <Mail className="w-5 h-5" />
                      Admin Email
                    </label>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="admin@thekalyani.school"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="peer w-full pl-4 pr-4 py-6 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#008060]/10 focus:border-[#008060] transition-all bg-white font-medium"
                        disabled={isLoading}
                      />
                      <div className="absolute inset-0 rounded-xl border-2 border-transparent peer-focus:border-[#008060]/10 pointer-events-none"></div>
                    </div>
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-base font-bold text-gray-800 flex items-center gap-2 transition-colors group-focus-within:text-[#008060]">
                      <Lock className="w-5 h-5" />
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter admin password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="w-full pl-4 pr-12 py-6 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#008060]/10 focus:border-[#008060] transition-all bg-white font-medium"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#008060] p-1 rounded-md hover:bg-gray-50 transition-colors"
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <p className="text-sm font-medium text-emerald-900">
                      Verification code sent to
                    </p>
                    <p className="mt-1 text-base font-bold text-emerald-950">
                      {maskEmail(otpChallenge.email)}
                    </p>
                    {otpExpiryText ? (
                      <p className="mt-2 text-xs font-medium text-emerald-700">{otpExpiryText}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-base font-bold text-gray-800 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5" />
                      Enter OTP
                    </label>
                    <div className="flex justify-center py-2" onKeyDown={handleKeyPress}>
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        disabled={isLoading}
                        containerClassName="justify-center"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      Enter the 6-digit code from your email to continue.
                    </p>
                    <div className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-sm font-semibold text-[#008060] hover:text-[#006b51] hover:bg-green-50"
                        onClick={handleResendOtp}
                        disabled={isLoading || resendCooldown > 0}
                      >
                        {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-shake">
                  <div className="bg-red-100 p-1 rounded-full text-red-600 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-medium text-red-600 leading-snug">{error}</p>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <Button
                  className="w-full bg-gradient-to-r from-[#008060] to-[#006b51] hover:from-[#006b51] hover:to-[#005d47] text-white py-6 rounded-xl font-bold text-lg shadow-lg shadow-green-900/10 hover:shadow-xl hover:shadow-green-900/20 active:scale-[0.98] transition-all relative overflow-hidden group"
                  onClick={isOtpStep ? handleVerifyOtp : handleAdminLogin}
                  disabled={isLoading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{isOtpStep ? "Verifying OTP..." : "Checking Credentials..."}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      {isOtpStep ? "Verify And Continue" : "Send OTP"}
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>

                {isOtpStep ? (
                  <Button
                    variant="outline"
                    className="w-full py-4 rounded-xl font-semibold"
                    onClick={resetOtpStep}
                    disabled={isLoading}
                  >
                    Back to Credentials
                  </Button>
                ) : null}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500 font-medium tracking-wider">User Access</span>
                  </div>
                </div>

                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="w-full text-gray-500 hover:text-[#008060] hover:bg-green-50 py-4 rounded-xl font-semibold transition-all"
                  >
                    Go to User Login
                  </Button>
                </Link>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-8">
              &copy; {new Date().getFullYear()} The Kalyani School. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 h-full relative overflow-hidden bg-[#001a14] flex-col justify-end">
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20 z-10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(166,206,57,0.18),transparent_40%)] z-10"></div>

        <div className="absolute inset-0 z-0 animate-ken-burns">
          <img
            src="/auth_hero_students.png"
            alt="Alumni Community"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-20 w-full p-8 xl:p-12 animate-fade-up">
          <div className="relative max-w-md group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#008060] via-[#a6ce39] to-[#008060] rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-all duration-700 animate-gradient-shift"></div>

            <div className="relative p-6 xl:p-8 rounded-3xl bg-black/45 backdrop-blur-xl border border-white/30 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"></div>

              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-0.5 w-6 bg-gradient-to-r from-[#008060] to-[#a6ce39]"></div>
                  <span className="px-2 py-1 rounded-full bg-black/35 border border-white/20 text-[11px] font-black uppercase tracking-[0.25em] text-emerald-100">Legacy & Tradition</span>
                </div>

                <p className="text-xl xl:text-2xl font-semibold text-white leading-relaxed italic tracking-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.75)]">
                  "Reconnect with the mentors who guided you, the friends who stood by you, and the school that shaped you."
                </p>

                <div className="flex items-center gap-4 pt-5 border-t border-white/20">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-br from-[#008060] to-[#a6ce39] rounded-xl blur-sm opacity-50"></div>
                    <div className="relative w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center font-black text-[#a6ce39] text-sm border border-white/10">TKS</div>
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
