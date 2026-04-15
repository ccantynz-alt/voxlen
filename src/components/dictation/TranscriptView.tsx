import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useDictationStore } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { Copy, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatTimestamp } from "@/lib/utils";

interface TranscriptViewProps {
  className?: string;
  onCorrectGrammar?: (text: string) => void;
}

export function TranscriptView({
  className,
  onCorrectGrammar,
}: TranscriptViewProps) {
  const segments = useDictationStore((s) => s.segments);
  const currentTranscript = useDictationStore((s) => s.currentTranscript);
  const status = useDictationStore((s) => s.status);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, currentTranscript]);

  const fullText = segments
    .map((s) => s.correctedText || s.text)
    .join(" ");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
    }
  };

  const hasContent = segments.length > 0 || currentTranscript;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl bg-surface-100 border border-surface-300/50 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/50">
        <span className="text-xs font-medium text-surface-700">
          Transcript
        </span>
        <div className="flex items-center gap-1">
          {hasContent && onCorrectGrammar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCorrectGrammar(fullText)}
              className="h-7 px-2 text-xs"
            >
              <Wand2 className="h-3 w-3" />
              Polish
            </Button>
          )}
          {hasContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
      </div>

      {/* Transcript content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[500px]"
        style={{ fontSize: `${fontSize}px` }}
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-surface-200 flex items-center justify-center mb-3">
              <svg
                className="h-5 w-5 text-surface-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <p className="text-sm text-surface-700 font-medium">
              No transcript yet
            </p>
            <p className="text-xs text-surface-600 mt-1">
              Start dictating to see your words appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((segment) => (
              <div key={segment.id} className="group animate-fade-in">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-surface-600 font-mono mt-1 shrink-0">
                    {formatTimestamp(segment.timestamp)}
                  </span>
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      segment.correctedText
                        ? "text-surface-950"
                        : "text-surface-900"
                    )}
                  >
                    {segment.correctedText || segment.text}
                    {segment.grammarApplied && (
                      <span className="inline-flex ml-1">
                        <Wand2 className="h-3 w-3 text-marcoreid-400" />
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}

            {/* Live transcription indicator */}
            {currentTranscript && (
              <div className="flex items-start gap-2 animate-fade-in">
                <span className="text-[10px] text-surface-600 font-mono mt-1 shrink-0">
                  {formatTimestamp(new Date())}
                </span>
                <p className="text-sm leading-relaxed text-surface-700 italic">
                  {currentTranscript}
                  {status === "listening" && (
                    <span className="inline-block w-0.5 h-4 bg-marcoreid-400 ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
