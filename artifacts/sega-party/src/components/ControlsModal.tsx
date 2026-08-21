import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2, RotateCcw, Circle, Keyboard, Tv } from "lucide-react";
import {
  GAME_ACTIONS,
  DEFAULT_MAPPING,
  loadMapping,
  saveMapping,
  buttonLabel,
  type GamepadMapping,
} from "@/lib/gamepadMapping";

interface ControlsModalProps {
  open: boolean;
  onClose: () => void;
}

const ACTION_ORDER = ["up", "down", "left", "right", "a", "b", "c", "x", "y", "z", "start", "mode"];

export function ControlsModal({ open, onClose }: ControlsModalProps) {
  const [mapping, setMapping] = useState<GamepadMapping>(() => loadMapping());
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [connectedPad, setConnectedPad] = useState<string | null>(null);
  const [lastPressedButton, setLastPressedButton] = useState<string | null>(null);
  const listenTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);

  // Detect connected gamepad
  useEffect(() => {
    const update = () => {
      const pads = navigator.getGamepads();
      const found = [...pads].find(Boolean);
      setConnectedPad(found ? `${found.id.slice(0, 35)}${found.id.length > 35 ? "…" : ""}` : null);
    };
    update();
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);

  // Poll for button press when listening or testing
  useEffect(() => {
    if (!open) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const pressed = new Set<number>();

    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;
        for (let i = 0; i < gp.buttons.length; i++) {
          const isDown = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
          if (isDown && !pressed.has(i)) {
            setLastPressedButton(buttonLabel(i));
            if (listeningFor) {
              const newMapping = { ...mapping, [String(i)]: listeningFor };
              setMapping(newMapping);
              saveMapping(newMapping);
              window.dispatchEvent(new Event("gamepad-mapping-changed"));
              setListeningFor(null);
              if (listenTimeout.current) clearTimeout(listenTimeout.current);
              return;
            }
          }
          if (!isDown) pressed.delete(i);
          if (isDown) pressed.add(i);
        }
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, listeningFor, mapping]);

  const startListening = (actionName: string) => {
    setListeningFor(actionName);
    if (listenTimeout.current) clearTimeout(listenTimeout.current);
    listenTimeout.current = setTimeout(() => setListeningFor(null), 5000);
  };

  const resetDefaults = () => {
    saveMapping(DEFAULT_MAPPING);
    setMapping({ ...DEFAULT_MAPPING });
    window.dispatchEvent(new Event("gamepad-mapping-changed"));
  };

  const actionToButton = (actionName: string): string => {
    const entry = Object.entries(mapping).find(([k, v]) => v === actionName && !k.startsWith("axis"));
    if (!entry) return "—";
    return buttonLabel(Number(entry[0]));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setListeningFor(null); onClose(); } }}>
      <DialogContent className="max-w-xl bg-card border-primary/50 font-sans shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-primary flex items-center gap-2 text-xl">
            <Gamepad2 className="w-5 h-5 text-accent" /> Controller & Key Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="gamepad" className="w-full">
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/60">
            <TabsTrigger value="gamepad" className="text-xs font-bold gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5" /> Gamepad Remap
            </TabsTrigger>
            <TabsTrigger value="keyboard" className="text-xs font-bold gap-1.5">
              <Keyboard className="w-3.5 h-3.5" /> Keyboard Layout
            </TabsTrigger>
          </TabsList>

          {/* Gamepad tab */}
          <TabsContent value="gamepad" className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {connectedPad ? (
                  <Badge variant="outline" className="border-green-500 text-green-400 text-xs py-0.5">
                    <Circle className="w-2 h-2 fill-green-400 mr-1" /> {connectedPad}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted text-muted-foreground text-xs py-0.5">
                    No gamepad detected — connect via USB/Bluetooth
                  </Badge>
                )}
              </div>
              {lastPressedButton && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Last pressed: <span className="text-accent font-bold">{lastPressedButton}</span>
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Click any button row below and press your physical controller button to rebind.
            </p>

            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {ACTION_ORDER.map((actionName) => {
                const action = GAME_ACTIONS[actionName];
                const isListening = listeningFor === actionName;
                const boundButton = actionToButton(actionName);
                return (
                  <button
                    key={actionName}
                    onClick={() => startListening(actionName)}
                    className={`flex items-center justify-between px-3 py-2 border text-left transition-all rounded-md ${
                      isListening
                        ? "border-accent bg-accent/15 animate-pulse"
                        : "border-border bg-background/80 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {action.label}
                    </span>
                    <span className={`text-xs font-mono font-bold ${isListening ? "text-accent" : "text-muted-foreground"}`}>
                      {isListening ? "Press now…" : boundButton}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-2 border-t border-border/60">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetDefaults}
                className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8"
              >
                <RotateCcw className="w-3 h-3" /> Reset Defaults
              </Button>
              <Button
                size="sm"
                onClick={() => { setListeningFor(null); onClose(); }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 h-8"
              >
                Save
              </Button>
            </div>
          </TabsContent>

          {/* Keyboard reference tab */}
          <TabsContent value="keyboard" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Keyboard mappings when playing without a gamepad:
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-blue-950/20 border border-blue-500/40 rounded-lg space-y-1.5">
                <div className="font-display font-bold text-blue-400 text-sm">Player 1 Controls</div>
                <div className="font-mono text-[11px] space-y-1 text-muted-foreground">
                  <div>• D-Pad: <span className="text-foreground font-bold">Arrow Keys</span></div>
                  <div>• A / B / C: <span className="text-foreground font-bold">Z / X / C</span></div>
                  <div>• X / Y / Z: <span className="text-foreground font-bold">A / S / D</span></div>
                  <div>• Start: <span className="text-foreground font-bold">Enter</span></div>
                  <div>• Mode: <span className="text-foreground font-bold">Space</span></div>
                </div>
              </div>

              <div className="p-3 bg-red-950/20 border border-red-500/40 rounded-lg space-y-1.5">
                <div className="font-display font-bold text-red-400 text-sm">Player 2 Controls</div>
                <div className="font-mono text-[11px] space-y-1 text-muted-foreground">
                  <div>• D-Pad: <span className="text-foreground font-bold">I / K / J / L</span></div>
                  <div>• A / B / C: <span className="text-foreground font-bold">U / O / P</span></div>
                  <div>• X / Y / Z: <span className="text-foreground font-bold">7 / 8 / 9</span></div>
                  <div>• Start: <span className="text-foreground font-bold">0 (Zero)</span></div>
                  <div>• Mode: <span className="text-foreground font-bold">- (Minus)</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <Button
                size="sm"
                onClick={onClose}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 h-8"
              >
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

