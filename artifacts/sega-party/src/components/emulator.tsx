import { useEffect, useRef, useState } from "react";
import { Monitor, Tv, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  syncEmulatorJSControls,
  loadPlayerKeyboardMapping,
  getInternalEmulatorKeyCode,
} from "@/lib/gamepadMapping";

export interface EmulatorProps {
  romUrl: string;
  core?: string;
  onStreamReady?: (stream: MediaStream) => void;
  onAudioTrackAdded?: (track: MediaStreamTrack) => void;
  onVideoFrame?: (dataUrl: string) => void;
  onAudioChunk?: (pcmBase64: string, sampleRate: number) => void;
}

declare global {
  interface Window {
    EJS_player: string;
    EJS_core: string;
    EJS_gameUrl: string;
    EJS_pathtodata: string;
    EJS_startOnLoaded: boolean;
    EJS_defaultControls?: Record<number, Record<number, { value: string | number; value2?: string }>>;
    EJS_onGameStart: () => void;
    EJS_on?: (event: string, ...args: unknown[]) => void;
    EJS_disableDatabases?: boolean;
    EJS_disableLocalStorage?: boolean;
    EJS_defaultOptions?: Record<string, string>;
    EJS_threads?: boolean;
    __emulatorAudioStream?: MediaStream | null;
    __onEmulatorAudioChunk?: (pcmBase64: string, sampleRate: number) => void;
  }
}

export type EjsWindow = Window;

// Hook WebGL getContext to enforce preserveDrawingBuffer: true so direct canvas.captureStream
// and canvas.toDataURL work reliably without black/flickering frames.
function installWebGLCaptureHook() {
  if (typeof window === "undefined") return;
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (type: string, attrs?: Record<string, unknown>) => unknown;
    __webglPatched?: boolean;
  };
  if (proto.__webglPatched) return;
  const origGetContext = proto.getContext;
  proto.getContext = function (this: HTMLCanvasElement, type: string, attrs?: Record<string, unknown>) {
    if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
      attrs = { ...(attrs || {}), preserveDrawingBuffer: true };
    }
    return origGetContext.call(this, type, attrs);
  };
  proto.__webglPatched = true;
}

// Intercept Web Audio connections so emulator audio is mirrored to a MediaStream and PCM tap
function installAudioCaptureHook() {
  if (typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass || (AudioContextClass as unknown as { __patched?: boolean }).__patched) return;

  const proto = AudioNode.prototype as unknown as { connect: (...args: unknown[]) => unknown };
  const origConnect = proto.connect;

  proto.connect = function (this: AudioNode, destination: unknown, ...rest: unknown[]) {
    try {
      const ctx = this.context as AudioContext | undefined;
      const isInternal = (this as unknown as { __isInternalAudio?: boolean }).__isInternalAudio;
      if (ctx && destination === ctx.destination && !isInternal) {
        // 1. MediaStreamDestination for WebRTC
        if (typeof ctx.createMediaStreamDestination === "function") {
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

        // 2. PCM Audio Chunk Tap via ScriptProcessorNode for WebSocket broadcast
        if (
          !(ctx as unknown as { __pcmTap?: ScriptProcessorNode }).__pcmTap &&
          typeof ctx.createScriptProcessor === "function"
        ) {
          try {
            const pcmTap = ctx.createScriptProcessor(2048, 1, 1);
            const silentGain = ctx.createGain();
            silentGain.gain.value = 0;
            (pcmTap as unknown as { __isInternalAudio: boolean }).__isInternalAudio = true;
            (silentGain as unknown as { __isInternalAudio: boolean }).__isInternalAudio = true;

            pcmTap.onaudioprocess = (e: AudioProcessingEvent) => {
              const cb = window.__onEmulatorAudioChunk;
              if (!cb) return;

              const input = e.inputBuffer.getChannelData(0);
              let hasSound = false;
              for (let i = 0; i < input.length; i++) {
                if (Math.abs(input[i]) > 0.001) {
                  hasSound = true;
                  break;
                }
              }
              if (!hasSound) return;

              // Downsample by 2x if sampleRate >= 44100 to conserve bandwidth
              const downsample = ctx.sampleRate >= 44100;
              const step = downsample ? 2 : 1;
              const outLen = Math.floor(input.length / step);
              const int16 = new Int16Array(outLen);
              const outSampleRate = downsample ? Math.floor(ctx.sampleRate / 2) : ctx.sampleRate;

              let outIdx = 0;
              for (let i = 0; i < input.length; i += step) {
                const s = Math.max(-1, Math.min(1, input[i]));
                int16[outIdx++] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }

              // Encode to Base64
              const uint8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
              let binary = "";
              const chunkSize = 8192;
              for (let i = 0; i < uint8.length; i += chunkSize) {
                const sub = uint8.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, sub as unknown as number[]);
              }
              const base64 = btoa(binary);
              cb(base64, outSampleRate);
            };

            (ctx as unknown as { __pcmTap: ScriptProcessorNode }).__pcmTap = pcmTap;
            (ctx as unknown as { __silentGain: GainNode }).__silentGain = silentGain;

            origConnect.call(pcmTap, silentGain);
            origConnect.call(silentGain, ctx.destination);
          } catch (e) {
            console.warn("PCM audio tap setup failed:", e);
          }
        }

        const pcmTap = (ctx as unknown as { __pcmTap?: ScriptProcessorNode }).__pcmTap;
        if (pcmTap) {
          origConnect.call(this, pcmTap);
        }
      }
    } catch {
      // Ignore audio connect errors
    }
    return origConnect.call(this, destination, ...rest);
  };

  (AudioContextClass as unknown as { __patched: boolean }).__patched = true;
}

