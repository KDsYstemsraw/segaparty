import { useEffect, useRef, useState } from "react";
import { Monitor, Tv, Maximize2, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  syncEmulatorJSControls,
  loadPlayerKeyboardMapping,
  getInternalEmulatorKeyCode,
} from "@/lib/gamepadMapping";

export interface EmulatorProps {
  romUrl: string;
  gameName?: string;
  core?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenControls?: () => void;
  onStreamReady?: (stream: MediaStream) => void;
  onAudioTrackAdded?: (track: MediaStreamTrack) => void;
  onVideoFrame?: (dataUrl: string) => void;
  onAudioChunk?: (pcmBase64: string, sampleRate: number) => void;
  hasActiveRtcPeers?: boolean;
}

declare global {
  interface Window {
    EJS_player: string;
    EJS_core: string;
    EJS_gameName?: string;
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
    __useRetroPartyFullscreen?: boolean;
    EJS_Buttons?: Record<string, { visible: boolean }>;
    __emulatorAudioStream?: MediaStream | null;
    __onEmulatorAudioChunk?: (pcmBase64: string, sampleRate: number) => void;
    __hasActiveRtcPeers?: boolean;
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

interface ExtendedAudioContext extends AudioContext {
  __captureBus?: GainNode;
  __streamDest?: MediaStreamAudioDestinationNode;
  __pcmTap?: ScriptProcessorNode;
  __silentGain?: GainNode;
  __attachedSources?: WeakSet<AudioNode>;
}

interface OpenALContext {
  audioCtx: ExtendedAudioContext;
  gain?: AudioNode;
  sources?: Record<string, { gain?: AudioNode } | undefined> | Array<{ gain?: AudioNode } | undefined>;
}

let activeAudioCtx: ExtendedAudioContext | null = null;
const trackedAudioContexts = new Set<ExtendedAudioContext>();

const OriginalAudioContext =
  typeof window !== "undefined"
    ? window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    : undefined;

let activeAudioTrackListener: ((track: MediaStreamTrack) => void) | null = null;

function getOpenALContext(): OpenALContext | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    EJS_emulator?: { Module?: { AL?: { currentCtx?: OpenALContext } } };
    EmulatorJS?: { Module?: { AL?: { currentCtx?: OpenALContext } } };
    Module?: { AL?: { currentCtx?: OpenALContext } };
    AL?: { currentCtx?: OpenALContext };
  };

  const al =
    win.EJS_emulator?.Module?.AL ||
    win.EmulatorJS?.Module?.AL ||
    win.Module?.AL ||
    win.AL;

  if (al?.currentCtx?.audioCtx) {
    return al.currentCtx;
  }
  return null;
}

function ensureCaptureBus(audioCtx: ExtendedAudioContext): {
  bus: GainNode;
  streamDest?: MediaStreamAudioDestinationNode;
  track?: MediaStreamTrack;
} {
  activeAudioCtx = audioCtx;
  trackedAudioContexts.add(audioCtx);

  if (!audioCtx.__captureBus) {
    const bus = audioCtx.createGain();
    bus.gain.value = 1.0;
    (bus as unknown as { __isInternalAudio: boolean }).__isInternalAudio = true;
    audioCtx.__captureBus = bus;
    console.debug("[audio-host] bus created");
  }
  const bus = audioCtx.__captureBus;

  if (!audioCtx.__streamDest && typeof audioCtx.createMediaStreamDestination === "function") {
    try {
      const dest = audioCtx.createMediaStreamDestination();
      bus.connect(dest);
      audioCtx.__streamDest = dest;
      window.__emulatorAudioStream = dest.stream;
    } catch (e) {
      console.warn("[audio-host] failed to create media stream destination:", e);
    }
  }

  // Setup ScriptProcessor for PCM tap if not already set up
  if (!audioCtx.__pcmTap && typeof audioCtx.createScriptProcessor === "function") {
    try {
      const pcmTap = audioCtx.createScriptProcessor(2048, 1, 1);
      const silentGain = audioCtx.createGain();
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
        const downsample = audioCtx.sampleRate >= 44100;
        const step = downsample ? 2 : 1;
        const outLen = Math.floor(input.length / step);
        const int16 = new Int16Array(outLen);
        const outSampleRate = downsample ? Math.floor(audioCtx.sampleRate / 2) : audioCtx.sampleRate;

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

      audioCtx.__pcmTap = pcmTap;
      audioCtx.__silentGain = silentGain;

      bus.connect(pcmTap);
      pcmTap.connect(silentGain);
      silentGain.connect(audioCtx.destination);
    } catch (e) {
      console.warn("[audio-host] PCM audio tap setup failed:", e);
    }
  }

  if (!audioCtx.__attachedSources) {
    audioCtx.__attachedSources = new WeakSet<AudioNode>();
  }

  const track = audioCtx.__streamDest?.stream.getAudioTracks()[0];
  return {
    bus,
    streamDest: audioCtx.__streamDest,
    track,
  };
}

