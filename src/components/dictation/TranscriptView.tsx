import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useDictationStore } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { Copy, Check, Wand2, Languages } from "lucide-react";
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
        "flex flex-col rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/50 bg-surface-50/60">
        <span className="label-caps">
          Transcript
        </span>
        <div className="flex items-center gap-1">
          {hasContent && onCorrectGrammar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCorrectGrammar(fullText)}
              className="h-7 px-2 text-[11px]"
            >
              <Wand2 className="h-3 w-3" strokeWidth={1.75} />
              Polish
            </Button>
          )}
          {hasContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-[11px]"
            >
              {copied ? (
                <Check className="h-3 w-3 text-brass-500" strokeWidth={2} />
              ) : (
                <Copy className="h-3 w-3" strokeWidth={1.75} />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
      </div>

      {/* Transcript content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 min-h-[200px] max-h-[500px]"
        style={{ fontSize: `${fontSize}px` }}
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="divider-brass w-20 mb-4" />
            <p className="font-display italic text-[14px] text-surface-800 tracking-tight-display">
              No transcript yet.
            </p>
            <p className="text-[11px] text-surface-600 mt-1.5">
              Start dictating to see your words appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((segment) => (
              <div key={segment.id} className="group animate-fade-in">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] text-surface-600 font-mono tabular-nums mt-1 shrink-0">
                    {formatTimestamp(segment.timestamp)}
                  </span>
                  <div className="flex-1">
                    <p
                      className={cn(
                        "leading-relaxed",
                        segment.correctedText
                          ? "text-surface-950"
                          : "text-surface-900"
                      )}
                    >
                      {segment.correctedText || segment.text}
                      {segment.grammarApplied && (
                        <span className="inline-flex ml-1.5 align-middle">
                          <Wand2 className="h-3 w-3 text-brass-500" strokeWidth={1.75} />
                        </span>
                      )}
                    </p>
                    {segment.translatedText && (
                      <p className="mt-1 text-[0.92em] italic text-surface-700 leading-relaxed font-display flex items-baseline gap-1.5">
                        <Languages className="h-3 w-3 text-brass-500 shrink-0 self-center" strokeWidth={1.75} />
                        <span>
                          {segment.translatedText}
                          {segment.translatedToLanguage && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-surface-500 font-mono not-italic">
                              {segment.translatedToLanguage}
                            </span>
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Live transcription indicator */}
            {currentTranscript && (
              <div className="flex items-start gap-3 animate-fade-in">
                <span className="text-[10px] text-surface-600 font-mono tabular-nums mt-1 shrink-0">
                  {formatTimestamp(new Date())}
                </span>
                <p className="leading-relaxed text-surface-700 italic font-display">
                  {currentTranscript}
                  {status === "listening" && (
                    <span className="inline-block w-px h-4 bg-brass-500 ml-0.5 animate-pulse-soft align-text-bottom" />
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
