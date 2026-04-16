import {} from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  formatValue,
  className,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-[10px] font-medium uppercase tracking-wide-caps text-surface-600">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-[11px] font-mono tabular-nums text-surface-800">
              {formatValue ? formatValue(value) : value}
            </span>
          )}
        </div>
      )}
      <div className="relative h-5 flex items-center">
        <div className="absolute h-1 w-full rounded-full bg-surface-200 shadow-inset-hairline">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-marcoreid-700 to-brass-500/70 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            "absolute w-full h-5 opacity-0 cursor-pointer",
            "appearance-none"
          )}
        />
        <div
          className="absolute h-3.5 w-3.5 rounded-full bg-surface-50 shadow-elevation border border-marcoreid-800 pointer-events-none transition-all"
          style={{ left: `calc(${percentage}% - 7px)` }}
        />
      </div>
    </div>
  );
}
