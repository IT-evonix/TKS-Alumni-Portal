import React from "react";
import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: readonly string[];
  /** 0-based active step; equal to steps.length means the review screen. */
  current: number;
  onSelect: (index: number) => void;
}

export const StepIndicator = ({ steps, current, onSelect }: StepIndicatorProps) => {
  const reviewing = current >= steps.length;
  const label = reviewing ? "Review & confirm" : steps[current];
  const percent = Math.round(((Math.min(current, steps.length) + 1) / (steps.length + 1)) * 100);

  return (
    <nav aria-label="Registration progress">
      {/* Phones: compact bar */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-bold text-gray-900">{label}</span>
          <span className="text-xs font-semibold text-gray-500">
            Step {Math.min(current + 1, steps.length + 1)} of {steps.length + 1}
          </span>
        </div>
        <Progress
          value={percent}
          className="h-1.5 bg-gray-200 [&>div]:bg-[#008060]"
          aria-label={`Registration progress: ${percent}%`}
        />
      </div>

      {/* ≥sm: numbered stepper */}
      <ol className="hidden items-center sm:flex">
        {[...steps, "Review"].map((name, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done;
          return (
            <li key={name} className={cn("flex items-center", i < steps.length && "flex-1")}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelect(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex shrink-0 items-center gap-2 rounded-full py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008060]/40",
                  clickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                    done && "border-[#008060] bg-gradient-to-br from-[#008060] to-[#3f9b56] text-white shadow-sm",
                    active && "border-[#008060] bg-white text-[#008060] ring-4 ring-[#A6CE39]/30",
                    !done && !active && "border-gray-300 bg-white text-gray-500"
                  )}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn("whitespace-nowrap text-sm font-semibold", !active && "hidden md:inline", active ? "text-gray-900" : done ? "text-gray-700" : "text-gray-500")}>
                  {name}
                </span>
              </button>
              {i < steps.length && (
                <span
                  aria-hidden="true"
                  className={cn("mx-2 h-0.5 min-w-3 flex-1 rounded-full transition-colors", done ? "bg-gradient-to-r from-[#008060] to-[#A6CE39]" : "bg-gray-200")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
