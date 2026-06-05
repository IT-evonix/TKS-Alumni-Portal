import React from "react";
import { cn } from "@/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  text?: string;
}

export function Loader({ className, text = "Loading...", ...props }: LoaderProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center p-8", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading"
      {...props}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-[#008060] rounded-full blur-xl opacity-20 animate-pulse"></div>
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
          <div
            className="absolute inset-0 border-4 border-[#008060] rounded-full animate-spin"
            style={{ borderTopColor: 'transparent', borderLeftColor: 'transparent', animationDuration: '0.8s' }}
          ></div>
          <span className="text-2xl sm:text-3xl font-bold text-[#008060] animate-pulse">T</span>
        </div>
      </div>
      <div className="mt-6 flex flex-col items-center gap-1">
        <p className="text-sm sm:text-base font-bold text-[#008060] animate-pulse">{text}</p>
      </div>
    </div>
  );
}