// Call hooks immediately upon module import
installWebGLCaptureHook();
installAudioCaptureHook();



function teardownEmulator() {
  if (typeof window === "undefined") return;

  const win = window as unknown as {
    EJS_emulator?: {
      callEvent?: (event: string) => void;
      gameManager?: { functions?: { toggleMainLoop?: (val: number) => void } };
      Module?: { abort?: () => void };
      elements?: { parent?: HTMLElement };
    };
    Module?: { abort?: () => void };
  };

  // 1. Terminate Wasm main loop
  try {
    if (win.EJS_emulator?.gameManager?.functions?.toggleMainLoop) {
      win.EJS_emulator.gameManager.functions.toggleMainLoop(0);
    }
    if (typeof win.EJS_emulator?.callEvent === "function") {
      win.EJS_emulator.callEvent("exit");
    }
    if (typeof win.EJS_emulator?.Module?.abort === "function") {
      win.EJS_emulator.Module.abort();
    }
  } catch {}

  // 2. Forcibly release WebGL contexts on any canvas inside #game
  try {
    const canvases = document.querySelectorAll("#game canvas");
    canvases.forEach((c) => {
      const canvas = c as HTMLCanvasElement;
      const gl = canvas.getContext("webgl") || canvas.getContext("webgl2") || canvas.getContext("experimental-webgl");
      if (gl) {
        const ext = (gl as WebGLRenderingContext).getExtension?.("WEBGL_lose_context");
        ext?.loseContext?.();
      }
    });
  } catch {}

  // 3. Clear #game DOM node
  const gameEl = document.getElementById("game");
  if (gameEl) {
    gameEl.innerHTML = "";
  }

  // 4. Remove injected loader and emulator scripts
  document.querySelectorAll('script[src*="emulatorjs/"]').forEach((s) => s.remove());
  document.querySelectorAll('head link[href*="emulatorjs/"]').forEach((s) => s.remove());

  // 5. Clean up audio streams
  if (window.__emulatorAudioStream) {
    window.__emulatorAudioStream.getTracks().forEach((t) => t.stop());
    window.__emulatorAudioStream = null;
  }
  delete (window as unknown as { __onEmulatorAudioChunk?: unknown }).__onEmulatorAudioChunk;

  // 6. Delete global emulator instances
  delete (window as unknown as { EJS_emulator?: unknown }).EJS_emulator;
  delete (window as unknown as { EmulatorJS?: unknown }).EmulatorJS;
  delete (window as unknown as { Module?: unknown }).Module;
  delete (window as unknown as { AL?: unknown }).AL;
  delete (window as unknown as { FS?: unknown }).FS;
  delete (window as unknown as Record<string, unknown>).EJS_onGameStart;
  delete (window as unknown as Record<string, unknown>).EJS_on;
  delete (window as unknown as Record<string, unknown>).EJS_defaultControls;
}