export function getSharedHostAudioContext(): ExtendedAudioContext | null {
  if (typeof window === "undefined" || !OriginalAudioContext) return null;
  if (!activeAudioCtx || activeAudioCtx.state === "closed") {
    try {
      activeAudioCtx = new OriginalAudioContext() as ExtendedAudioContext;
      trackedAudioContexts.add(activeAudioCtx);
      console.debug("[audio-host] Initialized shared host AudioContext");
    } catch (e) {
      console.warn("[audio-host] Failed to create shared host AudioContext:", e);
    }
  }
  return activeAudioCtx;
}

function attachOpenALAudio(): MediaStreamTrack | null {
  const alCtx = getOpenALContext();
  if (alCtx?.audioCtx) {
    const audioCtx = alCtx.audioCtx;
    trackedAudioContexts.add(audioCtx);
    const { bus, track } = ensureCaptureBus(audioCtx);

    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(() => {
        console.debug("[audio-host] ctx resumed");
      }).catch(() => {});
    }

    const attached = audioCtx.__attachedSources || (audioCtx.__attachedSources = new WeakSet<AudioNode>());

    // Connect OpenAL master listener gain if available
    const alCtxGain = (alCtx as unknown as { gain?: AudioNode }).gain;
    if (alCtxGain && !attached.has(alCtxGain)) {
      try {
        alCtxGain.connect(bus);
        attached.add(alCtxGain);
        console.debug("[audio-host] master listener gain attached");
      } catch (e) {
        console.warn("[audio-host] failed to connect master gain:", e);
      }
    }

    const sources = alCtx.sources;
    if (sources) {
      for (const key in sources) {
        const src = (sources as Record<string, { gain?: AudioNode } | undefined>)[key];
        if (src?.gain && !attached.has(src.gain)) {
          try {
            src.gain.connect(bus);
            attached.add(src.gain);
            console.debug("[audio-host] source attached");
          } catch (e) {
            console.warn("[audio-host] failed to connect source gain:", e);
          }
        }
      }
    }

    if (track) {
      if (!(track as unknown as { __loggedReady?: boolean }).__loggedReady) {
        (track as unknown as { __loggedReady?: boolean }).__loggedReady = true;
        console.debug("[audio-host] track ready", track.id);
      }
      return track;
    }
  }

  // Fallback to EmulatorJS built-in audio capture via collectScreenRecordingMediaTracks
  try {
    const win = window as unknown as {
      EJS_emulator?: {
        collectScreenRecordingMediaTracks?: (canvas: HTMLCanvasElement, fps: number) => MediaStreamTrack[] | MediaStream | null;
      };
    };
    if (typeof win.EJS_emulator?.collectScreenRecordingMediaTracks === "function") {
      const targetCanvas = (document.querySelector("#game canvas") as HTMLCanvasElement) || document.createElement("canvas");
      const res = win.EJS_emulator.collectScreenRecordingMediaTracks(targetCanvas, 60);
      if (res) {
        const ejsTracks: MediaStreamTrack[] = Array.isArray(res)
          ? res
          : (typeof (res as MediaStream).getTracks === "function" ? (res as MediaStream).getAudioTracks() : []);
        const audioTrack = ejsTracks.find((t: MediaStreamTrack) => t.kind === "audio");
        if (audioTrack) {
          console.debug("[audio-host] Found EmulatorJS built-in audio track:", audioTrack.id);
          if (!window.__emulatorAudioStream) {
            window.__emulatorAudioStream = new MediaStream([audioTrack]);
          }
          if (activeAudioCtx && typeof activeAudioCtx.createMediaStreamSource === "function") {
            try {
              const attached = activeAudioCtx.__attachedSources || (activeAudioCtx.__attachedSources = new WeakSet<AudioNode>());
              const streamSource = activeAudioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
              if (!attached.has(streamSource)) {
                const { bus } = ensureCaptureBus(activeAudioCtx);
                streamSource.connect(bus);
                attached.add(streamSource);
              }
            } catch {}
          }
          if (!(audioTrack as unknown as { __loggedReady?: boolean }).__loggedReady) {
            (audioTrack as unknown as { __loggedReady?: boolean }).__loggedReady = true;
            console.debug("[audio-host] track ready", audioTrack.id);
          }
          return audioTrack;
        }
      }
    }
  } catch (e) {
    console.warn("[audio-host] EmulatorJS collectScreenRecordingMediaTracks fallback error:", e);
  }

  // Fallback to window.__emulatorAudioStream if available
  if (window.__emulatorAudioStream) {
    const tracks = window.__emulatorAudioStream.getAudioTracks();
    if (tracks.length > 0) {
      const track = tracks[0];
      if (!(track as unknown as { __loggedReady?: boolean }).__loggedReady) {
        (track as unknown as { __loggedReady?: boolean }).__loggedReady = true;
        console.debug("[audio-host] track ready", track.id);
      }
      return track;
    }
  }

  return null;
}

