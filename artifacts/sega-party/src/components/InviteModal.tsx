import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Copy, Users, Check, Smartphone, Sparkles, Globe, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  sessionCode: string;
}

export function InviteModal({ open, onClose, sessionCode }: InviteModalProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/session/${sessionCode}`
      : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    inviteUrl
  )}&color=00B4FF&bgcolor=0a0a0a`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedLink(true);
      toast({
        title: "Room link copied!",
        description: "Send this URL to your friends to play together.",
      });
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode).then(() => {
      setCopiedCode(true);
      toast({
        title: "Room code copied!",
        description: `Code: ${sessionCode}`,
      });
      setTimeout(() => setCopiedCode(false), 2500);
    });
  };

  const portalTarget =
    (typeof document !== "undefined" && (document.fullscreenElement as HTMLElement)) ||
    (typeof document !== "undefined" ? document.body : null);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto font-sans select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-card/95 backdrop-blur-xl font-sans shadow-2xl p-0 overflow-hidden my-auto text-card-foreground"
      >
        {/* Top Gradient Banner */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-cyan-400 to-accent" />

        {/* Close Button at top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="text-center space-y-1.5">
            <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary mx-auto shadow-[0_0_20px_rgba(0,180,255,0.25)]">
              <Users className="w-6 h-6 text-accent animate-pulse" />
            </div>
            <h2 className="font-sans text-2xl font-black text-foreground">
              Invite Friends to Play
            </h2>
            <p className="text-xs text-muted-foreground/90 max-w-sm mx-auto">
              Share your room to start instant 60 FPS multiplayer. Zero downloads or setup needed for guests!
            </p>
          </div>

          {/* 1. Prominent Room Code Display */}
          <div className="p-4 rounded-2xl bg-neutral-950/80 border border-white/10 text-center space-y-2 relative overflow-hidden group shadow-inner">
            <span className="text-[10px] font-sans uppercase font-bold text-muted-foreground tracking-widest block">
              Room Code
            </span>
            <div className="font-mono text-4xl sm:text-5xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-300 to-accent select-all">
              {sessionCode}
            </div>
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyCode}
                className="h-7 px-3 text-xs rounded-xl border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-foreground font-semibold gap-1.5"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Code Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Copy Room Code</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 2. Direct Shareable Invite Link Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" /> Shareable Room URL
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="w-full bg-white/[0.04] border border-white/15 px-3 py-2 text-xs font-mono rounded-xl text-foreground select-all focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                onClick={handleCopyLink}
                size="sm"
                className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0 shadow-sm transition-all hover:scale-[1.02] gap-1.5"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 3. Friendly 3-Step Consumer Note */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>How Friends Join:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <div className="p-2 rounded-xl bg-black/30 border border-white/5 space-y-0.5">
                <span className="font-bold text-primary block">1. Send Link</span>
                <span>Send the link or room code to friends via Discord or chat.</span>
              </div>
              <div className="p-2 rounded-xl bg-black/30 border border-white/5 space-y-0.5">
                <span className="font-bold text-accent block">2. Open in Browser</span>
                <span>Works on PC, Mac, Chrome, Edge, and iOS/Android phones.</span>
              </div>
              <div className="p-2 rounded-xl bg-black/30 border border-white/5 space-y-0.5">
                <span className="font-bold text-emerald-400 block">3. Instant Play</span>
                <span>Zero ROM downloads or plugins needed. Jump straight in!</span>
              </div>
            </div>
          </div>

          {/* 4. Optional Mobile Phone QR Code Accordion */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="w-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-primary" />
                <span>Scan QR Code on Phone (Includes Touch Gamepad)</span>
              </span>
              <span className="text-[10px] text-primary font-mono font-bold">
                {showQr ? "Hide QR" : "Show QR"}
              </span>
            </button>

            {showQr && (
              <div className="p-4 pt-1 flex flex-col items-center justify-center space-y-2 border-t border-white/10 bg-black/40">
                <div className="w-48 h-48 bg-neutral-950 p-2.5 border border-primary/40 rounded-2xl flex items-center justify-center shadow-lg">
                  <img
                    src={qrUrl}
                    alt="Room QR Code"
                    className="w-full h-full object-contain rounded-xl"
                    loading="lazy"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Smartphones will automatically load the virtual touch controller deck!
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full h-10 rounded-xl border-white/15 hover:bg-white/10 text-foreground font-bold font-sans transition-all"
          >
            Done
          </Button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
