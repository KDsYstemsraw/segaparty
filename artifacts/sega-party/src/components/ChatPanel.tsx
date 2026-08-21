import React, { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Sparkles, Smile, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage, ParticipantInfo, SlotState } from "@/lib/webrtc";

interface ChatPanelProps {
  messages: ChatMessage[];
  participants: ParticipantInfo[];
  slots: SlotState;
  myPeerId: string;
  onSendMessage: (text: string) => void;
}

const EMOJI_REACTIONS = ["🔥", "🎮", "🕹️", "👏", "😂", "🚀", "💀", "🏆", "⚡", "❤️"];

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

  // Find player slot number for a peer
  const getSlotNumber = (peerId: string): number | null => {
    for (let i = 1; i <= 4; i++) {
      if (slots[i]?.peerId === peerId) return i;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-card/80 border border-border/80 rounded-lg overflow-hidden shadow-lg backdrop-blur">
      {/* Chat header */}
      <div className="p-3 border-b border-border/60 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-display text-xs uppercase tracking-wider font-bold text-foreground">
            Room Hangout Chat
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-sans border-primary/40 text-primary">
          {participants.length} online
        </Badge>
      </div>

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-2.5 min-h-[220px] max-h-[360px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <Sparkles className="w-6 h-6 mb-2 text-primary/40" />
            <p className="text-xs font-sans">No messages yet.</p>
            <p className="text-[10px] font-sans text-muted-foreground/60">Say hi to your retro party friends!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myPeerId;
            const slot = msg.senderId ? getSlotNumber(msg.senderId) : null;

            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center my-1.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 text-primary-foreground border border-primary/20 text-[10px] font-sans font-medium">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col space-y-0.5 ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className={`font-bold ${isMe ? "text-accent" : "text-foreground"}`}>
                    {msg.senderName}
                  </span>
                  {slot && (
                    <span className="px-1 py-0.2 rounded bg-primary/20 text-primary text-[9px] font-mono font-bold">
                      P{slot}
                    </span>
                  )}
                  <span className="text-[9px] opacity-60">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans max-w-[85%] break-words ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-none shadow-[0_0_10px_rgba(0,71,187,0.2)]"
                      : "bg-muted text-foreground rounded-tl-none border border-border/50"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Emoji Bar */}
      <div className="px-2 py-1.5 border-t border-border/40 bg-muted/10 flex items-center gap-1 overflow-x-auto">
        <span className="text-[10px] text-muted-foreground/60 font-sans px-1">Quick:</span>
        {EMOJI_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            className="hover:scale-125 transition-transform text-sm px-1 py-0.5 rounded hover:bg-white/10"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSend} className="p-2 border-t border-border/60 flex items-center gap-2 bg-background">
        <Input
          placeholder="Send a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="h-9 text-xs bg-muted/30 border-border/80 focus-visible:ring-primary font-sans"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!inputText.trim()}
          className="h-9 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-sans font-bold"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}
