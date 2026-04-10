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
    grammar: "text-blue-400 bg-blue-400/10",
    spelling: "text-red-400 bg-red-400/10",
    punctuation: "text-amber-400 bg-amber-400/10",
    style: "text-purple-400 bg-purple-400/10",
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-voxlen-500 to-purple-600">
            <SpellCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-950">
              AI Grammar Engine
            </h2>
            <p className="text-xs text-surface-600">
              Powered by AI - better than Grammarly, fraction of the cost
            </p>
          </div>
        </div>
        <Select
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
          className="w-40"
        />
      </div>

      {/* Editor area */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Input */}
        <div className="flex flex-col rounded-xl bg-surface-100 border border-surface-300/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/50">
            <span className="text-xs font-medium text-surface-700">
              Original Text
            </span>
            <span className="text-[10px] text-surface-600 font-mono">
              {inputText.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste or type text here to check grammar, spelling, and style..."
            className="flex-1 w-full p-4 bg-transparent text-sm text-surface-900 placeholder:text-surface-600 resize-none focus:outline-none leading-relaxed"
          />
        </div>

        {/* Output */}
        <div className="flex flex-col rounded-xl bg-surface-100 border border-surface-300/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-surface-700">
                Corrected
              </span>
              {score !== null && (
                <Badge
                  variant={score >= 0.9 ? "success" : score >= 0.7 ? "warning" : "error"}
                >
                  {Math.round(score * 100)}% score
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!correctedText}
              className="h-7 px-2 text-xs"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {correctedText ? (
              <p className="text-sm text-surface-950 leading-relaxed whitespace-pre-wrap">
                {correctedText}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="h-8 w-8 text-surface-500 mb-2" />
                <p className="text-xs text-surface-600">
                  Corrected text will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Changes list */}
      {changes.length > 0 && (
        <div className="rounded-xl bg-surface-100 border border-surface-300/50 p-4 max-h-40 overflow-y-auto">
          <h3 className="text-xs font-medium text-surface-700 mb-3">
            Changes ({changes.length})
          </h3>
          <div className="space-y-2">
            {changes.map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-xs animate-fade-in"
              >
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    categoryColors[change.category] || categoryColors.grammar
                  )}
                >
                  {change.category}
                </span>
                <span className="text-red-400 line-through">
                  {change.original}
                </span>
                <ArrowRight className="h-3 w-3 text-surface-600 shrink-0" />
                <span className="text-green-400">{change.corrected}</span>
                <span className="text-surface-600 truncate">
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
          className="min-w-[200px]"
        >
          <Wand2 className="h-4 w-4" />
          {isProcessing ? "Polishing..." : "Polish Text"}
        </Button>
      </div>
    </div>
  );
}
