import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAudioStore } from "@/stores/audio";
import { useDictationStore } from "@/stores/dictation";

interface WaveformProps {
  className?: string;
  height?: number;
  barCount?: number;
}

export function Waveform({
  className,
  height = 80,
  barCount = 64,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const waveformData = useAudioStore((s) => s.waveformData);
  const status = useDictationStore((s) => s.status);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, width, h);

    const barWidth = width / barCount;
    const gap = 2;
    const effectiveBarWidth = barWidth - gap;
    const centerY = h / 2;

    // Sample the waveform data to match bar count
    const step = Math.max(1, Math.floor(waveformData.length / barCount));

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.min(i * step, waveformData.length - 1);
      let amplitude = waveformData[dataIndex] || 0;

      // Add some visual smoothing
      if (status === "listening") {
        // Add subtle animation when listening
        amplitude = Math.max(amplitude, 0.02 + Math.sin(Date.now() / 300 + i * 0.3) * 0.015);
      } else if (status === "idle" || status === "paused") {
        // Subtle idle animation
        amplitude = 0.01 + Math.sin(Date.now() / 800 + i * 0.5) * 0.008;
      }

      // Scale amplitude for visual appeal
      const normalizedAmp = Math.min(amplitude * 8, 1);
      const barHeight = Math.max(2, normalizedAmp * (h * 0.8));

      const x = i * barWidth + gap / 2;

      // Gradient based on status
      let color: string;
      if (status === "listening") {
        const intensity = normalizedAmp;
        const r = Math.round(51 + intensity * 0);
        const g = Math.round(102 + intensity * 50);
        const b = Math.round(255);
        color = `rgba(${r}, ${g}, ${b}, ${0.4 + intensity * 0.6})`;
      } else if (status === "processing") {
        color = `rgba(168, 85, 247, ${0.3 + normalizedAmp * 0.5})`;
      } else if (status === "error") {
        color = `rgba(239, 68, 68, ${0.3 + normalizedAmp * 0.5})`;
      } else {
        color = `rgba(113, 113, 122, ${0.2 + normalizedAmp * 0.3})`;
      }

      ctx.fillStyle = color;

      // Draw rounded bars from center
      const radius = Math.min(effectiveBarWidth / 2, 2);

      // Top bar
      roundRect(ctx, x, centerY - barHeight / 2, effectiveBarWidth, barHeight, radius);
    }

    if (status === "listening" || status === "processing") {
      animationRef.current = requestAnimationFrame(draw);
    }
  }, [waveformData, status, barCount]);

  useEffect(() => {
    draw();

    if (status === "listening" || status === "processing") {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, status]);

  return (
    <div className={cn("w-full", className)}>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}
