import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCreateSession, useJoinSession } from "@workspace/api-client-react";
import { Loader2, Gamepad2, Zap, Dices, Flame, Link2, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setRom, setRomFromUrl } from "@/lib/romStore";
import { RomFilePicker } from "@/components/RomFilePicker";
import { ConsolePicker } from "@/components/ConsolePicker";
import { detectConsoleFromFilename } from "@/lib/consoles";
import { cleanRomTitle } from "@/lib/romUtils";
import { setStoredPlayerIdentity } from "@/lib/webrtc";

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
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const getRandomName = () => RETRO_NAMES[Math.floor(Math.random() * RETRO_NAMES.length)];

  // Create Session State
  const [hostName, setHostName] = useState(getRandomName);
  const [romMethod, setRomMethod] = useState<"file" | "url">("file");
  const [romFile, setRomFile] = useState<File | null>(null);
  const [romUrlInput, setRomUrlInput] = useState("");
  const [selectedCore, setSelectedCore] = useState<string>("segaMD");
  const [detectedCore, setDetectedCore] = useState<string | undefined>();

  // Join Session State
  const [joinName, setJoinName] = useState(getRandomName);
  const [joinCode, setJoinCode] = useState("");

  const createSession = useCreateSession();
  const joinSession = useJoinSession();

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
      toast({ title: "Error", description: "Please enter your host name.", variant: "destructive" });
      return;
    }

    if (romMethod === "file") {
      if (!romFile) {
        toast({ title: "Error", description: "Please select a ROM file from your computer.", variant: "destructive" });
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
      toast({ title: "Error", description: "Name and 6-letter room code are required.", variant: "destructive" });
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
      return romFile ? cleanRomTitle(romFile.name) : "Choose ROM File";
    }
    return romUrlInput.trim() ? cleanRomTitle(romUrlInput.split("?")[0].split("/").pop() || "ROM") : "Enter ROM URL";
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 md:p-8 bg-background relative overflow-x-hidden">
      {/* Glow ambient background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="mb-8 text-center relative z-10 space-y-2">
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-sans font-bold tracking-widest uppercase mb-1">
          <span>A KD SYSTEMS PRODUCT</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary drop-shadow-[0_0_20px_rgba(0,71,187,0.5)] font-display tracking-wider">
          SEGA PARTY
        </h1>

        <p className="text-muted-foreground text-sm font-sans tracking-wide">
          Multiplayer party rooms for Sega Genesis, PS1, SNES, N64, GBA & more
        </p>
      </div>

      {/* Main Grid */}
      <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 relative z-10">
        {/* Host Game (7 cols) */}
        <Card className="md:col-span-7 border-primary/50 bg-card/85 backdrop-blur shadow-2xl">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-display flex items-center gap-2 text-primary">
                <Gamepad2 className="w-6 h-6 text-accent" /> Host a Party Room
              </CardTitle>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase">
                Up to 4 Players
              </Badge>
            </div>
            <CardDescription className="font-sans text-xs">
              Load your ROM (.chd, .bin, .sfc, .nes, .z64, .gba, .zip), create a room, and invite friends to play in sync!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-5">
            {/* Host Name input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Host Nickname
                </label>
                <button
                  type="button"
                  onClick={() => setHostName(getRandomName())}
                  className="text-[11px] text-primary hover:text-accent font-sans flex items-center gap-1 font-bold"
                >
                  <Dices className="w-3.5 h-3.5" /> Randomize
                </button>
              </div>
              <Input
                placeholder="YOUR NAME"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                maxLength={20}
                className="bg-background/80 border-primary/30 focus-visible:ring-primary font-sans font-bold h-11"
              />
            </div>

            {/* ROM Selection Source */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Game to Play
                </label>
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setRomMethod("file")}
                    className={`text-[11px] font-sans font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                      romMethod === "file"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FolderOpen className="w-3 h-3" /> Local File
                  </button>
                  <button
                    type="button"
                    onClick={() => setRomMethod("url")}
                    className={`text-[11px] font-sans font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                      romMethod === "url"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Link2 className="w-3 h-3" /> Direct URL
                  </button>
                </div>
              </div>

              {romMethod === "file" ? (
                <RomFilePicker
                  selectedFile={romFile}
                  onFileSelected={handleFileSelected}
                />
              ) : (
                <div className="space-y-1.5 p-4 rounded-xl border border-primary/30 bg-primary/5">
                  <label className="text-xs font-bold text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-accent" /> Direct ROM URL (.chd, .bin, .sfc, etc.)
                  </label>
                  <Input
                    placeholder="https://example.com/games/mygame.chd"
                    value={romUrlInput}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="bg-background/80 border-primary/30 focus-visible:ring-primary font-mono text-xs h-10"
                  />
                  <p className="text-[10px] text-muted-foreground font-sans">
                    Must be a CORS-accessible direct download link.
                  </p>
                </div>
              )}

              {/* Console / Emulation Core Picker */}
              <ConsolePicker
                selectedCore={selectedCore}
                onSelectCore={setSelectedCore}
                detectedCore={detectedCore}
              />
            </div>

            {/* Launch Button */}
            <Button
              onClick={handleCreate}
              disabled={createSession.isPending || !hostName.trim() || (romMethod === "file" && !romFile) || (romMethod === "url" && !romUrlInput.trim())}
              className="w-full h-13 text-base font-bold uppercase tracking-wider bg-primary hover:bg-primary/85 text-primary-foreground shadow-[0_0_20px_rgba(0,71,187,0.5)] transition-all hover:scale-[1.01]"
            >
              {createSession.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="truncate flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4 text-accent shrink-0" />
                  <span>START PARTY: {getActiveGameTitle()}</span>
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Join Game (5 cols) */}
        <Card className="md:col-span-5 border-accent/50 bg-card/85 backdrop-blur shadow-2xl flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-2xl font-display flex items-center gap-2 text-accent">
                <Flame className="w-6 h-6" /> Join Room
              </CardTitle>
              <CardDescription className="font-sans text-xs">
                Enter a 6-letter room code from your friend to join.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5">
              {/* Joiner Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Your Nickname
                  </label>
                  <button
                    type="button"
                    onClick={() => setJoinName(getRandomName())}
                    className="text-[11px] text-accent hover:text-primary font-sans flex items-center gap-1 font-bold"
                  >
                    <Dices className="w-3.5 h-3.5" /> Randomize
                  </button>
                </div>
                <Input
                  placeholder="GUEST NAME"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  maxLength={20}
                  className="bg-background/80 border-accent/30 focus-visible:ring-accent font-sans font-bold h-11"
                />
              </div>

              {/* Room Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  6-Letter Room Code
                </label>
                <Input
                  placeholder="ABCDEF"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="bg-background/80 border-accent/30 focus-visible:ring-accent font-sans h-12 uppercase text-center tracking-[0.25em] font-display font-black text-2xl text-accent"
                />
              </div>

              {/* Join Button */}
              <Button
                onClick={handleJoin}
                disabled={joinSession.isPending || !joinName.trim() || !joinCode.trim()}
                variant="outline"
                className="w-full h-13 text-base font-bold uppercase tracking-wider border-accent text-accent hover:bg-accent hover:text-accent-foreground shadow-[0_0_15px_rgba(224,0,11,0.2)] hover:shadow-[0_0_25px_rgba(224,0,11,0.5)] transition-all"
              >
                {joinSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "ENTER PARTY ROOM"}
              </Button>
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-muted-foreground/80 font-sans tracking-wide">
        A <span className="font-bold text-foreground">KD Systems</span> Product
      </footer>
    </div>
  );
}
