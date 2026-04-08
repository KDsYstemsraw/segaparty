import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCreateSession, useJoinSession } from "@workspace/api-client-react";
import { Loader2, Upload, Gamepad2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setRom } from "@/lib/romStore";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Create Session State
  const [hostName, setHostName] = useState("");
  const [romFile, setRomFile] = useState<File | null>(null);
  
  // Join Session State
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const createSession = useCreateSession();
  const joinSession = useJoinSession();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setRomFile(e.target.files[0]);
    }
  };

  const handleCreate = async () => {
    if (!hostName || !romFile) {
      toast({ title: "Error", description: "Name and ROM file are required.", variant: "destructive" });
      return;
    }

    await setRom(romFile);

    createSession.mutate({ data: { hostName } }, {
      onSuccess: (session) => {
        sessionStorage.setItem("playerName", hostName);
        sessionStorage.setItem("playerId", session.hostId);
        setLocation(`/session/${session.code}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create session.", variant: "destructive" });
      }
    });
  };

  const handleJoin = () => {
    if (!joinName || !joinCode) {
      toast({ title: "Error", description: "Name and code are required.", variant: "destructive" });
      return;
    }

    joinSession.mutate({ code: joinCode.toUpperCase(), data: { playerName: joinName } }, {
      onSuccess: (response) => {
        sessionStorage.setItem("playerName", joinName);
        sessionStorage.setItem("playerId", response.playerId);
        setLocation(`/session/${response.session.code}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Invalid code or session is full.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6">
      
      <div className="mb-12 text-center">
        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary mb-2 drop-shadow-[0_0_15px_rgba(0,71,187,0.5)]">
          SEGA PARTY
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl font-sans uppercase tracking-widest flex items-center justify-center gap-2">
          <Zap className="w-5 h-5 text-accent" />
          Browser-Based Multiplayer
          <Zap className="w-5 h-5 text-accent" />
        </p>
      </div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 relative z-10">
        
        {/* Create Game */}
        <Card className="border-primary/50 bg-card/80 backdrop-blur">
          <CardHeader className="border-b border-border mb-6">
            <CardTitle className="text-2xl font-display flex items-center gap-2 text-primary">
              <Gamepad2 className="w-6 h-6" /> Host Game
            </CardTitle>
            <CardDescription className="font-sans">Upload a ROM and invite friends.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Name</label>
              <Input 
                placeholder="PLAYER 1" 
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                className="bg-background border-primary/30 focus-visible:ring-primary font-sans h-12"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select ROM (.bin, .md, .smd, .gen)</label>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".bin,.md,.smd,.gen"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className={`h-24 border-2 border-dashed ${romFile ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 hover:border-primary/50'} flex flex-col items-center justify-center transition-colors`}>
                  {romFile ? (
                    <span className="font-sans text-primary font-bold truncate px-4">{romFile.name}</span>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                      <span className="font-sans text-sm text-muted-foreground">Click or drag ROM file here</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Button 
              onClick={handleCreate} 
              disabled={createSession.isPending || !hostName || !romFile}
              className="w-full h-14 text-lg font-bold uppercase tracking-wider bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_rgba(0,71,187,0.5)] transition-all hover:scale-[1.02]"
            >
              {createSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "INSERT COIN (START)"}
            </Button>
          </CardContent>
        </Card>

        {/* Join Game */}
        <Card className="border-accent/50 bg-card/80 backdrop-blur">
          <CardHeader className="border-b border-border mb-6">
            <CardTitle className="text-2xl font-display flex items-center gap-2 text-accent">
              <Zap className="w-6 h-6" /> Join Game
            </CardTitle>
            <CardDescription className="font-sans">Enter a code to join an active session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Name</label>
              <Input 
                placeholder="PLAYER 2" 
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="bg-background border-accent/30 focus-visible:ring-accent font-sans h-12"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Session Code</label>
              <Input 
                placeholder="XXXXXX" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="bg-background border-accent/30 focus-visible:ring-accent font-sans h-12 uppercase text-center tracking-[0.2em] font-bold text-xl"
              />
            </div>

            <Button 
              onClick={handleJoin}
              disabled={joinSession.isPending || !joinName || !joinCode}
              variant="outline"
              className="w-full h-14 text-lg font-bold uppercase tracking-wider border-accent text-accent hover:bg-accent hover:text-accent-foreground shadow-[0_0_15px_rgba(224,0,11,0.2)] hover:shadow-[0_0_20px_rgba(224,0,11,0.5)] transition-all"
            >
              {joinSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "JOIN PARTY"}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
