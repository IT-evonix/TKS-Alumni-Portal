import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, CheckCircle2, GraduationCap, ArrowRight, User, BookOpen, Sparkles, UserCircle, Mail, Phone, Calendar, School, ClipboardList, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateName, validateEmail, validateYear, validateTextLength, sanitizeString } from "@/utils/validation";
import { getGraduationYearOptions, MIN_GRADUATION_YEAR } from "@/constants/graduationYear";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";

export const SignupPage = (): JSX.Element => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // LinkedIn prefill state — sub is kept separate from formData for security
  const [linkedinSub, setLinkedinSub] = useState<string | null>(null);
  const [isLinkedinPrefill, setIsLinkedinPrefill] = useState(false);

  React.useEffect(() => {
    document.title = "Join the Network - TKS Alumni Portal";
  }, []);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      setLocation('/feed');
    }
  }, [user, setLocation]);

  // Read LinkedIn prefill params from URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sub = params.get('li_sub');
    if (!sub) return;

    const fn = decodeURIComponent(params.get('li_fn') || '');
    const ln = decodeURIComponent(params.get('li_ln') || '');
    const email = decodeURIComponent(params.get('li_email') || '');

    setLinkedinSub(decodeURIComponent(sub));
    setIsLinkedinPrefill(true);
    setFormData(prev => ({
      ...prev,
      firstName: fn || prev.firstName,
      lastName: ln || prev.lastName,
      email: email || prev.email,
    }));

    // Clean URL — params are now in state
    window.history.replaceState({}, '', '/signup');
  }, []);

  const [formData, setFormData] = useState({
    userType: "alumni",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    graduationYear: "",
    batch: "",
    course: "",
    branch: "",
    reasonForJoining: ""
  });

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validateField = (name: string, value: string, currentUserType: string = formData.userType): string => {
    switch (name) {
      case 'firstName': {
        const result = validateName(value, 'First Name');
        return result.isValid ? '' : (result.error || '');
      }
      case 'lastName': {
        const result = validateName(value, 'Last Name');
        return result.isValid ? '' : (result.error || '');
      }
      case 'email': {
        const result = validateEmail(value);
        return result.isValid ? '' : (result.error || '');
      }
      case 'phone':
        if (value && value.trim()) {
          const digitsOnly = value.replace(/\D/g, '');
          if (digitsOnly.length < 10) return 'Phone number must be at least 10 digits';
          if (digitsOnly.length > 15) return 'Phone number is too long';
        }
        return '';
      case 'graduationYear': {
        if (currentUserType === 'faculty') return '';
        const result = validateYear(value, MIN_GRADUATION_YEAR);
        return result.isValid ? '' : (result.error || '');
      }
      case 'reasonForJoining':
        if (value && value.trim()) {
          const result = validateTextLength(value, 'Reason for Joining', 0, 1000);
          return result.isValid ? '' : (result.error || '');
        }
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value, name === 'userType' ? value : formData.userType);
    setFieldErrors(prev => ({ ...prev, [name]: error }));

    // Revalidate graduationYear if userType changes
    if (name === 'userType' && touched.graduationYear) {
      setFieldErrors(prev => ({ ...prev, graduationYear: validateField('graduationYear', formData.graduationYear, value) }));
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name as keyof typeof formData] || '', formData.userType);
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async () => {
    setError(null);
    const allTouched: { [key: string]: boolean } = {};
    Object.keys(formData).forEach(key => allTouched[key] = true);
    setTouched(allTouched);

    const errors: { [key: string]: string } = {};
    // Skip validation for LinkedIn-prefilled readonly fields (name + email came from LinkedIn)
    const skipFields = isLinkedinPrefill ? ['firstName', 'lastName', 'email'] : [];
    Object.keys(formData).forEach(key => {
      if (skipFields.includes(key)) return;
      const error = validateField(key, formData[key as keyof typeof formData] || '', formData.userType);
      if (error) errors[key] = error;
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please fix the validation errors before submitting");
      const firstErrorField = Object.keys(errors)[0];
      const element = document.getElementsByName(firstErrorField)[0];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.email || (formData.userType !== 'faculty' && !formData.graduationYear)) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);

    try {
      // Sanitize form data before sending
      const sanitizedData = {
        userType: formData.userType,
        firstName: sanitizeString(formData.firstName),
        lastName: sanitizeString(formData.lastName),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || null,
        graduationYear: formData.graduationYear,
        batch: sanitizeString(formData.batch) || null,
        course: sanitizeString(formData.course) || null,
        branch: sanitizeString(formData.branch) || null,
        reasonForJoining: sanitizeString(formData.reasonForJoining, 1000) || null,
        linkedinOauthId: linkedinSub || null,
      };

      const response = await fetch('/api/auth/signup-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedData),
      });

      if (response.ok) {
        setSuccess(true);
      } else {
        const errorInfo = await handleAPIError(response);
        logError(errorInfo, 'SignupPage.handleSubmit');
        setError(getUserFriendlyError(errorInfo) || 'Signup request failed. Please try again.');
      }
    } catch (err) {
      logError(err, 'SignupPage.handleSubmit');
      setError(getUserFriendlyError(err) || 'Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.target instanceof HTMLTextAreaElement) return;
      handleSubmit();
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-[#008060]/5 via-white to-[#006b51]/10 items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-0 overflow-hidden rounded-3xl animate-scale-in">
          <div className="h-2 bg-gradient-to-r from-[#008060] to-[#a6ce39]"></div>
          <CardContent className="p-10 text-center space-y-8">
            <div className="relative">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-100/50">
                <CheckCircle2 className="w-12 h-12 text-[#008060] animate-bounce-gentle" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Application Received!</h2>
              <p className="text-gray-600 leading-relaxed">
                Thank you for applying to join the <span className="font-semibold text-[#008060]">TKS Alumni Portal</span>.
              </p>
            </div>

            <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 text-left space-y-2">
              <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">What's Next?</h4>
              <p className="text-sm text-emerald-700 leading-relaxed">
                Our administration team will verify your details. You'll receive an email confirmation at <span className="font-medium underline">{formData.email}</span> once approved.
              </p>
            </div>

            <Button
              onClick={() => setLocation("/")}
              className="w-full bg-[#008060] hover:bg-[#006b51] text-white py-8 rounded-2xl text-lg font-bold shadow-xl shadow-[#008060]/20 transition-all hover:-translate-y-1 active:scale-95"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans">

      {/* Left Side: Form Section */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto scrollbar-hide bg-white relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -mr-32 -mt-32 z-0"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-50/50 rounded-full blur-3xl -ml-32 -mb-32 z-0"></div>

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
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Portal Request</p>
                </div>
              </Link>
              <div className="text-sm xl:text-base text-gray-500 font-bold hidden sm:block">
                Step 1 of 1: <span className="text-gray-900 bg-gray-100 px-3 py-1 rounded-full">Registration</span>
              </div>
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16">
            <div className="w-full max-w-xl space-y-10 animate-fade-up">

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-none">
                  Begin Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008060] to-[#a6ce39]">Journey</span>
                </h1>
                <p className="text-gray-500 text-lg sm:text-xl font-medium max-w-md">
                  Join the exclusive network of TKS Alumni and unlock endless possibilities.
                </p>
              </div>

              <div className="space-y-10">

                {/* LinkedIn prefill banner */}
                {isLinkedinPrefill && (
                  <div className="flex items-start gap-3 bg-[#0A66C2]/5 border border-[#0A66C2]/20 rounded-2xl p-4">
                    <svg className="w-5 h-5 text-[#0A66C2] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-[#0A66C2]">Signed in with LinkedIn</p>
                      <p className="text-xs text-gray-500 mt-0.5">Your name and email have been pre-filled from LinkedIn and cannot be changed here. Please complete the remaining fields below.</p>
                    </div>
                  </div>
                )}

                {/* Personal Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-green-1/10 text-primary-green-1 flex items-center justify-center">
                      <UserCircle className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Personal Profile</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <InputGroup
                      label="First Name" name="firstName" required
                      placeholder="e.g. Rahul"
                      value={formData.firstName} onChange={handleChange} onBlur={handleBlur}
                      error={!isLinkedinPrefill && touched.firstName ? fieldErrors.firstName : undefined}
                      disabled={isLoading}
                      readOnly={isLinkedinPrefill}
                      icon={<User className="w-4 h-4" />}
                    />
                    <InputGroup
                      label="Last Name" name="lastName" required
                      placeholder="e.g. Kumar"
                      value={formData.lastName} onChange={handleChange} onBlur={handleBlur}
                      error={!isLinkedinPrefill && touched.lastName ? fieldErrors.lastName : undefined}
                      disabled={isLoading}
                      readOnly={isLinkedinPrefill}
                    />
                  </div>

                  <div className="space-y-6">
                    <InputGroup
                      label="Email Address" type="email" name="email" required
                      placeholder="you@example.com"
                      value={formData.email} onChange={handleChange} onBlur={handleBlur}
                      error={!isLinkedinPrefill && touched.email ? fieldErrors.email : undefined}
                      disabled={isLoading}
                      readOnly={isLinkedinPrefill}
                      icon={<Mail className="w-4 h-4" />}
                      helperText={isLinkedinPrefill ? "Email pre-filled from LinkedIn. If your portal email differs, sign in with email & password instead." : "Login details will be sent to this email."}
                    />

                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" /> Phone Number
                      </label>
                      <PhoneInput
                        name="phone"
                        value={formData.phone}
                        onChange={(value) => setFormData({ ...formData, phone: value })}
                        placeholder="Mobile number"
                        disabled={isLoading}
                        className="phone-input-premium"
                      />
                    </div>
                  </div>
                </section>

                {/* Role Selection */}
                <section className="space-y-6 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Account Type</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        I am joining as a... <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          name="userType"
                          value={formData.userType}
                          onChange={handleChange}
                          disabled={isLoading}
                          className={cn(
                            "w-full h-14 pl-4 pr-10 rounded-2xl border-2 bg-gray-50/50 text-gray-900 font-bold appearance-none transition-all outline-none",
                            "focus:bg-white focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 border-gray-100"
                          )}
                        >
                          <option value="alumni">Alumni</option>
                          <option value="student">Student</option>
                          <option value="faculty">Faculty / Staff</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-black">↓</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Academic Section */}
                {formData.userType !== 'faculty' && (
                  <section className="space-y-6 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Academic Verification</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" /> Graduation Year <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          name="graduationYear"
                          value={formData.graduationYear}
                          onChange={handleChange}
                          onBlur={() => handleBlur('graduationYear')}
                          disabled={isLoading}
                          className={cn(
                            "w-full h-14 pl-4 pr-10 rounded-2xl border-2 bg-gray-50/50 text-gray-900 font-bold appearance-none transition-all outline-none",
                            "focus:bg-white focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5",
                            touched.graduationYear && fieldErrors.graduationYear ? "border-red-200 bg-red-50/30" : "border-gray-100"
                          )}
                        >
                          <option value="">Select Year</option>
                          {getGraduationYearOptions().map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-black">↓</div>
                      </div>
                      {touched.graduationYear && fieldErrors.graduationYear && (
                        <p className="text-xs text-red-500 font-bold ml-1">{fieldErrors.graduationYear}</p>
                      )}
                    </div>

                    <InputGroup
                      label="Batch Range" name="batch"
                      placeholder="e.g. 2018-2022"
                      value={formData.batch} onChange={handleChange}
                      disabled={isLoading}
                      icon={<ClipboardList className="w-4 h-4" />}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <InputGroup
                      label="Course" name="course"
                      placeholder="e.g. Class 12th"
                      value={formData.course} onChange={handleChange}
                      disabled={isLoading}
                      icon={<School className="w-4 h-4" />}
                    />
                    <InputGroup
                      label="Branch / Stream" name="branch"
                      placeholder="e.g. Science"
                      value={formData.branch} onChange={handleChange}
                      disabled={isLoading}
                    />
                  </div>
                </section>
                )}

                {/* Additional Details Section */}
                <section className="space-y-6 pt-2">
                  <div className="space-y-2.5">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-400" /> Reason for Joining
                  </label>
                  <Textarea
                    name="reasonForJoining"
                    placeholder="Briefly tell us why you'd like to join the alumni portal..."
                    value={formData.reasonForJoining}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="min-h-[120px] rounded-2xl border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 p-4 transition-all resize-none text-base font-medium"
                  />
                </div>
              </section>

                {/* Error & Submit */}
                <div className="space-y-6 pt-4">
                  {error && (
                    <div className="bg-red-50/50 border-2 border-red-100 p-5 rounded-2xl flex items-start gap-3 animate-shake">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-800 font-bold">Registration Issue</p>
                        <p className="text-xs text-red-700 font-medium mt-1">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="w-full h-16 bg-gradient-to-r from-[#008060] to-[#01a57c] hover:from-[#01a57c] hover:to-[#02b388] text-white rounded-2xl font-black text-xl shadow-2xl shadow-emerald-500/20 transition-all hover:-translate-y-1 active:scale-95 group relative overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {isLoading ? (
                          <>
                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Submitting Request...</span>
                          </>
                        ) : (
                          <>
                            Request Access <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                          </>
                        )}
                      </span>
                    </Button>

                    <p className="text-center text-sm font-bold text-gray-400">
                      Already have an account?{" "}
                      <Link href="/login" className="text-[#008060] hover:underline hover:text-[#01a57c]">
                        Log In
                      </Link>
                    </p>
                  </div>
                </div>
              </div>

              <footer className="text-center space-y-4 pb-10">
                <div className="flex items-center justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all">
                  <div className="h-0.5 w-12 bg-gray-300"></div>
                  <img src="/tks_logo.png" alt="TKS" className="h-6" />
                  <div className="h-0.5 w-12 bg-gray-300"></div>
                </div>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                  &copy; {new Date().getFullYear()} The Kalyani School • Excellence In Education
                </p>
              </footer>
            </div>
          </main>
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

// Unified Premium Input Component
const InputGroup = ({
  label, name, type = "text", required, placeholder, value, onChange, onBlur, error, disabled, helperText, icon, readOnly
}: any) => {
  const fieldId = `field-${name}`;
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;

  return (
    <div className="space-y-2.5 group">
      <label
        htmlFor={fieldId}
        className={cn(
          "text-base font-bold uppercase tracking-wider flex items-center gap-2 transition-colors",
          error ? "text-red-500" : "text-gray-800 group-focus-within:text-[#008060]"
        )}
      >
        {icon && <span className="opacity-70" aria-hidden="true">{icon}</span>}
        {label} {required && <span className="text-red-500 ml-0.5" aria-label="required">*</span>}
      </label>
      <div className="relative">
        <Input
          id={fieldId}
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={label}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : (helperText ? helpId : undefined)}
          className={cn(
            "w-full h-14 pl-5 rounded-2xl border-2 bg-gray-50/50 text-gray-900 font-bold transition-all outline-none",
            "placeholder:text-gray-400 placeholder:font-medium",
            "focus:bg-white focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5",
            error ? "border-red-200 bg-red-50/30 ring-red-100/50" : "border-gray-100",
            disabled && "opacity-50 cursor-not-allowed",
            readOnly && "bg-gray-100 cursor-default text-gray-600 focus:bg-gray-100 focus:border-gray-200 focus:ring-0"
          )}
        />
        {error && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2" aria-hidden="true">
            <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
        )}
      </div>
      {error ? (
        <p id={errorId} className="text-[11px] text-red-500 font-bold ml-1 uppercase tracking-tight" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={helpId} className="text-[11px] text-gray-400 font-medium ml-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
