import React from "react";
import {
  Gamepad2,
  Users,
  Crown,
  Sparkles,
  Send,
  UserX,
  Hand,
  MoreVertical,
  Coins,
  Zap,
  Radio,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SlotState, ParticipantInfo } from "@/lib/webrtc";
import { cn } from "@/lib/utils";

interface ControllerSlotsProps {
  slots: SlotState;
  myPeerId: string;
  isHost: boolean;
  mySlot: number | null;
  activeButtons: Set<string>;
  participants: ParticipantInfo[];
  onClaimSlot: (slot: number) => void;
  onReleaseSlot: (slot?: number) => void;
  onPassSlot?: (slot: number, targetPeerId: string, targetPlayerName: string) => void;
  onKickSlot?: (slot: number) => void;
  onRequestSlot?: (slot: number) => void;
}

const SLOT_CONFIGS: Record<
  number,
  {
    upTag: string;
    name: string;
    color: string;
    border: string;
    bg: string;
    glow: string;
    badgeBg: string;
    neonColor: string;
    accentHex: string;
  }
> = {
  1: {
    upTag: "1UP",
    name: "Player 1",
    color: "text-cyan-400",
    border: "border-cyan-500/70 hover:border-cyan-400",
    bg: "bg-cyan-950/30",
    glow: "shadow-[0_0_22px_rgba(6,182,212,0.3)]",
    badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/50",
    neonColor: "bg-cyan-400",
    accentHex: "#06b6d4",
  },
  2: {
    upTag: "2UP",
    name: "Player 2",
    color: "text-red-400",
    border: "border-red-500/70 hover:border-red-400",
    bg: "bg-red-950/30",
    glow: "shadow-[0_0_22px_rgba(239,68,68,0.3)]",
    badgeBg: "bg-red-500/20 text-red-300 border-red-400/50",
    neonColor: "bg-red-400",
    accentHex: "#ef4444",
  },
  3: {
    upTag: "3UP",
    name: "Player 3",
    color: "text-amber-400",
    border: "border-amber-500/70 hover:border-amber-400",
    bg: "bg-amber-950/30",
    glow: "shadow-[0_0_22px_rgba(245,158,11,0.3)]",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-400/50",
    neonColor: "bg-amber-400",
    accentHex: "#f59e0b",
  },
  4: {
    upTag: "4UP",
    name: "Player 4",
    color: "text-emerald-400",
    border: "border-emerald-500/70 hover:border-emerald-400",
    bg: "bg-emerald-950/30",
    glow: "shadow-[0_0_22px_rgba(16,185,129,0.3)]",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50",
    neonColor: "bg-emerald-400",
    accentHex: "#10b981",
  },
};

const BUTTON_INDICATORS = [
  { id: "up", label: "▲" },
  { id: "down", label: "▼" },
  { id: "left", label: "◀" },
  { id: "right", label: "▶" },
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
  { id: "x", label: "X" },
  { id: "y", label: "Y" },
  { id: "z", label: "Z" },
  { id: "start", label: "STA" },
  { id: "mode", label: "MOD" },
];

