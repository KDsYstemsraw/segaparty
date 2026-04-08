import { useEffect, useRef } from "react";

interface EmulatorProps {
  romUrl: string;
  onStreamReady?: (stream: MediaStream) => void;
}

declare global {
  interface Window {
    EJS_player: string;
    EJS_core: string;
    EJS_gameUrl: string;
    EJS_pathtodata: string;
    EJS_startOnLoaded: boolean;
    EJS_onGameStart: () => void;
  }
}

export function Emulator({ romUrl, onStreamReady }: EmulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streamReadyFired = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    window.EJS_player = "#game";
    window.EJS_core = "segaMD";
    window.EJS_gameUrl = romUrl;
    window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
    window.EJS_startOnLoaded = true;

    const tryCapture = (): boolean => {
      if (streamReadyFired.current || !onStreamReady) return true;
      const canvas = document.querySelector("#game canvas") as HTMLCanvasElement | null;
      if (!canvas) return false;
      try {
        const stream = canvas.captureStream(30);
        if (stream.getVideoTracks().length === 0) return false;
        streamReadyFired.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        onStreamReady(stream);
        return true;
      } catch {
        return false;
      }
    };

    if (onStreamReady) {
      // EJS callback fires when the game actually starts — try immediately + with delays
      window.EJS_onGameStart = () => {
        if (tryCapture()) return;
        setTimeout(tryCapture, 500);
        setTimeout(tryCapture, 1500);
        setTimeout(tryCapture, 3000);
      };

      // Also poll every second as a fallback — handles cases where EJS_onGameStart
      // doesn't fire or canvas appears before/after expected timing
      let pollAttempts = 0;
      pollIntervalRef.current = setInterval(() => {
        if (tryCapture()) return;
        pollAttempts++;
        if (pollAttempts > 180) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }, 1000);
    }

    const script = document.createElement("script");
    script.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [romUrl]);

  return (
    <div className="w-full max-w-3xl mx-auto aspect-video bg-black border-4 border-primary shadow-[0_0_20px_rgba(0,71,187,0.4)] relative overflow-hidden">
      <div id="game" ref={containerRef} className="w-full h-full" />
    </div>
  );
}
