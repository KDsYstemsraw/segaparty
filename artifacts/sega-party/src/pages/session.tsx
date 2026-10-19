import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useLocation } from "wouter";
import { useGetSession, useJoinSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Emulator } from "@/components/emulator";
import { getRomUrl, getRomName, getRomCore, setRom, setRomFromUrl, clearRom } from "@/lib/romStore";
import {
  getWsUrl,
  RTC_CONFIG,
  getStoredPlayerId,
  getStoredPlayerName,
  getStoredIsHost,
  setStoredPlayerIdentity,
  type PlayerInputEvent,
  type SlotState,
  type ChatMessage,
  type ParticipantInfo,
} from "@/lib/webrtc";
import {
  getPlayerActionKey,
  simulateEmulatorInput,
  loadPlayerKeyboardMapping,
  loadChatHotkey,
  formatKeyLabel,
  getConsoleActions,
  mouseButtonToToken,
  isMouseBinding,
} from "@/lib/gamepadMapping";
import { useGamepad } from "@/hooks/useGamepad";

import { ControlsModal } from "@/components/ControlsModal";
import { ControllerSlots } from "@/components/ControllerSlots";
import { ChatPanel } from "@/components/ChatPanel";
import { InGameChatOverlay } from "@/components/InGameChatOverlay";
import { TouchGamepad } from "@/components/TouchGamepad";
import { InviteModal } from "@/components/InviteModal";
import { RomFilePicker } from "@/components/RomFilePicker";
import { ConsolePicker } from "@/components/ConsolePicker";
import { getConsoleSystem, detectConsoleFromFilename } from "@/lib/consoles";
import { cleanRomTitle } from "@/lib/romUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Copy,
  Users,
  Wifi,
  WifiOff,
  AlertTriangle,
  HomeIcon,
  Gamepad2,
  Settings2,
  Sliders,
  Volume2,
  VolumeX,
  Maximize2,
  Tv,
  Share2,
  Smartphone,
  Sparkles,
  FolderOpen,
  Loader2,
  Disc,
  Zap,
  Wand2,
  ArrowLeft,
  Crown,
  UserPlus,
  Check,
  MessageSquare,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";


const DEFAULT_NICKNAMES = [
  "Sonic_Speed",
  "Tails_Flyer",
  "Knuckles_Brawler",
  "Shinobi_Ninja",
  "Streets_Axel",
  "Golden_Axe",
  "Gunstar_Hero",
  "Ecco_Dolphin",
  "Ristar_Star",
  "Mega_Player",
];

const mungeSdpFor60Fps = (sdpStr: string): string => {
  const lines = sdpStr.includes("\r\n") ? sdpStr.split("\r\n") : sdpStr.split("\n");
  const newLines: string[] = [];
  let inVideo = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("m=video")) {
      inVideo = true;
      newLines.push(line);
      // Force high-bandwidth allocation on video section (4 Mbps)
      newLines.push("b=AS:4000");
      newLines.push("b=TIAS:4000000");
      continue;
    } else if (line.startsWith("m=audio") || line.startsWith("m=application")) {
      inVideo = false;
    }

    if (inVideo && line.startsWith("a=fmtp:")) {
      const match = line.match(/^a=fmtp:(\d+)\s+(.*)$/);
      if (match) {
        const pt = match[1];
        const rest = match[2];
        // Add start, min, max bitrate and 60 FPS cap to codec parameters
        newLines.push(`a=fmtp:${pt} ${rest};x-google-start-bitrate=3000;x-google-min-bitrate=1500;x-google-max-bitrate=6000;max-fr=60`);
        continue;
      }
    }
    newLines.push(line);
  }
  return newLines.join("\r\n");
};

