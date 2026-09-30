import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ClipboardCheck, GraduationCap, Loader2, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sanitizeString } from "@/utils/validation";
import { getUserFriendlyError } from "@/utils/errorHandler";
import { getGraduationYearOptions } from "@/constants/graduationYear";
import {
  STEP_FIELDS,
  defaultGraduationYear,
  firstInvalidStep,
  isPhoneEmpty,
  mapServerError,
  validateField,
  validateStep,
  type FieldErrors,
  type StudentSignupField,
  type StudentSignupForm,
} from "@/utils/studentSignupFields";
import { AuthSplitLayout, type HeroCaption } from "@/components/student-signup/AuthSplitLayout";
import { StepIndicator } from "@/components/student-signup/StepIndicator";
import { FormField, controlClass } from "@/components/student-signup/FormField";
import { PasswordField, PasswordStrengthMeter } from "@/components/student-signup/PasswordField";
import { ReviewSummary } from "@/components/student-signup/ReviewSummary";
import { SignupSuccess } from "@/components/student-signup/SignupSuccess";
import { cn } from "@/lib/utils";

const STEPS = ["About you", "School", "Account"] as const;
const REVIEW_STEP = STEPS.length;
const DRAFT_KEY = "tks-student-signup-draft";

const STEP_ACCENTS = [
  { icon: UserRound, chip: "bg-emerald-100 text-emerald-700 ring-emerald-200", bar: "from-[#008060] to-[#A6CE39]" },
  { icon: GraduationCap, chip: "bg-amber-100 text-amber-700 ring-amber-200", bar: "from-[#FDB913] to-[#A6CE39]" },
  { icon: Lock, chip: "bg-lime-100 text-lime-700 ring-lime-200", bar: "from-[#A6CE39] to-[#008060]" },
  { icon: ClipboardCheck, chip: "bg-teal-100 text-teal-700 ring-teal-200", bar: "from-[#008060] to-[#FDB913]" },
] as const;

const STEP_COPY: { title: string; subtitle: string }[] = [
  { title: "Tell us about you", subtitle: "Use your name as it appears in school records." },
  { title: "Your school details", subtitle: "We use your roll number to link your account to the school." },
  { title: "Secure your account", subtitle: "You'll use these to sign in." },
  { title: "Review & confirm", subtitle: "Check everything below, then create your account." },
];

const HERO_CAPTIONS: HeroCaption[] = [
  { eyebrow: "Step 1 of 4", text: "Start with the basics. Your name helps teachers and batchmates recognise you." },
  { eyebrow: "Step 2 of 4", text: "Your roll number ties your account to your official school record. Find it on your ID card." },
  { eyebrow: "Step 3 of 4", text: "Pick a password only you know. You can change it anytime from your profile." },
  { eyebrow: "Last step", text: "Double-check your details. You can jump back to any section to edit." },
];

const EMPTY_FORM: StudentSignupForm = {
  firstName: "",
  lastName: "",
  gender: "",
  rollNumber: "",
  graduationYear: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const fieldId = (f: StudentSignupField) => `ss-${f}`;

function loadDraft(): { form: StudentSignupForm; step: number } {
  const base = { ...EMPTY_FORM, graduationYear: String(defaultGraduationYear()) };
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { form: base, step: 0 };
    const parsed = JSON.parse(raw);
    const form = { ...base };
    for (const key of Object.keys(base) as StudentSignupField[]) {
      if (key === "password" || key === "confirmPassword") continue;
      if (typeof parsed?.form?.[key] === "string") form[key] = parsed.form[key];
    }
    const step = Number.isInteger(parsed?.step) ? Math.min(Math.max(parsed.step, 0), STEPS.length - 1) : 0;
    return { form, step };
  } catch {
    return { form: base, step: 0 };
  }
}

