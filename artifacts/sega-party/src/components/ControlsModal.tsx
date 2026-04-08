import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, RotateCcw, Circle } from "lucide-react";
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
  const listenTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);

  // Detect connected gamepad
  useEffect(() => {
    const update = () => {
      const pads = navigator.getGamepads();
      const found = [...pads].find(Boolean);
      setConnectedPad(found ? `${found.id.slice(0, 40)}${found.id.length > 40 ? "…" : ""}` : null);
    };
    update();
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);

  // Poll for button press when listening
  useEffect(() => {
    if (!listeningFor) { cancelAnimationFrame(rafRef.current); return; }

    const pressed = new Set<number>();

    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;
        for (let i = 0; i < gp.buttons.length; i++) {
          const isDown = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
          if (isDown && !pressed.has(i)) {
            // Button first pressed — assign it
            const newMapping = { ...mapping, [String(i)]: listeningFor };
            setMapping(newMapping);
            saveMapping(newMapping);
            window.dispatchEvent(new Event("gamepad-mapping-changed"));
            setListeningFor(null);
            if (listenTimeout.current) clearTimeout(listenTimeout.current);
            return;
          }
          if (!isDown) pressed.delete(i);
          if (isDown) pressed.add(i);
        }
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [listeningFor, mapping]);

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

  // Which button index maps to each action
  const actionToButton = (actionName: string): string => {
    const entry = Object.entries(mapping).find(([k, v]) => v === actionName && !k.startsWith("axis"));
    if (!entry) return "—";
    return buttonLabel(Number(entry[0]));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setListeningFor(null); onClose(); } }}>
      <DialogContent className="max-w-lg bg-card border-primary/50 font-sans">
        <DialogHeader>
          <DialogTitle className="font-display text-primary flex items-center gap-2 text-xl">
            <Gamepad2 className="w-5 h-5" /> Controller Setup
          </DialogTitle>
        </DialogHeader>

        {/* Gamepad status */}
        <div className="flex items-center gap-2 text-sm mb-2">
          {connectedPad ? (
            <Badge variant="outline" className="border-green-500 text-green-400 text-xs py-0.5">
              <Circle className="w-2 h-2 fill-green-400 mr-1" /> {connectedPad}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-muted text-muted-foreground text-xs py-0.5">
              No controller detected — plug in and press a button
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Click a row, then press the button you want to assign. Left stick is automatically mapped to the D-Pad.
        </p>

        {/* Mapping table */}
        <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto pr-1">
          {ACTION_ORDER.map((actionName) => {
            const action = GAME_ACTIONS[actionName];
            const isListening = listeningFor === actionName;
            const boundButton = actionToButton(actionName);
            return (
              <button
                key={actionName}
                onClick={() => startListening(actionName)}
                data-testid={`remap-${actionName}`}
                className={`flex items-center justify-between px-3 py-2 border text-left transition-all rounded-sm ${
                  isListening
                    ? "border-accent bg-accent/10 animate-pulse"
                    : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <span className="text-sm font-bold text-foreground uppercase tracking-wide">
                  {action.label}
                </span>
                <span className={`text-xs font-mono ${isListening ? "text-accent" : "text-muted-foreground"}`}>
                  {isListening ? "Press now…" : boundButton}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between mt-4 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={resetDefaults} className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
            <RotateCcw className="w-3 h-3" /> Reset to defaults
          </Button>
          <Button size="sm" onClick={() => { setListeningFor(null); onClose(); }} className="bg-primary text-primary-foreground font-bold text-xs px-4">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
