import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, Loader2, Sparkles, Home } from "lucide-react";

export const ForgotPasswordPage = (): JSX.Element => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  React.useEffect(() => {
    document.title = "Forgot Password - TKS Alumni Portal";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      setError("Please enter your email address");
      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        toast({
          title: "Email sent",
          description: "If an account with that email exists, a password reset link has been sent.",
        });
      } else {
        setError(data.error || "Failed to send password reset email");
      }
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError("An error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex h-screen w-full bg-white overflow-hidden items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-0 overflow-hidden rounded-3xl animate-scale-in">
          <div className="h-2 bg-gradient-to-r from-[#008060] to-[#a6ce39]"></div>
          <CardContent className="p-10 text-center space-y-8">
            <div className="relative">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-blue-100/50">
                <Mail className="w-12 h-12 text-[#008060] animate-bounce-gentle" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Check Your Email</h2>
              <p className="text-gray-600 leading-relaxed">
                We've sent a password reset link to <span className="font-semibold text-[#008060]">{email}</span>.
              </p>
            </div>

            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-left space-y-2">
              <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider">Note:</h4>
              <p className="text-sm text-blue-700 leading-relaxed">
                The reset link will expire in 1 hour. If you don't see it, please check your spam folder.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => setLocation("/login")}
                className="w-full bg-[#008060] hover:bg-[#006b51] text-white py-8 rounded-2xl text-lg font-bold shadow-xl shadow-[#008060]/20 transition-all hover:-translate-y-1 active:scale-95"
              >
                Return to Login
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail("");
                }}
                className="w-full text-[#008060] hover:bg-[#008060]/5 font-bold"
              >
                Send Another Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      {/* Left Side: Form Section */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto overflow-x-hidden flex flex-col relative z-10 scrollbar-hide">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -mr-32 -mt-32 z-0 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -ml-32 -mb-32 z-0 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col min-h-full">
          <header className="p-6 sm:p-10 flex flex-col gap-6">
            <div className="flex justify-between items-center w-full">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-[#008060] font-bold flex items-center gap-2 group/home">
                  <Home className="w-4 h-4 group-hover/home:-translate-x-1 transition-transform" />
                  Home
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-4 group">
                <img
                  src="/tks_logo.png"
                  alt="TKS Logo"
                  className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 object-contain group-hover:scale-105 transition-transform drop-shadow-lg"
                />
                <div>
                  <h3 className="text-xl xl:text-2xl font-black text-[#008060] leading-none">TKS Alumni</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Portal Access</p>
                </div>
              </Link>
            </div>
          </header>


          <main className="flex-1 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-12">
            <div className="w-full max-w-[420px] space-y-8 animate-fade-up">
              <div className="space-y-4">
                <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none text-balance">
                  Reset Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008060] to-[#a6ce39]">Password</span>
                </h1>
                <p className="text-gray-500 text-sm sm:text-base font-medium leading-relaxed">
                  Enter your email address and we'll send you a link to get back into your account.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2 group">
                  <label className="text-base font-bold text-gray-800 flex items-center gap-2 transition-colors group-focus-within:text-[#008060]">
                    <Mail className="w-5 h-5" />
                    Email Address
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="peer w-full pl-4 pr-4 py-6 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#008060]/10 focus:border-[#008060] transition-all bg-white font-medium"
                      disabled={isLoading}
                    />
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent peer-focus:border-[#008060]/10 pointer-events-none"></div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50/50 border-2 border-red-100 p-4 rounded-2xl flex items-center gap-3 animate-shake">
                    <p className="text-sm text-red-700 font-bold">{error}</p>
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full h-16 bg-gradient-to-r from-[#008060] to-[#01a57c] hover:from-[#01a57c] hover:to-[#02b388] text-white rounded-2xl font-black text-xl shadow-2xl shadow-emerald-500/20 transition-all hover:-translate-y-1 active:scale-95 group"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Sending Link...</span>
                      </div>
                    ) : (
                      <span>Send reset link</span>
                    )}
                  </Button>

                  <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-[#008060] transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Login
                  </Link>
                </div>
              </div>
            </div>
          </main>

          <footer className="p-10 text-center">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
              &copy; {new Date().getFullYear()} The Kalyani School • Excellence In Education
            </p>
          </footer>
        </div>
      </div>

      {/* Right Side: Hero Section */}
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

        {/* Content Overlay - Positioned Bottom with Elegant Styling */}
        <div className="relative z-20 w-full p-8 xl:p-12 animate-fade-up">
          <div className="relative max-w-md group">
            {/* Multi-layered Glow Effect */}
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
