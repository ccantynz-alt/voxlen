import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
  label,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={ref}>
      {label && (
        <label className="block text-[10px] font-medium uppercase tracking-wide-caps text-surface-600 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full h-10 px-3 rounded-md text-sm transition-colors shadow-inset-hairline",
          "bg-surface-50 border border-surface-300/70 text-surface-900",
          "hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isOpen && "ring-2 ring-brass-400/50 border-brass-400/40"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selected?.icon}
          <span className={!selected ? "text-surface-600/70" : "font-medium"}>
            {selected?.label || placeholder}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-surface-600 transition-transform",
            isOpen && "rotate-180"
          )}
          strokeWidth={1.75}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-surface-50 border border-surface-300/80 shadow-elevation-lg shadow-inset-hairline py-1 animate-slide-down">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors",
                "hover:bg-surface-100",
                option.value === value
                  ? "text-surface-950 bg-surface-100/60"
                  : "text-surface-800"
              )}
            >
              {option.icon}
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className={cn("truncate", option.value === value && "font-medium")}>{option.label}</span>
                {option.description && (
                  <span className="text-[11px] text-surface-600 truncate">
                    {option.description}
                  </span>
                )}
              </div>
              {option.value === value && (
                <Check className="h-4 w-4 text-brass-500 shrink-0" strokeWidth={2} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