function getOrCreateCaptureTrack(): MediaStreamTrack | null {
  if (typeof window === "undefined") return null;

  let ctx = activeAudioCtx;
  if (!ctx || ctx.state === "closed") {
    ctx = getOpenALContext()?.audioCtx || null;
  }

  if (!ctx || ctx.state === "closed") {
    ctx = getSharedHostAudioContext();
  }

  if (ctx) {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const { track } = ensureCaptureBus(ctx);
    if (track) return track;
  }

  if (window.__emulatorAudioStream) {
    const tracks = window.__emulatorAudioStream.getAudioTracks();
    if (tracks.length > 0) return tracks[0];
  }

  return null;
}

// Intercept Web Audio connections so emulator audio is mirrored to a MediaStream and PCM tap
function installAudioCaptureHook() {
  if (typeof window === "undefined" || !OriginalAudioContext) return;

  // 1. AudioContext Proxy Unification:
  // Guarantee EmulatorJS, Emscripten OpenAL, and SDL all share the exact same AudioContext instance
  if (!(OriginalAudioContext as unknown as { __audioContextProxied?: boolean }).__audioContextProxied) {
    const AudioContextProxy = new Proxy(OriginalAudioContext, {
      construct(target, args, newTarget) {
        const shared = getSharedHostAudioContext();
        if (shared) {
          if (shared.state === "suspended") {
            shared.resume().catch(() => {});
          }
          return shared;
        }
        return Reflect.construct(target, args, newTarget);
      },
    });

    window.AudioContext = AudioContextProxy as unknown as typeof AudioContext;
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext =
      AudioContextProxy as unknown as typeof AudioContext;

    (OriginalAudioContext as unknown as { __audioContextProxied: boolean }).__audioContextProxied = true;
  }

  // 2. AudioNode.prototype.connect interception:
  const proto = AudioNode.prototype as unknown as {
    connect: (...args: unknown[]) => unknown;
    __audioConnectPatched?: boolean;
  };
  if (proto.__audioConnectPatched) return;
  const origConnect = proto.connect;

  proto.connect = function (this: AudioNode, destination: unknown, ...rest: unknown[]) {
    try {
      const ctx = this.context as ExtendedAudioContext | undefined;
      const isInternal = (this as unknown as { __isInternalAudio?: boolean }).__isInternalAudio;
      if (ctx && destination === ctx.destination && !isInternal) {
        trackedAudioContexts.add(ctx);
        if (ctx.state === "suspended") {
          ctx.resume().then(() => {
            console.debug("[audio-host] ctx resumed");
          }).catch(() => {});
        }

        const { bus } = ensureCaptureBus(ctx);
        const attached = ctx.__attachedSources || (ctx.__attachedSources = new WeakSet<AudioNode>());
        if (!attached.has(this)) {
          try {
            origConnect.call(this, bus);
            attached.add(this);
            console.debug("[audio-host] source attached");

            const newTrack = ctx.__streamDest?.stream.getAudioTracks()[0];
            if (newTrack) {
              activeAudioTrackListener?.(newTrack);
            }
          } catch {}
        }
      }
    } catch {
      // Ignore audio connect errors
    }
    return origConnect.call(this, destination, ...rest);
  };

  proto.__audioConnectPatched = true;
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
      Module?: {
        abort?: () => void;
        AL?: { currentCtx?: OpenALContext };
      };
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

  // 5. Clean up audio contexts & streams (QA-02 AudioContext leak fix)
  activeAudioTrackListener = null;
  const contextsToClose = new Set<ExtendedAudioContext>();
  if (activeAudioCtx) contextsToClose.add(activeAudioCtx);
  const alCtx = getOpenALContext();
  if (alCtx?.audioCtx) contextsToClose.add(alCtx.audioCtx);
  const ejsAL = win.EJS_emulator?.Module?.AL?.currentCtx?.audioCtx;
  if (ejsAL) contextsToClose.add(ejsAL);
  for (const ctx of trackedAudioContexts) {
    if (ctx) contextsToClose.add(ctx);
  }
  trackedAudioContexts.clear();
  activeAudioCtx = null;

  for (const ctx of contextsToClose) {
    try {
      if (ctx.__pcmTap) {
        ctx.__pcmTap.onaudioprocess = null;
        try {
          ctx.__pcmTap.disconnect();
        } catch {}
        delete ctx.__pcmTap;
      }
      if (ctx.__silentGain) {
        try {
          ctx.__silentGain.disconnect();
        } catch {}
        delete ctx.__silentGain;
      }
      if (ctx.__captureBus) {
        try {
          ctx.__captureBus.disconnect();
        } catch {}
        delete ctx.__captureBus;
      }
      if (ctx.__streamDest) {
        try {
          ctx.__streamDest.stream?.getTracks().forEach((t) => t.stop());
          ctx.__streamDest.disconnect();
        } catch {}
        delete ctx.__streamDest;
      }
      delete ctx.__attachedSources;

      if (ctx.state !== "closed" && typeof ctx.close === "function") {
        ctx.close().catch(() => {});
      }
    } catch (e) {
      console.warn("[audio-teardown] error closing audio context:", e);
    }
  }

  if (window.__emulatorAudioStream) {
    window.__emulatorAudioStream.getTracks().forEach((t) => t.stop());
    window.__emulatorAudioStream = null;
  }
  delete (window as unknown as { __onEmulatorAudioChunk?: unknown }).__onEmulatorAudioChunk;

  // 6. Delete global emulator instances and residual global properties
  if (win.EJS_emulator) {
    try {
      for (const key of Object.keys(win.EJS_emulator)) {
        try {
          delete (win.EJS_emulator as Record<string, unknown>)[key];
        } catch {}
      }
    } catch {}
  }
  delete (window as unknown as { EJS_emulator?: unknown }).EJS_emulator;
  delete (window as unknown as { EmulatorJS?: unknown }).EmulatorJS;
  delete (window as unknown as { Module?: unknown }).Module;
  delete (window as unknown as { AL?: unknown }).AL;
  delete (window as unknown as { FS?: unknown }).FS;
  delete (window as unknown as Record<string, unknown>).EJS_player;
  delete (window as unknown as Record<string, unknown>).EJS_core;
  delete (window as unknown as Record<string, unknown>).EJS_gameName;
  delete (window as unknown as Record<string, unknown>).EJS_gameUrl;
  delete (window as unknown as Record<string, unknown>).EJS_pathtodata;
  delete (window as unknown as Record<string, unknown>).EJS_startOnLoaded;
  delete (window as unknown as Record<string, unknown>).EJS_onGameStart;
  delete (window as unknown as Record<string, unknown>).EJS_on;
  delete (window as unknown as Record<string, unknown>).EJS_defaultControls;
  delete (window as unknown as Record<string, unknown>).EJS_disableDatabases;
  delete (window as unknown as Record<string, unknown>).EJS_disableLocalStorage;
  delete (window as unknown as Record<string, unknown>).EJS_defaultOptions;
  delete (window as unknown as Record<string, unknown>).EJS_threads;
  delete (window as unknown as Record<string, unknown>).__useRetroPartyFullscreen;
  delete (window as unknown as Record<string, unknown>).EJS_Buttons;
  delete (window as unknown as Record<string, unknown>).__hasActiveRtcPeers;
}

