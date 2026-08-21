import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useCreateSession, useJoinSession } from "@workspace/api-client-react";
import { Loader2, Upload, Gamepad2, Zap, Sparkles, Dices, Users, ShieldCheck, Flame, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setRom, setRomFromUrl } from "@/lib/romStore";
import { SAMPLE_ROMS, type SampleRom } from "@/lib/sampleRoms";
import { RomFilePicker } from "@/components/RomFilePicker";
import { cleanRomTitle } from "@/lib/romUtils";

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
  const [romFile, setRomFile] = useState<File | null>(null);
  const [selectedSampleRom, setSelectedSampleRom] = useState<SampleRom | null>(SAMPLE_ROMS[0]);
  const [romSourceTab, setRomSourceTab] = useState<"file" | "sample">("file");

  // Join Session State
  const [joinName, setJoinName] = useState(getRandomName);
  const [joinCode, setJoinCode] = useState("");

  const createSession = useCreateSession();
  const joinSession = useJoinSession();

  const handleCreate = async () => {
    if (!hostName.trim()) {
      toast({ title: "Error", description: "Please enter your host name.", variant: "destructive" });
      return;
    }

    if (romSourceTab === "file") {
      if (!romFile) {
        toast({ title: "Error", description: "Please select a Sega Genesis ROM file from your computer.", variant: "destructive" });
        return;
      }
      await setRom(romFile);
    } else {
      if (!selectedSampleRom) {
        toast({ title: "Error", description: "Please pick a sample demo ROM.", variant: "destructive" });
        return;
      }
      setRomFromUrl(selectedSampleRom.url, selectedSampleRom.name);
    }

    createSession.mutate(
      { data: { hostName: hostName.trim() } },
      {
        onSuccess: (session) => {
          sessionStorage.setItem("playerName", hostName.trim());
          sessionStorage.setItem("playerId", session.hostId);
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
          sessionStorage.setItem("playerName", joinName.trim());
          sessionStorage.setItem("playerId", response.playerId);
          setLocation(`/session/${response.session.code}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Invalid code or session is full.", variant: "destructive" });
        },
      },
    );
  };

  const getActiveGameTitle = () => {
    if (romSourceTab === "file") {
      return romFile ? cleanRomTitle(romFile.name) : "Choose ROM File";
    }
    return selectedSampleRom?.name || "Demo";
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
          Multiplayer Sega Genesis party rooms
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
              Pick any Sega Genesis ROM from your computer, create a room, and share the link with friends!
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

            {/* ROM Selection: Pick Local File vs Built-in */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Select Game to Play
              </label>

              <Tabs
                value={romSourceTab}
                onValueChange={(v) => setRomSourceTab(v as "file" | "sample")}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 bg-muted/60 mb-3">
                  <TabsTrigger value="file" className="text-xs font-bold gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-accent" /> Pick Local ROM File
                  </TabsTrigger>
                  <TabsTrigger value="sample" className="text-xs font-bold gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Built-in Demos
                  </TabsTrigger>
                </TabsList>

                {/* Pick Local ROM File Tab (100% Client-side in browser memory) */}
                <TabsContent value="file" className="space-y-2">
                  <RomFilePicker
                    selectedFile={romFile}
                    onFileSelected={(file) => setRomFile(file)}
                  />
                </TabsContent>

                {/* Built-in Games Grid */}
                <TabsContent value="sample" className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {SAMPLE_ROMS.map((rom) => {
                      const isSelected = selectedSampleRom?.id === rom.id;
                      return (
                        <button
                          key={rom.id}
                          type="button"
                          onClick={() => setSelectedSampleRom(rom)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/15 shadow-[0_0_12px_rgba(0,71,187,0.3)] ring-1 ring-primary"
                              : "border-border bg-background/50 hover:border-primary/40 hover:bg-primary/5"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-foreground truncate">{rom.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/40 text-primary">
                              {rom.badge}
                            </Badge>
                            <span>{rom.category}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                            {rom.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Launch Button */}
            <Button
              onClick={handleCreate}
              disabled={createSession.isPending || !hostName.trim() || (romSourceTab === "file" && !romFile)}
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




