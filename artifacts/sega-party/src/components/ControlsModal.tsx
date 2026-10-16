import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2, RotateCcw, Circle, Keyboard } from "lucide-react";
import {
  DEFAULT_MAPPING,
  loadMapping,
  saveMapping,
  buttonLabel,
  type GamepadMapping,
  type KeyboardMapping,
  DEFAULT_KEYBOARD_MAPPING,
  WASD_KEYBOARD_MAPPING,
  loadKeyboardMapping,
  saveKeyboardMapping,
  formatKeyLabel,
} from "@/lib/gamepadMapping";
import { getConsoleSystem } from "@/lib/consoles";
import { cn } from "@/lib/utils";

interface ControlsModalProps {
  open: boolean;
  onClose: () => void;
  activeCore?: string;
}

interface ActionInfo {
  id: string;
  label: string;
}

function getConsoleActions(coreId: string): ActionInfo[] {
  const normCore = (coreId || "segaMD").toLowerCase();

  const dpad: ActionInfo[] = [
    { id: "up", label: "D-Pad Up" },
    { id: "down", label: "D-Pad Down" },
    { id: "left", label: "D-Pad Left" },
    { id: "right", label: "D-Pad Right" },
  ];

  if (normCore === "psx") {
    return [
      ...dpad,
      { id: "b", label: "Cross (✕)" },
      { id: "y", label: "Square (□)" },
      { id: "a", label: "Circle (○)" },
      { id: "x", label: "Triangle (△)" },
      { id: "l1", label: "L1 Trigger" },
      { id: "r1", label: "R1 Trigger" },
      { id: "l2", label: "L2 Trigger" },
      { id: "r2", label: "R2 Trigger" },
      { id: "mode", label: "Select" },
      { id: "start", label: "Start" },
    ];
  }

  if (normCore === "snes") {
    return [
      ...dpad,
      { id: "a", label: "A Button" },
      { id: "b", label: "B Button" },
      { id: "x", label: "X Button" },
      { id: "y", label: "Y Button" },
      { id: "l", label: "L Shoulder" },
      { id: "r", label: "R Shoulder" },
      { id: "mode", label: "Select" },
      { id: "start", label: "Start" },
    ];
  }

  if (normCore === "gba" || normCore === "gb" || normCore === "nes") {
    return [
      ...dpad,
      { id: "a", label: "A Button" },
      { id: "b", label: "B Button" },
      { id: "l", label: "L Shoulder" },
      { id: "r", label: "R Shoulder" },
      { id: "mode", label: "Select" },
      { id: "start", label: "Start" },
    ];
  }

  if (normCore === "n64") {
    return [
      ...dpad,
      { id: "a", label: "A Button" },
      { id: "b", label: "B Button" },
      { id: "z", label: "Z Trigger" },
      { id: "l", label: "L Button" },
      { id: "r", label: "R Button" },
      { id: "c-up", label: "C-Up" },
      { id: "c-down", label: "C-Down" },
      { id: "c-left", label: "C-Left" },
      { id: "c-right", label: "C-Right" },
      { id: "start", label: "Start" },
    ];
  }

  // Default: Sega Genesis / Mega Drive (6-button)
  return [
    ...dpad,
    { id: "a", label: "A Button" },
    { id: "b", label: "B Button" },
    { id: "c", label: "C Button" },
    { id: "x", label: "X Button" },
    { id: "y", label: "Y Button" },
    { id: "z", label: "Z Button" },
    { id: "start", label: "Start" },
    { id: "mode", label: "Mode" },
  ];
}