export function ControllerSlots({
  slots,
  myPeerId,
  isHost,
  mySlot,
  activeButtons,
  participants,
  onClaimSlot,
  onReleaseSlot,
  onPassSlot,
  onKickSlot,
  onRequestSlot,
}: ControllerSlotsProps) {
  const eligibleSpectators = participants.filter(
    (p) => !Object.values(slots).some((s) => s?.peerId === p.peerId),
  );

  return (
    <div className="w-full space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-accent animate-pulse" />
          <h3 className="font-display text-sm tracking-widest text-primary uppercase font-bold flex items-center gap-2">
            Arcade Player Deck
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border">
              4-PLAYER LIVE
            </span>
          </h3>
        </div>

        {mySlot && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReleaseSlot(mySlot)}
            className="h-7 text-xs border-muted-foreground/30 text-muted-foreground hover:text-destructive hover:border-destructive font-sans gap-1"
          >
            <UserX className="w-3 h-3" /> Leave Player {mySlot} (Spectate)
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((slotNum) => {
          const cfg = SLOT_CONFIGS[slotNum];
          const holder = slots[slotNum];
          const isMe = holder?.peerId === myPeerId;
          const isOccupied = !!holder;

          return (
            <Card
              key={slotNum}
              className={cn(
                "border transition-all relative overflow-hidden backdrop-blur-sm",
                isOccupied
                  ? cn(cfg.border, cfg.bg, cfg.glow)
                  : "border-dashed border-border/70 bg-card/40 hover:border-primary/50"
              )}
            >
              <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                {/* Header: Player Tag (1UP..4UP) & Status Orb */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-display font-black text-sm px-2 py-0.5 rounded border tracking-wider bg-background/90 shadow-sm",
                        cfg.color,
                        cfg.border
                      )}
                    >
                      {cfg.upTag}
                    </span>
                    <span className="font-sans font-bold text-xs uppercase tracking-wider text-foreground">
                      {cfg.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isOccupied ? (
                      <>
                        {/* Glowing Online Status Orb */}
                        <span className="relative flex h-2 w-2 mr-1">
                          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", cfg.neonColor)} />
                          <span className={cn("relative inline-flex rounded-full h-2 w-2", cfg.neonColor)} />
                        </span>

                        {holder.isHost ? (
                          <Badge variant="outline" className="text-[10px] border-primary/50 text-primary py-0 px-1.5 gap-1 font-bold">
                            <Crown className="w-2.5 h-2.5 text-amber-400" /> Host
                          </Badge>
                        ) : isMe ? (
                          <Badge variant="outline" className="text-[10px] border-accent/50 text-accent py-0 px-1.5 gap-1 font-bold">
                            <Sparkles className="w-2.5 h-2.5" /> You
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[10px] font-sans uppercase font-bold text-muted-foreground/60 tracking-wider">
                        Open Slot
                      </span>
                    )}

                    {/* Host Moderation Menu on every slot */}
                    {isHost && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-primary p-0"
                            title={`Host Moderation P${slotNum}`}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-card border-border">
                          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase font-mono">
                            Host Actions ({cfg.upTag})
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                              <Send className="w-3 h-3 mr-2 text-primary" /> Pass to spectator...
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48 bg-card border-border">
                              {eligibleSpectators.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">
                                  No spectators available
                                </div>
                              ) : (
                                eligibleSpectators.map((p) => (
                                  <DropdownMenuItem
                                    key={p.peerId}
                                    onClick={() => onPassSlot?.(slotNum, p.peerId, p.playerName)}
                                    className="cursor-pointer text-xs"
                                  >
                                    <span className="font-bold truncate">{p.playerName}</span>
                                  </DropdownMenuItem>
                                ))
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          {isOccupied && (
                            <DropdownMenuItem
                              onClick={() => onKickSlot?.(slotNum)}
                              className="cursor-pointer text-xs text-destructive focus:text-destructive flex items-center gap-2"
                            >
                              <UserX className="w-3.5 h-3.5" /> Kick to Spectators
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Occupant details or Claim / Pass / Request controls */}
                <div className="space-y-2">
                  {isOccupied ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Gamepad2 className={cn("w-4 h-4 shrink-0", cfg.color)} />
                        <span className="font-sans font-bold text-sm truncate text-foreground">
                          {holder.playerName}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1">
                        <Radio className="w-2.5 h-2.5 text-accent" />
                        {isMe ? "Active on your controls" : "Remote player controller"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Button
                        size="sm"
                        onClick={() => onClaimSlot(slotNum)}
                        className={cn(
                          "w-full h-9 text-xs font-black font-display tracking-widest uppercase transition-all flex items-center justify-center gap-1.5",
                          "bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30 hover:from-primary hover:to-primary text-primary-foreground border border-primary/70 shadow-[0_0_15px_rgba(0,180,255,0.35)] animate-pulse hover:animate-none hover:scale-[1.02]"
                        )}
                      >
                        <Coins className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                        <span>INSERT COIN / PRESS TO JOIN</span>
                      </Button>
                      <p className="text-[9px] text-center text-muted-foreground font-mono uppercase tracking-wider">
                        FREE PLAY · READY
                      </p>
                    </div>
                  )}

                  {/* If isMe: Pass Controller dropdown & Release (Spectate) button */}
                  {isMe && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs border-primary/40 text-primary hover:bg-primary/20 flex items-center justify-center gap-1 font-sans"
                          >
                            <Send className="w-3 h-3" /> Pass Controller
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 bg-card border-border">
                          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase font-mono">
                            Pass to Spectator
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {eligibleSpectators.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground text-center">
                              No spectators available
                            </div>
                          ) : (
                            eligibleSpectators.map((p) => (
                              <DropdownMenuItem
                                key={p.peerId}
                                onClick={() => onPassSlot?.(slotNum, p.peerId, p.playerName)}
                                className="cursor-pointer text-xs flex items-center justify-between"
                              >
                                <span className="font-bold truncate">{p.playerName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">Give</span>
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReleaseSlot(slotNum)}
                        className="h-7 text-xs border-muted-foreground/30 text-muted-foreground hover:text-destructive hover:border-destructive font-sans px-2"
                        title="Release (Spectate)"
                      >
                        <UserX className="w-3 h-3 mr-1" /> Spectate
                      </Button>
                    </div>
                  )}

                  {/* If occupied by someone else, AND !mySlot (current user is spectator): Request Controller button */}
                  {isOccupied && !isMe && !mySlot && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRequestSlot?.(slotNum)}
                        className="w-full h-7 text-xs border-primary/40 text-primary hover:bg-primary/20 flex items-center justify-center gap-1.5 font-sans"
                      >
                        <Hand className="w-3 h-3 text-accent" /> Request Controller
                      </Button>
                    </div>
                  )}
                </div>

                {/* Real-time Arcade Button Activity HUD (when isMe) */}
                {isMe && (
                  <div className="pt-2 border-t border-border/50 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1 font-bold text-foreground">
                        <Zap className="w-3 h-3 text-accent animate-pulse" /> Arcade HUD
                      </span>
                      <span className="text-accent font-bold animate-pulse text-[9px] bg-accent/20 px-1 rounded border border-accent/40">
                        LIVE BUS
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {BUTTON_INDICATORS.map((btn) => {
                        const isDown = activeButtons.has(btn.id);
                        return (
                          <span
                            key={btn.id}
                            className={cn(
                              "text-[9px] font-mono font-bold text-center py-1 rounded transition-all select-none",
                              isDown
                                ? "bg-accent text-accent-foreground shadow-[0_0_12px_rgba(255,30,30,0.95)] translate-y-0.5 border-t-2 border-white/40 scale-105 font-black ring-1 ring-accent"
                                : "bg-black/60 border border-white/10 text-muted-foreground/80 shadow-[0_2px_0_rgba(255,255,255,0.08)]"
                            )}
                          >
                            {btn.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
