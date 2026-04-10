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
            <span className="text-sm font-medium text-surface-900">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-surface-700 mt-0.5">
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
          "relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voxlen-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0",
          {
            "h-5 w-9": size === "sm",
            "h-6 w-11": size === "md",
            "bg-voxlen-600": checked,
            "bg-surface-400": !checked,
          }
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full bg-white shadow-lg transform transition-transform duration-200 ease-in-out",
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
