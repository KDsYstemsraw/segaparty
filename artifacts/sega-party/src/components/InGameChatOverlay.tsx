import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage, ParticipantInfo, SlotState } from "@/lib/webrtc";
import { cn } from "@/lib/utils";

export interface InGameChatOverlayProps {
  messages: ChatMessage[];
  participants: ParticipantInfo[];
  slots: SlotState;
  myPeerId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (text: string) => void;
  chatHotkey?: string;
}

const EMOJI_REACTIONS = ["🔥", "🎮", "👏", "😂", "🚀", "🏆", "❤️", "⚡"];

const SLOT_TAG_STYLES: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: "text-cyan-400", bg: "bg-cyan-500/25", border: "border-cyan-400/50" },
  2: { text: "text-rose-400", bg: "bg-rose-500/25", border: "border-rose-400/50" },
  3: { text: "text-amber-400", bg: "bg-amber-500/25", border: "border-amber-400/50" },
  4: { text: "text-emerald-400", bg: "bg-emerald-500/25", border: "border-emerald-400/50" },
};

function formatKey(key?: string): string {
  if (!key) return "Enter";
  if (key === " ") return "Space";
  if (key === "Enter") return "Enter";
  if (key === "Escape") return "Esc";
  if (key === "Backspace") return "Backspace";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function InGameChatOverlay({
  messages,
  participants,
  slots,
  myPeerId,
  isOpen,
  onOpenChange,
  onSendMessage,
  chatHotkey = "Enter",
}: InGameChatOverlayProps) {
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Time tracker for auto-fading passive toasts (6.5s window)
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  // Filter messages for passive 6.5s auto-fade
  const recentMessages = useMemo(() => {
    return messages.filter((m) => now - m.timestamp <= 6500).slice(-4);
  }, [messages, now]);

  // Focus input on active opening
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setInputText("");
      return undefined;
    }
  }, [isOpen]);

  // Auto-scroll chat history on new messages when open
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Find slot for a player peerId
  const getSlotNumber = (peerId: string): number | null => {
    for (let i = 1; i <= 4; i++) {
      if (slots[i]?.peerId === peerId) return i;
    }
    return null;
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (trimmed) {
      onSendMessage(trimmed);
    }
    setInputText("");
    onOpenChange(false);
  };

  return (
    <div
      className="absolute bottom-3 left-3 z-30 w-80 sm:w-96 max-w-[calc(100%-1.5rem)] pointer-events-none font-sans select-none"
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
    >
      {isOpen ? (
        /* ================= Active Typing Mode: Frosted-Glass HUD Drawer ================= */
        <div className="pointer-events-auto bg-black/85 backdrop-blur-xl border border-white/20 rounded-2xl p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] space-y-2 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 px-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                <MessageSquare className="w-3 h-3 text-accent" />
              </div>
              <span className="font-sans font-bold text-xs uppercase tracking-wider text-foreground">
                Party Chat
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/80 px-1.5 py-0.2 rounded-full bg-white/[0.05] border border-white/10">
                {participants.length} in room
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                [Enter] Send · [Esc] Close
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                title="Close chat (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Message History */}
          <div
            ref={scrollRef}
            className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground/60 text-[11px] space-y-0.5">
                <Sparkles className="w-4 h-4 mx-auto mb-1 text-primary/40" />
                <p>No messages yet. Send a message or emoji to your party!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === myPeerId;
                const slot = msg.senderId ? getSlotNumber(msg.senderId) : null;
                const slotStyle = slot ? SLOT_TAG_STYLES[slot] : null;

                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="text-center my-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/[0.06] text-neutral-300 border border-white/10 text-[10px] font-sans">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col space-y-0.5 text-xs",
                      isMe ? "items-end" : "items-start"
                    )}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className={cn("font-bold", isMe ? "text-accent" : "text-foreground")}>
                        {msg.senderName}
                      </span>
                      {slot && slotStyle && (
                        <span
                          className={cn(
                            "px-1 py-0.2 rounded font-mono font-bold text-[9px] border",
                            slotStyle.bg,
                            slotStyle.text,
                            slotStyle.border
                          )}
                        >
                          P{slot}
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-xs font-sans max-w-[90%] break-words shadow-sm leading-relaxed",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-none shadow-[0_0_12px_rgba(0,180,255,0.3)]"
                          : "bg-white/[0.08] text-neutral-100 border border-white/10 rounded-tl-none"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Emoji Reaction Strip */}
          <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-white/10">
            <span className="text-[9px] text-muted-foreground/60 uppercase font-bold pl-1 shrink-0">
              React:
            </span>
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSendMessage(emoji);
                }}
                className="px-1.5 py-0.5 rounded-md hover:bg-white/15 text-xs transition-transform active:scale-90 hover:scale-110 shrink-0"
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Auto-Focused Input Form with Strict Key Isolation */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSend();
            }}
            className="flex items-center gap-1.5 pt-0.5"
          >
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") {
                  e.preventDefault();
                  onOpenChange(false);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              placeholder="Type message, press Enter to send..."
              className="h-8 text-xs rounded-xl bg-white/[0.07] border-white/15 focus-visible:ring-primary text-foreground placeholder:text-muted-foreground/60 font-sans"
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 w-8 p-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-sm transition-all hover:scale-105"
              title="Send (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      ) : (
        /* ================= Passive Gameplay Mode: 6-Second Floating Toasts & Pill ================= */
        <div className="space-y-2 pointer-events-none">
          {/* Floating Recent Message Toasts (Up to 4 messages within 6.5s) */}
          <div className="space-y-1.5">
            {recentMessages.map((msg) => {
              const isMe = msg.senderId === myPeerId;
              const slot = msg.senderId ? getSlotNumber(msg.senderId) : null;
              const slotStyle = slot ? SLOT_TAG_STYLES[slot] : null;

              if (msg.isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="pointer-events-auto inline-block bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-xl text-[10px] text-neutral-300 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    {msg.text}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className="pointer-events-auto flex items-start gap-1.5 bg-black/70 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl text-xs text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-full"
                >
                  {slot && slotStyle ? (
                    <span
                      className={cn(
                        "px-1 py-0.2 rounded font-mono font-bold text-[9px] border shrink-0 mt-0.5",
                        slotStyle.bg,
                        slotStyle.text,
                        slotStyle.border
                      )}
                    >
                      P{slot}
                    </span>
                  ) : null}

                  <div className="min-w-0">
                    <span className={cn("font-bold mr-1.5", isMe ? "text-accent" : "text-white")}>
                      {msg.senderName}:
                    </span>
                    <span className="text-white/90 break-words font-sans">{msg.text}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unobtrusive HUD Trigger Pill */}
          <div>
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 hover:bg-black/80 border border-white/15 hover:border-white/30 text-[11px] text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-md shadow-md hover:scale-105 active:scale-95"
              title={`Press [${formatKey(chatHotkey)}] to open on-screen chat`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-accent animate-pulse" />
              <span>
                Press <strong className="text-accent font-mono">[{formatKey(chatHotkey)}]</strong> to Chat
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
