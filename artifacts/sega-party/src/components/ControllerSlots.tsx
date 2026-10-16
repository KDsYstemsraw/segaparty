import React from "react";
import { Gamepad2, Users, Crown, ShieldAlert, Sparkles, Send, UserX, Hand, MoreVertical } from "lucide-react";
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

const SLOT_CONFIGS: Record<number, { name: string; color: string; border: string; bg: string; glow: string }> = {
  1: {
    name: "Player 1",
    color: "text-blue-400",
    border: "border-blue-500",
    bg: "bg-blue-950/40",
    glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]",
  },
  2: {
    name: "Player 2",
    color: "text-red-400",
    border: "border-red-500",
    bg: "bg-red-950/40",
    glow: "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
  },
  3: {
    name: "Player 3",
    color: "text-amber-400",
    border: "border-amber-500",
    bg: "bg-amber-950/40",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",
  },
  4: {
    name: "Player 4",
    color: "text-emerald-400",
    border: "border-emerald-500",
    bg: "bg-emerald-950/40",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",
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
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm tracking-widest text-primary flex items-center gap-2 uppercase font-bold">
          <Gamepad2 className="w-4 h-4 text-accent" />
          Controller Slots (Genesis 6-Button)
        </h3>
        {mySlot && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReleaseSlot(mySlot)}
            className="h-7 text-xs border-muted-foreground/30 text-muted-foreground hover:text-destructive hover:border-destructive font-sans"
          >
            Leave Player {mySlot} (Spectate)
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
              className={`border transition-all relative overflow-hidden ${
                isOccupied ? `${cfg.border} ${cfg.bg} ${cfg.glow}` : "border-dashed border-border/60 bg-card/40"
              }`}
            >
              <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-display font-black text-base px-2 py-0.5 rounded border ${cfg.color} ${cfg.border} bg-background/80`}
                    >
                      P{slotNum}
                    </span>
                    <span className="font-sans font-bold text-xs uppercase tracking-wider text-foreground">
                      {cfg.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isOccupied ? (
                      holder.isHost ? (
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary py-0 px-1.5 gap-1">
                          <Crown className="w-2.5 h-2.5" /> Host
                        </Badge>
                      ) : isMe ? (
                        <Badge variant="outline" className="text-[10px] border-accent/50 text-accent py-0 px-1.5 gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> You
                        </Badge>
                      ) : null
                    ) : (
                      <span className="text-[10px] font-sans uppercase font-bold text-muted-foreground/60 tracking-wider">
                        Open
                      </span>
                    )}

                    {/* Host Moderation Popover / Menu on every slot */}
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
                            Host Actions (P{slotNum})
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
                      <div className="font-sans font-bold text-sm truncate text-foreground flex items-center gap-1.5">
                        {holder.playerName}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">
                        {isMe ? "Sending controller inputs" : "Remote player controller"}
                      </p>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onClaimSlot(slotNum)}
                      className={`w-full h-8 text-xs font-bold font-sans uppercase tracking-wider ${
                        mySlot === slotNum
                          ? "bg-accent text-accent-foreground"
                          : "bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/40"
                      }`}
                    >
                      Grab Player {slotNum}
                    </Button>
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

                {/* Live Button Activity Monitor (if this is the user's slot) */}
                {isMe && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground font-sans uppercase tracking-wider mb-1">
                      <span>Input Monitor</span>
                      <span className="text-accent font-mono">LIVE</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {BUTTON_INDICATORS.map((btn) => {
                        const isDown = activeButtons.has(btn.id);
                        return (
                          <span
                            key={btn.id}
                            className={`text-[9px] font-mono px-1 py-0.5 rounded border transition-colors ${
                              isDown
                                ? "bg-accent border-accent text-accent-foreground font-bold shadow-[0_0_8px_rgba(224,0,11,0.8)] scale-105"
                                : "bg-background/80 border-border text-muted-foreground/70"
                            }`}
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
