import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gamepad2,
  RotateCcw,
  Circle,
  Keyboard,
  Wand2,
  CheckCircle2,
  ArrowRight,
  X,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import {
  DEFAULT_MAPPING,
  loadPlayerGamepadMapping,
  savePlayerGamepadMapping,
  loadPlayerKeyboardMapping,
  savePlayerKeyboardMapping,
  assignGamepadBinding,
  assignKeyboardBinding,
  buttonLabel,
  formatKeyLabel,
  DEFAULT_KEYBOARD_MAPPING,
  WASD_KEYBOARD_MAPPING,
  type GamepadMapping,
  type KeyboardMapping,
} from "@/lib/gamepadMapping";
import { getConsoleSystem } from "@/lib/consoles";
import { cn } from "@/lib/utils";

export interface ControlsModalProps {
  open: boolean;
  onClose: () => void;
  activeCore?: string;
  playerSlot?: number;
  isHost?: boolean;
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

export function ControlsModal({
  open,
  onClose,
  activeCore = "segaMD",
  playerSlot = 1,
  isHost = true,
}: ControlsModalProps) {
  // Player slot selection state
  const [selectedSlot, setSelectedSlot] = useState<number>(() => Math.max(1, Math.min(4, playerSlot || 1)));

  // Mappings per selected slot
  const [mapping, setMapping] = useState<GamepadMapping>(() => loadPlayerGamepadMapping(selectedSlot));
  const [kbMapping, setKbMapping] = useState<KeyboardMapping>(() => loadPlayerKeyboardMapping(selectedSlot));

  // Single-button manual rebinding state
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [listeningKeyFor, setListeningKeyFor] = useState<string | null>(null);

  // Diagnostic live pressed display
  const [connectedPad, setConnectedPad] = useState<string | null>(null);
  const [lastPressedButton, setLastPressedButton] = useState<string | null>(null);
  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);

  // Sequential Wizard Engine state
  const [isWizardActive, setIsWizardActive] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [wizardDevice, setWizardDevice] = useState<"keyboard" | "gamepad">("gamepad");
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [wizardJustMapped, setWizardJustMapped] = useState<string | null>(null);

  const listenTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const prevDownRef = useRef<Set<string>>(new Set());
  const lastActionTimestamp = useRef<number>(0);

  const consoleSys = getConsoleSystem(activeCore);
  const actions = getConsoleActions(activeCore);
  const currentWizardAction = actions[wizardStepIndex] || actions[0];

  // Sync selectedSlot when playerSlot prop changes
  useEffect(() => {
    if (playerSlot) {
      setSelectedSlot(Math.max(1, Math.min(4, playerSlot)));
    }
  }, [playerSlot]);

  // Reload mappings whenever selectedSlot changes or modal opens
  useEffect(() => {
    if (open) {
      setMapping(loadPlayerGamepadMapping(selectedSlot));
      setKbMapping(loadPlayerKeyboardMapping(selectedSlot));
      setIsWizardActive(false);
      setWizardCompleted(false);
      setListeningFor(null);
      setListeningKeyFor(null);
    }
  }, [selectedSlot, open]);

