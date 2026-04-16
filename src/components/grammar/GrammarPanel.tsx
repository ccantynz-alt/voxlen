import { useState, useCallback } from "react";
import {
  SpellCheck,
  Wand2,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { useSettingsStore } from "@/stores/settings";

interface GrammarChange {
  original: string;
  corrected: string;
  reason: string;
  category: string;
}

export function GrammarPanel() {
  const [inputText, setInputText] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [changes, setChanges] = useState<GrammarChange[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const writingStyle = useSettingsStore((s) => s.writingStyle);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const handleCorrect = useCallback(async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{
        original: string;
        corrected: string;
        changes: GrammarChange[];
        score: number;
      }>("correct_grammar", { text: inputText });

      setCorrectedText(result.corrected);
      setChanges(result.changes);
      setScore(result.score);
    } catch {
      // Demo fallback
      setCorrectedText(inputText);
      setChanges([]);
      setScore(1.0);
    }
    setIsProcessing(false);
  }, [inputText]);

  const handleCopy = async () => {
    const text = correctedText || inputText;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoryColors: Record<string, string> = {
    grammar: "text-marcoreid-500 bg-marcoreid-500/10 border border-marcoreid-500/20",
    spelling: "text-red-500 bg-red-500/10 border border-red-500/20",
    punctuation: "text-amber-500 bg-amber-500/10 border border-amber-500/20",
    style: "text-brass-500 bg-brass-400/10 border border-brass-400/25",
  };

  return (
    <div className="flex flex-col h-full p-8 gap-6">
      {/* Header — editorial header with brass mark. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gradient-to-br from-marcoreid-700 to-marcoreid-900 shadow-elevation shadow-inset-hairline">
            <SpellCheck className="h-4 w-4 text-brass-300" strokeWidth={2} />
          </div>
          <div>
            <h2 className="font-display text-[22px] font-medium tracking-tight-display text-surface-950 leading-tight">
              Grammar <span className="italic text-brass-500">Engine</span>
            </h2>
            <p className="text-[11px] text-surface-600 mt-0.5 leading-snug">
              An AI-polished draft, in the register you choose.
            </p>
          </div>
        </div>
        <Select
          label="Register"
          value={writingStyle}
          onChange={(v) =>
            updateSetting(
              "writingStyle",
              v as typeof writingStyle
            )
          }
          options={[
            { value: "professional", label: "Professional" },
            { value: "casual", label: "Casual" },
            { value: "academic", label: "Academic" },
            { value: "creative", label: "Creative" },
            { value: "technical", label: "Technical" },
          ]}
          className="w-44"
        />
      </div>

      <div className="divider-brass" />

      {/* Editor area */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Input */}
        <div className="flex flex-col rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/50 bg-surface-50/60">
            <span className="label-caps">
              Original
            </span>
            <span className="text-[10px] text-surface-600 font-mono tabular-nums">
              {inputText.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste or type text to polish…"
            className="flex-1 w-full p-5 bg-transparent text-[14px] text-surface-900 placeholder:text-surface-600/70 resize-none focus:outline-none leading-relaxed font-sans"
          />
        </div>

        {/* Output */}
        <div className="flex flex-col rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/50 bg-surface-50/60">
            <div className="flex items-center gap-2">
              <span className="label-caps">
                Polished
              </span>
              {score !== null && (
                <Badge
                  variant={score >= 0.9 ? "success" : score >= 0.7 ? "warning" : "error"}
                >
                  {Math.round(score * 100)}%
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!correctedText}
              className="h-7 px-2 text-[11px]"
            >
              {copied ? (
                <Check className="h-3 w-3 text-brass-500" strokeWidth={2} />
              ) : (
                <Copy className="h-3 w-3" strokeWidth={1.75} />
              )}
            </Button>
          </div>
          <div className="flex-1 p-5 overflow-y-auto">
            {correctedText ? (
              <p className="text-[14px] text-surface-950 leading-relaxed whitespace-pre-wrap font-sans">
                {correctedText}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="h-5 w-5 text-brass-500/50 mb-3" strokeWidth={1.5} />
                <p className="font-display italic text-[13px] text-surface-600 tracking-tight-display">
                  Polished text will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Changes list */}
      {changes.length > 0 && (
        <div className="rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline p-4 max-h-40 overflow-y-auto">
          <h3 className="label-caps mb-3 block">
            Changes &mdash; {changes.length}
          </h3>
          <div className="space-y-2">
            {changes.map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-[11px] animate-fade-in"
              >
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wide-caps",
                    categoryColors[change.category] || categoryColors.grammar
                  )}
                >
                  {change.category}
                </span>
                <span className="text-red-500/80 line-through font-mono">
                  {change.original}
                </span>
                <ArrowRight className="h-3 w-3 text-brass-500/70 shrink-0" strokeWidth={1.75} />
                <span className="text-surface-950 font-medium">{change.corrected}</span>
                <span className="text-surface-600 truncate italic">
                  {change.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="flex items-center justify-center">
        <Button
          variant="glow"
          size="lg"
          onClick={handleCorrect}
          loading={isProcessing}
          disabled={!inputText.trim()}
          className="min-w-[220px]"
        >
          <Wand2 className="h-4 w-4" strokeWidth={1.75} />
          {isProcessing ? "Polishing…" : "Polish"}
        </Button>
      </div>
    </div>
  );
}
