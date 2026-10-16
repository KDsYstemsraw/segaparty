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
  Plus,
  Settings2,
  Radio,
  Sliders,
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

export interface ControllerSlotsProps {
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
  onOpenControls?: (slot?: number) => void;
}

const SLOT_CONFIGS: Record<
  number,
  {
    tag: string;
    label: string;
    color: string;
    border: string;
    bg: string;
    glow: string;
    pillBg: string;
    dotColor: string;
  }
> = {
  1: {
    tag: "P1",
    label: "Player 1",
    color: "text-cyan-400",
    border: "border-cyan-500/35 hover:border-cyan-400/60",
    bg: "bg-cyan-950/20",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
    pillBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
    dotColor: "bg-cyan-400",
  },
  2: {
    tag: "P2",
    label: "Player 2",
    color: "text-rose-400",
    border: "border-rose-500/35 hover:border-rose-400/60",
    bg: "bg-rose-950/20",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]",
    pillBg: "bg-rose-500/20 text-rose-300 border-rose-400/40",
    dotColor: "bg-rose-400",
  },
  3: {
    tag: "P3",
    label: "Player 3",
    color: "text-amber-400",
    border: "border-amber-500/35 hover:border-amber-400/60",
    bg: "bg-amber-950/20",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    pillBg: "bg-amber-500/20 text-amber-300 border-amber-400/40",
    dotColor: "bg-amber-400",
  },
  4: {
    tag: "P4",
    label: "Player 4",
    color: "text-emerald-400",
    border: "border-emerald-500/35 hover:border-emerald-400/60",
    bg: "bg-emerald-950/20",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    pillBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
    dotColor: "bg-emerald-400",
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
  onOpenControls,
}: ControllerSlotsProps) {
  const eligibleSpectators = participants.filter(
    (p) => !Object.values(slots).some((s) => s?.peerId === p.peerId),
  );

  return (
    <div className="w-full space-y-3 font-sans">
      {/* 1. Clean Consumer Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-primary shadow-sm">
            <Gamepad2 className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="font-sans font-extrabold text-sm tracking-tight text-foreground flex items-center gap-2">
              Controllers & Players
              <Badge variant="outline" className="text-[10px] font-mono py-0 px-2 rounded-full border-white/15 bg-white/[0.03] text-muted-foreground font-semibold">
                Up to 4 Players
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground/80">
              Pick a controller slot to jump into the game with Keyboard, Mouse, or Gamepad.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenControls && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onOpenControls(mySlot || undefined)}
              className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm shadow-primary/30 flex items-center gap-1.5 transition-all hover:scale-[1.02]"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Keybind & Controller Setup</span>
            </Button>
          )}

          {mySlot && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReleaseSlot(mySlot)}
              className="h-8 px-3 text-xs rounded-xl border-white/15 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 font-medium transition-colors gap-1.5"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Switch to Spectator</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Sleek 4-Player Consumer Cards */}
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
                "rounded-2xl transition-all duration-200 relative overflow-hidden backdrop-blur-md flex flex-col justify-between",
                isOccupied
                  ? cn(cfg.border, cfg.bg, cfg.glow, "border shadow-lg")
                  : "border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/25 shadow-sm"
              )}
            >
              <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                {/* Top Row: Slot Pill, Player Display Name, Status Badges & Menu */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "font-sans font-black text-[11px] px-2 py-0.5 rounded-full border tracking-wide uppercase shrink-0 shadow-sm",
                        isOccupied ? cfg.pillBg : "bg-white/5 text-muted-foreground border-white/10"
                      )}
                    >
                      {cfg.tag}
                    </span>

                    <span className="font-sans font-bold text-xs truncate text-foreground">
                      {isOccupied ? holder.playerName : `Controller ${slotNum}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isOccupied ? (
                      <>
                        {holder.isHost ? (
                          <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300 bg-amber-500/10 py-0.5 px-1.5 rounded-full font-bold gap-1">
                            <Crown className="w-2.5 h-2.5 text-amber-400" /> Host
                          </Badge>
                        ) : isMe ? (
                          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary-foreground bg-primary/30 py-0.5 px-1.5 rounded-full font-bold gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-accent" /> You
                          </Badge>
                        ) : null}

                        {/* Host Moderation Menu */}
                        {isHost && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-lg p-0"
                                title={`Manage Controller ${slotNum}`}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl bg-card border-white/10 shadow-xl">
                              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase font-mono">
                                Controller {slotNum} Options
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs cursor-pointer rounded-lg">
                                  <Send className="w-3 h-3 mr-2 text-primary" /> Pass to spectator...
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48 rounded-xl bg-card border-white/10 shadow-xl">
                                  {eligibleSpectators.length === 0 ? (
                                    <div className="p-2.5 text-xs text-muted-foreground text-center">
                                      No spectators in room
                                    </div>
                                  ) : (
                                    eligibleSpectators.map((p) => (
                                      <DropdownMenuItem
                                        key={p.peerId}
                                        onClick={() => onPassSlot?.(slotNum, p.peerId, p.playerName)}
                                        className="cursor-pointer text-xs rounded-lg font-bold"
                                      >
                                        <span className="truncate">{p.playerName}</span>
                                      </DropdownMenuItem>
                                    ))
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuItem
                                onClick={() => onKickSlot?.(slotNum)}
                                className="cursor-pointer text-xs text-destructive focus:text-destructive rounded-lg flex items-center gap-2"
                              >
                                <UserX className="w-3.5 h-3.5" /> Remove from Slot
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] font-sans font-medium text-muted-foreground/60">
                        Available
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Content: Live Input Activity HUD (when isMe) or Occupant Status */}
                {isOccupied ? (
                  <div className="space-y-2 py-0.5">
                    {/* Live Input Activity Dots / Buttons */}
                    {isMe ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" /> Live Input Bus:
                          </span>
                          <span className="font-mono text-[9px] text-emerald-400">P{slotNum} Active</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {BUTTON_INDICATORS.map((btn) => {
                            const isDown = activeButtons.has(btn.id);
                            return (
                              <span
                                key={btn.id}
                                className={cn(
                                  "text-[9px] font-mono font-bold text-center py-0.5 rounded-md transition-all select-none border",
                                  isDown
                                    ? "bg-emerald-400 text-black border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)] font-black scale-105"
                                    : "bg-black/40 border-white/10 text-muted-foreground/70"
                                )}
                              >
                                {btn.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", cfg.dotColor)} />
                            <span className={cn("relative inline-flex rounded-full h-2 w-2", cfg.dotColor)} />
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground truncate">
                            Remote player ready
                          </span>
                        </div>
                        {/* Request Controller button if current user is spectator */}
                        {!mySlot && onRequestSlot && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRequestSlot(slotNum)}
                            className="h-6 text-[10px] px-2 text-primary hover:text-primary-foreground hover:bg-primary/20 rounded-lg font-bold gap-1"
                          >
                            <Hand className="w-2.5 h-2.5 text-accent" /> Request
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Pass to spectator shortcut (when isMe) */}
                    {isMe && onPassSlot && eligibleSpectators.length > 0 && (
                      <div className="flex items-center justify-between text-[10px] pt-0.5 text-muted-foreground">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-[10px] text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors"
                            >
                              <Send className="w-2.5 h-2.5" /> Pass Controller to Spectator...
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 rounded-xl bg-card border-white/10 shadow-xl">
                            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase font-mono">
                              Pass Controller {slotNum}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            {eligibleSpectators.map((p) => (
                              <DropdownMenuItem
                                key={p.peerId}
                                onClick={() => onPassSlot(slotNum, p.peerId, p.playerName)}
                                className="cursor-pointer text-xs rounded-lg font-bold"
                              >
                                <span>{p.playerName}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-3 flex flex-col items-center justify-center text-center space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground/80">
                      Controller {slotNum} Available
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      Press Take Controller to join
                    </p>
                  </div>
                )}

                {/* Bottom Row: Clear Action Button */}
                <div className="pt-1 border-t border-white/5">
                  {isOccupied ? (
                    onOpenControls ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenControls(slotNum)}
                        className="w-full h-8 text-xs font-bold rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-foreground border border-white/10 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01]"
                        title={`Configure & Test Controls for Player ${slotNum}`}
                      >
                        <Settings2 className="w-3.5 h-3.5 text-primary" />
                        <span>Keybinds & Setup</span>
                      </Button>
                    ) : null
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onClaimSlot(slotNum)}
                      className={cn(
                        "w-full h-8 text-xs font-black tracking-wide uppercase rounded-xl transition-all flex items-center justify-center gap-1.5",
                        "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.02]"
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Take Controller</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