  // Detect connected gamepad
  useEffect(() => {
    const update = () => {
      const pads = navigator.getGamepads();
      const found = [...pads].find(Boolean);
      setConnectedPad(found ? `${found.id.slice(0, 32)}${found.id.length > 32 ? "…" : ""}` : null);
    };
    update();
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);

  // Format gamepad button or axis display
  const formatGamepadBinding = (actionName: string): string => {
    const entries = Object.entries(mapping).filter(([, v]) => v === actionName);
    if (!entries.length) return "—";
    const primary = entries.find(([k]) => !k.startsWith("axis")) || entries[0];
    const key = primary[0];
    if (key.startsWith("axis")) {
      if (key === "axis-0-neg") return "Stick Left";
      if (key === "axis-0-pos") return "Stick Right";
      if (key === "axis-1-neg") return "Stick Up";
      if (key === "axis-1-pos") return "Stick Down";
      return key;
    }
    return buttonLabel(Number(key));
  };

  // Gamepad Polling Engine: Supports both manual single-button rebinding and Sequential Wizard
  useEffect(() => {
    if (!open) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const poll = () => {
      const gamepads = navigator.getGamepads();
      const currentDown = new Set<string>();

      for (const gp of gamepads) {
        if (!gp) continue;

        // 1. Scan physical buttons (0 to 16)
        for (let i = 0; i < gp.buttons.length; i++) {
          const isDown = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
          const btnKey = String(i);
          if (isDown) currentDown.add(btnKey);

          const justPressed = isDown && !prevDownRef.current.has(btnKey);

          if (justPressed) {
            setLastPressedButton(buttonLabel(i));

            // Wizard gamepad input handling
            if (isWizardActive && wizardDevice === "gamepad") {
              const now = Date.now();
              if (now - lastActionTimestamp.current > 250) {
                lastActionTimestamp.current = now;
                const updated = assignGamepadBinding(mapping, currentWizardAction.id, btnKey);
                setMapping(updated);
                savePlayerGamepadMapping(selectedSlot, updated);
                setWizardJustMapped(buttonLabel(i));

                if (wizardStepIndex + 1 < actions.length) {
                  setWizardStepIndex((prev) => prev + 1);
                } else {
                  setIsWizardActive(false);
                  setWizardCompleted(true);
                }
                prevDownRef.current = currentDown;
                return;
              }
            }

            // Single manual button rebinding
            if (listeningFor) {
              const updated = assignGamepadBinding(mapping, listeningFor, btnKey);
              setMapping(updated);
              savePlayerGamepadMapping(selectedSlot, updated);
              setListeningFor(null);
              if (listenTimeout.current) clearTimeout(listenTimeout.current);
              prevDownRef.current = currentDown;
              return;
            }
          }
        }

        // 2. Scan analog stick axes (for directionals)
        if (gp.axes && gp.axes.length >= 2) {
          const axisCandidates: [string, boolean][] = [
            ["axis-0-neg", gp.axes[0] < -0.65],
            ["axis-0-pos", gp.axes[0] > 0.65],
            ["axis-1-neg", gp.axes[1] < -0.65],
            ["axis-1-pos", gp.axes[1] > 0.65],
          ];

          for (const [axisKey, isDeflected] of axisCandidates) {
            if (isDeflected) currentDown.add(axisKey);
            const axisJustPressed = isDeflected && !prevDownRef.current.has(axisKey);

            if (axisJustPressed) {
              const niceAxisName =
                axisKey === "axis-0-neg"
                  ? "Stick Left"
                  : axisKey === "axis-0-pos"
                  ? "Stick Right"
                  : axisKey === "axis-1-neg"
                  ? "Stick Up"
                  : "Stick Down";

              setLastPressedButton(niceAxisName);

              if (isWizardActive && wizardDevice === "gamepad") {
                const now = Date.now();
                if (now - lastActionTimestamp.current > 250) {
                  lastActionTimestamp.current = now;
                  const updated = assignGamepadBinding(mapping, currentWizardAction.id, axisKey);
                  setMapping(updated);
                  savePlayerGamepadMapping(selectedSlot, updated);
                  setWizardJustMapped(niceAxisName);

                  if (wizardStepIndex + 1 < actions.length) {
                    setWizardStepIndex((prev) => prev + 1);
                  } else {
                    setIsWizardActive(false);
                    setWizardCompleted(true);
                  }
                  prevDownRef.current = currentDown;
                  return;
                }
              }

              if (listeningFor) {
                const updated = assignGamepadBinding(mapping, listeningFor, axisKey);
                setMapping(updated);
                savePlayerGamepadMapping(selectedSlot, updated);
                setListeningFor(null);
                if (listenTimeout.current) clearTimeout(listenTimeout.current);
                prevDownRef.current = currentDown;
                return;
              }
            }
          }
        }
      }

      prevDownRef.current = currentDown;
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    open,
    listeningFor,
    isWizardActive,
    wizardDevice,
    wizardStepIndex,
    actions,
    currentWizardAction,
    mapping,
    selectedSlot,
  ]);

  // Keyboard Event Engine: Handles both Wizard and Single-key rebinding
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Passive key indicator when not rebinding
      if (!listeningKeyFor && (!isWizardActive || wizardDevice !== "keyboard")) {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          setLastPressedKey(formatKeyLabel(e.key));
        }
        return;
      }

      // Ignore auto-repeat when user holds down a key
      if (e.repeat) return;

      // Wizard Keyboard Step Capture
      if (isWizardActive && wizardDevice === "keyboard") {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setIsWizardActive(false);
          return;
        }

        const newKey = e.key;
        setLastPressedKey(formatKeyLabel(newKey));
        setWizardJustMapped(formatKeyLabel(newKey));

        const updated = assignKeyboardBinding(kbMapping, currentWizardAction.id, newKey);
        setKbMapping(updated);
        savePlayerKeyboardMapping(selectedSlot, updated);

        if (wizardStepIndex + 1 < actions.length) {
          setWizardStepIndex((prev) => prev + 1);
        } else {
          setIsWizardActive(false);
          setWizardCompleted(true);
        }
        return;
      }

