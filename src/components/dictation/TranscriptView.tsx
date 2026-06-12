import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useDictationStore } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { useFlywheelStore } from "@/stores/flywheel";
import { Copy, Check, Wand2, Languages, Pencil, Trash2, Replace, AlignLeft, List, RotateCcw } from "lucide-react";
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
  const updateSegment = useDictationStore((s) => s.updateSegment);
  const removeSegment = useDictationStore((s) => s.removeSegment);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [replaceCount, setReplaceCount] = useState<number | null>(null);
  const [paragraphMode, setParagraphMode] = useState(false);
  const [paraEditing, setParaEditing] = useState(false);
  const [paraValue, setParaValue] = useState("");
  const paraRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, currentTranscript]);

  const fullText = segments
    .map((s) => s.correctedText || s.text)
    .join(" ");

  const startEdit = useCallback((id: string, text: string) => {
    setEditingId(id);
    setEditValue(text);
    setTimeout(() => {
      editRef.current?.focus();
      editRef.current?.select();
    }, 0);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      updateSegment(editingId, { correctedText: trimmed, grammarApplied: false });
    }
    setEditingId(null);
  }, [editingId, editValue, updateSegment]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const deleteSegment = useCallback((id: string) => {
    removeSegment(id);
  }, [removeSegment]);

  const handleReplaceAll = useCallback(() => {
    if (!findValue.trim()) return;
    const segs = useDictationStore.getState().segments;
    let count = 0;
    segs.forEach((seg) => {
      const base = seg.correctedText ?? seg.text;
      if (base.includes(findValue)) {
        const next = base.split(findValue).join(replaceValue);
        updateSegment(seg.id, { correctedText: next });
        count++;
      }
    });
    setReplaceCount(count);
    if (count > 0) setFindValue("");
  }, [findValue, replaceValue, updateSegment]);

  const openParaEdit = useCallback(() => {
    const text = segments.map((s) => s.correctedText || s.text).join(" ");
    setParaValue(text);
    setParaEditing(true);
    setTimeout(() => paraRef.current?.focus(), 0);
  }, [segments]);

  const commitParaEdit = useCallback(() => {
    // Replace all segments with a single merged segment
    const { clearSession, addSegment } = useDictationStore.getState();
    clearSession();
    const trimmed = paraValue.trim();
    if (trimmed) {
      addSegment({
        id: crypto.randomUUID(),
        text: trimmed,
        timestamp: new Date(),
        confidence: 1.0,
        isFinal: true,
        grammarApplied: false,
      });
    }
    setParaEditing(false);
  }, [paraValue]);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setParagraphMode((p) => !p); setParaEditing(false); }}
            className="h-7 px-2 text-[11px]"
            title={paragraphMode ? "Switch to segment view" : "Switch to paragraph view"}
          >
            {paragraphMode ? <List className="h-3 w-3" strokeWidth={1.75} /> : <AlignLeft className="h-3 w-3" strokeWidth={1.75} />}
            {paragraphMode ? "Segments" : "Paragraph"}
          </Button>
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
              onClick={() => { setFindReplaceOpen((o) => !o); setReplaceCount(null); }}
              className="h-7 px-2 text-[11px]"
              title="Find & Replace"
            >
              <Replace className="h-3 w-3" strokeWidth={1.75} />
              Replace
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

      {/* Find & Replace bar */}
      {findReplaceOpen && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-300/50 bg-surface-100/60 flex-wrap">
          <input
            autoFocus
            type="text"
            placeholder="Find…"
            value={findValue}
            onChange={(e) => { setFindValue(e.target.value); setReplaceCount(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleReplaceAll(); if (e.key === "Escape") setFindReplaceOpen(false); }}
            className="h-6 rounded border border-surface-300/60 bg-surface-50 px-2 text-[11px] text-surface-900 outline-none focus:border-brass-400 w-32 shrink-0"
          />
          <input
            type="text"
            placeholder="Replace with…"
            value={replaceValue}
            onChange={(e) => setReplaceValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleReplaceAll(); if (e.key === "Escape") setFindReplaceOpen(false); }}
            className="h-6 rounded border border-surface-300/60 bg-surface-50 px-2 text-[11px] text-surface-900 outline-none focus:border-brass-400 w-32 shrink-0"
          />
          <button
            onClick={handleReplaceAll}
            className="h-6 px-2 text-[11px] rounded bg-brass-500/20 text-brass-600 hover:bg-brass-500/30 font-medium transition-colors shrink-0"
          >
            Replace All
          </button>
          {replaceCount !== null && (
            <span className="text-[10px] text-surface-600">
              {replaceCount > 0 ? `Replaced in ${replaceCount} segment${replaceCount !== 1 ? "s" : ""}` : "No matches"}
            </span>
          )}
          <button
            onClick={() => setFindReplaceOpen(false)}
            className="ml-auto text-[10px] text-surface-500 hover:text-surface-700 transition-colors shrink-0"
          >
            ✕
          </button>
        </div>
      )}

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
        ) : paragraphMode ? (
          <div className="h-full">
            {paraEditing ? (
              <div className="flex flex-col gap-2 h-full">
                <textarea
                  ref={paraRef}
                  value={paraValue}
                  onChange={(e) => setParaValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setParaEditing(false); }}
                  className="flex-1 w-full resize-none rounded border border-brass-400/50 bg-surface-100 p-3 text-surface-950 leading-relaxed outline-none focus:border-brass-500 focus:ring-1 focus:ring-brass-500/30"
                  style={{ fontSize: "inherit", minHeight: "160px" }}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={commitParaEdit}
                    className="text-[10px] px-2 py-0.5 rounded bg-brass-500/20 text-brass-600 hover:bg-brass-500/30 font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setParaEditing(false)}
                    className="text-[10px] px-2 py-0.5 rounded text-surface-500 hover:text-surface-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <span className="text-[9px] text-surface-500 ml-1">Esc to cancel</span>
                </div>
              </div>
            ) : (
              <p
                className="leading-relaxed text-surface-950 cursor-text whitespace-pre-wrap"
                title="Double-click to edit"
                onDoubleClick={openParaEdit}
              >
                {fullText}
                {currentTranscript && (
                  <span className="italic text-surface-700 font-display">
                    {" "}{currentTranscript}
                    {status === "listening" && (
                      <span className="inline-block w-px h-4 bg-brass-500 ml-0.5 animate-pulse-soft align-text-bottom" />
                    )}
                  </span>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((segment) => (
              <div key={segment.id} className="group animate-fade-in">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] text-surface-600 font-mono tabular-nums mt-1 shrink-0">
                    {formatTimestamp(segment.timestamp)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {segment.speakerLabel && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-brass-500 mb-0.5 block">
                        {segment.speakerLabel}
                      </span>
                    )}
                    {editingId === segment.id ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          ref={editRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="w-full resize-none rounded border border-brass-400/50 bg-surface-100 px-2 py-1 text-surface-950 leading-relaxed outline-none focus:border-brass-500 focus:ring-1 focus:ring-brass-500/30"
                          style={{ fontSize: "inherit" }}
                          rows={Math.max(2, Math.ceil(editValue.length / 60))}
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={commitEdit}
                            className="text-[10px] px-2 py-0.5 rounded bg-brass-500/20 text-brass-600 hover:bg-brass-500/30 font-medium transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-[10px] px-2 py-0.5 rounded text-surface-500 hover:text-surface-700 transition-colors"
                          >
                            Cancel
                          </button>
                          <span className="text-[9px] text-surface-500 ml-1">Enter to save · Esc to cancel</span>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={cn(
                          "leading-relaxed cursor-text",
                          segment.correctedText
                            ? "text-surface-950"
                            : "text-surface-900"
                        )}
                        title="Double-click to edit"
                        onDoubleClick={() => startEdit(segment.id, segment.correctedText ?? segment.text)}
                      >
                        {segment.words && !segment.correctedText
                          ? segment.words.map((w, i) => (
                              <span
                                key={i}
                                title={`Confidence: ${Math.round(w.confidence * 100)}%`}
                                className={cn(
                                  w.confidence < 0.75
                                    ? "bg-amber-400/20 text-amber-700 dark:text-amber-300 rounded px-0.5 cursor-help"
                                    : ""
                                )}
                              >
                                {w.punctuatedWord || w.word}{i < segment.words!.length - 1 ? " " : ""}
                              </span>
                            ))
                          : (segment.correctedText || segment.text)}
                        {segment.grammarApplied && (
                          <span className="inline-flex ml-1.5 align-middle">
                            <Wand2 className="h-3 w-3 text-brass-500" strokeWidth={1.75} />
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity align-middle">
                          {segment.grammarApplied && segment.correctedText && (
                            <button
                              onClick={() => {
                                updateSegment(segment.id, { correctedText: undefined, grammarApplied: false });
                                useFlywheelStore.getState().recordCorrectionFeedback(false);
                              }}
                              className="p-0.5 rounded text-surface-400 hover:text-amber-500 transition-colors"
                              title="Revert to original transcription"
                            >
                              <RotateCcw className="h-2.5 w-2.5" strokeWidth={2} />
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(segment.id, segment.correctedText ?? segment.text)}
                            className="p-0.5 rounded text-surface-400 hover:text-brass-500 transition-colors"
                            title="Edit segment"
                          >
                            <Pencil className="h-2.5 w-2.5" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => deleteSegment(segment.id)}
                            className="p-0.5 rounded text-surface-400 hover:text-red-400 transition-colors"
                            title="Delete segment"
                          >
                            <Trash2 className="h-2.5 w-2.5" strokeWidth={2} />
                          </button>
                        </span>
                      </p>
                    )}
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
