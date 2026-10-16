import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  ShieldCheck,
  Disc,
  Wand2,
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

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const getRandomName = () => RETRO_NAMES[Math.floor(Math.random() * RETRO_NAMES.length)];

  // Active Tab State (Host vs Join)
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("code") || params.get("join")) return "join";
    }
    return "host";
  });

  // Host Session State
  const [hostName, setHostName] = useState(getRandomName);
  const [romMethod, setRomMethod] = useState<"file" | "url">("file");
  const [romFile, setRomFile] = useState<File | null>(null);
  const [romUrlInput, setRomUrlInput] = useState("");
  const [selectedCore, setSelectedCore] = useState<string>("segaMD");
  const [detectedCore, setDetectedCore] = useState<string | undefined>();
  const [controlsOpen, setControlsOpen] = useState(false);

  // Join Session State
  const [joinName, setJoinName] = useState(getRandomName);
  const [joinCode, setJoinCode] = useState("");

  const createSession = useCreateSession();
  const joinSession = useJoinSession();

  // Support direct room code URL query parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code") || params.get("join");
      if (code) {
        setJoinCode(code.toUpperCase());
        setActiveTab("join");
      }
    }
  }, []);

  const handleFileSelected = (file: File | null) => {
    setRomFile(file);
    if (file) {
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
        const sys = detectConsoleFromFilename(filename);
        setSelectedCore(sys.id);
        setDetectedCore(sys.id);
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
          title: "ROM Required",
          description: "Please drop a game ROM or optical disc image into the dropzone.",
          variant: "destructive",
        });
        return;
      }
      await setRom(romFile, selectedCore);
    } else {
      if (!romUrlInput.trim()) {
        toast({ title: "Error", description: "Please enter a valid direct ROM URL.", variant: "destructive" });
        return;
      }
      const cleanTitle = cleanRomTitle(romUrlInput.split("?")[0].split("/").pop() || "Retro Game");
      setRomFromUrl(romUrlInput.trim(), cleanTitle, selectedCore);
    }

    createSession.mutate(
      { data: { hostName: hostName.trim() } },
      {
        onSuccess: (session) => {
          setStoredPlayerIdentity(session.code, session.hostId, hostName.trim());
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
      toast({ title: "Error", description: "Nickname and 6-letter room code are required.", variant: "destructive" });
      return;
    }

    const cleanCode = joinCode.trim().toUpperCase();

    joinSession.mutate(
      { code: cleanCode, data: { playerName: joinName.trim() } },
      {
        onSuccess: (response) => {
          setStoredPlayerIdentity(response.session.code, response.playerId, joinName.trim());
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
      return romFile ? cleanRomTitle(romFile.name) : "Choose ROM or Disc";
    }
    return romUrlInput.trim() ? cleanRomTitle(romUrlInput.split("?")[0].split("/").pop() || "ROM") : "Enter ROM URL";
  };

  const currentSystem = getConsoleSystem(selectedCore);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 bg-background relative overflow-x-hidden font-sans">
      {/* Cyber Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-primary/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-accent/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero Header */}
      <div className="mb-6 text-center relative z-10 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-sans font-bold tracking-widest uppercase">
          <Radio className="w-3 h-3 text-accent animate-pulse" />
          <span>A KD SYSTEMS PRODUCT · RETRO ARCADE NETWORK</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-400 to-accent drop-shadow-[0_0_25px_rgba(0,71,187,0.5)] font-display tracking-wider">
          RETROPARTY
        </h1>

        <p className="text-muted-foreground text-xs sm:text-sm font-sans tracking-wide max-w-xl mx-auto">
          Ultra low-latency synchronized multiplayer rooms for PlayStation, Sega, Nintendo, and Arcade classic systems.
        </p>
      </div>

      {/* Cyber-Arcade Glassmorphism Master Deck */}
      <Card className="w-full max-w-4xl border-2 border-primary/40 bg-card/85 backdrop-blur-xl shadow-[0_0_50px_rgba(0,71,187,0.25)] rounded-2xl sm:rounded-3xl overflow-hidden relative z-10">
        {/* Top Cyber Chassis Accent Bars */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-cyan-400 to-accent" />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Header Navigation Tabs */}
          <div className="p-4 sm:p-6 pb-2 border-b border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <TabsList className="grid grid-cols-2 w-full sm:w-80 h-11 bg-muted/50 p-1 border border-border/60 rounded-xl">
              <TabsTrigger
                value="host"
                className="font-bold text-xs uppercase tracking-wider gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_15px_rgba(0,71,187,0.4)] transition-all"
              >
                <Gamepad2 className="w-4 h-4" /> Host Session
              </TabsTrigger>
              <TabsTrigger
                value="join"
                className="font-bold text-xs uppercase tracking-wider gap-1.5 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-[0_0_15px_rgba(224,0,11,0.4)] transition-all"
              >
                <Flame className="w-4 h-4" /> Join Room
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setControlsOpen(true)}
                className="h-9 px-3 text-xs font-bold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground gap-1.5 shadow-sm"
              >
                <Wand2 className="w-3.5 h-3.5 text-accent animate-pulse" /> Controls Setup
              </Button>

              <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-muted-foreground ml-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-primary" /> Up to 4 Players
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent" /> WebRTC P2P Sync
                </span>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* HOST SESSION TAB CONTENT                                        */}
          {/* =============================================================== */}
          <TabsContent value="host" className="p-4 sm:p-6 md:p-8 space-y-6 focus-visible:outline-none m-0">
            {/* Step 1: 3D Console Showcase */}
            <ConsoleShowcase
              selectedCore={selectedCore}
              onSelectCore={(coreId) => {
                setSelectedCore(coreId);
                // Clear detected core if user explicitly overrides
                if (detectedCore && detectedCore !== coreId) {
                  setDetectedCore(undefined);
                }
              }}
              detectedCore={detectedCore}
            />

            {/* Step 2: Media Dropzone & Source Selection */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-primary" />
                  Load Game Media ({currentSystem.shortName})
                </label>

                {/* Local vs URL toggle */}
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setRomMethod("file")}
                    className={cn(
                      "text-[11px] font-sans font-bold px-2.5 py-1 rounded transition-colors flex items-center gap-1",
                      romMethod === "file"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <FolderOpen className="w-3 h-3" /> Local File
                  </button>
                  <button
                    type="button"
                    onClick={() => setRomMethod("url")}
                    className={cn(
                      "text-[11px] font-sans font-bold px-2.5 py-1 rounded transition-colors flex items-center gap-1",
                      romMethod === "url"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Link2 className="w-3 h-3" /> Direct URL
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
                <div className="space-y-2 p-5 rounded-2xl border border-primary/30 bg-primary/5">
                  <label className="text-xs font-bold text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-accent" /> Direct ROM / CHD URL
                  </label>
                  <Input
                    placeholder="https://example.com/games/mygame.chd"
                    value={romUrlInput}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="bg-background/80 border-primary/30 focus-visible:ring-primary font-mono text-xs h-11"
                  />
                  <p className="text-[11px] text-muted-foreground font-sans">
                    URL must link directly to an uncompressed or .chd/.zip file hosted on a CORS-enabled server.
                  </p>
                </div>
              )}
            </div>

            {/* Step 3: Host Identity & Launch Deck */}
            <div className="pt-2 border-t border-border/50 grid sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Host Nickname
                  </label>
                  <button
                    type="button"
                    onClick={() => setHostName(getRandomName())}
                    className="text-[11px] text-primary hover:text-accent font-sans flex items-center gap-1 font-bold transition-colors"
                  >
                    <Dices className="w-3.5 h-3.5" /> Randomize
                  </button>
                </div>
                <Input
                  placeholder="YOUR NAME"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  maxLength={20}
                  className="bg-background/80 border-primary/40 focus-visible:ring-primary font-sans font-bold h-12 text-sm"
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
                  className="w-full h-12 text-sm sm:text-base font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 text-primary-foreground shadow-[0_0_25px_rgba(0,71,187,0.45)] transition-all hover:scale-[1.01]"
                >
                  {createSession.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="truncate flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4 text-accent shrink-0 animate-pulse" />
                      <span>START PARTY: {getActiveGameTitle()}</span>
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* =============================================================== */}
          {/* JOIN SESSION TAB CONTENT                                        */}
          {/* =============================================================== */}
          <TabsContent value="join" className="p-4 sm:p-6 md:p-8 space-y-6 focus-visible:outline-none m-0">
            <div className="max-w-lg mx-auto space-y-5 text-center sm:text-left">
              <div>
                <h3 className="text-xl font-bold font-display text-accent flex items-center justify-center sm:justify-start gap-2">
                  <Flame className="w-5 h-5" /> Join An Active Room
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the 6-letter room code shared by your host to join the multiplayer session.
                </p>
              </div>

              {/* Room Code Big Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block text-left">
                  6-Letter Room Code
                </label>
                <Input
                  placeholder="ABCDEF"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="bg-background/80 border-accent/40 focus-visible:ring-accent font-sans h-14 uppercase text-center tracking-[0.3em] font-display font-black text-3xl text-accent shadow-inner"
                />
              </div>

              {/* Guest Nickname Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Your Nickname
                  </label>
                  <button
                    type="button"
                    onClick={() => setJoinName(getRandomName())}
                    className="text-[11px] text-accent hover:text-primary font-sans flex items-center gap-1 font-bold transition-colors"
                  >
                    <Dices className="w-3.5 h-3.5" /> Randomize
                  </button>
                </div>
                <Input
                  placeholder="GUEST NAME"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  maxLength={20}
                  className="bg-background/80 border-accent/30 focus-visible:ring-accent font-sans font-bold h-12"
                />
              </div>

              {/* Join Action Button */}
              <Button
                onClick={handleJoin}
                disabled={joinSession.isPending || !joinName.trim() || !joinCode.trim()}
                className="w-full h-13 text-base font-bold uppercase tracking-wider bg-accent hover:bg-accent/90 text-accent-foreground shadow-[0_0_25px_rgba(224,0,11,0.4)] transition-all hover:scale-[1.01]"
              >
                {joinSession.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Flame className="w-4 h-4" /> ENTER PARTY ROOM
                  </span>
                )}
              </Button>

              {/* Join Feature Callouts */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1">
                  <Users className="w-4 h-4 mx-auto text-primary" />
                  <p className="text-[10px] font-bold text-foreground">4 Players</p>
                  <p className="text-[9px] text-muted-foreground">Full co-op & vs</p>
                </div>
                <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1">
                  <Zap className="w-4 h-4 mx-auto text-accent" />
                  <p className="text-[10px] font-bold text-foreground">Zero Latency</p>
                  <p className="text-[9px] text-muted-foreground">Direct WebRTC</p>
                </div>
                <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1">
                  <Gamepad2 className="w-4 h-4 mx-auto text-emerald-400" />
                  <p className="text-[10px] font-bold text-foreground">Any Gamepad</p>
                  <p className="text-[9px] text-muted-foreground">Auto mapped</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-muted-foreground/80 font-sans tracking-wide relative z-10 flex items-center justify-center gap-2">
        <span>A <strong className="text-foreground">KD Systems</strong> Product</span>
        <span>·</span>
        <span>SEGA Party Cyber-Arcade Edition</span>
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
