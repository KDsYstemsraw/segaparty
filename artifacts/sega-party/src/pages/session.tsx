import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetSession, useJoinSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Emulator } from "@/components/emulator";
import { getRomUrl, getRomName, setRom, setRomFromUrl } from "@/lib/romStore";
import {
  getWsUrl,
  RTC_CONFIG,
  type PlayerInputEvent,
  type SlotState,
  type ChatMessage,
  type ParticipantInfo,
} from "@/lib/webrtc";
import { getPlayerActionKey } from "@/lib/gamepadMapping";
import { useGamepad } from "@/hooks/useGamepad";

import { ControlsModal } from "@/components/ControlsModal";
import { ControllerSlots } from "@/components/ControllerSlots";
import { ChatPanel } from "@/components/ChatPanel";
import { TouchGamepad } from "@/components/TouchGamepad";
import { InviteModal } from "@/components/InviteModal";
import { RomFilePicker } from "@/components/RomFilePicker";
import { cleanRomTitle } from "@/lib/romUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

  const [myPlayerId, setMyPlayerId] = useState<string>(() => sessionStorage.getItem("playerId") || "");
  const [myPlayerName, setMyPlayerName] = useState<string>(() => sessionStorage.getItem("playerName") || "");
  const myPeerId = useRef(crypto.randomUUID());

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [crtFilter, setCrtFilter] = useState(false);
  const [showTouchGamepad, setShowTouchGamepad] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [controlsOpen, setControlsOpen] = useState(false);
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
  const [currentRomUrl, setCurrentRomUrl] = useState<string | null>(() => getRomUrl());
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


  const joinSession = useJoinSession();

  const { data: session, isLoading, isError, refetch } = useGetSession(code, {
    query: {
      enabled: !!code,
      queryKey: getGetSessionQueryKey(code),
      refetchInterval: 5000,
    },
  });

  const romUrl = currentRomUrl || getRomUrl();
  const isHost = !!session && !!myPlayerId && myPlayerId === session.hostId;

  // Determine current user's slot number (1, 2, 3, 4 or null)
  const mySlot: number | null = (() => {
    for (let i = 1; i <= 4; i++) {
      if (slots[i]?.peerId === myPeerId.current) return i;
    }
    return null;
  })();


  // Prompt nickname modal if guest arrived via link without playerId
  useEffect(() => {
    if (!isLoading && session && !myPlayerId) {
      setJoinPromptOpen(true);
    }
  }, [isLoading, session, myPlayerId]);

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
      if (isHost) {
        // Host dispatches keyboard event to window
        window.dispatchEvent(
          new KeyboardEvent(event.type, {
            key: event.key,
            keyCode: event.keyCode,
            code: event.code,
            bubbles: true,
          }),
        );
      } else {
        // Guest sends over WebRTC Data Channel to Host
        if (guestDataChannelRef.current?.readyState === "open") {
          guestDataChannelRef.current.send(JSON.stringify(event));
        }
      }
    },
    [isHost],
  );

  useGamepad(mySlot, handleInputEvent, handleButtonActivity);

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

  // Host creates WebRTC Offer for a connected guest
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
            const keyInfo = getPlayerActionKey(input.playerIndex, input.action);
            if (keyInfo) {
              window.dispatchEvent(
                new KeyboardEvent(input.type, {
                  key: keyInfo.key,
                  keyCode: keyInfo.keyCode,
                  code: keyInfo.code,
                  bubbles: true,
                }),
              );
            }
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
        };

        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        sendSignal(guestPeerId, { type: "offer", sdp: pc.localDescription });
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
          // Reuse existing PeerConnection for renegotiation (e.g. audio track added)
          let pc = peerConnsRef.current.get(fromPeerId);
          const isRenegotiation = !!pc;

          if (!pc) {
            pc = new RTCPeerConnection(RTC_CONFIG);
            peerConnsRef.current.set(fromPeerId, pc);

            pc.ontrack = (e) => {
              if (e.streams && e.streams[0]) {
                setRemoteStream(e.streams[0]);
                setConnectionStatus("connected");
              } else if (e.track) {
                // Return a NEW MediaStream so React detects the state change
                setRemoteStream((prev) => {
                  const newStream = new MediaStream(prev ? prev.getTracks() : []);
                  if (!newStream.getTracks().some((t) => t.id === e.track.id)) {
                    newStream.addTrack(e.track);
                  }
                  return newStream;
                });
                setConnectionStatus("connected");
              }
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

          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp as RTCSessionDescriptionInit));

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
          sendSignal(fromPeerId, { type: "answer", sdp: pc.localDescription });
          return;
        }

        if (data.type === "answer" && isHost) {
          const pc = peerConnsRef.current.get(fromPeerId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp as RTCSessionDescriptionInit));

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

  // WebSocket signaling connection
  useEffect(() => {
    if (!session || !myPlayerName) return;

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
          if (msg.hostPeerId) hostPeerIdRef.current = msg.hostPeerId as string;
        }

        if (msg.type === "slot-state") {
          if (msg.slots) setSlots(msg.slots as SlotState);
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

        if (msg.type === "rom-info") {
          setActiveRomName(msg.romName as string);
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

        if (msg.type === "no-host" && !isHost) {
          hostPeerIdRef.current = null;
          setRemoteStream(null);
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
            setConnectionStatus("idle");
          }
        }
      } catch {}
    };

    ws.onerror = () => setConnectionStatus("error");

    return () => {
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
  }, [code, isHost, myPlayerName, session?.code, createHostOffer, handleSignal, toast]);

  // Bind remote stream to HTML5 video element with auto-recovery
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.muted = true; // Start muted to ensure immediate playback
      videoRef.current
        .play()
        .then(() => {
          setConnectionStatus("connected");
          setAudioBlocked(false);
        })
        .catch((err) => {
          console.warn("Autoplay blocked, playing muted video:", err);
          setAudioBlocked(true);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
    }
  }, [remoteStream]);

  // Handle guest volume and mute adjustments
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.muted = isMuted;
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
          sendSignal(peerId, { type: "offer", sdp: pc.localDescription });
        } catch {}
      });
    }
  }, [sendSignal]);

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

  // Keyboard input forwarding for assigned player slots
  useEffect(() => {
    if (!mySlot) return; // Spectators don't forward keyboard to game

    const KEY_ACTIONS_P1: Record<string, string> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      z: "a",
      Z: "a",
      x: "b",
      X: "b",
      c: "c",
      C: "c",
      a: "x",
      A: "x",
      s: "y",
      S: "y",
      d: "z",
      D: "z",
      Enter: "start",
      " ": "mode",
    };

    const KEY_ACTIONS_P2: Record<string, string> = {
      i: "up",
      I: "up",
      k: "down",
      K: "down",
      j: "left",
      J: "left",
      l: "right",
      L: "right",
      u: "a",
      U: "a",
      o: "b",
      O: "b",
      p: "c",
      P: "c",
      "7": "x",
      "8": "y",
      "9": "z",
      "0": "start",
      "-": "mode",
    };

    const actionMap = mySlot === 2 ? KEY_ACTIONS_P2 : KEY_ACTIONS_P1;

    const forwardKey = (e: KeyboardEvent, type: "keydown" | "keyup") => {
      // Ignore synthetic events dispatched by handleInputEvent to prevent infinite loop
      if (!e.isTrusted) return;

      // Don't intercept if user is typing in chat input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const action = actionMap[e.key];
      if (!action) return;

      e.preventDefault();
      handleButtonActivity(action, type === "keydown");

      const keyInfo = getPlayerActionKey(mySlot, action);
      if (!keyInfo) return;

      handleInputEvent({
        type,
        playerIndex: mySlot,
        action,
        key: keyInfo.key,
        keyCode: keyInfo.keyCode,
        code: keyInfo.code,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => forwardKey(e, "keydown");
    const onKeyUp = (e: KeyboardEvent) => forwardKey(e, "keyup");

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mySlot, handleInputEvent, handleButtonActivity]);


  const handleLoadRomFile = async (file: File) => {
    const url = await setRom(file);
    const title = cleanRomTitle(file.name);
    setCurrentRomUrl(url);
    setActiveRomName(title);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "rom-info",
          sessionCode: code,
          romName: title,
        }),
      );
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          sessionCode: code,
          text: `🎮 Host loaded ROM: ${title}`,
        }),
      );
    }
    toast({
      title: "ROM Loaded",
      description: `Loaded ${title}`,
    });
    setRomPickerOpen(false);
    setNewRomFile(null);
  };

  const handleQuickJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) return;

    const name = guestNameInput.trim();

    joinSession.mutate(
      { code, data: { playerName: name } },
      {
        onSuccess: (resp) => {
          sessionStorage.setItem("playerId", resp.playerId);
          sessionStorage.setItem("playerName", name);
          setMyPlayerId(resp.playerId);
          setMyPlayerName(name);
          setJoinPromptOpen(false);
          refetch();
        },
        onError: () => {
          toast({
            title: "Join Error",
            description: "Could not join session. It may be full or ended.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const unlockAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume;
      setIsMuted(false);
      setAudioBlocked(false);
      videoRef.current.play().catch(() => {});
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
            <Gamepad2 className="w-5 h-5 text-accent" /> SEGA PARTY
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
              title="Load or Switch Sega Genesis ROM"
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
            variant="outline"
            onClick={() => setControlsOpen(true)}
            className="h-7 px-2 text-xs font-sans border-border text-muted-foreground hover:text-foreground gap-1"
          >
            <Settings2 className="w-3.5 h-3.5" /> Config
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Column: Stage & Controller Slots (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Game Stage */}
          <div className="w-full relative">
            {isHost ? (
              romUrl ? (
                <Emulator
                  key={romUrl}
                  romUrl={romUrl}
                  onStreamReady={handleStreamReady}
                  onAudioTrackAdded={handleAudioTrackAdded}
                />
              ) : (
                <div className="w-full aspect-video bg-black border-4 border-destructive/50 rounded-lg flex flex-col items-center justify-center p-6 text-center space-y-3">
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
                className="w-full aspect-[4/3] max-w-4xl mx-auto bg-black border-4 border-primary rounded-lg shadow-[0_0_30px_rgba(0,71,187,0.4)] relative overflow-hidden group flex items-center justify-center"
              >
                {remoteStream ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      autoPlay
                      playsInline
                    />

                    {/* CRT Scanline Filter */}
                    {crtFilter && (
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] z-10 opacity-70" />
                    )}

                    {/* Autoplay Unmute Recovery Banner */}
                    {audioBlocked && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-accent/90 text-accent-foreground px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce cursor-pointer">
                        <VolumeX className="w-4 h-4" />
                        <button onClick={unlockAudio} className="text-xs font-bold font-sans uppercase">
                          Click to Enable Audio
                        </button>
                      </div>
                    )}

                    {/* Guest Stream Controls Overlay */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/80 p-1.5 rounded-lg border border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsMuted(!isMuted)}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground"
                        title={isMuted ? "Unmute Game Audio" : "Mute Game Audio"}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-destructive" /> : <Volume2 className="w-4 h-4 text-green-400" />}
                      </Button>

                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-16 h-1 accent-primary cursor-pointer"
                        title={`Volume: ${Math.round(volume * 100)}%`}
                      />

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setCrtFilter(!crtFilter)}
                        className={`w-7 h-7 ${crtFilter ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
                        title="Toggle CRT Scanline Effect"
                      >
                        <Tv className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={toggleFullscreen}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground"
                        title="Fullscreen"
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

          {/* Active ROM Info & Stream status */}
          <div className="flex items-center justify-between px-2 text-xs font-sans text-muted-foreground">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-foreground uppercase">Now Playing:</span>
              <span className="text-primary font-mono truncate">{activeRomName || "Sega Genesis Game"}</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] uppercase font-bold">
              {isHost ? (
                <span className="text-primary flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent" /> Hosting Room
                </span>
              ) : connectionStatus === "connected" ? (
                <span className="text-green-400 flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> 60 FPS Stereo
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1 animate-pulse">
                  <WifiOff className="w-3.5 h-3.5" /> Connecting...
                </span>
              )}
            </div>
          </div>

          {/* Multi-Player Controller Slots Bar */}
          <ControllerSlots
            slots={slots}
            myPeerId={myPeerId.current}
            isHost={isHost}
            mySlot={mySlot}
            activeButtons={activeButtons}
            onClaimSlot={handleClaimSlot}
            onReleaseSlot={handleReleaseSlot}
          />

          {/* Mobile Touch Controller (if toggled) */}
          {showTouchGamepad && (
            <div className="mt-2">
              <TouchGamepad
                playerSlot={mySlot}
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
      <ControlsModal open={controlsOpen} onClose={() => setControlsOpen(false)} />

      {/* Invite Friends & QR Code Modal */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} sessionCode={session.code} />

      {/* Host ROM Picker Dialog */}
      <Dialog open={romPickerOpen} onOpenChange={setRomPickerOpen}>
        <DialogContent className="max-w-lg bg-card border-primary/60 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-accent" /> Load Sega Genesis ROM
            </DialogTitle>
            <DialogDescription className="font-sans text-xs text-muted-foreground">
              Select any Sega Genesis ROM (.bin, .md, .gen, .smd, .zip) from your computer to run and stream live to all guests.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3">
            <RomFilePicker
              selectedFile={newRomFile}
              onFileSelected={(file) => {
                setNewRomFile(file);
                if (file) {
                  handleLoadRomFile(file);
                }
              }}
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setRomPickerOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Quick Join Dialog (when visiting via URL directly) */}
      <Dialog open={joinPromptOpen} onOpenChange={setJoinPromptOpen}>
        <DialogContent className="max-w-md bg-card border-primary/60 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-accent" /> Join Sega Party Room
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


