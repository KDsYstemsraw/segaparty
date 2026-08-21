import { useEffect, useRef, useState } from "react";
import { Monitor, Tv, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmulatorProps {
  romUrl: string;
  onStreamReady?: (stream: MediaStream) => void;
  onAudioTrackAdded?: (track: MediaStreamTrack) => void;
}

declare global {
  interface Window {
    EJS_player: string;
    EJS_core: string;
    EJS_gameUrl: string;
    EJS_pathtodata: string;
    EJS_startOnLoaded: boolean;
    EJS_defaultControls?: Record<number, Record<number, { value: string; value2?: string }>>;
    EJS_onGameStart: () => void;
    __emulatorAudioStream?: MediaStream | null;
  }
}

// Intercept Web Audio connections so emulator audio is mirrored to a MediaStream
function installAudioCaptureHook() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass || (AudioContextClass as unknown as { __patched?: boolean }).__patched) return;

  const proto = AudioNode.prototype as unknown as { connect: (...args: unknown[]) => unknown };
  const origConnect = proto.connect;

  proto.connect = function (this: AudioNode, destination: unknown, ...rest: unknown[]) {
    try {
      const ctx = this.context as AudioContext | undefined;
      if (ctx && destination === ctx.destination && typeof ctx.createMediaStreamDestination === "function") {
        if (!(ctx as unknown as { __streamDest?: MediaStreamAudioDestinationNode }).__streamDest) {
          const streamDest = ctx.createMediaStreamDestination();
          (ctx as unknown as { __streamDest: MediaStreamAudioDestinationNode }).__streamDest = streamDest;
          window.__emulatorAudioStream = streamDest.stream;
        }
        const streamDest = (ctx as unknown as { __streamDest?: MediaStreamAudioDestinationNode }).__streamDest;
        if (streamDest) {
          origConnect.call(this, streamDest as unknown as AudioNode);
        }
      }
    } catch {
      // Ignore audio connect errors
    }
    return origConnect.call(this, destination, ...rest);
  };

  (AudioContextClass as unknown as { __patched: boolean }).__patched = true;
}

// Call immediately upon module import
installAudioCaptureHook();


