import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glow";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marcoreid-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 disabled:opacity-50 disabled:pointer-events-none",
          {
            // Variants
            "bg-marcoreid-600 text-white hover:bg-marcoreid-700 active:bg-marcoreid-800 shadow-lg shadow-marcoreid-600/20":
              variant === "primary",
            "bg-surface-200 text-surface-900 hover:bg-surface-300 active:bg-surface-400 border border-surface-300":
              variant === "secondary",
            "text-surface-800 hover:bg-surface-200 hover:text-surface-950":
              variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700 active:bg-red-800":
              variant === "danger",
            "bg-marcoreid-600 text-white hover:bg-marcoreid-700 glow-blue":
              variant === "glow",
            // Sizes
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
            "h-10 w-10 p-0": size === "icon",
          },
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
