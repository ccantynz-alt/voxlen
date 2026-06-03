import { useEffect, useCallback } from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type?: ToastType, duration?: number) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = "info", duration = 3000) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, message, type, duration }] }));
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, type: ToastType = "info", duration = 3000) {
  useToastStore.getState().add(message, type, duration);
}

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(item.id), item.duration ?? 3000);
    return () => clearTimeout(t);
  }, [item.id, item.duration, onRemove]);

  const Icon = item.type === "success" ? CheckCircle2 : item.type === "error" ? AlertCircle : Info;
  const color = item.type === "success"
    ? "text-emerald-400 bg-emerald-500/10"
    : item.type === "error"
    ? "text-red-400 bg-red-500/10"
    : "text-brass-400 bg-brass-500/10";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-300/30 bg-surface-50/95 shadow-elevation backdrop-blur-sm",
        "animate-slide-in-right text-sm font-medium text-surface-900 max-w-xs"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 rounded-full p-0.5", color)} strokeWidth={2.5} />
      <span className="flex-1 leading-snug">{item.message}</span>
      <button
        onClick={() => onRemove(item.id)}
        className="text-surface-500 hover:text-surface-700 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  const handleRemove = useCallback((id: string) => remove(id), [remove]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem item={t} onRemove={handleRemove} />
        </div>
      ))}
    </div>
  );
}