export function Emulator({ romUrl, onStreamReady, onAudioTrackAdded }: EmulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streamReadyFired = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onStreamReadyRef = useRef(onStreamReady);
  onStreamReadyRef.current = onStreamReady;

  const onAudioTrackAddedRef = useRef(onAudioTrackAdded);
  onAudioTrackAddedRef.current = onAudioTrackAdded;

  const [crtFilter, setCrtFilter] = useState(false);
  const [aspect43, setAspect43] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    installAudioCaptureHook();

    // Clean up any existing emulator instances or previous game DOM nodes
    const gameEl = document.getElementById("game");
    if (gameEl) {
      gameEl.innerHTML = "";
    }

    try {
      (window as unknown as { EJS_emulator?: { stop?: () => void } }).EJS_emulator?.stop?.();
    } catch {}
    delete (window as unknown as { EJS_emulator?: unknown }).EJS_emulator;

    // Reset audio stream reference for fresh capture
    if (window.__emulatorAudioStream) {
      window.__emulatorAudioStream.getTracks().forEach((t) => t.stop());
      window.__emulatorAudioStream = null;
    }

    streamReadyFired.current = false;

    window.EJS_player = "#game";
    window.EJS_core = "segaMD";
    window.EJS_gameUrl = romUrl;
    window.EJS_pathtodata = "/emulatorjs/";
    window.EJS_startOnLoaded = true;

    // Configure conflict-free default mappings for 4 players
    window.EJS_defaultControls = {
      0: { // Player 1
        0: { value: "z" },          // A
        1: { value: "x" },          // B
        2: { value: " " },          // MODE
        3: { value: "enter" },      // START
        4: { value: "up arrow" },   // DPAD_UP
        5: { value: "down arrow" }, // DPAD_DOWN
        6: { value: "left arrow" }, // DPAD_LEFT
        7: { value: "right arrow" },// DPAD_RIGHT
        8: { value: "c" },          // C
        9: { value: "a" },          // X
        10: { value: "s" },         // Y
        11: { value: "d" },         // Z
      },
      1: { // Player 2
        0: { value: "u" },
        1: { value: "o" },
        2: { value: "-" },
        3: { value: "0" },
        4: { value: "i" },
        5: { value: "k" },
        6: { value: "j" },
        7: { value: "l" },
        8: { value: "p" },
        9: { value: "7" },
        10: { value: "8" },
        11: { value: "9" },
      },
      2: { // Player 3
        0: { value: "v" },
        1: { value: "b" },
        2: { value: "2" },
        3: { value: "1" },
        4: { value: "t" },
        5: { value: "g" },
        6: { value: "f" },
        7: { value: "h" },
        8: { value: "n" },
        9: { value: "4" },
        10: { value: "5" },
        11: { value: "6" },
      },
      3: { // Player 4
        0: { value: "1" },
        1: { value: "3" },
        2: { value: "." },
        3: { value: "enter" },
        4: { value: "8" },
        5: { value: "2" },
        6: { value: "4" },
        7: { value: "6" },
        8: { value: "5" },
        9: { value: "7" },
        10: { value: "9" },
        11: { value: "+" },
      },
    };

    // Track all pending timers for cleanup
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
    let audioPollId: ReturnType<typeof setInterval> | null = null;
    let audioPollTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryCapture = (): boolean => {
      if (streamReadyFired.current || !onStreamReadyRef.current) return true;

      const ejs = (window as unknown as {
        EJS_emulator?: {
          canvas?: HTMLCanvasElement;
          collectScreenRecordingMediaTracks?: (canvas: HTMLCanvasElement, fps: number) => MediaStream;
        };
      }).EJS_emulator;

      const sourceCanvas = ejs?.canvas || (document.querySelector("#game canvas") as HTMLCanvasElement | null);
      if (!sourceCanvas) return false;

      try {
        let stream: MediaStream | null = null;
        if (typeof ejs?.collectScreenRecordingMediaTracks === "function") {
          stream = ejs.collectScreenRecordingMediaTracks(sourceCanvas, 60);
        }

        if (!stream || stream.getVideoTracks().length === 0) {
          const captureFn = sourceCanvas.captureStream || (sourceCanvas as unknown as { mozCaptureStream?: (fps: number) => MediaStream }).mozCaptureStream;
          if (!captureFn) return false;

          const videoStream = captureFn.call(sourceCanvas, 60);
          if (videoStream.getVideoTracks().length === 0) return false;

          const composite = new MediaStream();
          videoStream.getVideoTracks().forEach((vt) => composite.addTrack(vt));
          if (window.__emulatorAudioStream) {
            window.__emulatorAudioStream.getAudioTracks().forEach((at) => composite.addTrack(at));
          }
          stream = composite;
        }

        if (!stream || stream.getVideoTracks().length === 0) return false;

        streamReadyFired.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        onStreamReadyRef.current(stream);

        // Check for late OpenAL audio if not yet present in initial stream
        if (stream.getAudioTracks().length === 0) {
          audioPollId = setInterval(() => {
            if (ejs && typeof ejs.collectScreenRecordingMediaTracks === "function" && sourceCanvas && onAudioTrackAddedRef.current) {
              const fullStream = ejs.collectScreenRecordingMediaTracks(sourceCanvas, 60);
              const audioTracks = fullStream?.getAudioTracks() || [];
              if (audioTracks.length > 0) {
                onAudioTrackAddedRef.current(audioTracks[0]);
                if (audioPollId) clearInterval(audioPollId);
                audioPollId = null;
                return;
              }
            }
            if (window.__emulatorAudioStream && onAudioTrackAddedRef.current) {
              const audioTracks = window.__emulatorAudioStream.getAudioTracks();
              if (audioTracks.length > 0) {
                onAudioTrackAddedRef.current(audioTracks[0]);
                if (audioPollId) clearInterval(audioPollId);
                audioPollId = null;
              }
            }
          }, 800);

          audioPollTimeoutId = setTimeout(() => {
            if (audioPollId) clearInterval(audioPollId);
            audioPollId = null;
          }, 20000);
        }

        return true;
      } catch (err) {
        console.warn("Capture stream attempt error:", err);
        return false;
      }
    };

    window.EJS_onGameStart = () => {
      if (tryCapture()) return;
      pendingTimeouts.push(setTimeout(tryCapture, 400));
      pendingTimeouts.push(setTimeout(tryCapture, 1200));
      pendingTimeouts.push(setTimeout(tryCapture, 2500));
    };

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

    const script = document.createElement("script");
    script.src = "/emulatorjs/loader.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Clear all tracked timers
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      for (const t of pendingTimeouts) clearTimeout(t);
      if (audioPollId) clearInterval(audioPollId);
      if (audioPollTimeoutId) clearTimeout(audioPollTimeoutId);

      // Remove the loader script tag
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }

      // Remove injected emulator scripts from <head>
      document.querySelectorAll('head script[src*="emulatorjs/src/"]').forEach((s) => s.remove());
      document.querySelectorAll('head link[href*="emulatorjs/"]').forEach((s) => s.remove());

      // Stop and destroy the emulator instance
      try {
        (window as unknown as { EJS_emulator?: { stop?: () => void } }).EJS_emulator?.stop?.();
      } catch {}
      delete (window as unknown as { EJS_emulator?: unknown }).EJS_emulator;

      // Clean up audio stream
      if (window.__emulatorAudioStream) {
        window.__emulatorAudioStream.getTracks().forEach((t) => t.stop());
        window.__emulatorAudioStream = null;
      }

      // Clean up global EJS properties
      delete (window as unknown as Record<string, unknown>).EJS_onGameStart;
      delete (window as unknown as Record<string, unknown>).EJS_defaultControls;
    };
  }, [romUrl]);


  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Emulator container */}
      <div
        ref={containerRef}
        className={`w-full max-w-4xl mx-auto ${
          aspect43 ? "aspect-[4/3]" : "aspect-video"
        } bg-black border-4 border-primary shadow-[0_0_25px_rgba(0,71,187,0.5)] relative overflow-hidden group rounded-lg`}
      >
        <div id="game" className="w-full h-full" />

        {/* CRT Scanline filter overlay */}
        {crtFilter && (
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] z-10 opacity-70" />
        )}

        {/* Quick display controls overlay on hover */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-1 rounded backdrop-blur border border-primary/30 z-20">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCrtFilter(!crtFilter)}
            className={`h-7 px-2 text-xs font-sans uppercase ${crtFilter ? "text-accent font-bold" : "text-muted-foreground"}`}
            title="Toggle CRT Scanline Effect"
          >
            <Tv className="w-3.5 h-3.5 mr-1" /> CRT
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAspect43(!aspect43)}
            className="h-7 px-2 text-xs font-sans text-muted-foreground hover:text-primary"
            title="Toggle Aspect Ratio (4:3 / 16:9)"
          >
            <Monitor className="w-3.5 h-3.5 mr-1" /> {aspect43 ? "4:3" : "16:9"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-7 px-2 text-xs font-sans text-muted-foreground hover:text-primary"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

