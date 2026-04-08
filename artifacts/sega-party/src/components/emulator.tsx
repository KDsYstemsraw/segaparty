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

  useEffect(() => {
    if (!containerRef.current) return;

    window.EJS_player = "#game";
    window.EJS_core = "segaMD";
    window.EJS_gameUrl = romUrl;
    window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
    window.EJS_startOnLoaded = true;

    if (onStreamReady) {
      window.EJS_onGameStart = () => {
        if (streamReadyFired.current) return;
        // Poll for the canvas that EmulatorJS creates inside #game
        let attempts = 0;
        const poll = setInterval(() => {
          const canvas = document.querySelector("#game canvas") as HTMLCanvasElement | null;
          if (canvas) {
            clearInterval(poll);
            try {
              const stream = canvas.captureStream(30);
              streamReadyFired.current = true;
              onStreamReady(stream);
            } catch (e) {
              // captureStream may fail if canvas is cross-origin tainted
            }
          }
          if (++attempts > 50) clearInterval(poll);
        }, 200);
      };
    }

    const script = document.createElement("script");
    script.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
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