export default function SessionPage() {
  const params = useParams();
  const rawCode = params.code || "";
  const code = rawCode.toUpperCase();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [myPlayerId, setMyPlayerId] = useState<string>(() => getStoredPlayerId(code));
  const [myPlayerName, setMyPlayerName] = useState<string>(() => getStoredPlayerName(code));
  const myPeerId = useRef(crypto.randomUUID());
  const hasJoinedRef = useRef(Boolean(getStoredPlayerName(code) || myPlayerName));
  const hasDismissedPrompt = useRef(false);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  remoteStreamRef.current = remoteStream;
  const [hasWsStream, setHasWsStream] = useState(false);
  const [rtcVideoActive, setRtcVideoActive] = useState(false);
  const [wsReconnectTick, setWsReconnectTick] = useState(0);
  const wsRetryCountRef = useRef<number>(0);
  const wsImgRef = useRef<HTMLImageElement | null>(null);
  const nextAudioTimeRef = useRef<number>(0);
  const lastAudioChunkSentRef = useRef<number>(0);
  const rtcVideoActiveRef = useRef(false);
  const lastVideoTimeRef = useRef<{ time: number; timestamp: number }>({ time: 0, timestamp: 0 });

  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [webrtcStatus, setWebrtcStatus] = useState<{ ice: string; tracks: number; lastSignal: string }>({
    ice: "idle",
    tracks: 0,
    lastSignal: "none",
  });
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [crtFilter, setCrtFilter] = useState(false);
  const [showTouchGamepad, setShowTouchGamepad] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageControlsVisible, setStageControlsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
    }
  }, []);

  const portalTarget =
    (typeof document !== "undefined" && (document.fullscreenElement as HTMLElement)) ||
    (typeof document !== "undefined" ? document.body : null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const guestAudioElRef = useRef<HTMLAudioElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsSlot, setControlsSlot] = useState<number | undefined>(undefined);
  const [chatOverlayOpen, setChatOverlayOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinPromptOpen, setJoinPromptOpen] = useState(false);
  const [romPickerOpen, setRomPickerOpen] = useState(false);
  const [newRomFile, setNewRomFile] = useState<File | null>(null);

  useEffect(() => {
    if (!romPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRomPickerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [romPickerOpen]);

  const [guestNameInput, setGuestNameInput] = useState(() => {
    return DEFAULT_NICKNAMES[Math.floor(Math.random() * DEFAULT_NICKNAMES.length)];
  });

  // Room & slots state
  const [slots, setSlots] = useState<SlotState>({ 1: null, 2: null, 3: null, 4: null });
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeRomName, setActiveRomName] = useState<string | null>(getRomName());
  const [activeCore, setActiveCore] = useState<string>(() => getRomCore() || "segaMD");
  const activeCoreRef = useRef(activeCore);
  activeCoreRef.current = activeCore;
  const [newRomCore, setNewRomCore] = useState<string>("segaMD");
  const consoleSys = getConsoleSystem(activeCore);
  const [currentRomUrl, setCurrentRomUrl] = useState<string | null>(() => getRomUrl());
  const [isReloadingRom, setIsReloadingRom] = useState(false);
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set());


  const wsRef = useRef<WebSocket | null>(null);
  const peerConnsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const gameStreamRef = useRef<MediaStream | null>(null);
  const pendingGuestsRef = useRef<Set<string>>(new Set());
  const guestDataChannelRef = useRef<RTCDataChannel | null>(null);
  const iceCandidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const participantsRef = useRef<ParticipantInfo[]>([]);
  const hostPeerIdRef = useRef<string | null>(null);
  const guestAudioCtxRef = useRef<AudioContext | null>(null);
  const guestAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const guestGainNodeRef = useRef<GainNode | null>(null);
  const lastRtcAudioEnergyTimeRef = useRef<number>(0);
  const rtcAnalyserRef = useRef<AnalyserNode | null>(null);


  const slotAssignmentsRef = useRef<SlotState>(slots);
  slotAssignmentsRef.current = slots;

  const joinSession = useJoinSession();

  const { data: session, isLoading, isError, refetch } = useGetSession(code, {
    query: {
      enabled: !!code,
      queryKey: getGetSessionQueryKey(code),
      refetchInterval: 5000,
    },
  });

  const romUrl = isReloadingRom ? "" : (currentRomUrl !== null ? currentRomUrl : getRomUrl());
  const [isStoredHost] = useState<boolean>(() => getStoredIsHost(code));
  const isHost = Boolean(
    (myPlayerId && session?.hostId && myPlayerId === session.hostId) ||
    isStoredHost
  );
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  // Determine current user's slot number (1, 2, 3, 4 or null)
  const mySlot: number | null = (() => {
    for (let i = 1; i <= 4; i++) {
      if (slots[i]?.peerId === myPeerId.current) return i;
    }
    return null;
  })();
  const effectiveSlot = mySlot ?? (!isHost ? 2 : 1);

  const [keyboardMapping, setKeyboardMapping] = useState(() => loadPlayerKeyboardMapping(effectiveSlot));
  const [chatHotkey, setChatHotkey] = useState<string>(() => loadChatHotkey(effectiveSlot));

  useEffect(() => {
    setKeyboardMapping(loadPlayerKeyboardMapping(effectiveSlot));
  }, [effectiveSlot]);

  useEffect(() => {
    const syncHotkey = () => setChatHotkey(loadChatHotkey(effectiveSlot));
    syncHotkey();
    window.addEventListener("chat-hotkey-changed", syncHotkey);
    return () => window.removeEventListener("chat-hotkey-changed", syncHotkey);
  }, [effectiveSlot]);

  useEffect(() => {
    const onMappingChanged = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.playerSlot === effectiveSlot) {
        setKeyboardMapping(loadPlayerKeyboardMapping(effectiveSlot));
      }
    };
    window.addEventListener("controls-mapping-changed", onMappingChanged);
    window.addEventListener("keyboard-mapping-changed", onMappingChanged);
    return () => {
      window.removeEventListener("controls-mapping-changed", onMappingChanged);
      window.removeEventListener("keyboard-mapping-changed", onMappingChanged);
    };
  }, [effectiveSlot]);


  // Prompt nickname modal ONLY if guest arrived without any stored or chosen nickname
  useEffect(() => {
    if (isLoading || !session) return;

    const storedName = getStoredPlayerName(code);
    const currentName = myPlayerName || storedName;

    // If the user already has a name chosen (or already submitted/dismissed), NEVER open the prompt
    if (currentName || hasJoinedRef.current || hasDismissedPrompt.current) {
      setJoinPromptOpen(false);
      return;
    }

    // If the user is the host, never show guest join prompt
    if (myPlayerId && session.hostId === myPlayerId) {
      setJoinPromptOpen(false);
      return;
    }

    // Only open if the user has no name and has not joined
    setJoinPromptOpen(true);
  }, [isLoading, session?.hostId, session?.code, myPlayerName, myPlayerId, code]);

  // Track button activity for live UI monitor
  const handleButtonActivity = useCallback((action: string, isDown: boolean) => {

    setActiveButtons((prev) => {
      const next = new Set(prev);
      if (isDown) next.add(action);
      else next.delete(action);
      return next;
    });
  }, []);

  // Route Gamepad & Virtual Gamepad Inputs
  const handleInputEvent = useCallback(
    (event: PlayerInputEvent) => {
      if (isHost || isHostRef.current) {
        // Direct C-Core simulation (simulateEmulatorInput handles RetroArch joypad or falls back to KeyboardEvent)
        (simulateEmulatorInput as any)(event.playerIndex, event.action, event.type === "keydown", activeCore);
      } else {
        // Guest sends over WebRTC Data Channel to Host if open
        if (guestDataChannelRef.current?.readyState === "open") {
          guestDataChannelRef.current.send(JSON.stringify(event));
        }
        // Dual-transport: Always also send over WebSocket signaling relay if open
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "player-input",
              sessionCode: code,
              input: event,
            }),
          );
        }
      }
    },
    [code, isHost, activeCore],
  );

  // Helper to release all currently active/held buttons when opening chat or modals
  const releaseAllHeldButtons = useCallback(() => {
    setActiveButtons((prev) => {
      if (prev.size === 0) return prev;
      prev.forEach((act) => {
        handleInputEvent({
          type: "keyup",
          playerIndex: effectiveSlot,
          action: act,
          key: act,
          keyCode: 0,
          code: act,
        });
      });
      return new Set();
    });
  }, [effectiveSlot, handleInputEvent]);

  useEffect(() => {
    if (controlsOpen || chatOverlayOpen) {
      releaseAllHeldButtons();
    }
  }, [controlsOpen, chatOverlayOpen, releaseAllHeldButtons]);

  useGamepad(effectiveSlot, handleInputEvent, handleButtonActivity);

  // Disconnect & kick ghost key release sweep helper (QA-05)
  const sweepSlotInputs = useCallback((slotNumber: number) => {
    try {
      const core = activeCoreRef.current || "segaMD";
      const standardActions = [
        "up",
        "down",
        "left",
        "right",
        "a",
        "b",
        "c",
        "x",
        "y",
        "z",
        "start",
        "select",
        "mode",
        "l",
        "r",
        "l2",
        "r2",
        "l3",
        "r3",
      ];
      const consoleActions = getConsoleActions(core).map((a) => a.id);
      const allActions = Array.from(new Set([...standardActions, ...consoleActions]));

      for (const action of allActions) {
        simulateEmulatorInput(slotNumber, action, false, core);
      }
    } catch (e) {
      console.warn(`[sweepSlotInputs] Failed to sweep inputs for slot ${slotNumber}:`, e);
    }
  }, []);

  // WebRTC Stalled Video Watchdog: falls back to WebSocket image stream if WebRTC video stalls or freezes (QA-07)
  useEffect(() => {
    if (isHost) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const now = Date.now();

      // Check if peer connection is disconnected/failed/closed
      let isIceDead = false;
      for (const [, pc] of peerConnsRef.current) {
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "closed"
        ) {
          isIceDead = true;
          break;
        }
      }

      if (isIceDead) {
        if (rtcVideoActiveRef.current) {
          console.debug("[WebRTC Watchdog] ICE disconnected/failed; switching to WebSocket fallback stream");
          rtcVideoActiveRef.current = false;
          setRtcVideoActive(false);
        }
        return;
      }

      if (!video.paused && video.videoWidth > 0) {
        const curTime = video.currentTime;
        if (curTime !== lastVideoTimeRef.current.time || video.readyState >= 3) {
          lastVideoTimeRef.current = { time: curTime, timestamp: now };
          if (!rtcVideoActiveRef.current) {
            rtcVideoActiveRef.current = true;
            setRtcVideoActive(true);
          }
        }
      }

      const lastUpdate = lastVideoTimeRef.current.timestamp;
      // Only flip rtcVideoActive(false) if video hasn't advanced for > 4000ms (4s)
      if (
        rtcVideoActiveRef.current &&
        lastUpdate > 0 &&
        now - lastUpdate > 4000
      ) {
        console.debug(`[WebRTC Watchdog] Video stalled (>4000ms without progress, elapsed=${now - lastUpdate}ms); unmasking WebSocket fallback stream`);
        rtcVideoActiveRef.current = false;
        setRtcVideoActive(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost]);

  // Send signaling helper
  const sendSignal = useCallback(
    (targetPeerId: string, data: unknown) => {
      wsRef.current?.send(
        JSON.stringify({
          type: "signal",
          sessionCode: code,
          targetPeerId,
          data,
        }),
      );
    },
    [code],
  );

  // Helper to safely parse SessionDescriptionInit from any wire format
  const toSdpInit = (raw: unknown, defaultType: "offer" | "answer"): RTCSessionDescriptionInit => {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (typeof obj.sdp === "string") {
        return {
          type: (obj.type as RTCSdpType) || defaultType,
          sdp: obj.sdp,
        };
      }
    }
    if (typeof raw === "string") {
      return { type: defaultType, sdp: raw };
    }
    return { type: defaultType, sdp: "" };
  };

  // Guest WebAudio pipeline: RMS Energy Monitor (AnalyserNode) + WS Playback Gain (non-competing with <audio>)
  const attachGuestWebAudio = useCallback((stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!guestAudioCtxRef.current) {
        guestAudioCtxRef.current = new AudioCtxClass();
      }
      const ctx = guestAudioCtxRef.current;

      // Ensure gain node connected to destination is ready for WebSocket PCM fallback playback
      if (!guestGainNodeRef.current) {
        const gain = ctx.createGain();
        gain.gain.value = isMutedRef.current ? 0 : volumeRef.current;
        gain.connect(ctx.destination);
        guestGainNodeRef.current = gain;
      } else {
        guestGainNodeRef.current.gain.value = isMutedRef.current ? 0 : volumeRef.current;
      }

      // Do NOT connect WebRTC MediaStreamSource to ctx.destination or guestGainNodeRef!
      // This prevents Chromium dual-consumer conflict (Issue 93367). Hardware WebRTC audio is played by <audio>.
      // Instead, connect audio-only stream source ONLY to an AnalyserNode for silent/active track detection.
      if (guestAudioSourceRef.current) {
        try { guestAudioSourceRef.current.disconnect(); } catch {}
      }

      if (!rtcAnalyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const silentMonitor = ctx.createGain();
        silentMonitor.gain.value = 0.00001;
        analyser.connect(silentMonitor);
        silentMonitor.connect(ctx.destination);
        rtcAnalyserRef.current = analyser;
      }

      const audioOnlyStream = new MediaStream(audioTracks);
      const source = ctx.createMediaStreamSource(audioOnlyStream);
      source.connect(rtcAnalyserRef.current);
      guestAudioSourceRef.current = source;

      if (ctx.state === "suspended" && !isMutedRef.current) {
        ctx.resume().catch(() => {});
      }
      console.debug("[audio-guest] WebAudio RMS AnalyserNode attached to remote audio tracks (hardware audio delegated to <audio>)");
    } catch (err) {
      console.warn("[audio-guest] WebAudio setup error:", err);
    }
  }, []);

  // Safe muted video play for 100% autoplay reliability (video engine never stalls)
  const safePlayVideo = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    if ("playoutDelayHint" in videoEl) {
      try {
        (videoEl as any).playoutDelayHint = 0;
      } catch {}
    }
    if (!videoEl.paused) return;
    videoEl.muted = true;
    videoEl.play().catch((err) => {
      console.debug("[video] safePlayVideo play failed:", err);
    });
  }, []);

  // Host creates WebRTC Offer for a connected guest with explicit transceivers
  const createHostOffer = useCallback(
    async (guestPeerId: string, stream: MediaStream | null, options?: { iceRestart?: boolean }) => {
      try {
        const existingPc = peerConnsRef.current.get(guestPeerId);
        if (options?.iceRestart && existingPc && existingPc.signalingState !== "closed") {
          try {
            console.debug(`[WebRTC] Initiating ICE restart for existing PC with ${guestPeerId}`);
            if (typeof existingPc.restartIce === "function") {
              existingPc.restartIce();
            }
            const offer = await existingPc.createOffer({ iceRestart: true });
            await existingPc.setLocalDescription(offer);
            setWebrtcStatus((prev) => ({ ...prev, lastSignal: `Sent ICE Restart Offer` }));
            const rawSdp = existingPc.localDescription?.sdp || "";
            const mungedSdp = mungeSdpFor60Fps(rawSdp);
            sendSignal(guestPeerId, {
              type: "offer",
              sdp: { type: "offer", sdp: mungedSdp },
              isRenegotiation: true,
            });
            return;
          } catch (iceErr) {
            console.warn(`[WebRTC] In-place ICE restart failed with ${guestPeerId}, falling back to new PC:`, iceErr);
          }
        }

        // Close any existing connection to prevent leaks
        if (existingPc) {
          try { existingPc.close(); } catch {}
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnsRef.current.set(guestPeerId, pc);

        // Create low-latency data channel for inputs
        const dc = pc.createDataChannel("inputs", {
          ordered: false,
          maxRetransmits: 0,
        });
        dataChannelsRef.current.set(guestPeerId, dc);

        dc.onclose = () => {
          console.debug(`[DataChannel] Inputs channel closed for guest ${guestPeerId}`);
          for (let s = 1; s <= 4; s++) {
            if (slotAssignmentsRef.current[s]?.peerId === guestPeerId) {
              sweepSlotInputs(s);
            }
          }
        };

        dc.onerror = () => {
          for (let s = 1; s <= 4; s++) {
            if (slotAssignmentsRef.current[s]?.peerId === guestPeerId) {
              sweepSlotInputs(s);
            }
          }
        };

        dc.onmessage = (e) => {
          try {
            const input = JSON.parse(e.data) as PlayerInputEvent;
            let assignedSlot: number | null = null;
            for (const s of [1, 2, 3, 4]) {
              if (slotAssignmentsRef.current[s]?.peerId === guestPeerId) {
                assignedSlot = s;
                break;
              }
            }
            if (assignedSlot !== null) {
              (simulateEmulatorInput as any)(assignedSlot, input.action, input.type === "keydown", activeCore);
            } else {
              // Peer is a spectator or has no slot. If requested slot is owned by someone else, ignore!
              const requestedSlot = Number(input.playerIndex) || 2;
              const owner = slotAssignmentsRef.current[requestedSlot];
              if (!owner || owner.peerId === guestPeerId) {
                (simulateEmulatorInput as any)(requestedSlot, input.action, input.type === "keydown", activeCore);
              }
            }
          } catch {}
        };

        if (stream) {
          stream.getTracks().forEach((track) => {
            if (track.kind === "video" && "contentHint" in track) {
              try {
                track.contentHint = "motion";
              } catch {}
            }
            pc.addTrack(track, stream);
          });
        }

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            sendSignal(guestPeerId, { type: "ice-candidate", candidate: e.candidate.toJSON() });
          }
        };

        pc.onconnectionstatechange = () => {
          loggerDebug(`Host connectionState with ${guestPeerId}: ${pc.connectionState}`);
          setWebrtcStatus((prev) => ({
            ...prev,
            ice: pc.iceConnectionState || pc.connectionState,
          }));
        };

        pc.oniceconnectionstatechange = async () => {
          loggerDebug(`Host ICE with ${guestPeerId}: ${pc.iceConnectionState}`);
          setWebrtcStatus((prev) => ({ ...prev, ice: pc.iceConnectionState }));
          if (pc.iceConnectionState === "failed") {
            console.warn(`[WebRTC] Host ICE failed with ${guestPeerId}, initiating automatic ICE restart...`);
            try {
              if (typeof pc.restartIce === "function") {
                pc.restartIce();
              }
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              const rawSdp = pc.localDescription?.sdp || "";
              const mungedSdp = mungeSdpFor60Fps(rawSdp);
              sendSignal(guestPeerId, {
                type: "offer",
                sdp: { type: "offer", sdp: mungedSdp },
                isRenegotiation: true,
              });
            } catch (e) {
              console.error("[WebRTC] Host ICE restart error:", e);
            }
          }
        };

        const offer = await pc.createOffer(options?.iceRestart ? { iceRestart: true } : undefined);
        await pc.setLocalDescription(offer);

        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          try {
            const params = videoSender.getParameters();
            params.degradationPreference = "maintain-framerate";
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 4_000_000;
            params.encodings[0].maxFramerate = 60;
            await videoSender.setParameters(params);
            console.debug("[WebRTC] Successfully applied maintain-framerate & 60fps on videoSender");
          } catch (paramErr) {
            console.warn("[WebRTC] Failed to setParameters after setLocalDescription:", paramErr);
          }
        }

        setWebrtcStatus((prev) => ({ ...prev, lastSignal: `Sent Offer (${stream?.getTracks().length || 0} tracks)` }));
        const rawSdp = pc.localDescription?.sdp || "";
        const mungedSdp = mungeSdpFor60Fps(rawSdp);
        sendSignal(guestPeerId, {
          type: "offer",
          sdp: { type: "offer", sdp: mungedSdp },
          isRenegotiation: Boolean(options?.iceRestart),
        });
      } catch (err) {
        console.error("Error creating host offer:", err);
      }
    },
    [sendSignal, sweepSlotInputs],
  );

  // Helper debug log
  const loggerDebug = (msg: string) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[WebRTC] ${msg}`);
    }
  };

  // Handle incoming signaling messages from peers
  const handleSignal = useCallback(
    async (fromPeerId: string, data: Record<string, unknown>) => {
      try {
        if (data.type === "offer" && !isHost) {
          setWebrtcStatus((prev) => ({ ...prev, lastSignal: "Received Offer" }));
          let pc = peerConnsRef.current.get(fromPeerId);
          const isRenegotiation = Boolean(data.isRenegotiation && pc && pc.signalingState !== "closed");

          if (!isRenegotiation || !pc) {
            if (pc) {
              try { pc.close(); } catch {}
            }
            pc = new RTCPeerConnection(RTC_CONFIG);
            peerConnsRef.current.set(fromPeerId, pc);

            pc.ontrack = (e) => {
              console.debug(`[audio] Track received from ${fromPeerId}: kind=${e.track.kind}, id=${e.track.id}, readyState=${e.track.readyState}`);
              setWebrtcStatus((prev) => ({ ...prev, tracks: prev.tracks + 1 }));

              if (e.track.kind === "video") {
                lastVideoTimeRef.current = { time: 0, timestamp: 0 };
              }

              setRemoteStream((prev) => {
                let combined: MediaStream;
                if (!prev) {
                  const initialTracks = (e.streams && e.streams[0] ? e.streams[0].getTracks() : [e.track])
                    .filter((t) => t.readyState !== "ended");
                  if (!initialTracks.some((t) => t.id === e.track.id)) {
                    initialTracks.push(e.track);
                  }
                  combined = new MediaStream(initialTracks);
                } else {
                  // Filter out ended tracks and stale tracks of the same kind (QA-06)
                  const survivingTracks = prev.getTracks().filter((t) => {
                    if (t.readyState === "ended") return false;
                    if (t.kind === e.track.kind && t.id !== e.track.id) return false;
                    return true;
                  });
                  if (!survivingTracks.some((t) => t.id === e.track.id)) {
                    survivingTracks.push(e.track);
                  }
                  combined = new MediaStream(survivingTracks);
                }

                const videoTracks = combined.getVideoTracks();
                if (videoRef.current && videoTracks.length > 0) {
                  const currentVideoTracks = (videoRef.current.srcObject as MediaStream | null)?.getVideoTracks() || [];
                  if (currentVideoTracks.length !== videoTracks.length || currentVideoTracks[0]?.id !== videoTracks[0]?.id) {
                    videoRef.current.srcObject = new MediaStream(videoTracks);
                  }
                  if ("playoutDelayHint" in videoRef.current) {
                    try {
                      (videoRef.current as any).playoutDelayHint = 0;
                    } catch {}
                  }
                  safePlayVideo(videoRef.current);
                }

                const audioTracks = combined.getAudioTracks();
                if (audioTracks.length > 0) {
                  attachGuestWebAudio(combined);
                  if (guestAudioElRef.current) {
                    const currentAudioTracks = (guestAudioElRef.current.srcObject as MediaStream | null)?.getAudioTracks() || [];
                    if (currentAudioTracks.length !== audioTracks.length || currentAudioTracks[0]?.id !== audioTracks[0]?.id) {
                      guestAudioElRef.current.srcObject = new MediaStream(audioTracks);
                    }
                    guestAudioElRef.current.volume = isMutedRef.current ? 0 : volumeRef.current;
                    guestAudioElRef.current.muted = isMutedRef.current;
                    guestAudioElRef.current.play().catch((err) => {
                      console.debug("[audio-guest] <audio> autoplay waiting for user gesture:", err);
                      setAudioBlocked(true);
                    });
                  }
                }

                return combined;
              });
              setConnectionStatus("connected");

              const onUnmute = () => {
                console.debug(`[audio] Track unmuted: kind=${e.track.kind}, id=${e.track.id}`);
                if (videoRef.current) {
                  safePlayVideo(videoRef.current);
                }
                if (e.track.kind === "audio" && remoteStreamRef.current) {
                  attachGuestWebAudio(remoteStreamRef.current);
                  if (guestAudioElRef.current) {
                    guestAudioElRef.current.play().catch(() => {});
                  }
                }
              };

              e.track.addEventListener("unmute", onUnmute, { once: true });

              e.track.onended = () => {
                console.debug(`[webrtc] Track ended: kind=${e.track.kind}, id=${e.track.id}`);
                setRemoteStream((cur) => {
                  if (!cur) return null;
                  const active = cur.getTracks().filter((t) => t.id !== e.track.id && t.readyState !== "ended");
                  const nextStream = active.length > 0 ? new MediaStream(active) : null;
                  if (videoRef.current) {
                    const nextVideoTracks = nextStream?.getVideoTracks() || [];
                    const currentVideoTracks = (videoRef.current.srcObject as MediaStream | null)?.getVideoTracks() || [];
                    if (currentVideoTracks.length !== nextVideoTracks.length || currentVideoTracks[0]?.id !== nextVideoTracks[0]?.id) {
                      videoRef.current.srcObject = nextVideoTracks.length > 0 ? new MediaStream(nextVideoTracks) : null;
                    }
                  }
                  if (guestAudioElRef.current) {
                    const nextAudioTracks = nextStream?.getAudioTracks() || [];
                    const currentAudioTracks = (guestAudioElRef.current.srcObject as MediaStream | null)?.getAudioTracks() || [];
                    if (currentAudioTracks.length !== nextAudioTracks.length || currentAudioTracks[0]?.id !== nextAudioTracks[0]?.id) {
                      guestAudioElRef.current.srcObject = nextAudioTracks.length > 0 ? new MediaStream(nextAudioTracks) : null;
                    }
                  }
                  return nextStream;
                });
              };
            };

            pc.ondatachannel = (e) => {
              guestDataChannelRef.current = e.channel;
              e.channel.onclose = () => { guestDataChannelRef.current = null; };
            };

            pc.onicecandidate = (e) => {
              if (e.candidate) {
                sendSignal(fromPeerId, { type: "ice-candidate", candidate: e.candidate.toJSON() });
              }
            };

            pc.oniceconnectionstatechange = () => {
              setWebrtcStatus((prev) => ({ ...prev, ice: pc!.iceConnectionState }));
              if (pc!.iceConnectionState === "connected" || pc!.iceConnectionState === "completed") {
                setConnectionStatus("connected");
              } else if (pc!.iceConnectionState === "failed" || pc!.iceConnectionState === "disconnected") {
                setConnectionStatus("connecting");
                console.warn(`[WebRTC] Guest ICE state ${pc!.iceConnectionState}, requesting ICE restart...`);
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({
                      type: "request-ice-restart",
                      sessionCode: code,
                      fromPeerId: myPeerId.current,
                    }),
                  );
                }
              }
            };

            pc.onconnectionstatechange = () => {
              if (pc!.connectionState === "connected") {
                setConnectionStatus("connected");
              } else if (pc!.connectionState === "failed" || pc!.connectionState === "disconnected") {
                setConnectionStatus("connecting");
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({
                      type: "request-ice-restart",
                      sessionCode: code,
                      fromPeerId: myPeerId.current,
                    }),
                  );
                }
              }
            };
          }

          const sdpInit = toSdpInit(data.sdp, "offer");
          await pc.setRemoteDescription(new RTCSessionDescription(sdpInit));

          // Flush any queued ICE candidates for this peer
          if (!isRenegotiation) {
            const queued = iceCandidateQueueRef.current.get(fromPeerId) || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (candErr) {
                console.warn("Error adding queued ICE candidate:", candErr);
              }
            }
            iceCandidateQueueRef.current.delete(fromPeerId);
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          setWebrtcStatus((prev) => ({ ...prev, lastSignal: "Sent Answer" }));
          const rawAnswerSdp = pc.localDescription?.sdp || "";
          const mungedAnswerSdp = mungeSdpFor60Fps(rawAnswerSdp);
          sendSignal(fromPeerId, { type: "answer", sdp: { type: "answer", sdp: mungedAnswerSdp } });
          return;
        }

        if (data.type === "answer" && isHost) {
          setWebrtcStatus((prev) => ({ ...prev, lastSignal: "Received Answer" }));
          const pc = peerConnsRef.current.get(fromPeerId);
          if (pc) {
            const sdpInit = toSdpInit(data.sdp, "answer");
            await pc.setRemoteDescription(new RTCSessionDescription(sdpInit));

            // Re-apply videoSender parameters after answer is negotiated
            const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (videoSender) {
              try {
                const params = videoSender.getParameters();
                params.degradationPreference = "maintain-framerate";
                if (!params.encodings || params.encodings.length === 0) {
                  params.encodings = [{}];
                }
                params.encodings[0].maxBitrate = 4_000_000;
                params.encodings[0].maxFramerate = 60;
                await videoSender.setParameters(params);
                console.debug("[WebRTC] Re-applied maintain-framerate & 60fps on videoSender after setRemoteDescription(answer)");
              } catch (paramErr) {
                console.warn("[WebRTC] Failed to re-apply parameters after answer:", paramErr);
              }
            }

            // Flush any queued ICE candidates for this peer
            const queued = iceCandidateQueueRef.current.get(fromPeerId) || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (candErr) {
                console.warn("Error adding queued ICE candidate on host:", candErr);
              }
            }
            iceCandidateQueueRef.current.delete(fromPeerId);
          }
          return;
        }

        if (data.type === "ice-candidate") {
          const candidate = data.candidate as RTCIceCandidateInit;
          if (!candidate) return;

          const pc = peerConnsRef.current.get(fromPeerId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.warn("Error adding immediate ICE candidate:", err);
            }
          } else {
            // Buffer candidate until remote description is set
            const q = iceCandidateQueueRef.current.get(fromPeerId) || [];
            q.push(candidate);
            iceCandidateQueueRef.current.set(fromPeerId, q);
          }
          return;
        }
      } catch (signalErr) {
        console.error("Signal processing error:", signalErr);
      }
    },
    [isHost, sendSignal],
  );

  // Claim Controller Slot
  const handleClaimSlot = useCallback(
    (slotNumber: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "slot-claim",
            sessionCode: code,
            slot: slotNumber,
            peerId: myPeerId.current,
            playerName: myPlayerName,
          }),
        );
      }
    },
    [code, myPlayerName],
  );

  // Release Controller Slot
  const handleReleaseSlot = useCallback(
    (slotNumber?: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "slot-release",
            sessionCode: code,
            slot: slotNumber,
            peerId: myPeerId.current,
            playerName: myPlayerName,
          }),
        );
      }
    },
    [code, myPlayerName],
  );

  // Pass Controller Slot to another peer
  const handlePassSlot = useCallback(
    (slot: number, targetPeerId: string, targetPlayerName: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "slot-pass",
            sessionCode: code,
            slot,
            targetPeerId,
            targetPlayerName,
          }),
        );
      }
    },
    [code],
  );

  // Kick Controller Slot to Spectator
  const handleKickSlot = useCallback(
    (slot: number) => {
      // Immediately sweep slot inputs locally on the host (QA2-07)
      sweepSlotInputs(slot);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "slot-kick",
            sessionCode: code,
            slot,
          }),
        );
      }
    },
    [code, sweepSlotInputs],
  );

  // Request Controller Slot
  const handleRequestSlot = useCallback(
    (slot: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "slot-request",
            sessionCode: code,
            slot,
          }),
        );
        toast({
          title: "Request Sent",
          description: `Requested Player ${slot} controller.`,
        });
      }
    },
    [code, toast],
  );

  // WebSocket signaling connection
  useEffect(() => {
    if (!session || !myPlayerName) return;

    let unmounted = false;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    setConnectionStatus("connecting");

    ws.onopen = () => {
      wsRetryCountRef.current = 0; // Reset exponential backoff on successful connect
      if (isHost) {
        setConnectionStatus("connected");
      }
      const isReturningHost = Boolean((myPlayerId && session?.hostId && myPlayerId === session.hostId) || isStoredHost);
      ws.send(
        JSON.stringify({
          type: "join",
          sessionCode: code,
          role: isHost ? "host" : "guest",
          peerId: myPeerId.current,
          playerName: myPlayerName,
          romName: activeRomName || undefined,
          core: activeCore || undefined,
          hostSecret: (isHost || isReturningHost) ? myPlayerId : undefined,
        }),
      );
    };


    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;

        if (msg.type === "room-state") {
          if (msg.slots) {
            const incomingSlots = msg.slots as SlotState;
            if (isHostRef.current) {
              const prevSlots = slotAssignmentsRef.current;
              for (let s = 1; s <= 4; s++) {
                const prevOccupant = prevSlots[s];
                const newOccupant = incomingSlots[s];
                if (prevOccupant?.peerId && (!newOccupant || newOccupant.peerId !== prevOccupant.peerId)) {
                  sweepSlotInputs(s);
                }
              }
            }
            slotAssignmentsRef.current = incomingSlots;
            setSlots(incomingSlots);
          }
          if (msg.peers) {
            const peers = msg.peers as ParticipantInfo[];
            setParticipants(peers);
            participantsRef.current = peers;
          }
          if (msg.romName) setActiveRomName(msg.romName as string);
          if (msg.core) setActiveCore(msg.core as string);
          if (msg.hostPeerId) hostPeerIdRef.current = msg.hostPeerId as string;
        }

        if (msg.type === "slot-state") {
          if (msg.slots) {
            const incomingSlots = msg.slots as SlotState;
            if (isHostRef.current) {
              const prevSlots = slotAssignmentsRef.current;
              for (let s = 1; s <= 4; s++) {
                const prevOccupant = prevSlots[s];
                const newOccupant = incomingSlots[s];
                if (prevOccupant?.peerId && (!newOccupant || newOccupant.peerId !== prevOccupant.peerId)) {
                  sweepSlotInputs(s);
                }
              }
            }
            slotAssignmentsRef.current = incomingSlots;
            setSlots(incomingSlots);
          }
        }

        if (msg.type === "slot-request") {
          const slot = Number(msg.slot);
          const fromPeerId = msg.fromPeerId as string;
          const fromPlayerName = msg.fromPlayerName as string;
          const isSlotOwner = slotAssignmentsRef.current[slot]?.peerId === myPeerId.current;
          if (isSlotOwner || isHostRef.current) {
            toast({
              title: "Controller Requested",
              description: `${fromPlayerName} requested Player ${slot} controller.`,
              action: (
                <ToastAction
                  altText="Pass Controller"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold"
                  onClick={() => handlePassSlot(slot, fromPeerId, fromPlayerName)}
                >
                  Pass Controller
                </ToastAction>
              ),
            });
          }
        }

        if (msg.type === "participant-joined") {
          setParticipants((prev) => {
            const next = [
              ...prev.filter((p) => p.peerId !== msg.peerId),
              {
                peerId: msg.peerId as string,
                playerName: msg.playerName as string,
                role: msg.role as "host" | "guest",
              },
            ];
            participantsRef.current = next;
            return next;
          });
        }

        if (msg.type === "chat") {
          setMessages((prev) => [...prev, msg as unknown as ChatMessage]);
        }

        if (msg.type === "rom-change" || msg.type === "rom-info") {
          if (msg.core) setActiveCore(msg.core as string);
          if (msg.romName) setActiveRomName(msg.romName as string);
        }

        if (msg.type === "peer-joined" && isHost) {
          const guestPeerId = msg.peerId as string;
          const stream = gameStreamRef.current;
          if (stream) {
            createHostOffer(guestPeerId, stream);
          } else {
            pendingGuestsRef.current.add(guestPeerId);
          }
        }

        if (msg.type === "host-info" && !isHost) {
          hostPeerIdRef.current = msg.hostPeerId as string;
          setConnectionStatus("connecting");
        }

        if (
          msg.type === "player-input" &&
          (isHostRef.current || !!(window as unknown as { EJS_emulator?: unknown }).EJS_emulator) &&
          msg.input
        ) {
          const input = msg.input as PlayerInputEvent;
          const fromPeerId = msg.fromPeerId as string | undefined;
          let verifiedSlot = Number(input.playerIndex) || 2;
          if (fromPeerId) {
            let assignedSlot: number | null = null;
            for (const s of [1, 2, 3, 4]) {
              if (slotAssignmentsRef.current[s]?.peerId === fromPeerId) {
                assignedSlot = s;
                break;
              }
            }
            if (assignedSlot !== null) {
              verifiedSlot = assignedSlot;
            } else {
              // Guest has no assigned slot (spectator). If verifiedSlot has an owner, ignore input!
              const owner = slotAssignmentsRef.current[verifiedSlot];
              if (owner && owner.peerId !== fromPeerId) {
                return;
              }
            }
          }
          (simulateEmulatorInput as any)(
            verifiedSlot,
            input.action,
            input.type === "keydown",
            activeCore,
          );
        }

        if (msg.type === "video-frame" && !isHost) {
          if (wsImgRef.current) {
            wsImgRef.current.src = msg.frame as string;
          }
          setHasWsStream((prev) => (prev ? prev : true));
          setConnectionStatus("connected");
          setWebrtcStatus((prev) => ({ ...prev, lastSignal: "WS Live Stream" }));
        }

        if (msg.type === "audio-chunk" && !isHost) {
          const audioTracks = (guestAudioElRef.current?.srcObject as MediaStream | null)?.getAudioTracks() || [];
          const hasLiveUnmutedRtcTrack = Boolean(
            guestAudioElRef.current &&
            !guestAudioElRef.current.paused &&
            !guestAudioElRef.current.muted &&
            audioTracks.some((t) => t.readyState === "live" && t.enabled && !t.muted)
          );

          let hasRtcSignal = false;
          if (rtcAnalyserRef.current && hasLiveUnmutedRtcTrack) {
            const buf = new Float32Array(rtcAnalyserRef.current.fftSize);
            rtcAnalyserRef.current.getFloatTimeDomainData(buf);
            for (let i = 0; i < buf.length; i++) {
              if (Math.abs(buf[i]) > 0.002) {
                hasRtcSignal = true;
                lastRtcAudioEnergyTimeRef.current = Date.now();
                break;
              }
            }
          }
          const isRtcAudioPlaying =
            hasLiveUnmutedRtcTrack &&
            (rtcVideoActiveRef.current || hasRtcSignal || Date.now() - lastRtcAudioEnergyTimeRef.current < 1500);

          if (isRtcAudioPlaying) {
            // WebRTC audio is actively playing through <audio>; mute WS fallback gain and reset nextAudioTime to prevent any overlap/echo collision
            if (guestGainNodeRef.current) {
              guestGainNodeRef.current.gain.value = 0;
            }
            nextAudioTimeRef.current = 0;
          } else if (!isMutedRef.current) {
            try {
              const pcmBase64 = msg.pcm as string;
              const sampleRate = (msg.sampleRate as number) || 22050;
              if (pcmBase64) {
                const AudioCtxClass =
                  window.AudioContext ||
                  (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                if (AudioCtxClass) {
                  if (!guestAudioCtxRef.current) {
                    guestAudioCtxRef.current = new AudioCtxClass();
                  }
                  const ctx = guestAudioCtxRef.current;
                  if (ctx.state === "suspended") {
                    ctx.resume().catch(() => {});
                  }

                  const binaryString = atob(pcmBase64);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const int16Array = new Int16Array(bytes.buffer);
                  const numSamples = int16Array.length;

                  if (numSamples > 0) {
                    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
                    const channelData = audioBuffer.getChannelData(0);
                    for (let i = 0; i < numSamples; i++) {
                      channelData[i] = int16Array[i] / 32768.0;
                    }

                    const bufferSource = ctx.createBufferSource();
                    bufferSource.buffer = audioBuffer;

                    if (!guestGainNodeRef.current) {
                      const gain = ctx.createGain();
                      gain.gain.value = isMutedRef.current ? 0 : volumeRef.current;
                      gain.connect(ctx.destination);
                      guestGainNodeRef.current = gain;
                    } else {
                      guestGainNodeRef.current.gain.value = isMutedRef.current ? 0 : volumeRef.current;
                    }

                    bufferSource.connect(guestGainNodeRef.current);

                    const now = ctx.currentTime;
                    const JITTER_BUFFER_SECS = 0.08; // 80ms cushion prevents underrun clicks

                    if (nextAudioTimeRef.current < now) {
                      // Underrun or first packet: schedule 80ms ahead so subsequent chunks chain seamlessly
                      nextAudioTimeRef.current = now + JITTER_BUFFER_SECS;
                    } else if (nextAudioTimeRef.current > now + 0.4) {
                      // Excessive drift (>400ms): resync cleanly without overlapping active buffers
                      nextAudioTimeRef.current = now + JITTER_BUFFER_SECS;
                    }

                    const startTime = nextAudioTimeRef.current;
                    bufferSource.start(startTime);
                    nextAudioTimeRef.current = startTime + audioBuffer.duration;

                    console.debug(`[audio] WS chunk played: samples=${numSamples}, rate=${sampleRate}`);
                  }
                }
              }
            } catch (err) {
              console.debug("[audio] WS chunk playback error:", err);
            }
          }
        }

        if (msg.type === "no-host" && !isHost) {
          hostPeerIdRef.current = null;
          lastVideoTimeRef.current = { time: 0, timestamp: 0 };
          setRemoteStream(null);
          setHasWsStream(false);
          setRtcVideoActive(false);
          rtcVideoActiveRef.current = false;
          setConnectionStatus("error");
          toast({
            title: "Host not online",
            description: "Waiting for the host to launch the game.",
            variant: "destructive",
          });
        }

        if (msg.type === "error") {
          toast({
            title: "Action Failed",
            description: (msg.message as string) || "Could not complete action",
            variant: "destructive",
          });
        }

        if (msg.type === "signal") {
          handleSignal(msg.fromPeerId as string, msg.data as Record<string, unknown>);
        }

        if (msg.type === "request-ice-restart" && isHostRef.current) {
          const fromPeerId = (msg.fromPeerId as string) || (msg.peerId as string);
          if (fromPeerId) {
            console.debug(`[WebRTC] Host received request-ice-restart from ${fromPeerId}`);
            createHostOffer(fromPeerId, gameStreamRef.current, { iceRestart: true });
          }
        }

        if (msg.type === "peer-left") {
          const peerId = msg.peerId as string;
          const pc = peerConnsRef.current.get(peerId);
          if (pc) {
            pc.close();
            peerConnsRef.current.delete(peerId);
          }
          const dc = dataChannelsRef.current.get(peerId);
          if (dc) {
            dc.close();
            dataChannelsRef.current.delete(peerId);
          }
          pendingGuestsRef.current.delete(peerId);
          iceCandidateQueueRef.current.delete(peerId);

          if (isHostRef.current) {
            // Sweep all controller slots previously assigned to this peer (QA-05)
            for (let s = 1; s <= 4; s++) {
              if (slotAssignmentsRef.current[s]?.peerId === peerId) {
                sweepSlotInputs(s);
              }
            }
          }

          setParticipants((prev) => {
            const next = prev.filter((p) => p.peerId !== peerId);
            participantsRef.current = next;
            return next;
          });

          // Detect host leaving using tracked hostPeerId (not database ID)
          if (!isHost && peerId === hostPeerIdRef.current) {
            hostPeerIdRef.current = null;
            guestDataChannelRef.current = null;
            lastVideoTimeRef.current = { time: 0, timestamp: 0 };
            setRemoteStream(null);
            setHasWsStream(false);
            setRtcVideoActive(false);
            rtcVideoActiveRef.current = false;
            setConnectionStatus("idle");
          }
        }
      } catch {}
    };

    ws.onerror = () => setConnectionStatus("error");

    ws.onclose = () => {
      if (!unmounted) {
        const attempts = wsRetryCountRef.current;
        wsRetryCountRef.current += 1;
        const baseDelay = Math.min(15000, 1000 * Math.pow(1.8, Math.min(attempts, 6)));
        const jitter = 0.75 + Math.random() * 0.5;
        const delay = Math.max(500, Math.floor(baseDelay * jitter));
        console.debug(`[WS] Connection closed. Reconnecting in ${delay}ms (attempt ${attempts + 1})...`);
        setTimeout(() => {
          if (!unmounted) setWsReconnectTick((t) => t + 1);
        }, delay);
      }
    };

    return () => {
      unmounted = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave", sessionCode: code, peerId: myPeerId.current }));
      }
      ws.close();
      // NOTE: Do NOT close peerConnsRef or dataChannelsRef here!
      // Healthy WebRTC P2P streams must continue streaming uninterrupted even if the signaling WebSocket drops and reconnects (QA2-01).
    };
  }, [code, session?.hostId, myPlayerId, myPlayerName, session?.code, wsReconnectTick, createHostOffer, handleSignal, toast]);

  // Dedicated unmount cleanup effect for WebRTC connections
  useEffect(() => {
    return () => {
      peerConnsRef.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      peerConnsRef.current.clear();
      dataChannelsRef.current.forEach((dc) => {
        try { dc.close(); } catch {}
      });
      dataChannelsRef.current.clear();
      iceCandidateQueueRef.current.clear();
    };
  }, []);

  // Bind remote stream to HTML5 video/audio elements with auto-recovery and WebAudio pipeline (QA2-04)
  useEffect(() => {
    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      attachGuestWebAudio(remoteStream);
    }

    const audioTracks = remoteStream?.getAudioTracks() || [];
    if (guestAudioElRef.current && audioTracks.length > 0) {
      const currentAudioTracks = (guestAudioElRef.current.srcObject as MediaStream | null)?.getAudioTracks() || [];
      if (currentAudioTracks.length !== audioTracks.length || currentAudioTracks[0]?.id !== audioTracks[0]?.id) {
        guestAudioElRef.current.srcObject = new MediaStream(audioTracks);
      }
      guestAudioElRef.current.volume = isMutedRef.current ? 0 : volumeRef.current;
      guestAudioElRef.current.muted = isMutedRef.current;
      if (guestAudioElRef.current.paused) {
        guestAudioElRef.current.play().catch((err) => {
          console.debug("[audio-guest] <audio> autoplay waiting for user gesture:", err);
          setAudioBlocked(true);
        });
      }
    }

    const videoTracks = remoteStream?.getVideoTracks() || [];
    if (videoRef.current && videoTracks.length > 0) {
      const currentVideoTracks = (videoRef.current.srcObject as MediaStream | null)?.getVideoTracks() || [];
      if (currentVideoTracks.length !== videoTracks.length || currentVideoTracks[0]?.id !== videoTracks[0]?.id) {
        videoRef.current.srcObject = new MediaStream(videoTracks);
      }
      if ("playoutDelayHint" in videoRef.current) {
        try {
          (videoRef.current as any).playoutDelayHint = 0;
        } catch {}
      }
      safePlayVideo(videoRef.current);

      // Auto-trigger playback when video packets begin arriving
      videoTracks.forEach((track) => {
        track.onunmute = () => {
          if (videoRef.current) {
            safePlayVideo(videoRef.current);
          }
        };
      });

      // Auto-trigger playback when audio packets begin arriving
      audioTracks.forEach((track) => {
        track.onunmute = () => {
          console.debug(`[audio] Remote audio track unmuted: ${track.id}`);
          if (remoteStream) attachGuestWebAudio(remoteStream);
          if (guestAudioElRef.current && guestAudioElRef.current.paused) {
            guestAudioElRef.current.play().catch(() => {});
          }
        };
      });
    }
  }, [remoteStream, safePlayVideo, attachGuestWebAudio]);

  // Handle guest volume and mute adjustments
  useEffect(() => {
    isMutedRef.current = isMuted;
    volumeRef.current = volume;
    if (guestGainNodeRef.current) {
      guestGainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
    if (guestAudioElRef.current) {
      guestAudioElRef.current.volume = isMuted ? 0 : volume;
      guestAudioElRef.current.muted = isMuted;
    }
    if (videoRef.current) {
      videoRef.current.muted = true;
    }
  }, [volume, isMuted]);

  // When Host's emulator stream is ready, create offers for all connected guests
  const handleStreamReady = useCallback(
    (stream: MediaStream) => {
      gameStreamRef.current = stream;
      const guestsToOffer = new Set(pendingGuestsRef.current);
      participantsRef.current.forEach((p) => {
        if (p.peerId !== myPeerId.current) {
          guestsToOffer.add(p.peerId);
        }
      });
      for (const guestPeerId of guestsToOffer) {
        createHostOffer(guestPeerId, stream);
      }
      pendingGuestsRef.current.clear();
    },
    [createHostOffer],
  );


  // Late audio track addition from emulator
  const handleAudioTrackAdded = useCallback((track: MediaStreamTrack) => {
    if (!gameStreamRef.current) return;
    track.enabled = true;
    // Cleanly replace old audio tracks in gameStreamRef
    const oldAudioTracks = gameStreamRef.current.getAudioTracks();
    oldAudioTracks.forEach((t) => {
      if (t !== track) {
        gameStreamRef.current?.removeTrack(t);
      }
    });
    if (!gameStreamRef.current.getAudioTracks().includes(track)) {
      gameStreamRef.current.addTrack(track);
    }

    // Replace track on existing peer connections using RTCRtpSender.replaceTrack
    peerConnsRef.current.forEach(async (pc, peerId) => {
      try {
        const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio" || (s.track && oldAudioTracks.includes(s.track)));
        if (audioSender) {
          await audioSender.replaceTrack(track);
          console.debug(`[WebRTC] Successfully replaced audio track for peer ${peerId} via replaceTrack:`, track.id);
        } else {
          pc.addTrack(track, gameStreamRef.current!);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const rawSdp = pc.localDescription?.sdp || "";
          const mungedSdp = mungeSdpFor60Fps(rawSdp);
          sendSignal(peerId, {
            type: "offer",
            sdp: { type: "offer", sdp: mungedSdp },
            isRenegotiation: true,
          });
        }
      } catch (err) {
        console.warn(`[WebRTC] Failed to update audio track for peer ${peerId}:`, err);
      }
    });
  }, [sendSignal]);

  // Host dual-transport video frame broadcasting over WebSocket for instant guest view (throttled when RTC is active, QA-01)
  const handleVideoFrame = useCallback(
    (dataUrl: string) => {
      if (!isHost || wsRef.current?.readyState !== WebSocket.OPEN) return;

      const guests = participantsRef.current.filter((p) => p.peerId !== myPeerId.current);
      if (guests.length === 0 && peerConnsRef.current.size === 0) return;

      // Only broadcast WS video frame if at least one guest is not yet fully connected via WebRTC
      let anyGuestNeedsFallback = false;
      if (guests.length > 0) {
        anyGuestNeedsFallback = guests.some((guest) => {
          const pc = peerConnsRef.current.get(guest.peerId);
          if (!pc) return true;
          const isConnected =
            pc.connectionState === "connected" ||
            (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed");
          return !isConnected;
        });
      } else {
        for (const [, pc] of peerConnsRef.current) {
          const isConnected =
            pc.connectionState === "connected" ||
            (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed");
          if (!isConnected) {
            anyGuestNeedsFallback = true;
            break;
          }
        }
      }

      if (!anyGuestNeedsFallback) return;

      wsRef.current.send(
        JSON.stringify({
          type: "video-frame",
          sessionCode: code,
          frame: dataUrl,
        }),
      );
    },
    [code, isHost],
  );

  // Host dual-transport audio chunk broadcasting over WebSocket for instant guest sound
  const handleAudioChunk = useCallback(
    (pcmBase64: string, sampleRate: number) => {
      if (!isHost || wsRef.current?.readyState !== WebSocket.OPEN) return;

      const guests = participantsRef.current.filter((p) => p.peerId !== myPeerId.current);
      if (guests.length === 0 && peerConnsRef.current.size === 0) return;

      wsRef.current.send(
        JSON.stringify({
          type: "audio-chunk",
          sessionCode: code,
          pcm: pcmBase64,
          sampleRate,
        }),
      );
    },
    [code, isHost],
  );




  // Send Text Chat Message
  const handleSendMessage = useCallback(
    (text: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "chat",
            sessionCode: code,
            text,
          }),
        );
      }
    },
    [code],
  );

  // Capture-Phase Keyboard & Mouse input forwarding for assigned player slots
  useEffect(() => {
    const activeSlot = effectiveSlot;

    // Build authoritative action lookup from active user's configured keyboardMapping
    const activeKeyMap: Record<string, string> = {};
    for (const [action, key] of Object.entries(keyboardMapping)) {
      if (!key) continue;
      activeKeyMap[key] = action;
      if (key.length === 1) {
        activeKeyMap[key.toLowerCase()] = action;
        activeKeyMap[key.toUpperCase()] = action;
      } else {
        activeKeyMap[key.toLowerCase()] = action;
      }
    }

    const forwardKey = (e: KeyboardEvent, type: "keydown" | "keyup") => {
      // 1. Allow Synthetic Internal Emulator Events dispatched by simulateEmulatorInput
      if ((e as unknown as { __isInternalEmulatorKey?: boolean }).__isInternalEmulatorKey) {
        return;
      }
      if (!e.isTrusted) return;

      // Escape key guard: When chat overlay is open, Esc closes chat without exiting fullscreen
      if (chatOverlayOpen && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setChatOverlayOpen(false);
        return;
      }

      // 2. When Controls Modal or Join Modal is Open, block game inputs
      if (controlsOpen || joinPromptOpen || romPickerOpen || inviteOpen) {
        const gameEl = document.getElementById("game");
        if (gameEl && (gameEl.contains(e.target as Node) || document.activeElement === gameEl)) {
          e.stopPropagation();
        }
        return;
      }

      // 3. When Typing in Chat or Any Input/Textarea: never trigger game controls
      const activeEl = document.activeElement as HTMLElement | null;
      const isTextEntry =
        chatOverlayOpen ||
        (activeEl &&
          (activeEl.tagName === "TEXTAREA" ||
            (activeEl.tagName === "INPUT" &&
              (activeEl as HTMLInputElement).type !== "range" &&
              (activeEl as HTMLInputElement).type !== "button" &&
              (activeEl as HTMLInputElement).type !== "checkbox")));
      if (isTextEntry) {
        const gameEl = document.getElementById("game");
        if (gameEl && (gameEl.contains(e.target as Node) || document.activeElement === gameEl)) {
          e.stopPropagation();
        }
        return;
      }

      // 4. Chat Overlay Hotkey Trigger (Enter / Return or custom chatHotkey)
      const activeChatKey = chatHotkey || "Enter";
      const isChatTrigger =
        e.key === activeChatKey ||
        e.code === activeChatKey ||
        e.key.toLowerCase() === activeChatKey.toLowerCase();
      if (type === "keydown" && !e.repeat && isChatTrigger) {
        e.preventDefault();
        e.stopPropagation();
        releaseAllHeldButtons();
        setChatOverlayOpen(true);
        return;
      }

      // 5. Mapped Game Key for Local Player (effectiveSlot Only)
      const action = activeKeyMap[e.key] || activeKeyMap[e.key.toLowerCase()];
      if (!action) {
        // The user pressed a random / unbound key! Block it from reaching #game so EmulatorJS never sees random presses
        const gameEl = document.getElementById("game");
        if (gameEl && (gameEl.contains(e.target as Node) || document.activeElement === gameEl)) {
          e.stopPropagation();
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      handleButtonActivity(action, type === "keydown");

      const keyInfo = (getPlayerActionKey as any)(activeSlot, action, activeCore) || {
        key: e.key,
        keyCode: e.keyCode,
        code: e.code,
        label: action,
      };

      handleInputEvent({
        type,
        playerIndex: activeSlot,
        action,
        key: keyInfo.key,
        keyCode: keyInfo.keyCode,
        code: keyInfo.code,
      });
    };

    const forwardMouse = (e: MouseEvent, type: "mousedown" | "mouseup") => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === "BUTTON" ||
          targetEl.tagName === "INPUT" ||
          targetEl.tagName === "SELECT" ||
          targetEl.tagName === "TEXTAREA" ||
          targetEl.closest("button") ||
          targetEl.closest("[role='dialog']") ||
          targetEl.closest("[role='menu']"))
      ) {
        return;
      }

      const stageEl = videoContainerRef.current;
      if (!stageEl || !stageEl.contains(targetEl)) {
        return;
      }

      const mouseToken = mouseButtonToToken(e.button).toLowerCase();
      const action = activeKeyMap[mouseToken] || activeKeyMap[mouseButtonToToken(e.button)];
      if (!action) return;

      e.preventDefault();
      handleButtonActivity(action, type === "mousedown");

      handleInputEvent({
        type: type === "mousedown" ? "keydown" : "keyup",
        playerIndex: activeSlot,
        action,
        key: mouseToken,
        keyCode: 0,
        code: mouseToken,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => forwardKey(e, "keydown");
    const onKeyUp = (e: KeyboardEvent) => forwardKey(e, "keyup");
    const onMouseDown = (e: MouseEvent) => forwardMouse(e, "mousedown");
    const onMouseUp = (e: MouseEvent) => forwardMouse(e, "mouseup");
    const onContextMenu = (e: MouseEvent) => {
      const mouseToken = mouseButtonToToken(2).toLowerCase();
      const action = activeKeyMap[mouseToken] || activeKeyMap["Mouse2"] || activeKeyMap["mouse2"];
      if (action) {
        const stageEl = videoContainerRef.current;
        if (stageEl && stageEl.contains(e.target as Node)) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [
    effectiveSlot,
    isHost,
    activeCore,
    keyboardMapping,
    chatHotkey,
    chatOverlayOpen,
    controlsOpen,
    joinPromptOpen,
    romPickerOpen,
    inviteOpen,
    handleInputEvent,
    handleButtonActivity,
    releaseAllHeldButtons,
  ]);


  const handleLoadRomFile = async (file: File) => {
    setIsReloadingRom(true);
    setRomPickerOpen(false);
    // 1. Temporarily clear active stream and rom URL so previous Wasm/WebGL instance cleanly unmounts
    gameStreamRef.current = null;
    setCurrentRomUrl("");

    // 2. Give the browser 300ms to garbage collect previous WebAssembly memory and release WebGL contexts
    await new Promise((r) => setTimeout(r, 300));

    // 3. Set the new ROM in romStore and mount the new core
    const url = await setRom(file, newRomCore);
    const title = cleanRomTitle(file.name);
    setCurrentRomUrl(url);
    setActiveRomName(title);
    setActiveCore(newRomCore);
    setIsReloadingRom(false);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "rom-change",
          sessionCode: code,
          romName: title,
          core: newRomCore,
        }),
      );
    }
    toast({
      title: "ROM Loaded",
      description: `Loaded ${title} (${newRomCore})`,
    });
    setNewRomFile(null);
  };

  const handleUnloadRom = async () => {
    setIsReloadingRom(true);
    setRomPickerOpen(false);
    if (gameStreamRef.current) {
      gameStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      gameStreamRef.current = null;
    }
    setCurrentRomUrl("");
    setActiveRomName(null);
    clearRom();
    await new Promise((r) => setTimeout(r, 200));
    setIsReloadingRom(false);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "rom-change",
          sessionCode: code,
          romName: "",
          core: null,
        }),
      );
    }
    toast({
      title: "Game Ejected",
      description: "The previous game has been cleanly unloaded.",
    });
  };

  const handleQuickJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) return;

    const name = guestNameInput.trim();
    hasJoinedRef.current = true;
    setJoinPromptOpen(false);

    const fallbackPlayerId = myPlayerId || crypto.randomUUID();
    setStoredPlayerIdentity(code, fallbackPlayerId, name);
    setMyPlayerId(fallbackPlayerId);
    setMyPlayerName(name);

    joinSession.mutate(
      { code, data: { playerName: name } },
      {
        onSuccess: (resp) => {
          hasJoinedRef.current = true;
          setStoredPlayerIdentity(code, resp.playerId, name);
          setMyPlayerId(resp.playerId);
          setMyPlayerName(name);
          setJoinPromptOpen(false);
          // Optimistically update React Query cache so session.players immediately contains this player
          try {
            queryClient.setQueryData(getGetSessionQueryKey(code), resp.session);
          } catch {}
          refetch();
        },
        onError: () => {
          // Still keep the user in the room as guest/spectator with their entered name!
          hasJoinedRef.current = true;
          setJoinPromptOpen(false);
        },
      },
    );
  };

  const unlockAudio = useCallback(() => {
    console.debug("[audio] unlock called");
    const audioTracks = remoteStreamRef.current?.getAudioTracks() || [];
    if (guestAudioElRef.current && audioTracks.length > 0) {
      const currentAudioTracks = (guestAudioElRef.current.srcObject as MediaStream | null)?.getAudioTracks() || [];
      if (currentAudioTracks.length !== audioTracks.length || currentAudioTracks[0]?.id !== audioTracks[0]?.id) {
        guestAudioElRef.current.srcObject = new MediaStream(audioTracks);
      }
      guestAudioElRef.current.muted = false;
      guestAudioElRef.current.volume = volumeRef.current;
      guestAudioElRef.current.play().catch(() => {});
    } else if (guestAudioElRef.current) {
      guestAudioElRef.current.muted = false;
      guestAudioElRef.current.volume = volumeRef.current;
      guestAudioElRef.current.play().catch(() => {});
    }
    if (videoRef.current) {
      safePlayVideo(videoRef.current);
    }
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!guestAudioCtxRef.current && AudioCtxClass) {
      try {
        guestAudioCtxRef.current = new AudioCtxClass();
      } catch {}
    }
    if (guestAudioCtxRef.current && guestAudioCtxRef.current.state === "suspended") {
      guestAudioCtxRef.current.resume().catch(() => {});
    }
    if (guestAudioCtxRef.current) {
      if (!guestGainNodeRef.current) {
        try {
          const gain = guestAudioCtxRef.current.createGain();
          gain.gain.value = volumeRef.current;
          gain.connect(guestAudioCtxRef.current.destination);
          guestGainNodeRef.current = gain;
        } catch {}
      } else {
        guestGainNodeRef.current.gain.value = volumeRef.current;
      }
    }
    if (remoteStreamRef.current) {
      attachGuestWebAudio(remoteStreamRef.current);
    }
    setAudioBlocked(false);
    setIsMuted(false);
    isMutedRef.current = false;
  }, [safePlayVideo, attachGuestWebAudio]);

  // One-time listener to unlock audio on first keypress or pointerdown anywhere on page
  useEffect(() => {
    if (isHost) return;

    const handleFirstInteraction = () => {
      console.debug("[audio] First user interaction on guest page, unlocking audio");
      unlockAudio();
    };

    window.addEventListener("keydown", handleFirstInteraction, { once: true, capture: true });
    window.addEventListener("pointerdown", handleFirstInteraction, { once: true, capture: true });

    return () => {
      window.removeEventListener("keydown", handleFirstInteraction, true);
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
    };
  }, [isHost, unlockAudio]);


  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (videoContainerRef.current?.requestFullscreen) {
        videoContainerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen((prev) => !prev);
        });
        setIsFullscreen(true);
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleRetropartyToggle = (e: Event) => {
      const custom = e as CustomEvent<{ fullscreen?: boolean }>;
      if (custom.detail && typeof custom.detail.fullscreen === "boolean") {
        if (custom.detail.fullscreen) {
          if (!document.fullscreenElement && videoContainerRef.current?.requestFullscreen) {
            videoContainerRef.current.requestFullscreen().catch(() => {});
          }
          setIsFullscreen(true);
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          setIsFullscreen(false);
        }
      } else {
        toggleFullscreen();
      }
    };

    const handleOpenControls = () => {
      setControlsSlot(effectiveSlot);
      setControlsOpen(true);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("retroparty-toggle-fullscreen", handleRetropartyToggle);
    window.addEventListener("open-retroparty-controls", handleOpenControls);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("retroparty-toggle-fullscreen", handleRetropartyToggle);
      window.removeEventListener("open-retroparty-controls", handleOpenControls);
    };
  }, [toggleFullscreen, effectiveSlot]);

  const displayParticipants = participants.length > 0
    ? participants
    : (myPlayerName ? [{ peerId: myPeerId.current, playerName: myPlayerName, role: isHost ? ("host" as const) : ("guest" as const) }] : []);

  const guests = participants.filter((p) => p.peerId !== myPeerId.current);
  const hasActiveRtcPeers = Boolean(
    isHost &&
    guests.length > 0 &&
    guests.every((guest) => {
      const pc = peerConnsRef.current.get(guest.peerId);
      return (
        pc &&
        (pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed")
      );
    })
  );

  const getPlayerSlotForPeer = (peerId: string): number | null => {
    for (const [slotStr, holder] of Object.entries(slots)) {
      if (holder?.peerId === peerId) {
        return Number(slotStr);
      }
    }
    return null;
  };

  const openSlots = [1, 2, 3, 4].filter((s) => !slots[s]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center p-6 space-y-6 bg-background">
        <Skeleton className="w-full max-w-5xl aspect-video bg-muted" />
        <Skeleton className="w-full max-w-5xl h-32 bg-muted" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4 animate-bounce" />
        <h2 className="text-3xl font-display text-destructive mb-2">Room Not Found</h2>
        <p className="text-muted-foreground font-sans mb-6">
          The party room for code <span className="font-mono font-bold text-foreground">{code}</span> does not exist or has closed.
        </p>
        <Button onClick={() => setLocation("/")} className="bg-primary text-primary-foreground font-bold">
          <HomeIcon className="w-4 h-4 mr-2" /> Return to Lobby
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Top Navbar */}
      <header className="w-full border-b border-white/10 bg-card/85 backdrop-blur-xl sticky top-0 z-30 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
        {/* Left: Leave / Brand / Active Game */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 font-bold gap-1.5 rounded-xl transition-colors"
            title="Return to Party Lobby"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </Button>

          <button
            onClick={() => setLocation("/")}
            className="font-display font-black text-lg sm:text-xl text-primary hover:text-accent transition-colors flex items-center gap-1.5"
          >
            <Gamepad2 className="w-5 h-5 text-accent" />
            <span className="tracking-tight">RETROPARTY</span>
          </button>

          {activeRomName ? (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full max-w-[180px] lg:max-w-xs truncate shadow-inner">
              <Badge
                variant="outline"
                className={cn("text-[9px] font-bold py-0 px-1.5 uppercase shrink-0", consoleSys.badgeColor)}
              >
                {consoleSys.shortName}
              </Badge>
              <span className="text-xs font-semibold text-foreground truncate" title={activeRomName}>
                {activeRomName}
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full max-w-[180px] lg:max-w-xs truncate shadow-inner">
              <Badge
                variant="outline"
                className={cn("text-[9px] font-bold py-0 px-1.5 uppercase shrink-0", consoleSys.badgeColor)}
              >
                {consoleSys.shortName}
              </Badge>
              <span className="text-xs font-medium text-muted-foreground truncate">
                {consoleSys.name}
              </span>
            </div>
          )}
        </div>

        {/* Center: Interactive Room Code & Invite */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 bg-neutral-900/90 border border-white/10 rounded-xl px-2.5 py-1 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-muted-foreground font-sans tracking-wider">
              Room
            </span>
            <span className="font-mono font-bold text-xs sm:text-sm tracking-widest text-primary px-1">
              {session.code}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(session.code);
                toast({
                  title: "Room Code Copied",
                  description: `Copied ${session.code} to clipboard!`,
                });
              }}
              className="w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-md"
              title="Copy Room Code"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setInviteOpen(true)}
            className="h-8 px-2.5 text-xs font-bold border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl shadow-sm gap-1.5"
            title="Invite Friends with Link or QR Code"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invite Friends</span>
          </Button>
        </div>

        {/* Right: Controls, Game Switch & Keybinds */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Friendly Stream Status Pill */}
          {isHost ? (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[11px] font-semibold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Hosting Live</span>
            </div>
          ) : connectionStatus === "connected" || remoteStream || hasWsStream ? (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[11px] font-semibold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Live Stream</span>
            </div>
          ) : (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-400 text-[11px] font-semibold shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>Connecting...</span>
            </div>
          )}

          {/* Host Game Switcher & Eject */}
          {isHost && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRomPickerOpen(true)}
                className="h-8 px-2.5 text-xs font-bold border-white/20 bg-card/80 hover:bg-card text-foreground hover:text-primary gap-1.5 rounded-xl shadow-sm"
                title="Change or Load Game ROM"
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Change Game</span>
              </Button>
              {activeRomName && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnloadRom}
                  className="h-8 px-2 text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 gap-1.5 rounded-xl shadow-sm"
                  title="Eject Current ROM Cartridge"
                >
                  <Disc className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Eject</span>
                </Button>
              )}
            </>
          )}

          {/* Touch Gamepad toggle */}
          <Button
            size="sm"
            variant={showTouchGamepad ? "default" : "outline"}
            onClick={() => setShowTouchGamepad(!showTouchGamepad)}
            className="h-8 px-2.5 text-xs font-bold rounded-xl border-white/20 gap-1.5"
            title="Toggle On-Screen Mobile Touch Controller"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Touch Pad</span>
          </Button>

          {/* Primary Keybinds & Controller Setup Button */}
          <Button
            size="sm"
            onClick={() => {
              setControlsSlot(effectiveSlot);
              setControlsOpen(true);
            }}
            className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md hover:shadow-[0_0_16px_rgba(0,140,255,0.5)] transition-all gap-1.5"
            title={`Configure ${consoleSys.name} controller and keybinds for Player ${effectiveSlot}`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span>{consoleSys.shortName} Keybinds (P{effectiveSlot})</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Column: Stage & Controller Slots (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Cinema Game Stage Bezel */}
          <div className="w-full max-w-4xl mx-auto rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-neutral-900 to-black border border-white/10 shadow-2xl relative group">
            {isHost ? (
              isReloadingRom ? (
                <div className="w-full aspect-[4/3] bg-black rounded-xl border border-neutral-800 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-primary font-display text-lg tracking-wide">Switching Games...</p>
                  <p className="text-muted-foreground text-xs font-sans">Cleaning up previous console memory and preparing new system...</p>
                </div>
              ) : romUrl ? (
                <div
                  ref={videoContainerRef}
                  onClick={() => {
                    if (isTouchDevice || showTouchGamepad) {
                      setStageControlsVisible((v) => !v);
                    }
                  }}
                  className={cn(
                    "w-full relative overflow-hidden transition-all group",
                    isFullscreen
                      ? "fixed inset-0 z-[80] w-screen h-screen max-w-none rounded-none bg-black flex items-center justify-center"
                      : "rounded-xl"
                  )}
                >
                  <Emulator
                    key={`${romUrl}-${activeCore}`}
                    romUrl={romUrl}
                    gameName={activeRomName || getRomName() || undefined}
                    core={activeCore}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                    onOpenControls={() => {
                      setControlsSlot(effectiveSlot);
                      setControlsOpen(true);
                    }}
                    onStreamReady={handleStreamReady}
                    onAudioTrackAdded={handleAudioTrackAdded}
                    onVideoFrame={handleVideoFrame}
                    onAudioChunk={handleAudioChunk}
                    hasActiveRtcPeers={hasActiveRtcPeers}
                  />

                  {/* On-Screen In-Game Chat Overlay (Host) */}
                  <InGameChatOverlay
                    messages={messages}
                    participants={displayParticipants}
                    slots={slots}
                    myPeerId={myPeerId.current}
                    isOpen={chatOverlayOpen}
                    onOpenChange={(open) => {
                      if (open) releaseAllHeldButtons();
                      setChatOverlayOpen(open);
                    }}
                    onSendMessage={handleSendMessage}
                    chatHotkey={chatHotkey}
                  />

                  {/* Floating Frosted Glass In-Stream Controls Overlay (Host) */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute bottom-14 right-3 flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-2 z-[90] shadow-xl transition-opacity duration-200",
                      showTouchGamepad || isTouchDevice || stageControlsVisible
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {/* Toggle EmulatorJS Bottom Settings Bar */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const win = window as any;
                        if (typeof win.EJS_emulator?.menu?.toggle === "function") {
                          win.EJS_emulator.menu.toggle();
                        }
                      }}
                      className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg"
                      title="Toggle Emulator Settings Bar"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-4 bg-white/10" />

                    {/* Remap Keybinds Shortcut */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setControlsSlot(effectiveSlot);
                        setControlsOpen(true);
                      }}
                      className="h-7 px-2 text-xs text-primary-foreground hover:bg-white/10 font-bold gap-1 rounded-lg"
                      title={`Configure Keybinds for Player ${effectiveSlot}`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5 text-accent" />
                      <span className="hidden sm:inline">P{effectiveSlot} Keybinds</span>
                    </Button>

                    <div className="w-px h-4 bg-white/10" />

                    {/* On-Screen Chat Toggle */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setChatOverlayOpen((v) => !v)}
                      className={cn(
                        "w-7 h-7 rounded-lg transition-colors",
                        chatOverlayOpen
                          ? "bg-primary/20 text-primary border border-primary/40 shadow-[0_0_10px_rgba(0,140,255,0.3)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                      )}
                      title={chatOverlayOpen ? "Close On-Screen Chat" : `Open Chat (${chatHotkey || "Enter"})`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-4 bg-white/10" />

                    {/* Fullscreen Toggle */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleFullscreen}
                      className={cn(
                        "w-7 h-7 rounded-lg transition-colors",
                        isFullscreen
                          ? "bg-primary/20 text-primary border border-primary/40 shadow-[0_0_10px_rgba(0,140,255,0.3)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                      )}
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-4 bg-white/10" />

                    {/* Eject ROM */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRomPickerOpen(true)}
                      className="h-7 px-2.5 text-xs font-sans font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 flex items-center gap-1.5 rounded-lg border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      title="Eject / Switch Game ROM Cartridge"
                    >
                      <Disc className="w-3.5 h-3.5 animate-spin" />
                      <span>Eject</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-video bg-black rounded-xl border border-white/10 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Gamepad2 className="w-12 h-12 text-primary/70 animate-pulse" />
                  <p className="text-foreground font-display text-lg font-bold">No Game Loaded Yet</p>
                  <p className="text-muted-foreground text-xs font-sans max-w-sm">
                    Pick any ROM cartridge from your PC to boot up and stream live to all guests.
                  </p>
                  <Button onClick={() => setRomPickerOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md">
                    <FolderOpen className="w-4 h-4 mr-2" /> Pick ROM File from PC
                  </Button>
                </div>
              )
            ) : (
              // Guest Stream View
              <div
                ref={videoContainerRef}
                onClick={() => {
                  if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === "INPUT") {
                    document.activeElement.blur();
                  }
                  unlockAudio();
                  if (isTouchDevice || showTouchGamepad) {
                    setStageControlsVisible((v) => !v);
                  }
                }}
                className={cn(
                  "bg-black overflow-hidden relative flex items-center justify-center cursor-pointer group",
                  isFullscreen
                    ? "fixed inset-0 z-[80] w-screen h-screen max-w-none rounded-none border-0"
                    : "w-full aspect-[4/3] rounded-xl border border-neutral-800"
                )}
              >
                {(remoteStream || hasWsStream) ? (
                  <>
                    {/* On-Screen In-Game Chat Overlay (Guest) */}
                    <InGameChatOverlay
                      messages={messages}
                      participants={displayParticipants}
                      slots={slots}
                      myPeerId={myPeerId.current}
                      isOpen={chatOverlayOpen}
                      onOpenChange={(open) => {
                        if (open) releaseAllHeldButtons();
                        setChatOverlayOpen(open);
                      }}
                      onSendMessage={handleSendMessage}
                      chatHotkey={chatHotkey}
                    />

                    {/* WebSocket Fallback Live Image Stream */}
                    <img
                      ref={wsImgRef}
                      alt="Game Stream"
                      className={`w-full h-full object-contain absolute inset-0 z-0 ${hasWsStream ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    />

                    {/* Dedicated Guest Audio Element (unmuted for hardware audio decoding) */}
                    <audio
                      ref={guestAudioElRef}
                      autoPlay
                      playsInline
                    />

                    {/* WebRTC Video Stream - transparent until decoding active frames */}
                    <video
                      ref={videoRef}
                      onTimeUpdate={(e) => {
                        const curTime = e.currentTarget.currentTime;
                        if (curTime !== lastVideoTimeRef.current.time) {
                          lastVideoTimeRef.current = { time: curTime, timestamp: Date.now() };
                        }
                        if (e.currentTarget.videoWidth > 0 && curTime > 0) {
                          if (!rtcVideoActiveRef.current) {
                            setRtcVideoActive(true);
                            rtcVideoActiveRef.current = true;
                          }
                        }
                      }}
                      onPlaying={(e) => {
                        lastVideoTimeRef.current = {
                          time: e.currentTarget.currentTime,
                          timestamp: Date.now(),
                        };
                        if (e.currentTarget.videoWidth > 0) {
                          setRtcVideoActive(true);
                          rtcVideoActiveRef.current = true;
                        }
                        if (videoRef.current) {
                          videoRef.current.muted = true;
                        }
                      }}
                      className={`w-full h-full object-contain relative z-[5] ${
                        rtcVideoActive ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                      autoPlay
                      playsInline
                      muted
                    />

                    {/* CRT Scanline Filter */}
                    {crtFilter && (
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] z-10 opacity-70" />
                    )}

                    {/* Persistent Click Screen to Enable Audio Banner */}
                    {(isMuted || audioBlocked) && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          unlockAudio();
                        }}
                        className="absolute top-6 left-1/2 -translate-x-1/2 z-[85] bg-primary/95 text-primary-foreground px-6 py-3 rounded-full shadow-[0_0_30px_rgba(0,140,255,0.9)] border-2 border-white/40 flex items-center gap-3 animate-pulse cursor-pointer hover:scale-105 active:scale-95 transition-all select-none"
                      >
                        <VolumeX className="w-5 h-5 text-amber-300" />
                        <span className="text-xs sm:text-sm font-bold font-sans tracking-wider uppercase">
                          Click Screen to Enable Audio
                        </span>
                      </div>
                    )}

                    {/* Floating Frosted Glass In-Stream Controls Overlay (Guest) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "absolute bottom-14 right-3 flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-2 z-[90] shadow-xl transition-opacity duration-200",
                        showTouchGamepad || isTouchDevice || stageControlsVisible
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {/* Volume Slider with Animated Speaker Wave */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const next = !isMuted;
                            setIsMuted(next);
                            isMutedRef.current = next;
                            if (!next) {
                              unlockAudio();
                            }
                          }}
                          className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg"
                          title={isMuted ? "Unmute Game Audio" : "Mute Game Audio"}
                        >
                          {isMuted ? (
                            <VolumeX className="w-4 h-4 text-destructive" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                          )}
                        </Button>

                        {!isMuted && volume > 0 && (
                          <div className="flex items-end gap-0.5 h-3 px-0.5" title={`Audio Playing (${Math.round(volume * 100)}%)`}>
                            <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.45s]" />
                          </div>
                        )}

                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => {
                            const newVol = parseFloat(e.target.value);
                            setVolume(newVol);
                            if (isMuted && newVol > 0) {
                              setIsMuted(false);
                              isMutedRef.current = false;
                              unlockAudio();
                            }
                          }}
                          className="w-16 sm:w-20 h-1.5 accent-primary bg-neutral-700 rounded-lg cursor-pointer"
                          title={`Volume: ${isMuted ? 0 : Math.round(volume * 100)}%`}
                        />
                      </div>

                      <div className="w-px h-4 bg-white/10" />

                      {/* Remap Controls Shortcut */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setControlsSlot(effectiveSlot);
                          setControlsOpen(true);
                        }}
                        className="h-7 px-2 text-xs text-primary-foreground hover:bg-white/10 font-bold gap-1 rounded-lg"
                        title={`Remap Controls for Player ${effectiveSlot}`}
                      >
                        <Gamepad2 className="w-3.5 h-3.5 text-accent" />
                        <span className="hidden sm:inline">P{effectiveSlot} Controls</span>
                      </Button>

                      <div className="w-px h-4 bg-white/10" />

                      {/* CRT Scanline Toggle */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setCrtFilter(!crtFilter)}
                        className={cn(
                          "w-7 h-7 rounded-lg transition-colors",
                          crtFilter
                            ? "bg-accent/20 text-accent border border-accent/40 shadow-[0_0_10px_rgba(255,200,0,0.3)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                        title={crtFilter ? "Disable CRT Scanlines" : "Enable CRT Scanlines"}
                      >
                        <Tv className="w-3.5 h-3.5" />
                      </Button>

                      <div className="w-px h-4 bg-white/10" />

                      {/* On-Screen Chat Toggle */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setChatOverlayOpen((v) => !v)}
                        className={cn(
                          "w-7 h-7 rounded-lg transition-colors",
                          chatOverlayOpen
                            ? "bg-primary/20 text-primary border border-primary/40 shadow-[0_0_10px_rgba(0,140,255,0.3)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                        title={chatOverlayOpen ? "Close On-Screen Chat" : `Open Chat (${chatHotkey || "Enter"})`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>

                      <div className="w-px h-4 bg-white/10" />

                      {/* Fullscreen Toggle */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={toggleFullscreen}
                        className={cn(
                          "w-7 h-7 rounded-lg transition-colors",
                          isFullscreen
                            ? "bg-primary/20 text-primary border border-primary/40 shadow-[0_0_10px_rgba(0,140,255,0.3)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                        title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,140,255,0.25)]">
                      <Gamepad2 className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="font-display font-bold text-xl text-foreground tracking-wide">
                        {connectionStatus === "error" ? "Host Stream Offline" : "Connecting to Host's Stream..."}
                      </h2>
                      <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                        {connectionStatus === "error"
                          ? "Could not establish a direct stream to the room host. The host may still be picking a game or starting up."
                          : "Synchronizing with the retro emulator console. Audio and video will start playing automatically once ready."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                      <span className="relative flex h-2 w-2">
                        <span
                          className={cn(
                            "relative inline-flex rounded-full h-2 w-2",
                            webrtcStatus.ice === "connected" || webrtcStatus.ice === "completed"
                              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                              : connectionStatus === "error"
                              ? "bg-rose-400"
                              : "bg-amber-400 animate-ping"
                          )}
                        />
                      </span>
                      <span>
                        {webrtcStatus.ice === "connected" || webrtcStatus.ice === "completed"
                          ? "Direct Peer Connection Established"
                          : connectionStatus === "error"
                          ? "Signal Disconnected"
                          : "Establishing WebRTC Direct Link..."}
                      </span>
                    </div>

                    {connectionStatus === "error" && (
                      <Button
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md gap-1.5"
                      >
                        Retry Connection
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Consumer Stream Status & Mode Bar */}
          <div className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-sans">
            {/* Active ROM Info & Console System */}
            <div className="flex items-center gap-2 min-w-0 max-w-full sm:max-w-[55%]">
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground/80 uppercase font-semibold shrink-0">
                CARTRIDGE:
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono font-bold py-0.5 px-2 uppercase rounded-full shadow-[0_0_10px_rgba(0,140,255,0.25)] shrink-0",
                  consoleSys.badgeColor
                )}
              >
                {consoleSys.shortName}
              </Badge>
              <span className="font-semibold text-xs text-foreground truncate" title={activeRomName || `${consoleSys.name} Game`}>
                {activeRomName || `${consoleSys.name} Game`}
              </span>
            </div>

            {/* Glowing Stream Status Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {isHost ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)] text-[10px] font-mono font-bold tracking-wide">
                  <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400 animate-pulse" />
                  <span>60 FPS Host Master</span>
                </div>
              ) : connectionStatus === "connected" ? (
                hasWsStream && !rtcVideoActive ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/50 border border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] text-[10px] font-mono font-bold tracking-wide">
                    <Wifi className="w-3 h-3 text-amber-400 animate-pulse" />
                    <span>Dual-Sync Fallback</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)] text-[10px] font-mono font-bold tracking-wide">
                    <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>60 FPS WebRTC Stream</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/80 border border-neutral-700/60 text-muted-foreground text-[10px] font-mono font-semibold animate-pulse">
                  <WifiOff className="w-3 h-3 text-neutral-400" />
                  <span>CONNECTING...</span>
                </div>
              )}
            </div>
          </div>

          {/* Live In-Game Controller & Keybind Light-Up Bar */}
          <div className="w-full max-w-4xl mx-auto rounded-2xl p-3 sm:p-4 bg-card/90 border border-white/10 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </span>
                <span className="text-xs sm:text-sm font-display font-bold text-foreground truncate">
                  {consoleSys.name} Controller (Player {effectiveSlot})
                </span>
                <Badge variant="outline" className={cn("text-[9px] font-bold py-0 px-1.5 uppercase shrink-0", consoleSys.badgeColor)}>
                  {consoleSys.shortName}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-sans hidden sm:inline">
                  Live input monitor · Press keys to test
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setControlsSlot(effectiveSlot);
                    setControlsOpen(true);
                  }}
                  className="h-7 text-xs px-2.5 border-primary/40 text-primary hover:bg-primary/20 flex items-center gap-1.5 font-bold rounded-xl"
                  title={`Open Keybind Wizard for Player ${effectiveSlot}`}
                >
                  <Wand2 className="w-3 h-3 text-accent animate-pulse" />
                  <span>Keybind Setup Wizard</span>
                </Button>
              </div>
            </div>

            {/* Row of interactive mini controller buttons */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-2 bg-black/60 rounded-xl border border-white/5 overflow-x-auto">
              {getConsoleActions(activeCore).map((act) => {
                const isDown = activeButtons.has(act.id);
                const boundKey = keyboardMapping[act.id] || "";
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setControlsSlot(effectiveSlot);
                      setControlsOpen(true);
                    }}
                    title={`${act.label}: bound to [${formatKeyLabel(boundKey)}] · Click to rebind`}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[36px] sm:min-w-[42px] px-1.5 py-1.5 rounded-lg text-center transition-all duration-75 select-none cursor-pointer border",
                      isDown
                        ? "bg-emerald-400 text-black border-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.9)] scale-110 font-black z-10"
                        : "bg-neutral-900/90 text-neutral-300 border-white/10 hover:border-primary/50 hover:bg-neutral-800"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] sm:text-[11px] font-black leading-tight",
                        isDown ? "text-black" : "text-foreground"
                      )}
                    >
                      {act.shortLabel || act.label}
                    </span>
                    <span
                      className={cn(
                        "text-[8px] sm:text-[9px] font-mono leading-none truncate max-w-[48px]",
                        isDown ? "text-neutral-900 font-bold" : "text-muted-foreground"
                      )}
                    >
                      {formatKeyLabel(boundKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Player Controller Slots Bar */}
          <ControllerSlots
            slots={slots}
            myPeerId={myPeerId.current}
            isHost={isHost}
            mySlot={mySlot}
            activeButtons={activeButtons}
            participants={participants}
            onClaimSlot={handleClaimSlot}
            onReleaseSlot={handleReleaseSlot}
            onPassSlot={handlePassSlot}
            onKickSlot={handleKickSlot}
            onRequestSlot={handleRequestSlot}
            onOpenControls={(slot) => {
              if (slot) setControlsSlot(slot);
              setControlsOpen(true);
            }}
          />

          {/* Mobile Touch Controller (if toggled) */}
          {showTouchGamepad && (
            <div className="mt-2">
              <TouchGamepad
                playerSlot={effectiveSlot}
                onInput={handleInputEvent}
                onActivity={handleButtonActivity}
                activeCore={activeCore}
              />
            </div>
          )}
        </div>

        {/* Right Column: Party Lounge Sidebar (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Party Members Card */}
          <div className="rounded-2xl bg-card/90 border border-white/10 p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-display font-bold text-sm text-foreground">
                  Players in Room ({displayParticipants.length})
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInviteOpen(true)}
                className="h-7 px-2.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg gap-1"
                title="Invite Friends to Party"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite</span>
              </Button>
            </div>

            {/* Members List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {displayParticipants.map((p) => {
                const slotNum = getPlayerSlotForPeer(p.peerId);
                const isSelf = p.peerId === myPeerId.current;
                const isPeerHost = p.role === "host";

                return (
                  <div
                    key={p.peerId}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar circle with initial */}
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 border",
                          isPeerHost
                            ? "bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                            : slotNum
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                            : "bg-muted text-muted-foreground border-white/10"
                        )}
                      >
                        {p.playerName.slice(0, 2)}
                      </div>

                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate max-w-[110px] sm:max-w-[140px]">
                            {p.playerName}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] text-muted-foreground font-medium">(You)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {isPeerHost && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/40 text-[9px] font-bold px-1 py-0 h-4 leading-none">
                              <Crown className="w-2.5 h-2.5 mr-0.5 inline" /> Host
                            </Badge>
                          )}
                          {slotNum ? (
                            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/40 text-[9px] font-bold px-1.5 py-0 h-4 leading-none">
                              P{slotNum}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground/80 border-white/10 text-[9px] font-medium px-1.5 py-0 h-4 leading-none">
                              Spectating
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Host Quick Slot Controls */}
                    {isHost && !isSelf && (
                      <div className="flex items-center gap-1 shrink-0">
                        {slotNum ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleKickSlot(slotNum)}
                            className="h-6 px-2 text-[10px] font-medium text-destructive hover:bg-destructive/20 rounded-md"
                            title={`Move ${p.playerName} to Spectator`}
                          >
                            Kick
                          </Button>
                        ) : openSlots.length > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePassSlot(openSlots[0], p.peerId, p.playerName)}
                            className="h-6 px-2 text-[10px] font-bold border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 rounded-md"
                            title={`Assign ${p.playerName} to Player ${openSlots[0]}`}
                          >
                            Give P{openSlots[0]}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Party Chat Lounge */}
          <div className="flex-1 min-h-[420px]">
            <ChatPanel
              messages={messages}
              participants={participants}
              slots={slots}
              myPeerId={myPeerId.current}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      </main>

      {/* Controls & Gamepad Rebind Modal */}
      <ControlsModal
        open={controlsOpen}
        onClose={() => {
          setControlsOpen(false);
          setControlsSlot(undefined);
        }}
        activeCore={activeCore}
        playerSlot={controlsSlot || effectiveSlot}
        isHost={isHost}
        {...({
          onTestInput: (action: string, isDown: boolean) => {
            const targetSlot = controlsSlot || effectiveSlot;
            handleButtonActivity(action, isDown);
            handleInputEvent({
              type: isDown ? "keydown" : "keyup",
              playerIndex: targetSlot,
              action,
              key: action,
              keyCode: 0,
              code: action,
            });
          },
        } as Record<string, unknown>)}
      />

      {/* Invite Friends & QR Code Modal */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} sessionCode={session.code} />

      {/* Host ROM Picker Dialog (Rendered with createPortal at z-[200] to sit cleanly above fullscreen) */}
      {romPickerOpen && portalTarget && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRomPickerOpen(false);
          }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto font-sans select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-primary/60 bg-card p-6 font-sans shadow-2xl my-auto text-card-foreground"
          >
            <button
              type="button"
              onClick={() => setRomPickerOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="font-display text-2xl text-primary flex items-center gap-2">
                <FolderOpen className="w-6 h-6 text-accent" /> Load Game ROM
              </h2>
              <p className="font-sans text-xs text-muted-foreground">
                Select any supported ROM or disc image from your computer to run and stream live to all guests.
              </p>
            </div>

            <div className="my-3 space-y-3">
              <RomFilePicker
                selectedFile={newRomFile}
                onFileSelected={(file) => {
                  setNewRomFile(file);
                  if (file) {
                    const detected = detectConsoleFromFilename(file.name);
                    setNewRomCore(detected.id);
                  }
                }}
              />

              <ConsolePicker
                selectedCore={newRomCore}
                onSelectCore={setNewRomCore}
                detectedCore={newRomFile ? detectConsoleFromFilename(newRomFile.name).id : undefined}
              />

              {newRomFile && (
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  onClick={() => handleLoadRomFile(newRomFile)}
                >
                  Launch & Stream Game
                </Button>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border">
              {activeRomName ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground font-bold text-xs"
                  onClick={handleUnloadRom}
                >
                  Eject Current Game
                </Button>
              ) : <div />}
              <Button variant="ghost" size="sm" onClick={() => setRomPickerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>,
        portalTarget
      )}

      {/* Quick Join Dialog (when visiting via URL directly) */}
      {joinPromptOpen && portalTarget && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setJoinPromptOpen(false);
              hasDismissedPrompt.current = true;
            }
          }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto font-sans select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-primary/60 bg-card p-6 font-sans shadow-2xl my-auto text-card-foreground"
          >
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="font-display text-2xl text-primary flex items-center gap-2">
                <Gamepad2 className="w-6 h-6 text-accent" /> Join RetroParty Room
              </h2>
              <p className="font-sans text-xs text-muted-foreground">
                You were invited to room <span className="font-bold text-foreground font-mono">{code}</span>. Enter your nickname to jump in!
              </p>
            </div>

            <form onSubmit={handleQuickJoinSubmit} className="space-y-4 my-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Your Nickname
                </label>
                <Input
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder="PLAYER NAME"
                  maxLength={20}
                  className="bg-muted/40 border-primary/40 focus-visible:ring-primary font-bold text-base h-11"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={joinSession.isPending || !guestNameInput.trim()}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(0,71,187,0.4)]"
              >
                {joinSession.isPending ? "Joining..." : "Enter Room"}
              </Button>
            </form>
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
}


