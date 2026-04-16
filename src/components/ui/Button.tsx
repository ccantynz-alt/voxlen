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
          "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all duration-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-50 disabled:opacity-50 disabled:pointer-events-none",
          {
            // Variants — oxford navy with restrained brass accents, not neon.
            "bg-gradient-to-b from-marcoreid-700 to-marcoreid-900 text-surface-50 hover:from-marcoreid-600 hover:to-marcoreid-800 active:from-marcoreid-800 active:to-marcoreid-900 shadow-elevation shadow-inset-hairline":
              variant === "primary",
            "bg-surface-100 text-surface-900 hover:bg-surface-200 active:bg-surface-300 border border-surface-300/70 shadow-inset-hairline":
              variant === "secondary",
            "text-surface-700 hover:bg-surface-100/80 hover:text-surface-950":
              variant === "ghost",
            "bg-red-600/90 text-surface-50 hover:bg-red-600 active:bg-red-700 shadow-inset-hairline":
              variant === "danger",
            "bg-gradient-to-b from-marcoreid-700 to-marcoreid-900 text-brass-300 hover:from-marcoreid-600 hover:to-marcoreid-800 shadow-elevation shadow-inset-hairline":
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