export function ControlsModal({ open, onClose, activeCore = "segaMD" }: ControlsModalProps) {
  const [mapping, setMapping] = useState<GamepadMapping>(() => loadMapping());
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [connectedPad, setConnectedPad] = useState<string | null>(null);
  const [lastPressedButton, setLastPressedButton] = useState<string | null>(null);
  const listenTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);

  // Keyboard rebinding state
  const [kbMapping, setKbMapping] = useState<KeyboardMapping>(() => loadKeyboardMapping());
  const [listeningKeyFor, setListeningKeyFor] = useState<string | null>(null);
  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);

  const consoleSys = getConsoleSystem(activeCore);
  const actions = getConsoleActions(activeCore);

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

  // Keyboard rebinding keydown listener
  useEffect(() => {
    if (!listeningKeyFor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setListeningKeyFor(null);
        return;
      }
      const newKey = e.key;
      setLastPressedKey(formatKeyLabel(newKey));
      const updated = { ...kbMapping, [listeningKeyFor]: newKey };
      setKbMapping(updated);
      saveKeyboardMapping(updated);
      setListeningKeyFor(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [listeningKeyFor, kbMapping]);

  // Passive keyboard tester listener when modal is open
  useEffect(() => {
    if (!open) return;
    const handleKeyTest = (e: KeyboardEvent) => {
      if (listeningKeyFor) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      setLastPressedKey(formatKeyLabel(e.key));
    };
    window.addEventListener("keydown", handleKeyTest);
    return () => window.removeEventListener("keydown", handleKeyTest);
  }, [open, listeningKeyFor]);

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

  const applyKeyboardPreset = (preset: KeyboardMapping) => {
    const updated = { ...preset };
    setKbMapping(updated);
    saveKeyboardMapping(updated);
  };

  const actionToButton = (actionName: string): string => {
    const entry = Object.entries(mapping).find(([k, v]) => v === actionName && !k.startsWith("axis"));
    if (!entry) return "—";
    return buttonLabel(Number(entry[0]));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setListeningFor(null);
          setListeningKeyFor(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl bg-card border-primary/50 font-sans shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="font-display text-primary flex items-center gap-2 text-xl">
              <Gamepad2 className="w-5 h-5 text-accent" /> Controls & Key Settings
            </DialogTitle>
            <Badge
              variant="outline"
              className={cn("text-xs font-bold py-0.5 px-2 uppercase", consoleSys.badgeColor)}
            >
              {consoleSys.name}
            </Badge>
          </div>
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
              Click any button row below and press your physical controller button to rebind for {consoleSys.shortName}.
            </p>

            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {actions.map((act) => {
                const actionName = act.id;
                const isListening = listeningFor === actionName;
                const boundButton = actionToButton(actionName);
                return (
                  <button
                    key={actionName}
                    onClick={() => startListening(actionName)}
                    className={`flex items-center justify-between px-3 py-2 border text-left transition-all rounded-md ${
                      isListening
                        ? "border-accent bg-accent/15 animate-pulse ring-1 ring-accent"
                        : "border-border bg-background/80 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {act.label}
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
                onClick={() => {
                  saveMapping(mapping);
                  window.dispatchEvent(new Event("gamepad-mapping-changed"));
                  setListeningFor(null);
                  onClose();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 h-8"
              >
                Save
              </Button>
            </div>
          </TabsContent>

          {/* Keyboard rebinding tab */}
          <TabsContent value="keyboard" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-muted-foreground text-[11px] font-semibold">Presets:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyKeyboardPreset(DEFAULT_KEYBOARD_MAPPING)}
                  className="h-7 px-2.5 text-[11px] font-medium border-border/80 hover:border-primary/50"
                >
                  Retro Default (Arrows)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyKeyboardPreset(WASD_KEYBOARD_MAPPING)}
                  className="h-7 px-2.5 text-[11px] font-medium border-border/80 hover:border-primary/50"
                >
                  WASD + JKL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyKeyboardPreset(DEFAULT_KEYBOARD_MAPPING)}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Defaults
                </Button>
              </div>
              {lastPressedKey && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Last pressed key: <span className="text-accent font-bold">{lastPressedKey}</span>
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Click any button to rebind for {consoleSys.shortName}. Press Escape to cancel.
            </p>

            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {actions.map((act) => {
                const actionName = act.id;
                const isListening = listeningKeyFor === actionName;
                const boundKey = kbMapping[actionName] || "";
                const keyDisplay = isListening ? "Press any key..." : formatKeyLabel(boundKey);
                return (
                  <button
                    key={actionName}
                    onClick={() => setListeningKeyFor(actionName)}
                    className={`flex items-center justify-between px-3 py-2 border text-left transition-all rounded-md ${
                      isListening
                        ? "border-accent bg-accent/20 animate-pulse ring-1 ring-accent"
                        : "border-border bg-background/80 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {act.label}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        isListening ? "text-accent animate-bounce" : "text-muted-foreground"
                      }`}
                    >
                      {keyDisplay}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-2.5 bg-muted/40 border border-border/50 rounded-md text-[11px] text-muted-foreground">
              Player 2 guest keyboard fallback: <span className="font-mono text-foreground font-semibold">I/K/J/L</span> (D-Pad), <span className="font-mono text-foreground font-semibold">U/O/P</span> (A/B/C), <span className="font-mono text-foreground font-semibold">0</span> (Start)
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyKeyboardPreset(DEFAULT_KEYBOARD_MAPPING)}
                className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8"
              >
                <RotateCcw className="w-3 h-3" /> Reset Defaults
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setListeningKeyFor(null);
                  onClose();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 h-8"
              >
                Done
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
