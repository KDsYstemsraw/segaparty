import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCreateSession, useJoinSession } from "@workspace/api-client-react";
import {
  Loader2,
  Gamepad2,
  Zap,
  Dices,
  Flame,
  Link2,
  FolderOpen,
  Sparkles,
  Users,
  Radio,
  Tv,
  Cpu,
  Layers,
  ArrowRight,
  Share2,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setRom, setRomFromUrl } from "@/lib/romStore";
import { RomDropzone } from "@/components/RomDropzone";
import { ConsoleShowcase } from "@/components/ConsoleShowcase";
import { ControlsModal } from "@/components/ControlsModal";
import { detectConsoleFromFilename, getConsoleSystem } from "@/lib/consoles";
import { cleanRomTitle } from "@/lib/romUtils";
import { setStoredPlayerIdentity } from "@/lib/webrtc";
import { cn } from "@/lib/utils";

const RETRO_NAMES = [
  "Sonic_99",
  "Tails_Ace",
  "Knuckles_Red",
  "Streets_Axel",
  "Shinobi_Master",
  "Golden_Axe",
  "Gunstar_Red",
  "Ecco_Wave",
  "Ristar_Star",
  "Mega_Drive",
  "Cyber_Fox",
  "Arcade_King",
];

const UNAMBIGUOUS_EXTENSIONS: Record<string, string> = {
  ".z64": "n64",
  ".n64": "n64",
  ".v64": "n64",
  ".sfc": "snes",
  ".smc": "snes",
  ".nes": "nes",
  ".gba": "gba",
  ".gb": "gb",
  ".gbc": "gb",
  ".sms": "segaMS",
  ".gg": "segaGG",
  ".32x": "sega32x",
  ".pbp": "psx",
  ".md": "segaMD",
  ".gen": "segaMD",
  ".smd": "segaMD",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const getRandomName = () => RETRO_NAMES[Math.floor(Math.random() * RETRO_NAMES.length)];

  // Host Session State
  const [hostName, setHostName] = useState(getRandomName);
  const [romMethod, setRomMethod] = useState<"file" | "url">("file");
  const [romFile, setRomFile] = useState<File | null>(null);
  const [romUrlInput, setRomUrlInput] = useState("");
  const [selectedCore, setSelectedCore] = useState<string>("segaMD");
  const [detectedCore, setDetectedCore] = useState<string | undefined>();
  const [hasExplicitCore, setHasExplicitCore] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  // Join Session State
  const [joinName, setJoinName] = useState(getRandomName);
  const [joinCode, setJoinCode] = useState("");
  const [hasInviteCode, setHasInviteCode] = useState(false);

  // Guest friction refs
  const joinCardRef = useRef<HTMLDivElement>(null);
  const joinNameInputRef = useRef<HTMLInputElement>(null);

  const createSession = useCreateSession();
  const joinSession = useJoinSession();

  // Support direct room code URL query parameter and auto-focus for guests (DES-01)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code") || params.get("join");
      if (code) {
        const cleanCode = code.toUpperCase();
        setJoinCode(cleanCode);
        setHasInviteCode(true);
        setTimeout(() => {
          joinNameInputRef.current?.focus();
          joinNameInputRef.current?.select();
          joinCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
    }
  }, []);

  const handleFileSelected = (file: File | null) => {
    setRomFile(file);
    if (!file) return;

    const lower = file.name.toLowerCase();
    const dotIdx = lower.lastIndexOf(".");
    const ext = dotIdx !== -1 ? lower.slice(dotIdx) : "";
    const unambiguousCore = UNAMBIGUOUS_EXTENSIONS[ext];

    if (unambiguousCore) {
      setSelectedCore(unambiguousCore);
      setDetectedCore(unambiguousCore);
    } else if (hasExplicitCore) {
      // User already explicitly selected a console core; do not overwrite with fallback
      setDetectedCore(selectedCore);
    } else {
      const sys = detectConsoleFromFilename(file.name);
      setSelectedCore(sys.id);
      setDetectedCore(sys.id);
    }
  };

  const handleUrlChange = (url: string) => {
    setRomUrlInput(url);
    if (url.trim()) {
      const clean = url.split("?")[0];
      const filename = clean.split("/").pop() || "";
      if (filename) {
        const lower = filename.toLowerCase();
        const dotIdx = lower.lastIndexOf(".");
        const ext = dotIdx !== -1 ? lower.slice(dotIdx) : "";
        const unambiguousCore = UNAMBIGUOUS_EXTENSIONS[ext];
        if (unambiguousCore) {
          setSelectedCore(unambiguousCore);
          setDetectedCore(unambiguousCore);
        } else if (!hasExplicitCore) {
          const sys = detectConsoleFromFilename(filename);
          setSelectedCore(sys.id);
          setDetectedCore(sys.id);
        }
      }
    }
  };

  const handleCreate = async () => {
    if (!hostName.trim()) {
      toast({ title: "Error", description: "Please enter your host nickname.", variant: "destructive" });
      return;
    }

    if (romMethod === "file") {
      if (!romFile) {
        toast({
          title: "Game Required",
          description: "Please choose or drop a game ROM file to launch the room.",
          variant: "destructive",
        });
        return;
      }
      await setRom(romFile, selectedCore);
    } else {
      if (!romUrlInput.trim()) {
        toast({ title: "Error", description: "Please enter a valid direct game URL.", variant: "destructive" });
        return;
      }
      const cleanTitle = cleanRomTitle(romUrlInput.split("?")[0].split("/").pop() || "Retro Game");
      setRomFromUrl(romUrlInput.trim(), cleanTitle, selectedCore);
    }

    createSession.mutate(
      { data: { hostName: hostName.trim() } },
      {
        onSuccess: (session) => {
          setStoredPlayerIdentity(session.code, session.hostId, hostName.trim(), true);
          setLocation(`/session/${session.code}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create session.", variant: "destructive" });
        },
      },
    );
  };

  const handleJoin = () => {
    if (!joinName.trim() || !joinCode.trim()) {
      toast({ title: "Error", description: "Nickname and 6-digit room code are required.", variant: "destructive" });
      return;
    }

    const cleanCode = joinCode.trim().toUpperCase();

    joinSession.mutate(
      { code: cleanCode, data: { playerName: joinName.trim() } },
      {
        onSuccess: (response) => {
          setStoredPlayerIdentity(response.session.code, response.playerId, joinName.trim(), false);
          setLocation(`/session/${response.session.code}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Invalid code or session is full.", variant: "destructive" });
        },
      },
    );
  };

  const getActiveGameTitle = () => {
    if (romMethod === "file") {
      return romFile ? cleanRomTitle(romFile.name) : "Select a Game";
    }
    return romUrlInput.trim() ? cleanRomTitle(romUrlInput.split("?")[0].split("/").pop() || "Game") : "Enter URL";
  };

  const currentSystem = getConsoleSystem(selectedCore);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground antialiased selection:bg-primary/30 selection:text-white">
      {/* Top Consumer Navigation Header */}
      <header className="w-full border-b border-white/10 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Mark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-indigo-500 to-accent flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-white/20">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-xl tracking-tight text-white">
                  Retro<span className="text-primary">Party</span>
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-white/5 border border-white/10 text-muted-foreground uppercase">
                  Cloud Arcade
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Navigation Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                <Cpu className="w-3.5 h-3.5 text-primary" /> 12 Classic Systems
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                <Users className="w-3.5 h-3.5 text-accent" /> Up to 4 Players
              </span>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setControlsOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold rounded-xl border-white/10 bg-card/60 hover:bg-white/10 text-white gap-2 transition-all shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>Controllers & Keys</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col justify-center">
        {/* Hero Welcome Banner */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>Browser-Based Peer-to-Peer Netplay</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.1] font-display">
            Play Classic Console Games <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-400 to-accent">Together</span>
          </h1>

          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            Host a private room in seconds, share a 6-digit code with friends, and play together right in your browser with zero downloads.
          </p>
        </div>

        {/* 2-Column Consumer Launcher Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* =============================================================== */}
          {/* LEFT COLUMN: START A PARTY ROOM (col-span-8)                    */}
          {/* =============================================================== */}
          <div className={cn(hasInviteCode ? "order-2 lg:order-2 lg:col-span-7" : "order-1 lg:order-1 lg:col-span-8")}>
            <div className="rounded-2xl border border-white/10 bg-card/90 backdrop-blur-xl shadow-2xl p-5 sm:p-7 space-y-7">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="space-y-0.5">
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
                    Start a Party Room
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Select a platform, drop in your game file, and create an instant multiplayer session.
                  </p>
                </div>

                <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5 font-semibold px-2.5 py-1">
                  Host Mode
                </Badge>
              </div>

              {/* Step 1: Choose Your System */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-primary" />
                    Step 1 · Choose Your System
                  </span>
                  <span className="text-xs text-white font-medium">
                    {currentSystem.name}
                  </span>
                </div>

                <ConsoleShowcase
                  selectedCore={selectedCore}
                  onSelectCore={(coreId) => {
                    setSelectedCore(coreId);
                    setHasExplicitCore(true);
                    if (detectedCore && detectedCore !== coreId) {
                      setDetectedCore(undefined);
                    }
                  }}
                  detectedCore={detectedCore}
                />
              </div>

              {/* Step 2: Load a Game */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-primary" />
                    Step 2 · Load Game ({currentSystem.shortName})
                  </span>

                  {/* Local vs URL toggle */}
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setRomMethod("file")}
                      className={cn(
                        "text-xs font-semibold px-3 py-1 rounded-lg transition-all flex items-center gap-1.5",
                        romMethod === "file"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-white",
                      )}
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setRomMethod("url")}
                      className={cn(
                        "text-xs font-semibold px-3 py-1 rounded-lg transition-all flex items-center gap-1.5",
                        romMethod === "url"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-white",
                      )}
                    >
                      <Link2 className="w-3.5 h-3.5" /> Direct URL
                    </button>
                  </div>
                </div>

                {romMethod === "file" ? (
                  <RomDropzone
                    selectedFile={romFile}
                    onFileSelected={handleFileSelected}
                    selectedCore={selectedCore}
                  />
                ) : (
                  <div className="space-y-2 p-5 rounded-2xl border border-white/10 bg-white/5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-accent" /> Direct Game / ROM URL
                    </label>
                    <Input
                      placeholder="https://example.com/games/mygame.chd"
                      value={romUrlInput}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="bg-card border-white/10 focus-visible:ring-primary font-mono text-xs h-11 rounded-xl"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      URL must link directly to an uncompressed or .chd/.zip file hosted on a CORS-enabled server.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 3: Host Profile & Launch */}
              <div className="pt-4 border-t border-white/10 grid sm:grid-cols-12 gap-4 items-end">
                <div className="sm:col-span-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Your Display Name
                    </label>
                    <button
                      type="button"
                      onClick={() => setHostName(getRandomName())}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors"
                    >
                      <Dices className="w-3.5 h-3.5" /> Randomize
                    </button>
                  </div>
                  <Input
                    placeholder="HOST NAME"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    maxLength={20}
                    className="bg-card border-white/10 focus-visible:ring-primary font-semibold h-12 text-sm rounded-xl"
                  />
                </div>

                <div className="sm:col-span-7">
                  <Button
                    onClick={handleCreate}
                    disabled={
                      createSession.isPending ||
                      !hostName.trim() ||
                      (romMethod === "file" && !romFile) ||
                      (romMethod === "url" && !romUrlInput.trim())
                    }
                    className="w-full h-12 text-sm sm:text-base font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {createSession.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="truncate flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4 text-accent shrink-0 animate-pulse" />
                        <span>Start Party: {getActiveGameTitle()}</span>
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* RIGHT COLUMN: JOIN A FRIEND'S PARTY + HOW IT WORKS (col-span-4)  */}
          {/* =============================================================== */}
          <div className={cn("space-y-6", hasInviteCode ? "order-1 lg:order-1 lg:col-span-5" : "order-2 lg:order-2 lg:col-span-4")}>
            {/* Join Room Card */}
            <div
              ref={joinCardRef}
              className={cn(
                "rounded-2xl border bg-card/90 backdrop-blur-xl p-5 sm:p-6 space-y-5 transition-all shadow-xl",
                hasInviteCode
                  ? "border-accent ring-2 ring-accent/30 shadow-accent/15"
                  : "border-white/10",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-accent" />
                    Join a Friend's Room
                  </h3>
                  {hasInviteCode && (
                    <Badge variant="outline" className="text-[10px] font-bold border-accent/40 text-accent bg-accent/10 px-2 py-0.5">
                      Invited
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Have an invite code? Enter it below to jump right in.
                </p>
              </div>

              {/* 6-Digit Room Code Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  6-Digit Room Code
                </label>
                <Input
                  placeholder="ABCDEF"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="bg-card border-white/10 focus-visible:ring-accent font-mono text-xl tracking-[0.25em] uppercase text-center h-12 rounded-xl text-white font-bold"
                />
              </div>

              {/* Guest Display Name Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Your Display Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setJoinName(getRandomName())}
                    className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 font-semibold transition-colors"
                  >
                    <Dices className="w-3.5 h-3.5" /> Randomize
                  </button>
                </div>
                <Input
                  ref={joinNameInputRef}
                  placeholder="GUEST NAME"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  maxLength={20}
                  className="bg-card border-white/10 focus-visible:ring-accent font-semibold h-11 text-sm rounded-xl"
                />
              </div>

              {/* Join Action Button */}
              <Button
                onClick={handleJoin}
                disabled={joinSession.isPending || !joinName.trim() || !joinCode.trim()}
                className="w-full h-11 text-sm font-bold bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {joinSession.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    Join Party Now
                  </span>
                )}
              </Button>
            </div>

            {/* How RetroParty Works Card */}
            <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                How RetroParty Works
              </h4>

              <div className="space-y-3.5 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">1. Pick Any Classic Game</h5>
                    <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                      Drop a game file from 12 supported consoles (PlayStation, N64, SNES, Genesis & more).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Share2 className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">2. Invite Friends Instantly</h5>
                    <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                      Share your 6-digit room code or invite link. Friends connect straight in their browser.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">3. Plug & Play Together</h5>
                    <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                      Up to 4 players on Keyboard, Mouse, or Gamepad with live HD streaming.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modern Clean Footer */}
      <footer className="w-full border-t border-white/5 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-muted-foreground/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            RetroParty · Instant Multi-Platform Web Arcade
          </p>
          <p className="font-mono text-[11px]">
            Ultra Low-Latency WebRTC P2P
          </p>
        </div>
      </footer>

      {/* Controls & Gamepad Rebind Modal */}
      <ControlsModal
        open={controlsOpen}
        onClose={() => setControlsOpen(false)}
        activeCore={selectedCore}
        playerSlot={1}
        isHost={true}
      />
    </div>
  );
}
