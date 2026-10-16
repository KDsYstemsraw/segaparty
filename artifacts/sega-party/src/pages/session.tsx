import { useCallback, useEffect, useRef, useState } from "react";
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
  formatKeyLabel,
  getConsoleActions,
  mouseButtonToToken,
  isMouseBinding,
} from "@/lib/gamepadMapping";
import { useGamepad } from "@/hooks/useGamepad";

import { ControlsModal } from "@/components/ControlsModal";
import { ControllerSlots } from "@/components/ControllerSlots";
import { ChatPanel } from "@/components/ChatPanel";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Copy,
  Users,
  Wifi,
  WifiOff,
  AlertTriangle,
  HomeIcon,
  Gamepad2,
  Settings2,
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
  const [hasWsStream, setHasWsStream] = useState(false);
  const [rtcVideoActive, setRtcVideoActive] = useState(false);
  const [wsReconnectTick, setWsReconnectTick] = useState(0);
  const wsImgRef = useRef<HTMLImageElement | null>(null);
  const nextAudioTimeRef = useRef<number>(0);
  const rtcVideoActiveRef = useRef(false);

  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [webrtcStatus, setWebrtcStatus] = useState<{ ice: string; tracks: number; lastSignal: string }>({
    ice: "idle",
    tracks: 0,
    lastSignal: "none",
  });
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [crtFilter, setCrtFilter] = useState(false);
  const [showTouchGamepad, setShowTouchGamepad] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsSlot, setControlsSlot] = useState<number | undefined>(undefined);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinPromptOpen, setJoinPromptOpen] = useState(false);
  const [romPickerOpen, setRomPickerOpen] = useState(false);
  const [newRomFile, setNewRomFile] = useState<File | null>(null);
  const [guestNameInput, setGuestNameInput] = useState(() => {
    return DEFAULT_NICKNAMES[Math.floor(Math.random() * DEFAULT_NICKNAMES.length)];
  });

  // Room & slots state
  const [slots, setSlots] = useState<SlotState>({ 1: null, 2: null, 3: null, 4: null });
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeRomName, setActiveRomName] = useState<string | null>(getRomName());
  const [activeCore, setActiveCore] = useState<string>(() => getRomCore() || "segaMD");
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
  const isHost = Boolean(myPlayerId && session?.hostId && myPlayerId === session.hostId);
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

  useEffect(() => {
    setKeyboardMapping(loadPlayerKeyboardMapping(effectiveSlot));
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

  useGamepad(effectiveSlot, handleInputEvent, handleButtonActivity);

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

  // Guest WebAudio pipeline for uncompressed low-latency game sound (Kosmi style)
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

      if (!guestGainNodeRef.current) {
        const gain = ctx.createGain();
        gain.gain.value = isMuted ? 0 : volume;
        gain.connect(ctx.destination);
        guestGainNodeRef.current = gain;
      }

      if (guestAudioSourceRef.current) {
        try { guestAudioSourceRef.current.disconnect(); } catch {}
      }

      const source = ctx.createMediaStreamSource(stream);
      source.connect(guestGainNodeRef.current);
      guestAudioSourceRef.current = source;

      if (ctx.state === "suspended" && !isMuted) {
        ctx.resume().catch(() => {});
      }
    } catch (err) {
      console.warn("Guest WebAudio setup error:", err);
    }
  }, [isMuted, volume]);

  // Host creates WebRTC Offer for a connected guest with explicit transceivers
  const createHostOffer = useCallback(
    async (guestPeerId: string, stream: MediaStream | null) => {
      try {
        // Close any existing connection to prevent leaks
        const existingPc = peerConnsRef.current.get(guestPeerId);
        if (existingPc) {
          existingPc.close();
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnsRef.current.set(guestPeerId, pc);

        // Create low-latency data channel for inputs
        const dc = pc.createDataChannel("inputs", {
          ordered: false,
          maxRetransmits: 0,
        });
        dataChannelsRef.current.set(guestPeerId, dc);

        dc.onmessage = (e) => {
          try {
            const input = JSON.parse(e.data) as PlayerInputEvent;
            let guestSlot = Number(input.playerIndex) || 2;
            for (const s of [1, 2, 3, 4]) {
              if (slotAssignmentsRef.current[s]?.peerId === guestPeerId) {
                guestSlot = s;
                break;
              }
            }
            (simulateEmulatorInput as any)(guestSlot, input.action, input.type === "keydown", activeCore);
          } catch {}
        };

        if (stream) {
          for (const track of stream.getTracks()) {
            pc.addTrack(track, stream);
          }
        }

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            sendSignal(guestPeerId, { type: "ice-candidate", candidate: e.candidate.toJSON() });
          }
        };

        pc.oniceconnectionstatechange = () => {
          loggerDebug(`Host ICE with ${guestPeerId}: ${pc.iceConnectionState}`);
          setWebrtcStatus((prev) => ({ ...prev, ice: pc.iceConnectionState }));
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        setWebrtcStatus((prev) => ({ ...prev, lastSignal: `Sent Offer (${stream?.getTracks().length || 0} tracks)` }));
        sendSignal(guestPeerId, { type: "offer", sdp: pc.localDescription?.toJSON() || { type: "offer", sdp: pc.localDescription?.sdp } });
      } catch (err) {
        console.error("Error creating host offer:", err);
      }
    },
    [sendSignal],
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
              setWebrtcStatus((prev) => ({ ...prev, tracks: prev.tracks + 1 }));
              const stream = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);

              setRemoteStream((prev) => {
                const combined = new MediaStream(prev ? prev.getTracks() : []);
                if (!combined.getTracks().some((t) => t.id === e.track.id)) {
                  combined.addTrack(e.track);
                }
                return combined;
              });
              setConnectionStatus("connected");

              const bindVideo = () => {
                if (videoRef.current) {
                  if (videoRef.current.srcObject !== stream) {
                    videoRef.current.srcObject = stream;
                  }
                  videoRef.current.play().catch(() => {});
                }
              };

              // Immediately bind
              bindVideo();

              // Fallback to unmute event
              e.track.addEventListener("unmute", bindVideo, { once: true });
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
              } else if (pc!.iceConnectionState === "failed") {
                setConnectionStatus("error");
              }
            };

            pc.onconnectionstatechange = () => {
              if (pc!.connectionState === "connected") {
                setConnectionStatus("connected");
              } else if (pc!.connectionState === "failed") {
                setConnectionStatus("error");
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
          sendSignal(fromPeerId, { type: "answer", sdp: pc.localDescription?.toJSON() || { type: "answer", sdp: pc.localDescription?.sdp } });
          return;
        }

        if (data.type === "answer" && isHost) {
          setWebrtcStatus((prev) => ({ ...prev, lastSignal: "Received Answer" }));
          const pc = peerConnsRef.current.get(fromPeerId);
          if (pc) {
            const sdpInit = toSdpInit(data.sdp, "answer");
            await pc.setRemoteDescription(new RTCSessionDescription(sdpInit));

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
    [code],
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
      if (isHost) {
        setConnectionStatus("connected");
      }
      ws.send(
        JSON.stringify({
          type: "join",
          sessionCode: code,
          role: isHost ? "host" : "guest",
          peerId: myPeerId.current,
          playerName: myPlayerName,
          romName: activeRomName || undefined,
          core: activeCore || undefined,
        }),
      );
    };


    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;

        if (msg.type === "room-state") {
          if (msg.slots) setSlots(msg.slots as SlotState);
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
          if (msg.slots) setSlots(msg.slots as SlotState);
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
          (simulateEmulatorInput as any)(
            input.playerIndex || 2,
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
          const isRtcAudioPlaying = rtcVideoActiveRef.current && !!remoteStream && remoteStream.getAudioTracks().some((t) => t.readyState === "live" && !t.muted);
          if (!isMutedRef.current && !isRtcAudioPlaying) {
            try {
              const pcmBase64 = msg.pcm as string;
              const sampleRate = (msg.sampleRate as number) || 22050;
              if (pcmBase64) {
                const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
                    }

                    bufferSource.connect(guestGainNodeRef.current || ctx.destination);

                    const now = ctx.currentTime;
                    nextAudioTimeRef.current = Math.min(Math.max(now, nextAudioTimeRef.current), now + 0.1);
                    const startTime = nextAudioTimeRef.current;
                    bufferSource.start(startTime);
                    nextAudioTimeRef.current = startTime + audioBuffer.duration;
                  }
                }
              }
            } catch {}
          }
        }

        if (msg.type === "no-host" && !isHost) {
          hostPeerIdRef.current = null;
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
          setParticipants((prev) => {
            const next = prev.filter((p) => p.peerId !== peerId);
            participantsRef.current = next;
            return next;
          });

          // Detect host leaving using tracked hostPeerId (not database ID)
          if (!isHost && peerId === hostPeerIdRef.current) {
            hostPeerIdRef.current = null;
            guestDataChannelRef.current = null;
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
        setTimeout(() => {
          if (!unmounted) setWsReconnectTick((t) => t + 1);
        }, 2000);
      }
    };

    return () => {
      unmounted = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave", sessionCode: code, peerId: myPeerId.current }));
      }
      ws.close();
      peerConnsRef.current.forEach((pc) => pc.close());
      peerConnsRef.current.clear();
      dataChannelsRef.current.forEach((dc) => dc.close());
      dataChannelsRef.current.clear();
      iceCandidateQueueRef.current.clear();
    };
  }, [code, session?.hostId, myPlayerId, myPlayerName, session?.code, wsReconnectTick, createHostOffer, handleSignal, toast]);

  // Bind remote stream to HTML5 video element with auto-recovery and onunmute handler
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      if (videoRef.current.srcObject !== remoteStream) {
        videoRef.current.srcObject = remoteStream;
      }
      videoRef.current.muted = isMuted;
      videoRef.current
        .play()
        .then(() => {
          setConnectionStatus("connected");
        })
        .catch(() => {});

      // Auto-trigger playback when video packets begin arriving
      remoteStream.getVideoTracks().forEach((track) => {
        track.onunmute = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        };
      });
    }
  }, [remoteStream, isMuted]);

  // Handle guest volume and mute adjustments
  useEffect(() => {
    if (guestGainNodeRef.current) {
      guestGainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
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
    if (!gameStreamRef.current.getAudioTracks().includes(track)) {
      gameStreamRef.current.addTrack(track);
      // Add track to existing peer connections
      peerConnsRef.current.forEach(async (pc, peerId) => {
        try {
          pc.addTrack(track, gameStreamRef.current!);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal(peerId, {
            type: "offer",
            sdp: pc.localDescription?.toJSON() || { type: "offer", sdp: pc.localDescription?.sdp },
            isRenegotiation: true,
          });
        } catch {}
      });
    }
  }, [sendSignal]);

  // Host dual-transport video frame broadcasting over WebSocket for instant guest view
  const handleVideoFrame = useCallback(
    (dataUrl: string) => {
      if (
        isHost &&
        wsRef.current?.readyState === WebSocket.OPEN &&
        (participantsRef.current.length > 1 || peerConnsRef.current.size > 0)
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: "video-frame",
            sessionCode: code,
            frame: dataUrl,
          }),
        );
      }
    },
    [code, isHost],
  );

  // Host dual-transport audio chunk broadcasting over WebSocket for instant guest sound
  const handleAudioChunk = useCallback(
    (pcmBase64: string, sampleRate: number) => {
      if (
        isHost &&
        wsRef.current?.readyState === WebSocket.OPEN &&
        (participantsRef.current.length > 1 || peerConnsRef.current.size > 0)
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: "audio-chunk",
            sessionCode: code,
            pcm: pcmBase64,
            sampleRate,
          }),
        );
      }
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

  // Keyboard & Mouse input forwarding for assigned player slots
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
      // Ignore synthetic events dispatched by handleInputEvent to prevent infinite loop
      if (!e.isTrusted) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isTextEntry =
        activeEl &&
        (activeEl.tagName === "TEXTAREA" ||
          (activeEl.tagName === "INPUT" &&
            (activeEl as HTMLInputElement).type !== "range" &&
            (activeEl as HTMLInputElement).type !== "button" &&
            (activeEl as HTMLInputElement).type !== "checkbox"));
      if (isTextEntry) return;

      const action = activeKeyMap[e.key] || activeKeyMap[e.key.toLowerCase()];
      if (!action) return;

      e.preventDefault();
      handleButtonActivity(action, type === "keydown");

      const keyInfo = getPlayerActionKey(activeSlot, action) || {
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

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [effectiveSlot, isHost, keyboardMapping, handleInputEvent, handleButtonActivity]);


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
    gameStreamRef.current = null;
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

  const unlockAudio = () => {
    setIsMuted(false);
    isMutedRef.current = false;
    setAudioBlocked(false);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume;
      videoRef.current.play().catch(() => {});
    }
    if (guestAudioCtxRef.current) {
      if (guestAudioCtxRef.current.state === "suspended") {
        guestAudioCtxRef.current.resume().catch(() => {});
      }
      if (guestGainNodeRef.current) {
        guestGainNodeRef.current.gain.value = volume;
      }
    }
  };


  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

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
      <header className="w-full border-b border-border/80 bg-card/60 backdrop-blur sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between">
        {/* Left: Brand & Room Code */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="font-display font-black text-xl text-primary hover:text-accent transition-colors flex items-center gap-1.5"
          >
            <Gamepad2 className="w-5 h-5 text-accent" /> RETROPARTY
          </button>

          <span className="hidden md:inline-block text-[9px] uppercase font-bold text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted/40 border border-border tracking-wider">
            KD SYSTEMS
          </span>


          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-primary/10 border border-primary/40 rounded-md">
            <span className="text-[10px] uppercase font-bold text-muted-foreground font-sans tracking-widest">
              Room
            </span>
            <span className="font-display font-black text-sm tracking-widest text-primary">
              {session.code}
            </span>
          </div>

          {activeRomName && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-muted/30 border border-border/60 rounded-md max-w-xs truncate">
              <Badge
                variant="outline"
                className={cn("text-[9px] font-bold py-0 px-1 uppercase shrink-0", consoleSys.badgeColor)}
              >
                {consoleSys.shortName}
              </Badge>
              <span className="text-xs font-bold text-foreground truncate">{activeRomName}</span>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setInviteOpen(true)}
            className="h-7 text-xs border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-bold gap-1"
          >
            <Share2 className="w-3 h-3" /> Invite
          </Button>
        </div>

        {/* Right: Load ROM / Touch / Config Controls */}
        <div className="flex items-center gap-2">


          {/* Load ROM button for host */}
          {isHost && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRomPickerOpen(true)}
              className="h-7 px-2 text-xs font-sans border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground gap-1.5 font-bold"
              title="Load or Switch Game ROM"
            >
              <FolderOpen className="w-3.5 h-3.5 text-accent" /> Load ROM
            </Button>
          )}

          {/* Touch Gamepad toggle */}
          <Button
            size="sm"
            variant={showTouchGamepad ? "default" : "outline"}
            onClick={() => setShowTouchGamepad(!showTouchGamepad)}
            className="h-7 px-2 text-xs font-sans gap-1"
            title="Toggle On-Screen Mobile Touch Controller"
          >
            <Smartphone className="w-3.5 h-3.5" /> Touch Pad
          </Button>

          {/* Controls Setup */}
          <Button
            size="sm"
            onClick={() => {
              setControlsSlot(effectiveSlot);
              setControlsOpen(true);
            }}
            className="h-7 px-3 text-xs font-sans bg-gradient-to-r from-primary via-indigo-600 to-primary hover:from-primary/90 hover:to-indigo-500 text-primary-foreground font-bold shadow-[0_0_12px_rgba(0,140,255,0.4)] hover:shadow-[0_0_18px_rgba(0,140,255,0.7)] hover:scale-[1.02] transition-all gap-1.5 border border-primary/50"
            title={`Configure ${consoleSys.name} controller and keybinds for Player ${effectiveSlot}`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span>{consoleSys.shortName} Keybinds &amp; Controller (P{effectiveSlot})</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Column: Stage & Controller Slots (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Arcade Cinema Stream Deck */}
          <div className="w-full max-w-4xl mx-auto rounded-2xl p-2.5 sm:p-3.5 bg-gradient-to-b from-neutral-800 via-neutral-900 to-black border-2 border-neutral-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_35px_rgba(0,140,255,0.2)] ring-1 ring-white/10 relative group">
            {isHost ? (
              isReloadingRom ? (
                <div className="w-full aspect-[4/3] bg-black rounded-xl border border-neutral-800 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-primary font-display text-lg tracking-wide">Switching Games...</p>
                  <p className="text-muted-foreground text-xs font-sans">Cleaning up previous console memory and preparing new system...</p>
                </div>
              ) : romUrl ? (
                <div ref={videoContainerRef} className="w-full relative rounded-xl overflow-hidden">
                  <Emulator
                    key={`${romUrl}-${activeCore}`}
                    romUrl={romUrl}
                    core={activeCore}
                    onStreamReady={handleStreamReady}
                    onAudioTrackAdded={handleAudioTrackAdded}
                    onVideoFrame={handleVideoFrame}
                    onAudioChunk={handleAudioChunk}
                  />
                  {/* Floating Frosted Glass In-Stream Controls Overlay (Host) */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-2 z-20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleFullscreen}
                      className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </Button>
                    <div className="w-px h-4 bg-white/10" />
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
                <div className="w-full aspect-video bg-black rounded-xl border border-destructive/50 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <p className="text-destructive font-display text-lg">No ROM loaded in memory.</p>
                  <Button onClick={() => setRomPickerOpen(true)} className="bg-primary text-primary-foreground font-bold">
                    Pick ROM File from PC
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
                  if (isMuted || audioBlocked) {
                    unlockAudio();
                  }
                }}
                className="w-full aspect-[4/3] bg-black rounded-xl overflow-hidden relative flex items-center justify-center cursor-pointer border border-neutral-800"
              >
                {(remoteStream || hasWsStream) ? (
                  <>
                    {/* WebSocket Fallback Live Image Stream */}
                    <img
                      ref={wsImgRef}
                      alt="Game Stream"
                      className={`w-full h-full object-contain absolute inset-0 z-0 ${hasWsStream ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    />

                    {/* WebRTC Video Stream - transparent until decoding active frames */}
                    <video
                      ref={(el) => {
                        videoRef.current = el;
                        if (el && remoteStream && el.srcObject !== remoteStream) {
                          el.srcObject = remoteStream;
                          el.play().catch(() => {});
                        }
                      }}
                      onTimeUpdate={(e) => {
                        if (e.currentTarget.videoWidth > 0 && e.currentTarget.currentTime > 0) {
                          setRtcVideoActive(true);
                          rtcVideoActiveRef.current = true;
                        }
                      }}
                      onPlaying={(e) => {
                        if (e.currentTarget.videoWidth > 0) {
                          setRtcVideoActive(true);
                          rtcVideoActiveRef.current = true;
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
                    {isMuted && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          unlockAudio();
                        }}
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-primary/95 text-primary-foreground px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(0,71,187,0.8)] border border-white/20 flex items-center gap-2.5 animate-pulse cursor-pointer hover:scale-105 transition-transform"
                      >
                        <VolumeX className="w-4 h-4 text-yellow-300" />
                        <span className="text-xs font-bold font-sans tracking-wide uppercase">
                          Click Screen to Enable Audio
                        </span>
                      </div>
                    )}

                    {/* Floating Frosted Glass In-Stream Controls Overlay (Guest) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-2 z-20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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

                      {/* Fullscreen Toggle */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={toggleFullscreen}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg"
                        title="Toggle Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <Gamepad2 className="w-16 h-16 text-primary animate-pulse" />
                    <div>
                      <h2 className="font-display text-xl text-foreground mb-1">
                        {connectionStatus === "error" ? "NO HOST SIGNAL" : "CONNECTING TO GAME STREAM"}
                      </h2>
                      <p className="font-sans text-xs text-muted-foreground max-w-sm">
                        {connectionStatus === "error"
                          ? "Could not establish WebRTC stream. The host may still be loading the game."
                          : "Waiting for host's Genesis emulator video & audio feed to start..."}
                      </p>
                    </div>

                    {/* Live WebRTC Telemetry HUD */}
                    <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-muted-foreground bg-black/60 px-3 py-1.5 rounded-md border border-primary/30">
                      <span>ICE: <b className={webrtcStatus.ice === "connected" || webrtcStatus.ice === "completed" ? "text-green-400" : "text-yellow-400"}>{webrtcStatus.ice}</b></span>
                      <span className="opacity-40">•</span>
                      <span>Signal: <b className="text-primary">{webrtcStatus.lastSignal}</b></span>
                      <span className="opacity-40">•</span>
                      <span>Tracks: <b className="text-foreground">{webrtcStatus.tracks}</b></span>
                    </div>
                    {connectionStatus === "error" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.reload()}
                        className="border-primary text-primary font-sans text-xs"
                      >
                        Retry Connection
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cyberpunk Live Telemetry HUD */}
          <div className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 px-2 py-1 text-xs font-sans">
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
              <span className="font-mono text-xs font-bold text-foreground truncate" title={activeRomName || `${consoleSys.name} Game`}>
                {activeRomName || `${consoleSys.name} Game`}
              </span>
            </div>

            {/* Glowing Pill Badges: ICE Connection Orb & Quick Remap Button */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Easy-to-Find Console-Aware Keybind Button */}
              <Button
                size="sm"
                onClick={() => {
                  setControlsSlot(effectiveSlot);
                  setControlsOpen(true);
                }}
                className="h-7 px-3 text-xs font-sans bg-gradient-to-r from-cyan-500 via-primary to-amber-500 hover:from-cyan-400 hover:via-primary/90 hover:to-amber-400 text-white font-extrabold shadow-[0_0_15px_rgba(0,190,255,0.6)] hover:shadow-[0_0_22px_rgba(0,220,255,0.9)] hover:scale-[1.03] transition-all gap-1.5 border border-white/30 rounded-full"
                title={`Configure & Test ${consoleSys.name} Controls for Player ${effectiveSlot}`}
              >
                <Gamepad2 className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                <span>{consoleSys.shortName} Keybinds &amp; Controller (P{effectiveSlot})</span>
              </Button>

              {/* ICE Connection Status Orb */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/90 border border-neutral-700/60 shadow-sm text-[11px] font-mono">
                {isHost ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    </span>
                    <span className="text-neutral-400 uppercase text-[10px] font-semibold">ICE:</span>
                    <span className="text-emerald-400 font-bold text-[10px]">HOST</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                      {webrtcStatus.ice === "connected" || webrtcStatus.ice === "completed" ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        </>
                      ) : webrtcStatus.ice === "checking" ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />
                      )}
                    </span>
                    <span className="text-neutral-400 uppercase text-[10px] font-semibold">ICE:</span>
                    <span
                      className={cn(
                        "font-bold text-[10px] uppercase",
                        webrtcStatus.ice === "connected" || webrtcStatus.ice === "completed"
                          ? "text-emerald-400"
                          : webrtcStatus.ice === "checking"
                          ? "text-amber-400"
                          : "text-rose-400"
                      )}
                    >
                      {webrtcStatus.ice}
                    </span>
                  </>
                )}
              </div>

              {/* Real-time Stream Mode Badge */}
              {isHost ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)] text-[10px] font-mono font-bold tracking-wide">
                  <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400 animate-pulse" />
                  <span>60 FPS Host Master</span>
                </div>
              ) : connectionStatus === "connected" ? (
                hasWsStream && !rtcVideoActive ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/50 border border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] text-[10px] font-mono font-bold tracking-wide">
                    <Wifi className="w-3 h-3 text-amber-400 animate-pulse" />
                    <span>15 FPS Dual-Sync</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)] text-[10px] font-mono font-bold tracking-wide">
                    <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>60 FPS WebRTC</span>
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

          {/* Live In-Game Button Light-Up HUD Bar */}
          <div className="w-full max-w-4xl mx-auto rounded-xl p-2 sm:p-2.5 bg-neutral-950/85 border border-neutral-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-sans">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-mono font-bold text-foreground truncate">
                  {consoleSys.name} Controller · <span className="text-primary font-black">P{effectiveSlot}</span>
                </span>
                <Badge variant="outline" className={cn("text-[9px] font-bold py-0 px-1.5 uppercase", consoleSys.badgeColor)}>
                  {consoleSys.shortName}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                  Click button to rebind:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setControlsSlot(effectiveSlot);
                    setControlsOpen(true);
                  }}
                  className="h-6 text-[10px] px-2 border-primary/40 text-primary hover:bg-primary/20 flex items-center gap-1 font-bold rounded-lg"
                  title={`Open Keybind Wizard for Player ${effectiveSlot}`}
                >
                  <Wand2 className="w-2.5 h-2.5 text-accent animate-pulse" />
                  <span>Set Up / Wizard</span>
                </Button>
              </div>
            </div>

            {/* Row of interactive mini controller buttons */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 p-1.5 bg-black/60 rounded-lg border border-white/5 overflow-x-auto">
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
                      "flex flex-col items-center justify-center min-w-[34px] sm:min-w-[40px] px-1 py-1 rounded-md text-center transition-all duration-75 select-none cursor-pointer border",
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
              />
            </div>
          )}
        </div>

        {/* Right Column: In-Room Hangout Chat (4 cols) */}
        <div className="lg:col-span-4 h-full min-h-[400px]">
          <ChatPanel
            messages={messages}
            participants={participants}
            slots={slots}
            myPeerId={myPeerId.current}
            onSendMessage={handleSendMessage}
          />
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

      {/* Host ROM Picker Dialog */}
      <Dialog open={romPickerOpen} onOpenChange={setRomPickerOpen}>
        <DialogContent className="max-w-lg bg-card border-primary/60 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-accent" /> Load Game ROM
            </DialogTitle>
            <DialogDescription className="font-sans text-xs text-muted-foreground">
              Select any supported ROM or disc image from your computer to run and stream live to all guests.
            </DialogDescription>
          </DialogHeader>

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
        </DialogContent>
      </Dialog>


      {/* Quick Join Dialog (when visiting via URL directly) */}
      <Dialog
        open={joinPromptOpen}
        onOpenChange={(open) => {
          setJoinPromptOpen(open);
          if (!open) {
            hasDismissedPrompt.current = true;
          }
        }}
      >
        <DialogContent className="max-w-md bg-card border-primary/60 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-accent" /> Join RetroParty Room
            </DialogTitle>
            <DialogDescription className="font-sans text-xs text-muted-foreground">
              You were invited to room <span className="font-bold text-foreground font-mono">{code}</span>. Enter your nickname to jump in!
            </DialogDescription>
          </DialogHeader>

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
        </DialogContent>
      </Dialog>
    </div>
  );
}


