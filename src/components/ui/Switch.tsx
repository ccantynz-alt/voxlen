import {} from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
  description?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  size = "md",
  label,
  description,
  className,
}: SwitchProps) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-surface-900 tracking-tight">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-surface-600 mt-0.5 leading-snug">
              {description}
            </span>
          )}
        </div>
      )}
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-50 shadow-inset-hairline",
          {
            "h-5 w-9": size === "sm",
            "h-6 w-11": size === "md",
            "bg-gradient-to-b from-marcoreid-700 to-marcoreid-900": checked,
            "bg-surface-300": !checked,
          }
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full bg-surface-50 shadow-elevation transform transition-transform duration-200 ease-in-out",
            {
              "h-4 w-4": size === "sm",
              "h-5 w-5": size === "md",
              "translate-x-4": checked && size === "sm",
              "translate-x-5": checked && size === "md",
              "translate-x-0.5": !checked,
            },
            "mt-0.5"
          )}
        />
      </button>
    </label>
  );
}
