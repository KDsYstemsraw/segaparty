import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Smartphone, Users, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  sessionCode: string;
}

export function InviteModal({ open, onClose, sessionCode }: InviteModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/session/${sessionCode}` : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}&color=0047BB&bgcolor=000000`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      toast({
        title: "Room link copied!",
        description: "Send this URL to your friends to play together.",
      });
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-primary/60 font-sans shadow-2xl">
        <DialogHeader className="text-center">
          <DialogTitle className="font-display text-2xl text-primary flex items-center justify-center gap-2">
            <Users className="w-6 h-6 text-accent" /> Invite Friends
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Share this room with anyone. They can join instantly with zero installs!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 my-2">
          {/* Room Code Callout */}
          <div className="text-center p-3 bg-black/50 border border-primary/40 rounded-lg">
            <span className="text-[10px] font-sans uppercase font-bold text-muted-foreground tracking-widest block mb-1">
              Room Code
            </span>
            <div className="font-display text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary tracking-[0.25em]">
              {sessionCode}
            </div>
          </div>

          {/* Copy Link Button */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="w-full bg-muted/40 border border-border px-3 py-2 text-xs font-mono rounded text-foreground select-all"
              />
              <Button
                onClick={handleCopy}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Mobile QR Code Scanner */}
          <div className="flex flex-col items-center justify-center p-4 bg-black/40 border border-border/80 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2">
              <Smartphone className="w-4 h-4 text-accent" /> Scan with Phone to Play
            </div>
            <div className="w-44 h-44 bg-black p-2 border-2 border-primary rounded-lg flex items-center justify-center shadow-lg">
              <img
                src={qrUrl}
                alt="Room QR Code"
                className="w-full h-full object-contain rounded"
                loading="lazy"
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 font-sans">
              Smartphones will automatically show the touch controller!
            </p>
          </div>
        </div>

        <Button onClick={onClose} variant="outline" className="w-full font-bold font-sans">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