export function Emulator({
  romUrl,
  core = "segaMD",
  onStreamReady,
  onAudioTrackAdded,
  onVideoFrame,
  onAudioChunk,
}: EmulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streamReadyFired = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onStreamReadyRef = useRef(onStreamReady);
  onStreamReadyRef.current = onStreamReady;

  const onAudioTrackAddedRef = useRef(onAudioTrackAdded);
  onAudioTrackAddedRef.current = onAudioTrackAdded;

  const onVideoFrameRef = useRef(onVideoFrame);
  onVideoFrameRef.current = onVideoFrame;

  const onAudioChunkRef = useRef(onAudioChunk);
  onAudioChunkRef.current = onAudioChunk;

  const [crtFilter, setCrtFilter] = useState(false);
  const [aspect43, setAspect43] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    installWebGLCaptureHook();
    installAudioCaptureHook();

    window.__onEmulatorAudioChunk = (pcmBase64: string, sampleRate: number) => {
      onAudioChunkRef.current?.(pcmBase64, sampleRate);
    };

    // Clean up any existing emulator instances, WebGL contexts, or DOM nodes
    teardownEmulator();

    // Clear any cached ejs- localStorage keys and delete EmulatorJS IndexedDB databases on mount
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("ejs-")) localStorage.removeItem(k);
      });
      window.indexedDB?.deleteDatabase?.("EmulatorJS-roms");
      window.indexedDB?.deleteDatabase?.("EmulatorJS-states");
    } catch {}

    // Reset audio stream reference for fresh capture
    if (window.__emulatorAudioStream) {
      window.__emulatorAudioStream.getTracks().forEach((t) => t.stop());
      window.__emulatorAudioStream = null;
    }

    streamReadyFired.current = false;

    // Track all pending timers for cleanup
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

    window.EJS_player = "#game";
    window.EJS_core = core || "segaMD";
    window.EJS_gameUrl = romUrl;
    window.EJS_pathtodata = "/emulatorjs/";
    window.EJS_startOnLoaded = true;

    const syncAllControls = () => {
      for (let slot = 1; slot <= 4; slot++) {
        syncEmulatorJSControls(slot, loadPlayerKeyboardMapping(slot), core);
      }
    };

    // When window.EJS_on or on("ready") / on("start") fires, synchronize all 4 player controls
    const prevEJSOn = window.EJS_on;
    window.EJS_on = (event: string, ...args: unknown[]) => {
      if (event === "ready" || event === "start" || event === "load") {
        syncAllControls();
      }
      if (typeof prevEJSOn === "function") {
        (prevEJSOn as Function)(event, ...args);
      }
    };

    // Synchronize controls at 500ms and 1500ms intervals to ensure sync after Wasm controls initialization
    pendingTimeouts.push(setTimeout(syncAllControls, 500));
    pendingTimeouts.push(setTimeout(syncAllControls, 1500));

    // Listen for controls-mapping-changed events
    const handleControlsMappingChanged = (e: Event) => {
      const customEvt = e as CustomEvent<{ playerSlot?: number }>;
      const slot = customEvt.detail?.playerSlot;
      if (slot) {
        syncEmulatorJSControls(slot, loadPlayerKeyboardMapping(slot), core);
      } else {
        syncAllControls();
      }
    };
    window.addEventListener("controls-mapping-changed", handleControlsMappingChanged);
    window.EJS_disableDatabases = true;
    window.EJS_disableLocalStorage = true;
    window.EJS_threads = typeof window !== "undefined" && Boolean(window.crossOriginIsolated);

    if (["segaMD", "segaCD", "sega32x"].includes(window.EJS_core)) {
      window.EJS_defaultOptions = {
        "genesis_plus_gx_joypad_1": "6 button",
        "genesis_plus_gx_joypad_2": "6 button",
      };
    } else if (window.EJS_core === "psx") {
      window.EJS_defaultOptions = {
        "pcsx_rearmed_pad1type": "standard",
        "pcsx_rearmed_pad2type": "standard",
      };
    } else {
      window.EJS_defaultOptions = {};
    }

    // Initialize all 4 ports (0..3) across RetroPad buttons (0..23) with isolated internal virtual keycodes (1000..1329).
    // Physical keyCodes are <= 255; this eliminates cross-player interference and prevents raw keyboard typing from triggering controls!
    const defaultControls: Record<number, Record<number, { value: number }>> = {};
    for (let port = 0; port < 4; port++) {
      defaultControls[port] = {};
      for (let btnId = 0; btnId <= 23; btnId++) {
        defaultControls[port][btnId] = { value: getInternalEmulatorKeyCode(port, btnId) };
      }
    }
    window.EJS_defaultControls = defaultControls;

    let audioPollId: ReturnType<typeof setInterval> | null = null;
    let audioPollTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // WebSocket / Broadcast frame capture canvas & interval (~15 FPS)
    let frameCanvas: HTMLCanvasElement | null = null;
    let frameCtx: CanvasRenderingContext2D | null = null;
    let frameBroadcastId: ReturnType<typeof setInterval> | null = null;

    // 2D Intermediate Capture Buffer Pump for WebGL (fallback if sourceCanvas.captureStream fails)
    let captureCanvas: HTMLCanvasElement | null = null;
    let captureCtx: CanvasRenderingContext2D | null = null;
    let animFrameId: number | null = null;

    const tryCapture = (): boolean => {
      const sourceCanvas = document.querySelector("#game canvas") as HTMLCanvasElement | null;
      if (!sourceCanvas || sourceCanvas.width <= 0 || sourceCanvas.height <= 0) return false;

      // Start 15 FPS frame broadcast interval if onVideoFrame is requested
      if (!frameBroadcastId) {
        frameCanvas = document.createElement("canvas");
        frameCanvas.width = 320;
        frameCanvas.height = 224;
        frameCtx = frameCanvas.getContext("2d", { alpha: false });
        if (frameCtx) {
          frameCtx.imageSmoothingEnabled = false;
        }

        frameBroadcastId = setInterval(() => {
          if (!onVideoFrameRef.current || !sourceCanvas || !frameCtx || !frameCanvas) return;
          if (sourceCanvas.width === 0 || sourceCanvas.height === 0) return;
          try {
            frameCtx.drawImage(sourceCanvas, 0, 0, 320, 224);
            const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.6);
            onVideoFrameRef.current(dataUrl);
          } catch {
            // Ignore capture error if canvas temporarily not ready
          }
        }, 66);
      }

      if (streamReadyFired.current) return true;
      if (!onStreamReadyRef.current) {
        streamReadyFired.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return true;
      }

      try {
        let videoStream: MediaStream | null = null;

        // Try direct sourceCanvas.captureStream(60) first (works reliably with preserveDrawingBuffer: true)
        const srcCaptureFn =
          sourceCanvas.captureStream ||
          (sourceCanvas as unknown as { mozCaptureStream?: (fps: number) => MediaStream }).mozCaptureStream;

        if (srcCaptureFn) {
          try {
            videoStream = srcCaptureFn.call(sourceCanvas, 60);
          } catch (err) {
            console.warn("Direct sourceCanvas.captureStream failed, falling back to 2D pump:", err);
          }
        }

        // Fallback to 2D intermediate capture pump if direct captureStream failed
        if (!videoStream || videoStream.getVideoTracks().length === 0) {
          const width = sourceCanvas.width || 320;
          const height = sourceCanvas.height || 224;

          if (!captureCanvas) {
            captureCanvas = document.createElement("canvas");
            captureCanvas.width = width;
            captureCanvas.height = height;
            captureCanvas.style.position = "fixed";
            captureCanvas.style.top = "-9999px";
            captureCanvas.style.left = "-9999px";
            captureCanvas.style.width = `${width}px`;
            captureCanvas.style.height = `${height}px`;
            captureCanvas.style.opacity = "0";
            captureCanvas.style.pointerEvents = "none";
            document.body.appendChild(captureCanvas);
            captureCtx = captureCanvas.getContext("2d", { alpha: false });
            if (captureCtx) {
              captureCtx.imageSmoothingEnabled = false;
            }
          }

          let running = true;
          const pump = () => {
            if (!running) return;
            if (captureCtx && sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
              if (captureCanvas && (captureCanvas.width !== sourceCanvas.width || captureCanvas.height !== sourceCanvas.height)) {
                captureCanvas.width = sourceCanvas.width;
                captureCanvas.height = sourceCanvas.height;
                if (captureCtx) captureCtx.imageSmoothingEnabled = false;
              }
              try {
                captureCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
              } catch {}
            }
            animFrameId = requestAnimationFrame(pump);
          };
          animFrameId = requestAnimationFrame(pump);

          const fallbackCaptureFn =
            captureCanvas.captureStream ||
            (captureCanvas as unknown as { mozCaptureStream?: (fps: number) => MediaStream }).mozCaptureStream;

          if (fallbackCaptureFn) {
            videoStream = fallbackCaptureFn.call(captureCanvas, 60);
          }
        }

        if (!videoStream) return false;
        const videoTracks = videoStream.getVideoTracks();
        if (videoTracks.length === 0) return false;

        const composite = new MediaStream();
        composite.addTrack(videoTracks[0]);

        // Capture OpenAL audio from EmulatorJS / Emscripten AL context (Playtime pattern)
        const AL =
          (window as unknown as { EJS_emulator?: { Module?: { AL?: unknown } } }).EJS_emulator?.Module?.AL ||
          (window as unknown as { AL?: unknown }).AL;

        if (
          AL &&
          (AL as { currentCtx?: { audioCtx?: AudioContext; sources?: Record<string, { gain: AudioNode }> } }).currentCtx?.audioCtx
        ) {
          const alContext = (AL as { currentCtx: { audioCtx: AudioContext; sources: Record<string, { gain: AudioNode }> } }).currentCtx;
          const audioContext = alContext.audioCtx;
          const gainNodes: AudioNode[] = [];
          for (const sourceIdx in alContext.sources) {
            if (alContext.sources[sourceIdx]?.gain) {
              gainNodes.push(alContext.sources[sourceIdx].gain);
            }
          }
          if (gainNodes.length > 0) {
            const merger = audioContext.createChannelMerger(gainNodes.length);
            gainNodes.forEach((node) => node.connect(merger));
            const destination = audioContext.createMediaStreamDestination();
            merger.connect(destination);
            const audioTracks = destination.stream.getAudioTracks();
            if (audioTracks.length > 0) {
              composite.addTrack(audioTracks[0]);
            }
          }
        } else if (window.__emulatorAudioStream) {
          window.__emulatorAudioStream.getAudioTracks().forEach((at) => composite.addTrack(at));
        }

        streamReadyFired.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        onStreamReadyRef.current(composite);

        // Check for late OpenAL audio if not yet captured initially
        if (composite.getAudioTracks().length === 0) {
          audioPollId = setInterval(() => {
            const curAL =
              (window as unknown as { EJS_emulator?: { Module?: { AL?: unknown } } }).EJS_emulator?.Module?.AL ||
              (window as unknown as { AL?: unknown }).AL;
            if (
              curAL &&
              (curAL as { currentCtx?: { audioCtx?: AudioContext; sources?: Record<string, { gain: AudioNode }> } }).currentCtx?.audioCtx &&
              onAudioTrackAddedRef.current
            ) {
              const alCtx = (curAL as { currentCtx: { audioCtx: AudioContext; sources: Record<string, { gain: AudioNode }> } }).currentCtx;
              const gNodes: AudioNode[] = [];
              for (const sIdx in alCtx.sources) {
                if (alCtx.sources[sIdx]?.gain) gNodes.push(alCtx.sources[sIdx].gain);
              }
              if (gNodes.length > 0) {
                const m = alCtx.audioCtx.createChannelMerger(gNodes.length);
                gNodes.forEach((n) => n.connect(m));
                const d = alCtx.audioCtx.createMediaStreamDestination();
                m.connect(d);
                const aTracks = d.stream.getAudioTracks();
                if (aTracks.length > 0) {
                  onAudioTrackAddedRef.current(aTracks[0]);
                  if (audioPollId) clearInterval(audioPollId);
                  audioPollId = null;
                  return;
                }
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
      syncAllControls();
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

    window.EJS_disableDatabases = true;
    window.EJS_disableLocalStorage = true;
    window.EJS_threads = typeof window !== "undefined" && Boolean(window.crossOriginIsolated);
    if (["segaMD", "segaCD", "sega32x"].includes(window.EJS_core)) {
      window.EJS_defaultOptions = {
        "genesis_plus_gx_joypad_1": "6 button",
        "genesis_plus_gx_joypad_2": "6 button",
      };
    } else if (window.EJS_core === "psx") {
      window.EJS_defaultOptions = {
        "pcsx_rearmed_pad1type": "standard",
        "pcsx_rearmed_pad2type": "standard",
      };
    } else {
      window.EJS_defaultOptions = {};
    }

    const script = document.createElement("script");
    script.src = "/emulatorjs/loader.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      window.removeEventListener("controls-mapping-changed", handleControlsMappingChanged);

      // Clear all tracked timers
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      for (const t of pendingTimeouts) clearTimeout(t);
      if (audioPollId) clearInterval(audioPollId);
      if (audioPollTimeoutId) clearTimeout(audioPollTimeoutId);

      // Clean up frame broadcast interval and canvas
      if (frameBroadcastId) {
        clearInterval(frameBroadcastId);
        frameBroadcastId = null;
      }
      frameCanvas = null;
      frameCtx = null;
      // Clean up 2D capture pump
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      if (captureCanvas && captureCanvas.parentNode) {
        captureCanvas.parentNode.removeChild(captureCanvas);
      }

      // Remove the loader script tag
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }

      // Execute full Wasm/WebGL/DOM/script teardown
      teardownEmulator();
    };
  }, [romUrl, core]);


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

