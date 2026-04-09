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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-surface-300 text-surface-800": variant === "default",
          "bg-green-500/10 text-green-400 border border-green-500/20":
            variant === "success",
          "bg-amber-500/10 text-amber-400 border border-amber-500/20":
            variant === "warning",
          "bg-red-500/10 text-red-400 border border-red-500/20":
            variant === "error",
          "bg-vox-500/10 text-vox-400 border border-vox-500/20":
            variant === "info",
        },
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-surface-600": variant === "default",
            "bg-green-400 animate-pulse": variant === "success",
            "bg-amber-400": variant === "warning",
            "bg-red-400 animate-pulse": variant === "error",
            "bg-vox-400 animate-pulse": variant === "info",
          })}
        />
      )}
      {children}
    </div>
  );
}
