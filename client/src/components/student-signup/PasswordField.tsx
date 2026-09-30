import React, { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { passwordStrength } from "@/utils/studentSignupFields";
import { controlClass, FieldControlProps } from "./FormField";

interface PasswordFieldProps extends FieldControlProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  autoComplete: "new-password" | "current-password";
  placeholder?: string;
  enterKeyHint?: "next" | "done" | "go";
}

export const PasswordField = ({
  id,
  name,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  autoComplete,
  placeholder,
  enterKeyHint = "next",
}: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        maxLength={128}
        placeholder={placeholder}
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={cn(controlClass(invalid), "pr-12")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#008060] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008060]/40"
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
};

const SEGMENT_COLORS = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-[#008060]"];
const LABEL_COLORS = ["", "text-red-600", "text-orange-600", "text-yellow-700", "text-[#008060]"];

export const PasswordStrengthMeter = ({ password }: { password: string }) => {
  if (!password) return null;
  const { score, label, checks } = passwordStrength(password);
  const items: [boolean, string][] = [
    [checks.minLength, "8+ characters"],
    [checks.mixedCase, "Upper & lower case"],
    [checks.number, "A number"],
    [checks.symbol, "A symbol"],
  ];
  return (
    <div className="space-y-2 rounded-xl bg-gray-50 p-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", i < score ? SEGMENT_COLORS[score - 1] : "bg-gray-200")}
            />
          ))}
        </div>
        <span className={cn("w-14 text-right text-xs font-bold", LABEL_COLORS[score])}>{label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map(([ok, text]) => (
          <li key={text} className={cn("flex items-center gap-1.5 text-xs", ok ? "text-[#008060]" : "text-gray-500")}>
            <Check className={cn("h-3.5 w-3.5 shrink-0", ok ? "opacity-100" : "opacity-30")} aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">At least 6 characters required. Longer and mixed passwords are safer.</p>
    </div>
  );
};
