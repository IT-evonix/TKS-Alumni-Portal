import React, { useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ArrowRight, Mail, BookOpen, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignupSuccessProps {
  firstName: string;
  email: string;
}

export const SignupSuccess = ({ firstName, email }: SignupSuccessProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-8 pb-8 text-center"
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e6f5f0] ring-8 ring-[#e6f5f0]/60">
        <motion.span
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        >
          <CheckCircle2 className="h-10 w-10 text-[#008060]" aria-hidden="true" />
        </motion.span>
      </div>

      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-gray-900 outline-none">
          Welcome, {firstName}!
        </h1>
        <p className="mx-auto max-w-sm text-base leading-relaxed text-gray-600">
          Your student account is ready. No approval needed — you can sign in right away.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">What's next</p>
        <ul className="space-y-3 text-sm text-gray-700">
          <li className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#008060]" aria-hidden="true" />
            <span>
              Sign in with <strong className="break-all">{email}</strong> and the password you just set.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#008060]" aria-hidden="true" />
            <span>Complete your profile so batchmates and teachers can find you.</span>
          </li>
          <li className="flex items-start gap-3">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[#008060]" aria-hidden="true" />
            <span>Explore the alumni network and upcoming events.</span>
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <Button asChild variant="brand" className="h-12 w-full rounded-xl text-base font-bold">
          <Link href="/login">
            Go to sign in <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-11 w-full rounded-xl text-sm font-semibold text-gray-600">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </motion.div>
  );
};
