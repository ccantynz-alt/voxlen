import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide-caps transition-colors",
        {
          "bg-surface-200/70 text-surface-700 border border-surface-300/60":
            variant === "default",
          "bg-brass-400/10 text-brass-500 border border-brass-400/25":
            variant === "success",
          "bg-amber-500/10 text-amber-500 border border-amber-500/25":
            variant === "warning",
          "bg-red-500/10 text-red-500 border border-red-500/25":
            variant === "error",
          "bg-marcoreid-500/10 text-marcoreid-400 border border-marcoreid-500/25":
            variant === "info",
        },
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-surface-500": variant === "default",
            "bg-brass-400 animate-pulse-soft": variant === "success",
            "bg-amber-500": variant === "warning",
            "bg-red-500 animate-pulse-soft": variant === "error",
            "bg-marcoreid-400 animate-pulse-soft": variant === "info",
          })}
        />
      )}
      {children}
    </div>
  );
}