export function Emulator({
  romUrl,
  gameName,
  core = "segaMD",
  isFullscreen,
  onToggleFullscreen,
  onOpenControls,
  onStreamReady,
  onAudioTrackAdded,
  onVideoFrame,
  onAudioChunk,
  hasActiveRtcPeers,
}: EmulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streamReadyFired = useRef(false);
  const lastEmittedAudioTrackIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasActiveRtcPeersRef = useRef(hasActiveRtcPeers);
  hasActiveRtcPeersRef.current = hasActiveRtcPeers;

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
    window.__hasActiveRtcPeers = Boolean(hasActiveRtcPeers);
  }, [hasActiveRtcPeers]);

  useEffect(() => {
    if (!containerRef.current) return;

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

    installWebGLCaptureHook();
    installAudioCaptureHook();

    window.__hasActiveRtcPeers = Boolean(hasActiveRtcPeers);

    window.__onEmulatorAudioChunk = (pcmBase64: string, sampleRate: number) => {
      onAudioChunkRef.current?.(pcmBase64, sampleRate);
    };

    streamReadyFired.current = false;
    lastEmittedAudioTrackIdRef.current = null;

    activeAudioTrackListener = (track: MediaStreamTrack) => {
      if (track && track.id !== lastEmittedAudioTrackIdRef.current) {
        lastEmittedAudioTrackIdRef.current = track.id;
        console.debug("[audio-host] Emitting new live audio track:", track.id);
        onAudioTrackAddedRef.current?.(track);
      }
    };

    // Track all pending timers for cleanup
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

    const CORE_EXTENSIONS: Record<string, string> = {
      segaMD: ".bin",
      segaCD: ".iso",
      sega32x: ".32x",
      segaMS: ".sms",
      segaGG: ".gg",
      snes: ".sfc",
      nes: ".nes",
      gba: ".gba",
      gb: ".gb",
      gbc: ".gbc",
      n64: ".z64",
      psx: ".chd",
    };
    const fallbackExt = CORE_EXTENSIONS[core] || ".bin";
    let resolvedName = (gameName || "").trim();
    if (!resolvedName && romUrl && !romUrl.startsWith("blob:") && !romUrl.startsWith("data:")) {
      resolvedName = romUrl.split("/").pop()?.split("#")[0]?.split("?")[0] || "";
    }
    if (!resolvedName) {
      resolvedName = `game${fallbackExt}`;
    } else if (!resolvedName.includes(".")) {
      resolvedName = `${resolvedName}${fallbackExt}`;
    }

    window.EJS_player = "#game";
    window.EJS_core = core || "segaMD";
    window.EJS_gameName = resolvedName;
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

    // Host user gesture listener to resume AudioContext if suspended by browser autoplay policy
    const resumeSuspendedAudio = () => {
      if (activeAudioCtx && activeAudioCtx.state === "suspended") {
        activeAudioCtx.resume().then(() => {
          console.debug("[audio-host] ctx resumed");
        }).catch(() => {});
      }
      const alCtx = getOpenALContext();
      if (alCtx?.audioCtx && alCtx.audioCtx.state === "suspended") {
        alCtx.audioCtx.resume().then(() => {
          console.debug("[audio-host] alCtx resumed");
        }).catch(() => {});
      }
      for (const ctx of trackedAudioContexts) {
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      }
    };
    window.addEventListener("pointerdown", resumeSuspendedAudio);
    window.addEventListener("keydown", resumeSuspendedAudio);
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

    // WebSocket / Broadcast frame capture canvas & interval (~7 FPS fallback when WebRTC is inactive)
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

      // Start ~7 FPS (140ms) frame broadcast interval if onVideoFrame is requested
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
          // Dual-Transport Frame Throttling (QA-01):
          // When WebRTC video stream is active and serving peers, suppress WebSocket JPEG frame broadcasting
          // completely to avoid redundant ~350 KB/s TCP traffic and player input starvation.
          if (hasActiveRtcPeersRef.current || window.__hasActiveRtcPeers) return;
          if (sourceCanvas.width === 0 || sourceCanvas.height === 0) return;
          try {
            frameCtx.drawImage(sourceCanvas, 0, 0, 320, 224);
            const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.55);
            onVideoFrameRef.current(dataUrl);
          } catch {
            // Ignore capture error if canvas temporarily not ready
          }
        }, 140);
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

        // Ensure an audio track is ALWAYS present in composite from frame 0
        const audioTrack = attachOpenALAudio() || getOrCreateCaptureTrack();
        if (audioTrack && !composite.getAudioTracks().includes(audioTrack)) {
          composite.addTrack(audioTrack);
          lastEmittedAudioTrackIdRef.current = audioTrack.id;
          console.debug("[audio-host] Initial composite stream bundled with audio track:", audioTrack.id);
        }

        streamReadyFired.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        onStreamReadyRef.current(composite);

        return true;
      } catch (err) {
        console.warn("Capture stream attempt error:", err);
        return false;
      }
    };

    window.EJS_onGameStart = () => {
      syncAllControls();
      if (activeAudioCtx && activeAudioCtx.state === "suspended") {
        activeAudioCtx.resume().catch(() => {});
      }
      const alCtx = getOpenALContext();
      if (alCtx?.audioCtx && alCtx.audioCtx.state === "suspended") {
        alCtx.audioCtx.resume().catch(() => {});
      }
      attachOpenALAudio();
      if (tryCapture()) return;
      pendingTimeouts.push(setTimeout(tryCapture, 400));
      pendingTimeouts.push(setTimeout(tryCapture, 1200));
      pendingTimeouts.push(setTimeout(tryCapture, 2500));
    };

    // Persistent 1-second audio poll to attach new dynamic OpenAL sources and handle late audio initialization
    audioPollId = setInterval(() => {
      if (activeAudioCtx && activeAudioCtx.state === "suspended") {
        activeAudioCtx.resume().catch(() => {});
      }
      const alCtx = getOpenALContext();
      if (alCtx?.audioCtx && alCtx.audioCtx.state === "suspended") {
        alCtx.audioCtx.resume().catch(() => {});
      }
      const track = attachOpenALAudio();
      if (track && track.id !== lastEmittedAudioTrackIdRef.current) {
        lastEmittedAudioTrackIdRef.current = track.id;
        console.debug("[audio-host] Emitting new live audio track:", track.id);
        onAudioTrackAddedRef.current?.(track);
      }
    }, 1000);

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

    (window as unknown as Record<string, unknown>).__useRetroPartyFullscreen = true;
    (window as unknown as Record<string, unknown>).EJS_Buttons = {
      playPause: { visible: true },
      restart: { visible: true },
      mute: { visible: true },
      volumeSlider: { visible: true },
      saveState: { visible: true },
      loadState: { visible: true },
      settings: { visible: true },
      gamepad: { visible: true }, // Now opens RetroParty's ControlsModal via "open-retroparty-controls" event!
      fullscreen: { visible: true }, // Now triggers RetroParty's Custom Fullscreen via "retroparty-toggle-fullscreen" event!
      cheat: { visible: false },
      netplay: { visible: false },
      cacheManager: { visible: false },
      saveSavFiles: { visible: false },
      loadSavFiles: { visible: false },
      exitEmulation: { visible: false },
    };

    const script = document.createElement("script");
    script.src = "/emulatorjs/loader.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      window.removeEventListener("controls-mapping-changed", handleControlsMappingChanged);
      window.removeEventListener("pointerdown", resumeSuspendedAudio);
      window.removeEventListener("keydown", resumeSuspendedAudio);

      // Clear all tracked timers
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      for (const t of pendingTimeouts) clearTimeout(t);
      if (audioPollId) {
        clearInterval(audioPollId);
        audioPollId = null;
      }

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


  const toggleEmulatorBottomBar = () => {
    const ejs = (window as unknown as { EJS_emulator?: { menu?: { toggle?: () => void } } }).EJS_emulator;
    if (ejs?.menu?.toggle) {
      ejs.menu.toggle();
    }
  };

  const toggleFullscreen = () => {
    onToggleFullscreen?.();
  };

  return (
    <div className={`w-full flex flex-col items-center ${isFullscreen ? "h-full justify-center" : ""}`}>
      {/* Emulator container */}
      <div
        ref={containerRef}
        className={`w-full ${
          isFullscreen
            ? "max-w-none max-h-screen border-0 shadow-none rounded-none"
            : "max-w-4xl mx-auto border-4 border-primary shadow-[0_0_25px_rgba(0,71,187,0.5)] rounded-lg"
        } ${
          aspect43 ? "aspect-[4/3]" : "aspect-video"
        } bg-black relative overflow-hidden group`}
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
            onClick={toggleEmulatorBottomBar}
            className="h-7 px-2 text-xs font-sans text-muted-foreground hover:text-primary"
            title="Toggle Emulator Core Settings & Save States Bar"
          >
            <Sliders className="w-3.5 h-3.5 mr-1" /> Core Bar
          </Button>
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

