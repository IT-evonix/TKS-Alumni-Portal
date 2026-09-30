import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared control styling so every input/select/phone row has identical height, radius and focus ring. */
export const controlClass = (invalid?: boolean) =>
  cn(
    "h-12 w-full rounded-xl border bg-white px-4 text-base md:text-base text-gray-900 placeholder:text-gray-400",
    "transition-[border-color,box-shadow] duration-150 ring-offset-0",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-0",
    invalid
      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/25"
      : "border-gray-300 hover:border-gray-400 focus-visible:border-[#008060] focus-visible:ring-[#008060]/25"
  );

export interface FieldControlProps {
  id: string;
  invalid: boolean;
  describedBy?: string;
}

interface FormFieldProps {
  id: string;
  label: string;
  optional?: boolean;
  help?: React.ReactNode;
  error?: string;
  className?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}

export const FormField = ({ id, label, optional, help, error, className, children }: FormFieldProps) => {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy = error ? errorId : help ? helpId : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-gray-800">
        <span>{label}</span>
        {optional && <span className="text-xs font-medium text-gray-500">Optional</span>}
      </label>
      {children({ id, invalid: !!error, describedBy })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p id={helpId} className="text-xs leading-relaxed text-gray-600">
          {help}
        </p>
      ) : null}
    </div>
  );
};
