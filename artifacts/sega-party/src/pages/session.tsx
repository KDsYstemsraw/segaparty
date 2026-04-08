import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Emulator } from "@/components/emulator";
import { getRomUrl } from "@/lib/romStore";
import { getWsUrl, RTC_CONFIG, type InputEvent } from "@/lib/webrtc";
import { useGamepad } from "@/hooks/useGamepad";
import { ControlsModal } from "@/components/ControlsModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Users, Wifi, WifiOff, AlertTriangle, HomeIcon, Gamepad2, Settings2, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function SessionPage() {
  const params = useParams();
  const code = params.code || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const myPlayerId = sessionStorage.getItem("playerId") || "";
  const myPeerId = useRef(crypto.randomUUID());

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const gameStreamRef = useRef<MediaStream | null>(null);
  const pendingGuestsRef = useRef<Set<string>>(new Set());
  const dcRef = useRef<RTCDataChannel | null>(null);

  const { data: session, isLoading, isError } = useGetSession(code, {
    query: {
      enabled: !!code,
      queryKey: getGetSessionQueryKey(code),
      refetchInterval: 3000,
    },
  });

  const [controlsOpen, setControlsOpen] = useState(false);

  const romUrl = getRomUrl();
  const isHost = !!session && !!myPlayerId && myPlayerId === session.hostId;

  // Route gamepad inputs: host dispatches to window (EJS picks it up),
  // guest sends over data channel to host
  const handleGamepadInput = useCallback((event: InputEvent) => {
    if (isHost) {
      window.dispatchEvent(new KeyboardEvent(event.type, {
        key: event.key, keyCode: event.keyCode, code: event.code, bubbles: true,
      }));
    } else {
      if (dcRef.current?.readyState === "open") {
        dcRef.current.send(JSON.stringify(event));
      }
    }
  }, [isHost]);

  useGamepad(handleGamepadInput);

  const sendSignal = useCallback((targetPeerId: string, data: unknown) => {
    wsRef.current?.send(JSON.stringify({
      type: "signal",
      sessionCode: code,
      targetPeerId,
      data,
    }));
  }, [code]);

  const createHostOffer = useCallback(async (guestPeerId: string, stream: MediaStream | null) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnsRef.current.set(guestPeerId, pc);

    const dc = pc.createDataChannel("inputs");
    dc.onmessage = (e) => {
      try {
        const input = JSON.parse(e.data) as InputEvent;
        window.dispatchEvent(new KeyboardEvent(input.type, {
          key: input.key,
          keyCode: input.keyCode,
          code: input.code,
          bubbles: true,
        }));
      } catch {
        // ignore malformed input
      }
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

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(guestPeerId, { type: "offer", sdp: pc.localDescription });
  }, [sendSignal]);

  const handleSignal = useCallback(async (fromPeerId: string, data: Record<string, unknown>) => {
    if (data.type === "offer" && !isHost) {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnsRef.current.set(fromPeerId, pc);

      pc.ontrack = (e) => {
        if (e.streams[0]) {
          setRemoteStream(e.streams[0]);
          setConnectionStatus("connected");
        }
      };

      pc.ondatachannel = (e) => {
        dcRef.current = e.channel;
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(fromPeerId, { type: "ice-candidate", candidate: e.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") setConnectionStatus("error");
      };

      await pc.setRemoteDescription(data.sdp as RTCSessionDescriptionInit);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(fromPeerId, { type: "answer", sdp: pc.localDescription });
      return;
    }

    if (data.type === "answer" && isHost) {
      const pc = peerConnsRef.current.get(fromPeerId);
      if (pc) await pc.setRemoteDescription(data.sdp as RTCSessionDescriptionInit);
      return;
    }

    if (data.type === "ice-candidate") {
      const pc = peerConnsRef.current.get(fromPeerId);
      if (pc && data.candidate) {
        await pc.addIceCandidate(data.candidate as RTCIceCandidateInit);
      }
      return;
    }
  }, [isHost, sendSignal]);

  // Connect to signaling server once we know our role
  useEffect(() => {
    if (!session) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    setConnectionStatus("connecting");

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        sessionCode: code,
        role: isHost ? "host" : "guest",
        peerId: myPeerId.current,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;

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
          // server confirmed host exists — waiting for offer
        }

        if (msg.type === "no-host" && !isHost) {
          setConnectionStatus("error");
          toast({ title: "No host found", description: "The host hasn't connected yet. Try refreshing.", variant: "destructive" });
        }

        if (msg.type === "signal") {
          handleSignal(msg.fromPeerId as string, msg.data as Record<string, unknown>);
        }

        if (msg.type === "peer-left") {
          const peerId = msg.peerId as string;
          const pc = peerConnsRef.current.get(peerId);
          if (pc) { pc.close(); peerConnsRef.current.delete(peerId); }
          pendingGuestsRef.current.delete(peerId);
          if (!isHost) {
            setRemoteStream(null);
            setConnectionStatus("idle");
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => setConnectionStatus("error");

    return () => {
      ws.send(JSON.stringify({ type: "leave", sessionCode: code, peerId: myPeerId.current }));
      ws.close();
      peerConnsRef.current.forEach((pc) => pc.close());
      peerConnsRef.current.clear();
    };
  }, [session?.code, isHost]);

  // When host's game stream is ready, send offers to pending guests
  const handleStreamReady = useCallback((stream: MediaStream) => {
    gameStreamRef.current = stream;
    for (const guestPeerId of pendingGuestsRef.current) {
      createHostOffer(guestPeerId, stream);
    }
    pendingGuestsRef.current.clear();
  }, [createHostOffer]);

  // Keyboard input forwarding for guests
  useEffect(() => {
    if (isHost) return;

    const KEYS: Record<string, { key: string; keyCode: number; code: string }> = {
      ArrowUp:    { key: "ArrowUp",    keyCode: 38, code: "ArrowUp" },
      ArrowDown:  { key: "ArrowDown",  keyCode: 40, code: "ArrowDown" },
      ArrowLeft:  { key: "ArrowLeft",  keyCode: 37, code: "ArrowLeft" },
      ArrowRight: { key: "ArrowRight", keyCode: 39, code: "ArrowRight" },
      z: { key: "z", keyCode: 90, code: "KeyZ" },
      x: { key: "x", keyCode: 88, code: "KeyX" },
      a: { key: "a", keyCode: 65, code: "KeyA" },
      s: { key: "s", keyCode: 83, code: "KeyS" },
      Enter: { key: "Enter", keyCode: 13, code: "Enter" },
      " ":  { key: " ", keyCode: 32, code: "Space" },
    };

    const forward = (e: KeyboardEvent, type: "keydown" | "keyup") => {
      const info = KEYS[e.key];
      if (!info) return;
      e.preventDefault();
      if (!dcRef.current || dcRef.current.readyState !== "open") return;
      const msg: InputEvent = { type, ...info };
      dcRef.current.send(JSON.stringify(msg));
    };

    const onDown = (e: KeyboardEvent) => forward(e, "keydown");
    const onUp   = (e: KeyboardEvent) => forward(e, "keyup");
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [isHost]);

  // Wire remote stream to video element
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({ title: "Link copied!", description: "Share with friends to play together." });
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center p-6 space-y-6">
        <Skeleton className="w-full max-w-3xl aspect-video bg-muted" />
        <Skeleton className="w-full max-w-3xl h-32 bg-muted" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-display text-destructive mb-2">Session Not Found</h2>
        <p className="text-muted-foreground font-sans mb-6">This session doesn't exist or has ended.</p>
        <Button onClick={() => setLocation("/")} variant="outline" className="font-sans border-primary text-primary">
          <HomeIcon className="w-4 h-4 mr-2" /> Return Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center p-4 md:p-8 bg-background">

      {/* Header bar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 text-primary px-3 py-1 border border-primary font-display font-bold text-xl tracking-widest">
            {session.code}
          </div>
          <Button variant="ghost" size="icon" onClick={copyLink}
            className="text-muted-foreground hover:text-primary border border-transparent hover:border-primary/50"
            data-testid="button-copy-link">
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {!isHost && (
            <div className="flex items-center gap-2 text-sm font-sans font-bold uppercase">
              {connectionStatus === "connected" ? (
                <><Wifi className="w-4 h-4 text-green-400" /><span className="text-green-400">Connected</span></>
              ) : connectionStatus === "error" ? (
                <><WifiOff className="w-4 h-4 text-destructive" /><span className="text-destructive">No Signal</span></>
              ) : (
                <><Wifi className="w-4 h-4 text-muted-foreground animate-pulse" /><span className="text-muted-foreground">Connecting...</span></>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setControlsOpen(true)}
            className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50 gap-1.5 font-sans text-xs uppercase tracking-wide"
            data-testid="button-open-controls">
            <Settings2 className="w-3.5 h-3.5" /> Controls
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground font-sans text-sm font-bold uppercase">
            <Users className="w-4 h-4" />
            {session.players.length} / {session.maxPlayers}
          </div>
        </div>
      </div>

      {/* Game area */}
      {isHost ? (
        romUrl ? (
          <Emulator romUrl={romUrl} onStreamReady={handleStreamReady} />
        ) : (
          <div className="w-full max-w-3xl aspect-video bg-black border-4 border-destructive/50 flex items-center justify-center">
            <p className="text-destructive font-display">No ROM loaded. <button onClick={() => setLocation("/")} className="underline">Go back</button></p>
          </div>
        )
      ) : (
        // Guest view
        remoteStream ? (
          <div className="w-full max-w-3xl mx-auto aspect-video bg-black border-4 border-primary shadow-[0_0_20px_rgba(0,71,187,0.4)] relative overflow-hidden group">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              muted={isMuted}
            />
            {/* Mute/unmute toggle — visible on hover */}
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-3xl aspect-video bg-black border-4 border-primary/30 flex flex-col items-center justify-center gap-4 text-center px-8">
            <Gamepad2 className="w-14 h-14 text-primary animate-pulse" />
            <div>
              <h2 className="font-display text-xl text-foreground mb-2">
                {connectionStatus === "error" ? "CONNECTION FAILED" : "WAITING FOR HOST"}
              </h2>
              <p className="font-sans text-sm text-muted-foreground">
                {connectionStatus === "error"
                  ? "Could not connect to the host. Make sure the host has started the game."
                  : "The host's game will appear here once they start playing."}
              </p>
            </div>
            {connectionStatus === "error" && (
              <Button variant="outline" onClick={() => window.location.reload()} className="border-primary text-primary font-sans mt-2">
                Retry Connection
              </Button>
            )}
          </div>
        )
      )}

      {/* Controls hint for guests */}
      {!isHost && remoteStream && (
        <div className="w-full max-w-4xl mt-4 px-2">
          <p className="text-xs text-muted-foreground font-sans text-center uppercase tracking-widest">
            Arrow keys to move &nbsp;·&nbsp; Z / X / A / S — buttons &nbsp;·&nbsp; Enter — start &nbsp;·&nbsp; Space — select
          </p>
        </div>
      )}

      {/* Players */}
      <div className="w-full max-w-4xl mt-8">
        <h3 className="font-display text-lg text-primary mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Connected Players
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {session.players.map((player) => (
            <Card key={player.id} className={`border-border bg-card ${player.isHost ? "border-primary shadow-[0_0_10px_rgba(0,71,187,0.2)]" : ""}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 flex items-center justify-center font-display font-bold text-lg bg-background border ${player.isHost ? "border-primary text-primary" : "border-muted text-muted-foreground"}`}>
                  P{player.playerIndex}
                </div>
                <div className="overflow-hidden">
                  <div className="font-sans font-bold truncate text-foreground">{player.name}</div>
                  {player.isHost && <div className="text-[10px] uppercase font-bold text-primary tracking-wider">Host</div>}
                </div>
              </CardContent>
            </Card>
          ))}
          {Array.from({ length: Math.max(0, session.maxPlayers - session.players.length) }).map((_, i) => (
            <Card key={`empty-${i}`} className="border-dashed border-border bg-transparent opacity-40">
              <CardContent className="p-4 flex items-center justify-center h-[74px]">
                <div className="font-sans text-sm font-bold text-muted-foreground uppercase tracking-widest">Waiting...</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ControlsModal open={controlsOpen} onClose={() => setControlsOpen(false)} />
    </div>
  );
}