function saveDraft(form: StudentSignupForm, step: number) {
  try {
    const { password, confirmPassword, ...safe } = form;
    void password;
    void confirmPassword;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: safe, step }));
  } catch {
    /* storage unavailable (private mode) — draft persistence is best-effort */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export const StudentSignupPage = (): JSX.Element | null => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();

  const initial = useMemo(loadDraft, []);
  const [form, setForm] = useState<StudentSignupForm>(initial.form);
  const [step, setStep] = useState(initial.step);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<StudentSignupField, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [registered, setRegistered] = useState<{ firstName: string; email: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const yearOptions = useMemo(() => getGraduationYearOptions(), []);

  useEffect(() => {
    document.title = "Student Registration | TKS Alumni Portal";
  }, []);

  useEffect(() => {
    if (user) setLocation("/feed");
  }, [user, setLocation]);

  // Best-effort draft (never includes passwords)
  useEffect(() => {
    if (!registered) saveDraft(form, Math.min(step, STEPS.length - 1));
  }, [form, step, registered]);

  // Move focus to the step heading and reset scroll whenever the step changes
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const focusField = useCallback((field: StudentSignupField) => {
    window.setTimeout(() => {
      const el = document.getElementById(fieldId(field));
      el?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      (el as HTMLElement | null)?.focus({ preventScroll: true });
    }, 50);
  }, [reduceMotion]);

  const goTo = useCallback((next: number) => {
    setDirection(next >= step ? 1 : -1);
    setServerError(null);
    setStep(next);
  }, [step]);

  const setField = (field: StudentSignupField, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    setServerError(null);
    // Reward early, punish late: only re-validate live once the field has been visited
    if (touched[field] || errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value, next.password) }));
    }
    if (field === "password" && (touched.confirmPassword || next.confirmPassword)) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateField("confirmPassword", next.confirmPassword, next.password),
      }));
    }
  };

  const blurField = (field: StudentSignupField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field], form.password) }));
  };

  /** For controls with no meaningful blur (Select): validate immediately on change. */
  const pickField = (field: StudentSignupField, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const next = { ...form, [field]: value };
    setForm(next);
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value, next.password) }));
  };

  const handleNext = () => {
    const stepErrors = validateStep(step, form);
    const keys = Object.keys(stepErrors) as StudentSignupField[];
    if (keys.length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      setTouched((prev) => ({ ...prev, ...Object.fromEntries(STEP_FIELDS[step].map((f) => [f, true])) }));
      setAnnounce(`${keys.length} ${keys.length === 1 ? "field needs" : "fields need"} attention: ${keys.map((k) => stepErrors[k]).join(". ")}`);
      focusField(STEP_FIELDS[step].find((f) => stepErrors[f])!);
      return;
    }
    setAnnounce("");
    goTo(step + 1);
  };

  const handleSubmit = async () => {
    // Full re-check: a draft restore or stale state must never send invalid data
    const bad = firstInvalidStep(form);
    if (bad !== -1) {
      const all: FieldErrors = {};
      for (let i = 0; i < STEPS.length; i++) Object.assign(all, validateStep(i, form));
      setErrors(all);
      goTo(bad);
      const first = STEP_FIELDS[bad].find((f) => all[f]);
      if (first) focusField(first);
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    try {
      const payload = {
        firstName: sanitizeString(form.firstName, 50),
        lastName: sanitizeString(form.lastName, 50),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: isPhoneEmpty(form.phone) ? "" : form.phone.trim(),
        gender: form.gender.trim(),
        rollNumber: sanitizeString(form.rollNumber, 30).toUpperCase(),
        graduationYear: String(form.graduationYear).trim(),
      };
      const response = await fetch("/api/auth/student-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const target = mapServerError(response.status, data?.error);
        if (target.field) {
          setErrors((prev) => ({ ...prev, [target.field!]: target.message }));
          setTouched((prev) => ({ ...prev, [target.field!]: true }));
          goTo(target.step);
          focusField(target.field);
        } else {
          setServerError(target.message);
        }
        return;
      }

      clearDraft();
      setRegistered({ firstName: payload.firstName, email: payload.email });
      toast({ title: "Registration successful", description: "Your account has been created. You can now sign in." });
    } catch (err) {
      const message = getUserFriendlyError(err);
      setServerError(message);
      toast({ title: "Registration failed", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user) return null;

  if (registered) {
    return (
      <AuthSplitLayout caption={{ eyebrow: "All set", text: "Your account is live. Sign in to complete your profile and meet your batch." }}>
        <SignupSuccess firstName={registered.firstName} email={registered.email} />
      </AuthSplitLayout>
    );
  }

  const isReview = step === REVIEW_STEP;
  const copy = STEP_COPY[step];
  const err = (f: StudentSignupField) => (touched[f] || errors[f] ? errors[f] : undefined);
  const slide = reduceMotion ? 0 : 24;

  return (
    <AuthSplitLayout caption={HERO_CAPTIONS[step]} scrollRef={scrollRef}>
      <div className="mb-6">
        <StepIndicator steps={STEPS} current={step} onSelect={goTo} />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isReview) void handleSubmit();
          else handleNext();
        }}
        className="flex flex-1 flex-col"
      >
        <div className="flex-1">
          {(() => {
            const { icon: StepIcon, chip, bar } = STEP_ACCENTS[step];
            return (
              <div className="mb-6 flex items-start gap-3.5">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1", chip)}>
                  <StepIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-gray-900 outline-none sm:text-3xl">
                    {copy.title}
                  </h1>
                  <span className={cn("block h-1 w-12 rounded-full bg-gradient-to-r", bar)} aria-hidden="true" />
                  <p className="pt-1 text-sm text-gray-600 sm:text-base">{copy.subtitle}</p>
                </div>
              </div>
            );
          })()}

          <div className="sr-only" role="status" aria-live="assertive">
            {announce}
          </div>

          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: slide * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slide * direction }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-5"
            >
              {step === 0 && (
                <>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField id={fieldId("firstName")} label="First name" error={err("firstName")}>
                      {(p) => (
                        <Input
                          id={p.id}
                          name="firstName"
                          value={form.firstName}
                          maxLength={50}
                          placeholder="Aarav"
                          autoComplete="given-name"
                          enterKeyHint="next"
                          aria-invalid={p.invalid || undefined}
                          aria-describedby={p.describedBy}
                          onChange={(e) => setField("firstName", e.target.value)}
                          onBlur={() => blurField("firstName")}
                          className={controlClass(p.invalid)}
                        />
                      )}
                    </FormField>
                    <FormField id={fieldId("lastName")} label="Last name" error={err("lastName")}>
                      {(p) => (
                        <Input
                          id={p.id}
                          name="lastName"
                          value={form.lastName}
                          maxLength={50}
                          placeholder="Sharma"
                          autoComplete="family-name"
                          enterKeyHint="next"
                          aria-invalid={p.invalid || undefined}
                          aria-describedby={p.describedBy}
                          onChange={(e) => setField("lastName", e.target.value)}
                          onBlur={() => blurField("lastName")}
                          className={controlClass(p.invalid)}
                        />
                      )}
                    </FormField>
                  </div>

                  <FormField id={fieldId("gender")} label="Gender" error={err("gender")}>
                    {(p) => (
                      <Select value={form.gender || undefined} onValueChange={(v) => pickField("gender", v)}>
                        <SelectTrigger
                          id={p.id}
                          aria-invalid={p.invalid || undefined}
                          aria-describedby={p.describedBy}
                          className={cn(controlClass(p.invalid), "justify-between data-[placeholder]:text-gray-400")}
                        >
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="py-2.5 text-base">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                </>
              )}

              {step === 1 && (
                <>
                  <FormField
                    id={fieldId("rollNumber")}
                    label="Roll / admission number"
                    error={err("rollNumber")}
                    help="Printed on your school ID card or fee receipt."
                  >
                    {(p) => (
                      <Input
                        id={p.id}
                        name="rollNumber"
                        value={form.rollNumber}
                        maxLength={30}
                        placeholder="e.g. 465"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        enterKeyHint="next"
                        aria-invalid={p.invalid || undefined}
                        aria-describedby={p.describedBy}
                        onChange={(e) => setField("rollNumber", e.target.value.toUpperCase())}
                        onBlur={() => blurField("rollNumber")}
                        className={cn(controlClass(p.invalid), "uppercase placeholder:normal-case")}
                      />
                    )}
                  </FormField>

                  <FormField
                    id={fieldId("graduationYear")}
                    label="Graduation year"
                    error={err("graduationYear")}
                    help="The year you will complete Grade XII."
                  >
                    {(p) => (
                      <Select value={form.graduationYear || undefined} onValueChange={(v) => pickField("graduationYear", v)}>
                        <SelectTrigger
                          id={p.id}
                          aria-invalid={p.invalid || undefined}
                          aria-describedby={p.describedBy}
                          className={cn(controlClass(p.invalid), "justify-between")}
                        >
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {yearOptions.map((y) => (
                            <SelectItem key={y} value={String(y)} className="py-2.5 text-base">
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>

                  <FormField
                    id={fieldId("phone")}
                    label="Mobile number"
                    optional
                    error={err("phone")}
                    help="Only used to help the school reach you."
                  >
                    {(p) => (
                      <PhoneInput
                        id={p.id}
                        size="lg"
                        hideMessages
                        invalid={p.invalid}
                        describedBy={p.describedBy}
                        value={form.phone}
                        placeholder="98765 43210"
                        onChange={(val) => setField("phone", val)}
                        onBlur={() => blurField("phone")}
                      />
                    )}
                  </FormField>
                </>
              )}

              {step === 2 && (
                <>
                  <FormField id={fieldId("email")} label="Email address" error={err("email")}>
                    {(p) => (
                      <Input
                        id={p.id}
                        name="email"
                        type="email"
                        value={form.email}
                        maxLength={254}
                        placeholder="you@example.com"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="next"
                        aria-invalid={p.invalid || undefined}
                        aria-describedby={p.describedBy}
                        onChange={(e) => setField("email", e.target.value)}
                        onBlur={() => blurField("email")}
                        className={controlClass(p.invalid)}
                      />
                    )}
                  </FormField>

                  <div className="space-y-3">
                    <FormField id={fieldId("password")} label="Password" error={err("password")}>
                      {(p) => (
                        <PasswordField
                          {...p}
                          name="password"
                          value={form.password}
                          autoComplete="new-password"
                          placeholder="Create a password"
                          onChange={(v) => setField("password", v)}
                          onBlur={() => blurField("password")}
                        />
                      )}
                    </FormField>
                    <PasswordStrengthMeter password={form.password} />
                  </div>

                  <FormField id={fieldId("confirmPassword")} label="Confirm password" error={err("confirmPassword")}>
                    {(p) => (
                      <>
                        <PasswordField
                          {...p}
                          name="confirmPassword"
                          value={form.confirmPassword}
                          autoComplete="new-password"
                          placeholder="Re-enter your password"
                          enterKeyHint="go"
                          onChange={(v) => setField("confirmPassword", v)}
                          onBlur={() => blurField("confirmPassword")}
                        />
                        {form.confirmPassword && form.confirmPassword === form.password && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-[#008060]">
                            <Check className="h-4 w-4" aria-hidden="true" /> Passwords match
                          </p>
                        )}
                      </>
                    )}
                  </FormField>
                </>
              )}

              {isReview && <ReviewSummary form={form} onEdit={goTo} />}
            </motion.div>
          </AnimatePresence>

          {serverError && (
            <div
              role="alert"
              className="animate-shake mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{serverError}</p>
            </div>
          )}
        </div>

        {/* Action bar: sticky on phones so it is never lost behind the keyboard */}
        <div
          className={cn(
            "sticky bottom-0 z-20 -mx-4 mt-6 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:backdrop-blur-none"
          )}
        >
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => goTo(step - 1)}
              disabled={isSubmitting}
              className="h-12 rounded-xl border-gray-300 px-5 text-base font-semibold text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          )}
          <Button
            type="submit"
            variant="brand"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="h-12 flex-1 rounded-xl border-0 bg-gradient-to-r from-[#006b51] via-[#008060] to-[#3f9b56] text-base font-bold text-white shadow-lg shadow-[#008060]/30 transition hover:brightness-110 active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Creating account…
              </>
            ) : isReview ? (
              <>
                Create account <Check className="h-5 w-5" aria-hidden="true" />
              </>
            ) : (
              <>
                Continue <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </form>
    </AuthSplitLayout>
  );
};
