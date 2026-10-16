import React, { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Sparkles, Smile, Radio, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage, ParticipantInfo, SlotState } from "@/lib/webrtc";
import { cn } from "@/lib/utils";

export interface ChatPanelProps {
  messages: ChatMessage[];
  participants: ParticipantInfo[];
  slots: SlotState;
  myPeerId: string;
  onSendMessage: (text: string) => void;
}

const EMOJI_REACTIONS = ["🔥", "🎮", "👏", "😂", "🚀", "🏆", "❤️", "⚡", "🕹️", "💀"];

const SLOT_TAG_STYLES: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-400/40" },
  2: { text: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-400/40" },
  3: { text: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-400/40" },
  4: { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-400/40" },
};

export function ChatPanel({
  messages,
  participants,
  slots,
  myPeerId,
  onSendMessage,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleEmojiClick = (emoji: string) => {
    onSendMessage(emoji);
  };

  // Find player slot number for a peer (1 to 4)
  const getSlotNumber = (peerId: string): number | null => {
    for (let i = 1; i <= 4; i++) {
      if (slots[i]?.peerId === peerId) return i;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-neutral-900/90 border border-white/10 shadow-xl overflow-hidden backdrop-blur-md">
      {/* 1. Modern Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <span className="font-sans font-bold text-xs uppercase tracking-wider text-foreground">
            Party Chat
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold text-neutral-300">
            {participants.length} in room
          </span>
        </div>
      </div>

      {/* 2. Message Feed */}
      <div
        ref={scrollRef}
        className="flex-1 p-3.5 overflow-y-auto space-y-3 min-h-[220px] max-h-[460px] scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-muted-foreground/60">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">No messages yet</p>
              <p className="text-[11px] text-muted-foreground/70">
                Say hello or drop a reaction to your party!
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myPeerId;
            const slot = msg.senderId ? getSlotNumber(msg.senderId) : null;
            const slotStyle = slot ? SLOT_TAG_STYLES[slot] : null;

            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-1.5">
                  <span className="px-3 py-1 rounded-full bg-white/[0.04] text-neutral-300 border border-white/10 text-[11px] font-sans font-medium shadow-sm">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col space-y-1 transition-all",
                  isMe ? "items-end" : "items-start"
                )}
              >
                {/* Sender Metadata */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className={cn("font-bold", isMe ? "text-accent" : "text-foreground")}>
                    {msg.senderName}
                  </span>

                  {slot && slotStyle ? (
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full border text-[9px] font-mono font-black uppercase tracking-wider",
                        slotStyle.bg,
                        slotStyle.text,
                        slotStyle.border
                      )}
                    >
                      P{slot}
                    </span>
                  ) : null}

                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={cn(
                    "px-3.5 py-2 text-xs font-sans max-w-[85%] break-words leading-relaxed shadow-sm",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm shadow-[0_0_15px_rgba(0,180,255,0.25)]"
                      : "bg-white/[0.06] text-neutral-100 border border-white/[0.08] rounded-2xl rounded-tl-sm"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Sleek Quick Reaction Bar */}
      <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[10px] text-muted-foreground/60 font-sans px-1 shrink-0">
          React:
        </span>
        {EMOJI_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleEmojiClick(emoji)}
            className="px-2 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.12] border border-white/5 text-xs transition-all active:scale-90 hover:scale-110 shrink-0"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* 4. Modern Rounded Message Input Bar */}
      <form
        onSubmit={handleSend}
        className="p-2.5 border-t border-white/10 flex items-center gap-2 bg-neutral-950/80"
      >
        <Input
          placeholder="Send a message or reaction..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="h-9 text-xs rounded-xl bg-white/[0.05] border-white/10 focus-visible:ring-primary text-foreground placeholder:text-muted-foreground/60 font-sans"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!inputText.trim()}
          className="h-9 w-9 p-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0 shadow-sm transition-all hover:scale-105 disabled:opacity-40"
          title="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}