      // Manual Single-Key Rebinding
      if (listeningKeyFor) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setListeningKeyFor(null);
          return;
        }

        const newKey = e.key;
        setLastPressedKey(formatKeyLabel(newKey));
        const updated = assignKeyboardBinding(kbMapping, listeningKeyFor, newKey);
        setKbMapping(updated);
        savePlayerKeyboardMapping(selectedSlot, updated);
        setListeningKeyFor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    open,
    listeningKeyFor,
    isWizardActive,
    wizardDevice,
    wizardStepIndex,
    actions,
    currentWizardAction,
    kbMapping,
    selectedSlot,
  ]);

  const startListening = (actionName: string) => {
    setIsWizardActive(false);
    setListeningFor(actionName);
    if (listenTimeout.current) clearTimeout(listenTimeout.current);
    listenTimeout.current = setTimeout(() => setListeningFor(null), 6000);
  };

  const startListeningKey = (actionName: string) => {
    setIsWizardActive(false);
    setListeningKeyFor(actionName);
  };

  // Launch Sequential Keybind Wizard
  const startWizard = (device: "keyboard" | "gamepad") => {
    setListeningFor(null);
    setListeningKeyFor(null);
    setWizardDevice(device);
    setWizardStepIndex(0);
    setWizardCompleted(false);
    setWizardJustMapped(null);
    setIsWizardActive(true);
  };

  const skipWizardStep = () => {
    if (wizardStepIndex + 1 < actions.length) {
      setWizardStepIndex((prev) => prev + 1);
    } else {
      setIsWizardActive(false);
      setWizardCompleted(true);
    }
  };

  const cancelWizard = () => {
    setIsWizardActive(false);
  };

  const resetDefaultsGamepad = () => {
    savePlayerGamepadMapping(selectedSlot, DEFAULT_MAPPING);
    setMapping({ ...DEFAULT_MAPPING });
  };

  const applyKeyboardPreset = (preset: KeyboardMapping) => {
    const updated = { ...preset };
    setKbMapping(updated);
    savePlayerKeyboardMapping(selectedSlot, updated);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setIsWizardActive(false);
          setListeningFor(null);
          setListeningKeyFor(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-primary/50 font-sans shadow-2xl overflow-hidden p-0">
        {/* Top Header Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-cyan-400 to-accent" />

        <div className="p-5 sm:p-6 space-y-4">
          <DialogHeader className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <DialogTitle className="font-display text-primary flex items-center gap-2 text-xl tracking-wide">
                <Gamepad2 className="w-5 h-5 text-accent" /> Controller & Input Studio
              </DialogTitle>

              {/* Console Badge */}
              <Badge
                variant="outline"
                className={cn("text-xs font-bold py-0.5 px-2.5 uppercase tracking-wider self-start sm:self-auto", consoleSys.badgeColor)}
              >
                {consoleSys.name}
              </Badge>
            </div>

            {/* Per-Player Slot Selector Bar */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
              {isHost ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" /> Target Player Slot:
                  </span>
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
                    {[1, 2, 3, 4].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-bold font-mono transition-all",
                          selectedSlot === slot
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/40 ring-1 ring-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                        )}
                      >
                        P{slot}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Badge
                  variant="outline"
                  className="border-primary/50 bg-primary/10 text-primary text-xs font-bold py-1 px-3 flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" /> Configuring Player {selectedSlot} (Your Slot)
                </Badge>
              )}

              {/* Connected Pad Status Pill */}
              <div className="hidden sm:flex items-center gap-2 text-xs">
                {connectedPad ? (
                  <Badge variant="outline" className="border-emerald-500/60 text-emerald-400 bg-emerald-500/10 text-[11px] py-0.5">
                    <Circle className="w-2 h-2 fill-emerald-400 mr-1 animate-pulse" /> {connectedPad}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-border/80 text-muted-foreground text-[11px] py-0.5">
                    No Gamepad Detected
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* ============================================================= */}
          {/* SEQUENTIAL WIZARD HUD BANNER                                  */}
          {/* ============================================================= */}
          {isWizardActive ? (
            <div className="p-4 rounded-xl border-2 border-primary/70 bg-gradient-to-br from-primary/15 via-card/90 to-accent/15 shadow-[0_0_30px_rgba(0,71,187,0.3)] space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                    <Wand2 className="w-4 h-4 text-accent animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground font-display uppercase tracking-wider">
                      Keybind Wizard · Player {selectedSlot} ({wizardDevice.toUpperCase()})
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Step {wizardStepIndex + 1} of {actions.length}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={skipWizardStep}
                    className="h-7 px-2.5 text-xs font-semibold border-border hover:border-primary/50"
                  >
                    Skip (Keep)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelWizard}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Cancel Wizard (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full bg-muted/80 h-2 rounded-full overflow-hidden border border-primary/30">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${((wizardStepIndex + 1) / actions.length) * 100}%` }}
                />
              </div>

              {/* Big Action Prompt Banner */}
              <div className="py-2.5 px-4 rounded-lg bg-background/80 border border-primary/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center justify-center sm:justify-start gap-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    Press {wizardDevice === "keyboard" ? "Any Key" : "Gamepad Button"} For:
                  </span>
                  <p className="text-lg sm:text-xl font-black text-foreground font-display tracking-wide uppercase">
                    {currentWizardAction.label}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono py-1 px-3 border-primary/40 bg-card">
                    Current:{" "}
                    <strong className="text-accent ml-1">
                      {wizardDevice === "keyboard"
                        ? formatKeyLabel(kbMapping[currentWizardAction.id] || "")
                        : formatGamepadBinding(currentWizardAction.id)}
                    </strong>
                  </Badge>

                  {wizardJustMapped && (
                    <Badge variant="outline" className="text-xs font-mono py-1 px-2.5 border-emerald-500/50 bg-emerald-500/10 text-emerald-400 animate-in fade-in duration-150">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Bound!
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : wizardCompleted ? (
            /* Wizard Completion Alert */
            <div className="p-3.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <strong className="text-foreground">Wizard Complete!</strong> All controls successfully mapped and saved for Player {selectedSlot}.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWizardCompleted(false)}
                className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          {/* ============================================================= */}
          {/* TABS: GAMEPAD vs KEYBOARD                                     */}
          {/* ============================================================= */}
          <Tabs defaultValue="gamepad" className="w-full">
            <TabsList className="grid grid-cols-2 mb-3 bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="gamepad" className="text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Gamepad2 className="w-3.5 h-3.5" /> Gamepad (P{selectedSlot})
              </TabsTrigger>
              <TabsTrigger value="keyboard" className="text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Keyboard className="w-3.5 h-3.5" /> Keyboard (P{selectedSlot})
              </TabsTrigger>
            </TabsList>

            {/* ----------------------------------------------------------- */}
            {/* GAMEPAD TAB                                                 */}
            {/* ----------------------------------------------------------- */}
            <TabsContent value="gamepad" className="space-y-3 m-0 focus-visible:outline-none">
              {/* Wizard Launch Banner */}
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-accent" /> Gamepad Quick-Bind Wizard
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Sequentially map all {consoleSys.shortName} buttons by pressing each controller button in order.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => startWizard("gamepad")}
                  className="h-8 px-3.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/30 gap-1.5 shrink-0"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Run Wizard
                </Button>
              </div>

              {/* Status & Diagnostic Pill */}
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="text-[11px] text-muted-foreground">
                  Or click any individual button row below to rebind manually:
                </span>
                {lastPressedButton && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Last Pressed: <span className="text-accent font-bold">{lastPressedButton}</span>
                  </span>
                )}
              </div>

              {/* Action Button Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {actions.map((act) => {
                  const actionName = act.id;
                  const isListening = listeningFor === actionName;
                  const boundButton = formatGamepadBinding(actionName);
                  return (
                    <button
                      key={actionName}
                      type="button"
                      onClick={() => startListening(actionName)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 border text-left transition-all rounded-lg",
                        isListening
                          ? "border-accent bg-accent/20 animate-pulse ring-2 ring-accent"
                          : "border-border/80 bg-background/80 hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.01]",
                      )}
                    >
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        {act.label}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-mono font-bold py-0.5 px-2",
                          isListening
                            ? "border-accent bg-accent text-accent-foreground animate-bounce"
                            : "border-border/60 text-muted-foreground",
                        )}
                      >
                        {isListening ? "Press button…" : boundButton}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Footer Controls */}
              <div className="flex justify-between items-center pt-3 border-t border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetDefaultsGamepad}
                  className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset P{selectedSlot} Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setListeningFor(null);
                    setIsWizardActive(false);
                    onClose();
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 h-8"
                >
                  Done
                </Button>
              </div>
            </TabsContent>

            {/* ----------------------------------------------------------- */}
            {/* KEYBOARD TAB                                                */}
            {/* ----------------------------------------------------------- */}
            <TabsContent value="keyboard" className="space-y-3 m-0 focus-visible:outline-none">
              {/* Wizard Launch Banner */}
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-accent" /> Keyboard Quick-Bind Wizard
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Sequentially map all {consoleSys.shortName} keys by pressing each physical key in order.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => startWizard("keyboard")}
                  className="h-8 px-3.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/30 gap-1.5 shrink-0"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Run Wizard
                </Button>
              </div>

              {/* Presets Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-[11px] font-semibold">Presets:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyKeyboardPreset(DEFAULT_KEYBOARD_MAPPING)}
                    className="h-7 px-2.5 text-[11px] font-medium border-border/80 hover:border-primary/50"
                  >
                    Retro Arrows
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyKeyboardPreset(WASD_KEYBOARD_MAPPING)}
                    className="h-7 px-2.5 text-[11px] font-medium border-border/80 hover:border-primary/50"
                  >
                    WASD + JKL
                  </Button>
                </div>

                {lastPressedKey && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Last Pressed Key: <span className="text-accent font-bold">{lastPressedKey}</span>
                  </span>
                )}
              </div>

              {/* Action Button Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {actions.map((act) => {
                  const actionName = act.id;
                  const isListening = listeningKeyFor === actionName;
                  const boundKey = kbMapping[actionName] || "";
                  const keyDisplay = isListening ? "Press any key…" : formatKeyLabel(boundKey);
                  return (
                    <button
                      key={actionName}
                      type="button"
                      onClick={() => startListeningKey(actionName)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 border text-left transition-all rounded-lg",
                        isListening
                          ? "border-accent bg-accent/20 animate-pulse ring-2 ring-accent"
                          : "border-border/80 bg-background/80 hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.01]",
                      )}
                    >
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        {act.label}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-mono font-bold py-0.5 px-2",
                          isListening
                            ? "border-accent bg-accent text-accent-foreground animate-bounce"
                            : "border-border/60 text-muted-foreground",
                        )}
                      >
                        {keyDisplay}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Guest Fallback Info Box */}
              <div className="p-2.5 bg-muted/40 border border-border/50 rounded-lg text-[11px] text-muted-foreground flex items-center justify-between">
                <span>
                  Default P2 Fallback: <span className="font-mono text-foreground font-semibold">I/K/J/L</span> (D-Pad), <span className="font-mono text-foreground font-semibold">U/O/P</span> (A/B/C)
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">Press Esc to cancel rebind</span>
              </div>

              {/* Footer Controls */}
              <div className="flex justify-between items-center pt-3 border-t border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    applyKeyboardPreset(selectedSlot === 2 ? WASD_KEYBOARD_MAPPING : DEFAULT_KEYBOARD_MAPPING)
                  }
                  className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset P{selectedSlot} Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setListeningKeyFor(null);
                    setIsWizardActive(false);
                    onClose();
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 h-8"
                >
                  Done
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
