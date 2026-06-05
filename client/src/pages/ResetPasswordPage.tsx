import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, getPasswordStrength } from "@/utils/password-validation";

export const ResetPasswordPage = (): JSX.Element => {
  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [passwordStrength, setPasswordStrength] = useState<ReturnType<typeof getPasswordStrength> | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get token from URL query parameter
  const [location] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
      verifyToken(tokenParam);
    } else {
      setIsVerifying(false);
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [location]);

  // Set page title
  useEffect(() => {
    document.title = "Reset Password - TKS Alumni Portal";
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/reset-password/verify/${tokenToVerify}`);
      const data = await response.json();

      if (response.ok && data.valid) {
        setIsValidToken(true);
      } else {
        setError(data.error || "Invalid or expired token");
        setIsValidToken(false);
      }
    } catch (err: any) {
      console.error("Token verification error:", err);
      setError("Failed to verify reset link. Please try again.");
      setIsValidToken(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!newPassword) {
      errors.push("New password is required");
    } else {
      const validation = validatePassword(newPassword);
      if (!validation.isValid) {
        errors.push(...validation.errors);
      }
    }

    if (!confirmPassword) {
      errors.push("Please confirm your password");
    } else if (newPassword !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordErrors([]);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: "Password reset successful",
          description: "Your password has been reset successfully. You can now log in.",
        });
        // Redirect to login after 3 seconds
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError("An error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-[#008060] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-600">Verifying reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900">Invalid or Expired Link</h2>
            <p className="text-gray-600">
              {error || "This password reset link is invalid or has expired. Please request a new one."}
            </p>
            <Button
              onClick={() => setLocation("/forgot-password")}
              className="w-full bg-gradient-to-r from-[#008060] to-[#006b51] hover:from-[#006b51] hover:to-[#005d47] text-white"
            >
              Request New Reset Link
            </Button>
            <Button
              onClick={() => setLocation("/login")}
              variant="outline"
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900">Password Reset Successful!</h2>
            <p className="text-gray-600">
              Your password has been reset successfully. You will be redirected to the login page shortly.
            </p>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full bg-gradient-to-r from-[#008060] to-[#006b51] hover:from-[#006b51] hover:to-[#005d47] text-white"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="space-y-2 sm:space-y-3 text-center">
            <div className="inline-block">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center mb-3 sm:mb-4 mx-auto shadow-lg">
                <span className="text-white text-xl sm:text-2xl font-bold">T</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Reset Your Password
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm px-2">
              Enter your new password below
            </p>
          </div>

          {/* Form */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password Field */}
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="text-[#008060]">🔒</span>
                    New Password
                  </label>
                  <div className="relative group">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewPassword(value);
                        
                        // Real-time validation
                        if (value) {
                          const validation = validatePassword(value);
                          const strength = getPasswordStrength(value);
                          setPasswordStrength(strength);
                          
                          if (!validation.isValid) {
                            setPasswordErrors(validation.errors);
                          } else {
                            setPasswordErrors([]);
                          }
                        } else {
                          setPasswordStrength(null);
                          setPasswordErrors([]);
                        }
                        
                        // Check password match
                        if (confirmPassword && value !== confirmPassword) {
                          setPasswordErrors(prev => {
                            const matchError = "Passwords do not match";
                            return prev.includes(matchError) ? prev : [...prev, matchError];
                          });
                        } else if (confirmPassword && value === confirmPassword) {
                          setPasswordErrors(prev => prev.filter(err => err !== "Passwords do not match"));
                        }
                      }}
                      className="w-full px-3 sm:px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008060]/20 focus:border-[#008060] transition-all duration-300 text-sm sm:text-base min-h-[44px]"
                      disabled={isLoading}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#008060] transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      disabled={isLoading}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Must be 8-128 characters with uppercase, lowercase, number, and special character
                  </p>
                  
                  {/* Password Strength Indicator */}
                  {newPassword && passwordStrength && (
                    <div className="mt-3 space-y-2">
                      {/* Strength Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            passwordStrength.strength === "weak"
                              ? "bg-red-500"
                              : passwordStrength.strength === "medium"
                              ? "bg-yellow-500"
                              : passwordStrength.strength === "strong"
                              ? "bg-blue-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${passwordStrength.percentage}%` }}
                        />
                      </div>
                      
                      {/* Strength Label */}
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${
                          passwordStrength.strength === "weak"
                            ? "text-red-600"
                            : passwordStrength.strength === "medium"
                            ? "text-yellow-600"
                            : passwordStrength.strength === "strong"
                            ? "text-blue-600"
                            : "text-green-600"
                        }`}>
                          {passwordStrength.strength === "weak"
                            ? "Weak"
                            : passwordStrength.strength === "medium"
                            ? "Medium"
                            : passwordStrength.strength === "strong"
                            ? "Strong"
                            : "Very Strong"}
                        </span>
                        <span className="text-gray-500">{passwordStrength.percentage}%</span>
                      </div>
                      
                      {/* Validation Checklist */}
                      {passwordErrors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {passwordErrors.slice(0, 5).map((err, idx) => (
                            <div key={idx} className="text-xs text-red-600 flex items-start gap-1.5">
                              <span>✗</span>
                              <span>{err}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Warnings */}
                      {passwordStrength.feedback && passwordStrength.feedback.length > 0 && passwordErrors.length === 0 && (
                        <div className="mt-2 space-y-1">
                          {passwordStrength.feedback.slice(0, 3).map((fb, idx) => (
                            <div key={idx} className={`text-xs flex items-start gap-1.5 ${
                              fb.startsWith("✓") ? "text-green-600" : "text-yellow-600"
                            }`}>
                              <span>{fb.startsWith("✓") ? "✓" : "⚠"}</span>
                              <span>{fb.replace(/^[✓⚠]\s*/, "")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="text-[#008060]">🔒</span>
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        setConfirmPassword(value);
                        
                        // Check password match
                        if (newPassword && value !== newPassword) {
                          setPasswordErrors(prev => {
                            const matchError = "Passwords do not match";
                            return prev.includes(matchError) ? prev : [...prev, matchError];
                          });
                        } else if (newPassword && value === newPassword) {
                          setPasswordErrors(prev => prev.filter(err => err !== "Passwords do not match"));
                        }
                      }}
                      className="w-full px-3 sm:px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008060]/20 focus:border-[#008060] transition-all duration-300 text-sm sm:text-base min-h-[44px]"
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#008060] transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                {/* Error Display */}
                {(error || passwordErrors.length > 0) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <ul className="text-red-600 text-xs sm:text-sm space-y-1">
                      {error && <li>⚠️ {error}</li>}
                      {passwordErrors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#008060] to-[#006b51] hover:from-[#006b51] hover:to-[#005d47] text-white py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl shadow-lg min-h-[44px]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Resetting Password...
                    </div>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
