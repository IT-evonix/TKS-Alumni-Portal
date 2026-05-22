import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { 
  AlertCircle, 
  CheckCircle2, 
  GraduationCap, 
  ArrowRight, 
  User, 
  Mail, 
  School, 
  BookOpen, 
  Lock, 
  Phone,
  Sparkles,
  ShieldCheck,
  Globe,
  ChevronDown,
  Eye,
  EyeOff,
  AlertTriangle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import { validateName, validateEmail, validateYear, sanitizeString } from "@/utils/validation";
import { getGraduationYearOptions, MIN_GRADUATION_YEAR } from "@/constants/graduationYear";
import { getUserFriendlyError } from "@/utils/errorHandler";
import { useToast } from "@/hooks/use-toast";
import { parsePhoneNumber, validatePhoneNumber } from "@/utils/phoneValidation";

export const StudentSignupPage = (): JSX.Element => {
  const allowedGenders = new Set(["male", "female", "other", "prefer_not_to_say"]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  React.useEffect(() => {
    document.title = "Student Registration | TKS Portal";
  }, []);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      setLocation('/feed');
    }
  }, [user, setLocation]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    gender: "",
    rollNumber: "",
    graduationYear: getGraduationYearOptions()[0].toString(),
    course: "",
    branch: "",
  });

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validateField = (name: string, value: string): string => {
    const sValue = value ? String(value).trim() : '';
    switch (name) {
      case 'firstName': {
        const result = validateName(sValue, 'First Name');
        return result.isValid ? '' : (result.error || '');
      }
      case 'lastName': {
        const result = validateName(sValue, 'Last Name');
        return result.isValid ? '' : (result.error || '');
      }
      case 'email': {
        const result = validateEmail(sValue);
        return result.isValid ? '' : (result.error || '');
      }
      case 'password':
        if (!sValue) return 'Password is required';
        if (sValue.length < 6) return 'Password must be at least 6 characters';
        return '';
      case 'confirmPassword':
        if (!sValue) return 'Please confirm your password';
        if (sValue !== formData.password) return 'Passwords do not match';
        return '';
      case 'phone': {
        if (!sValue) return ''; // Phone is optional
        const parsed = parsePhoneNumber(sValue);
        if (!parsed.country) return 'Please select a valid country code';
        const phoneValidation = validatePhoneNumber(parsed.number, parsed.country);
        if (!phoneValidation.valid) return phoneValidation.error || 'Invalid phone number';
        if (parsed.country.code === 'IN' && !/^[6-9]/.test(parsed.number)) {
          return 'Indian phone number must start with 6, 7, 8, or 9';
        }
        return '';
      }
      case 'gender':
        if (!sValue) return 'Gender is required';
        if (!allowedGenders.has(sValue)) return 'Please select a valid gender';
        return '';
      case 'graduationYear': {
        const result = validateYear(sValue, MIN_GRADUATION_YEAR);
        return result.isValid ? '' : (result.error || '');
      }
      case 'rollNumber':
        if (!sValue) return 'Roll Number is required';
        if (sValue.length < 3) return 'Roll Number is too short';
        if (sValue.length > 30) return 'Roll Number is too long';
        if (!/^[A-Za-z0-9\-\/]+$/.test(sValue)) {
          return 'Roll Number can only contain letters, numbers, hyphens, and slashes';
        }
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: error }));

    if (name === "password" && touched.confirmPassword) {
      setFieldErrors(prev => ({
        ...prev,
        confirmPassword: validateField("confirmPassword", formData.confirmPassword),
      }));
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name as keyof typeof formData] || '');
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const newErrors: { [key: string]: string } = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key as keyof typeof formData]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setTouched(Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.getElementsByName(firstErrorField)[0] as HTMLElement | undefined;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      toast({
        title: "Validation Error",
        description: "Please check the form for errors.",
        variant: "destructive",
      });
      return;
    }

    setIsConfirming(true);
  };

  const handleFinalSubmit = async () => {
    setIsConfirming(false);
    setIsLoading(true);

    try {
      // Strip confirmPassword from payload; server does not need it
      const { confirmPassword, ...submitData } = formData;
      void confirmPassword;
      const sanitizedData = {
        ...submitData,
        firstName: sanitizeString(formData.firstName, 50),
        lastName: sanitizeString(formData.lastName, 50),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        gender: formData.gender.trim(),
        rollNumber: sanitizeString(formData.rollNumber, 30).toUpperCase(),
        graduationYear: String(formData.graduationYear).trim(),
      };
      const response = await fetch("/api/auth/student-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizedData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      setSuccess(true);
      toast({
        title: "Registration Successful",
        description: "Your account has been created. You can now log in.",
      });
    } catch (err) {
      const errorMessage = getUserFriendlyError(err);
      setError(errorMessage);
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-2xl">
            <div className="bg-[#008060] p-8 text-center relative overflow-hidden">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"
              />
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30 backdrop-blur-sm z-10 relative">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white z-10 relative">Registration Complete!</h2>
            </div>
            <CardContent className="p-8 text-center bg-white">
              <p className="text-neutral-600 mb-8 leading-relaxed">
                Welcome to the TKS Portal! Your student account has been created and auto-approved. You can now log in to the platform.
              </p>
              <Link href="/login">
                <Button className="w-full h-14 bg-[#008060] hover:bg-[#006b51] text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all group">
                  Go to Login <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 py-8 sm:py-16 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-[#008060]/5 rounded-full blur-[120px] hidden sm:block" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-[#008060]/10 rounded-full blur-[120px] hidden sm:block" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#008060 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 z-10 relative"
      >
        {/* Left Side: Info */}
        <motion.div variants={itemVariants} className="lg:col-span-2 flex flex-col justify-center text-neutral-800 order-2 lg:order-1 px-4 lg:px-0">
          <div className="mb-8 hidden lg:block">
            <Link href="/">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-4 cursor-pointer group"
              >
                <div className="w-14 h-14 bg-[#008060] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[#008060]/20 group-hover:shadow-[#008060]/30 transition-all">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-900">The Kalyani School</h1>
                  <p className="text-sm font-semibold text-[#008060] tracking-[0.2em] uppercase opacity-80">Portal</p>
                </div>
              </motion.div>
            </Link>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6 leading-tight text-neutral-900">
            Join your <span className="text-[#008060] relative">
              Academic
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 25 0, 50 5 T 100 5" stroke="#008060" strokeWidth="2" fill="none" opacity="0.3" />
              </svg>
            </span> Community.
          </h2>
          
          <p className="text-base sm:text-lg text-neutral-600 mb-8 sm:mb-10 leading-relaxed font-medium">
            A specialized space for TKS students to connect, grow, and transition into the alumni network seamlessly.
          </p>

          <div className="space-y-6 sm:space-y-8">
            {[
              { icon: BookOpen, title: "Academic Tracking", desc: "Your records prepared for life after school." },
              { icon: Globe, title: "Alumni Network", desc: "Direct access to seniors in top universities." },
              { icon: ShieldCheck, title: "Verified Identity", desc: "Secure, school-authorized student accounts." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                variants={itemVariants}
                className="flex items-start gap-4 sm:gap-5 group"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl shadow-md flex items-center justify-center text-[#008060] shrink-0 border border-neutral-100 group-hover:bg-[#008060] group-hover:text-white transition-all duration-300">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 text-base sm:text-lg">{feature.title}</h4>
                  <p className="text-sm sm:text-base text-neutral-500">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          <motion.div 
            variants={itemVariants}
            className="mt-10 sm:mt-12 p-5 sm:p-6 bg-white/50 backdrop-blur-md rounded-2xl border border-white shadow-xl flex items-center gap-4 max-w-sm"
          >
             <div className="w-3 h-3 bg-[#008060] rounded-full animate-ping shrink-0"></div>
             <div>
               <p className="text-[10px] sm:text-[11px] font-black text-[#008060] uppercase tracking-widest mb-0.5">Live Session</p>
               <p className="text-xs sm:text-sm font-bold text-neutral-700">Computer Lab Registration Mode Active</p>
             </div>
          </motion.div>
        </motion.div>

        {/* Right Side: Form */}
        <motion.div variants={itemVariants} className="lg:col-span-3 order-1 lg:order-2">
          {/* Mobile Header */}
          <div className="mb-6 lg:hidden flex items-center justify-center gap-3">
             <div className="w-10 h-10 bg-[#008060] rounded-xl flex items-center justify-center text-white shadow-lg">
                <GraduationCap className="w-6 h-6" />
             </div>
             <h1 className="text-xl font-bold text-neutral-900">TKS Portal Registration</h1>
          </div>

          <Card className="border-white/40 shadow-2xl bg-white/80 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden border">
            <CardContent className="p-6 sm:p-12">
              <form onSubmit={handleStartSubmit} className="space-y-6 sm:space-y-8">
                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">First Name</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                      <Input
                        name="firstName"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={handleChange}
                        onBlur={() => handleBlur('firstName')}
                        className={cn(
                          "pl-11 h-12 sm:h-14 bg-white/50 border-neutral-200 focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 rounded-[0.8rem] sm:rounded-[1rem] transition-all font-medium text-neutral-800 text-sm sm:text-base",
                          touched.firstName && fieldErrors.firstName && "border-red-400 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                    </div>
                    {touched.firstName && fieldErrors.firstName && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.firstName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Last Name</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                      <Input
                        name="lastName"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={handleChange}
                        onBlur={() => handleBlur('lastName')}
                        className={cn(
                          "pl-11 h-12 sm:h-14 bg-white/50 border-neutral-200 focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 rounded-[0.8rem] sm:rounded-[1rem] transition-all font-medium text-neutral-800 text-sm sm:text-base",
                          touched.lastName && fieldErrors.lastName && "border-red-400 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                    </div>
                    {touched.lastName && fieldErrors.lastName && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                    <Input
                      name="email"
                      type="email"
                      placeholder="john.doe@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={() => handleBlur('email')}
                      className={cn(
                        "pl-11 h-12 sm:h-14 bg-white/50 border-neutral-200 focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 rounded-[0.8rem] sm:rounded-[1rem] transition-all font-medium text-neutral-800 text-sm sm:text-base",
                        touched.email && fieldErrors.email && "border-red-400 focus:border-red-400 focus:ring-red-100"
                      )}
                    />
                  </div>
                  {touched.email && fieldErrors.email && (
                    <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Phone & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Phone Number</label>
                    <div className="phone-input-premium">
                      <PhoneInput
                        value={formData.phone}
                        onChange={(val) => {
                           setFormData({ ...formData, phone: val });
                           setTouched(prev => ({ ...prev, phone: true }));
                           setFieldErrors(prev => ({ ...prev, phone: validateField('phone', val) }));
                        }}
                        className={cn(
                          "h-12 sm:h-14 overflow-hidden rounded-[0.8rem] sm:rounded-[1rem] border-neutral-200 transition-all focus-within:ring-4 focus-within:ring-[#008060]/5",
                          touched.phone && fieldErrors.phone && "border-red-400"
                        )}
                      />
                    </div>
                    {touched.phone && fieldErrors.phone && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Gender</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        onBlur={() => handleBlur('gender')}
                        className={cn(
                          "w-full pl-11 h-12 sm:h-14 bg-white/50 border-neutral-200 border rounded-[0.8rem] sm:rounded-[1rem] outline-none focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 text-sm transition-all appearance-none font-medium text-neutral-800",
                          touched.gender && fieldErrors.gender && "border-red-400 focus:border-red-400"
                        )}
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                    </div>
                    {touched.gender && fieldErrors.gender && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.gender}
                      </p>
                    )}
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={() => handleBlur('password')}
                        className={cn(
                          "pl-11 pr-12 h-12 sm:h-14 bg-white/50 border-neutral-200 focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 rounded-[0.8rem] sm:rounded-[1rem] transition-all font-medium text-neutral-800 text-sm sm:text-base",
                          touched.password && fieldErrors.password && "border-red-400 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {touched.password && fieldErrors.password && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Confirm Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                      <Input
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        onBlur={() => handleBlur('confirmPassword')}
                        className={cn(
                          "pl-11 pr-12 h-12 sm:h-14 bg-white/50 border-neutral-200 focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 rounded-[0.8rem] sm:rounded-[1rem] transition-all font-medium text-neutral-800 text-sm sm:text-base",
                          touched.confirmPassword && fieldErrors.confirmPassword && "border-red-400 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {touched.confirmPassword && fieldErrors.confirmPassword && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                {/* Roll & Year */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Roll Number</label>
                    <div className="relative group">
                      <School className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                      <Input
                        name="rollNumber"
                        placeholder="e.g. 10234"
                        value={formData.rollNumber}
                        onChange={handleChange}
                        onBlur={() => handleBlur('rollNumber')}
                        className={cn(
                          "pl-11 h-12 sm:h-14 bg-white/50 border-neutral-200 focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 rounded-[0.8rem] sm:rounded-[1rem] transition-all font-medium text-neutral-800 text-sm sm:text-base",
                          touched.rollNumber && fieldErrors.rollNumber && "border-red-400 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                    </div>
                    {touched.rollNumber && fieldErrors.rollNumber && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.rollNumber}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400 ml-1">Graduation Year</label>
                    <div className="relative group">
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#008060] transition-colors" />
                      <select
                        name="graduationYear"
                        value={formData.graduationYear}
                        onChange={handleChange}
                        onBlur={() => handleBlur('graduationYear')}
                        className="w-full pl-11 h-12 sm:h-14 bg-white/50 border-neutral-200 border rounded-[0.8rem] sm:rounded-[1rem] outline-none focus:border-[#008060] focus:ring-4 focus:ring-[#008060]/5 text-sm transition-all appearance-none font-medium text-neutral-800"
                      >
                        {getGraduationYearOptions().map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                    </div>
                    {touched.graduationYear && fieldErrors.graduationYear && (
                      <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.graduationYear}
                      </p>
                    )}
                  </div>
                </div>

                {/* Submits */}
                <div className="pt-4">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 sm:p-5 bg-red-50/50 border border-red-100 backdrop-blur-sm rounded-2xl text-red-600 text-sm flex items-center gap-4 mb-6"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span className="font-semibold">{error}</span>
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 sm:h-16 bg-[#008060] hover:bg-[#006b51] text-white rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl shadow-2xl shadow-[#008060]/20 hover:shadow-[#008060]/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3 relative z-10 transition-transform group-hover:scale-105">
                        <span>Create Account</span>
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform duration-300" />
                      </div>
                    )}
                    <motion.div 
                      className="absolute inset-0 bg-white/10"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    />
                  </Button>

                  <p className="text-center text-sm text-neutral-500 pt-6 font-medium">
                    Already a part of TKS? <Link href="/login" className="text-[#008060] font-black hover:underline underline-offset-4 decoration-2">Sign in here</Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirming && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsConfirming(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10"
            >
              <div className="bg-amber-50 p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-neutral-900">Review Your Details</h3>
                <p className="text-sm text-neutral-500 font-medium">Please ensure these are correct before proceeding.</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Name</p>
                    <p className="font-bold text-neutral-800">{formData.firstName} {formData.lastName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Roll Number</p>
                    <p className="font-bold text-[#008060] text-lg">{formData.rollNumber}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Email Address</p>
                  <p className="font-bold text-neutral-800 truncate">{formData.email}</p>
                </div>

                <div className="pt-4 space-y-3">
                  <Button 
                    onClick={handleFinalSubmit}
                    disabled={isLoading}
                    className="w-full h-14 bg-[#008060] hover:bg-[#006b51] text-white rounded-xl font-bold shadow-lg shadow-[#008060]/20"
                  >
                    Everything looks correct
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setIsConfirming(false)}
                    className="w-full h-14 text-neutral-500 hover:text-neutral-900 font-bold"
                  >
                    Go back and edit
                  </Button>
                </div>
              </div>
              
              <button 
                onClick={() => setIsConfirming(false)}
                className="absolute top-4 right-4 text-neutral-300 hover:text-neutral-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 text-neutral-300 pointer-events-none select-none z-0 overflow-hidden w-full text-center">
        <p className="text-[6rem] sm:text-[12rem] font-black opacity-[0.03] leading-none text-neutral-200">JOIN</p>
      </div>

      <style>{`
        .phone-input-premium [role="combobox"] {
          border-radius: 1rem 0 0 1rem !important;
          border-right: 1px solid #e5e7eb !important;
        }
        @media (max-width: 640px) {
           .phone-input-premium [role="combobox"] {
              border-radius: 0.8rem 0 0 0.8rem !important;
           }
        }
      `}</style>
    </div>
  );
};

