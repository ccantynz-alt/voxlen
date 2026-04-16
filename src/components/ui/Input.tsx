import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type = "text", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[10px] font-medium uppercase tracking-wide-caps text-surface-600">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brass-500/80">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "flex h-10 w-full rounded-md bg-surface-50 border border-surface-300/70 px-3 py-2 text-sm text-surface-900 shadow-inset-hairline",
              "placeholder:text-surface-600/70",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400/50 focus-visible:border-brass-400/40",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-200",
              icon && "pl-10",
              error && "border-red-500/60 focus-visible:ring-red-500/50",
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
