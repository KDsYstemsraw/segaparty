import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Gamepad2,
  Keyboard,
  RotateCcw,
  Circle,
  Wand2,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
  Radio,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sliders,
  Check,
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
  shortLabel?: string;
}

const NUMPAD_KEYBOARD_MAPPING: KeyboardMapping = {
  up: "8",
  down: "2",
  left: "4",
  right: "6",
  a: "1",
  b: "3",
  c: "5",
  x: "7",
  y: "9",
  z: "+",
  l: "/",
  r: "*",
  l1: "/",
  r1: "*",
  l2: "-",
  r2: "+",
  start: "Enter",
  mode: "0",
  select: "0",
};

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {}
}

function getConsoleActions(coreId: string): ActionInfo[] {
  const normCore = (coreId || "segaMD").toLowerCase();

  const dpad: ActionInfo[] = [
    { id: "up", label: "D-Pad Up", shortLabel: "▲" },
    { id: "down", label: "D-Pad Down", shortLabel: "▼" },
    { id: "left", label: "D-Pad Left", shortLabel: "◀" },
    { id: "right", label: "D-Pad Right", shortLabel: "▶" },
  ];

  if (normCore === "psx") {
    return [
      ...dpad,
      { id: "b", label: "Cross (✕)", shortLabel: "✕" },
      { id: "y", label: "Square (□)", shortLabel: "□" },
      { id: "a", label: "Circle (○)", shortLabel: "○" },
      { id: "x", label: "Triangle (△)", shortLabel: "△" },
      { id: "l1", label: "L1 Trigger", shortLabel: "L1" },
      { id: "r1", label: "R1 Trigger", shortLabel: "R1" },
      { id: "l2", label: "L2 Trigger", shortLabel: "L2" },
      { id: "r2", label: "R2 Trigger", shortLabel: "R2" },
      { id: "mode", label: "Select", shortLabel: "SEL" },
      { id: "start", label: "Start", shortLabel: "STA" },
    ];
  }

  if (normCore === "snes") {
    return [
      ...dpad,
      { id: "b", label: "B Button", shortLabel: "B" },
      { id: "a", label: "A Button", shortLabel: "A" },
      { id: "y", label: "Y Button", shortLabel: "Y" },
      { id: "x", label: "X Button", shortLabel: "X" },
      { id: "l", label: "L Shoulder", shortLabel: "L" },
      { id: "r", label: "R Shoulder", shortLabel: "R" },
      { id: "mode", label: "Select", shortLabel: "SEL" },
      { id: "start", label: "Start", shortLabel: "STA" },
    ];
  }

  if (normCore === "gba" || normCore === "gb" || normCore === "nes") {
    return [
      ...dpad,
      { id: "b", label: "B Button", shortLabel: "B" },
      { id: "a", label: "A Button", shortLabel: "A" },
      { id: "l", label: "L Shoulder", shortLabel: "L" },
      { id: "r", label: "R Shoulder", shortLabel: "R" },
      { id: "mode", label: "Select", shortLabel: "SEL" },
      { id: "start", label: "Start", shortLabel: "STA" },
    ];
  }

  if (normCore === "n64") {
    return [
      ...dpad,
      { id: "a", label: "A Button", shortLabel: "A" },
      { id: "b", label: "B Button", shortLabel: "B" },
      { id: "z", label: "Z Trigger", shortLabel: "Z" },
      { id: "l", label: "L Button", shortLabel: "L" },
      { id: "r", label: "R Button", shortLabel: "R" },
      { id: "c-up", label: "C-Up", shortLabel: "C▲" },
      { id: "c-down", label: "C-Down", shortLabel: "C▼" },
      { id: "c-left", label: "C-Left", shortLabel: "C◀" },
      { id: "c-right", label: "C-Right", shortLabel: "C▶" },
      { id: "start", label: "Start", shortLabel: "STA" },
    ];
  }

  // Default: Sega Genesis / Mega Drive (6-button)
  return [
    ...dpad,
    { id: "a", label: "A Button", shortLabel: "A" },
    { id: "b", label: "B Button", shortLabel: "B" },
    { id: "c", label: "C Button", shortLabel: "C" },
    { id: "x", label: "X Button", shortLabel: "X" },
    { id: "y", label: "Y Button", shortLabel: "Y" },
    { id: "z", label: "Z Button", shortLabel: "Z" },
    { id: "start", label: "Start", shortLabel: "STA" },
    { id: "mode", label: "Mode", shortLabel: "MOD" },
  ];
}

export function ControlsModal({
  open,
  onClose,
  activeCore = "segaMD",
  playerSlot = 1,
  isHost = true,
}: ControlsModalProps) {
  // Selected slot state
  const [selectedSlot, setSelectedSlot] = useState<number>(() =>
    Math.max(1, Math.min(4, playerSlot || 1)),
  );

  // Mappings for the selected slot
  const [mapping, setMapping] = useState<GamepadMapping>(() => loadPlayerGamepadMapping(selectedSlot));
  const [kbMapping, setKbMapping] = useState<KeyboardMapping>(() =>
    loadPlayerKeyboardMapping(selectedSlot),
  );

  // Rebinding state
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [listeningKeyFor, setListeningKeyFor] = useState<string | null>(null);

  // Connected gamepad diagnostic
  const [connectedPad, setConnectedPad] = useState<string | null>(null);
  const [lastLiveInput, setLastLiveInput] = useState<string | null>(null);

  // Sequential Wizard Engine state
  const [isWizardActive, setIsWizardActive] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [wizardDevice, setWizardDevice] = useState<"keyboard" | "gamepad">("keyboard");
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [wizardJustMapped, setWizardJustMapped] = useState<string | null>(null);

  // Toast / feedback message on preset apply
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live test pressed actions tracking
  const [activeTestActions, setActiveTestActions] = useState<Set<string>>(new Set());

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
      setActiveTestActions(new Set());
    }
  }, [selectedSlot, open]);

  // Detect connected gamepad
  useEffect(() => {
    const update = () => {
      const pads = navigator.getGamepads();
      const found = [...pads].find(Boolean);
      setConnectedPad(found ? `${found.id.slice(0, 30)}${found.id.length > 30 ? "…" : ""}` : null);
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
      if (key === "axis-0-neg") return "Stick ◀";
      if (key === "axis-0-pos") return "Stick ▶";
      if (key === "axis-1-neg") return "Stick ▲";
      if (key === "axis-1-pos") return "Stick ▼";
      return key;
    }
    return buttonLabel(Number(key));
  };

  // Keyboard Event Engine: Handles Wizard, Single-key rebinding, and Live Virtual Joypad Glow
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Wizard Keyboard Step Capture
      if (isWizardActive && wizardDevice === "keyboard") {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setIsWizardActive(false);
          return;
        }

        if (e.repeat) return;

        const newKey = e.key;
        playBeep();
        setLastLiveInput(`Key: ${formatKeyLabel(newKey)}`);
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

      // 2. Manual Single-Key Rebinding
      if (listeningKeyFor) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setListeningKeyFor(null);
          return;
        }

        const newKey = e.key;
        playBeep();
        setLastLiveInput(`Key: ${formatKeyLabel(newKey)}`);
        const updated = assignKeyboardBinding(kbMapping, listeningKeyFor, newKey);
        setKbMapping(updated);
        savePlayerKeyboardMapping(selectedSlot, updated);
        setListeningKeyFor(null);
        return;
      }

      // 3. Passive Live Testing: Match key to actions and light up buttons!
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setLastLiveInput(`Key: ${formatKeyLabel(e.key)}`);
        const lowerKey = e.key.toLowerCase();
        const matchedActions: string[] = [];
        for (const [actionId, boundKey] of Object.entries(kbMapping)) {
          if (boundKey && boundKey.toLowerCase() === lowerKey) {
            matchedActions.push(actionId);
          }
        }

        if (matchedActions.length > 0) {
          setActiveTestActions((prev) => {
            const next = new Set(prev);
            matchedActions.forEach((act) => next.add(act));
            return next;
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const lowerKey = e.key.toLowerCase();
      const matchedActions: string[] = [];
      for (const [actionId, boundKey] of Object.entries(kbMapping)) {
        if (boundKey && boundKey.toLowerCase() === lowerKey) {
          matchedActions.push(actionId);
        }
      }

      if (matchedActions.length > 0) {
        setActiveTestActions((prev) => {
          const next = new Set(prev);
          matchedActions.forEach((act) => next.delete(act));
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
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

  // Gamepad Polling Engine: Handles Wizard, Single-button rebinding, and Live Glow
  useEffect(() => {
    if (!open) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const poll = () => {
      const gamepads = navigator.getGamepads();
      const currentDown = new Set<string>();
      const gamepadActionsHeld = new Set<string>();

      for (const gp of gamepads) {
        if (!gp) continue;

        // 1. Scan physical buttons (0 to 16)
        for (let i = 0; i < gp.buttons.length; i++) {
          const isDown = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
          const btnKey = String(i);
          if (isDown) {
            currentDown.add(btnKey);
            const act = mapping[btnKey];
            if (act) gamepadActionsHeld.add(act);
          }

          const justPressed = isDown && !prevDownRef.current.has(btnKey);

          if (justPressed) {
            setLastLiveInput(`Pad: ${buttonLabel(i)}`);

            // Wizard gamepad input handling
            if (isWizardActive && wizardDevice === "gamepad") {
              const now = Date.now();
              if (now - lastActionTimestamp.current > 250) {
                lastActionTimestamp.current = now;
                playBeep();
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
              playBeep();
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

        // 2. Scan analog stick axes
        if (gp.axes && gp.axes.length >= 2) {
          const axisCandidates: [string, boolean][] = [
            ["axis-0-neg", gp.axes[0] < -0.65],
            ["axis-0-pos", gp.axes[0] > 0.65],
            ["axis-1-neg", gp.axes[1] < -0.65],
            ["axis-1-pos", gp.axes[1] > 0.65],
          ];

          for (const [axisKey, isDeflected] of axisCandidates) {
            if (isDeflected) {
              currentDown.add(axisKey);
              const act = mapping[axisKey];
              if (act) gamepadActionsHeld.add(act);
            }
            const axisJustPressed = isDeflected && !prevDownRef.current.has(axisKey);

            if (axisJustPressed) {
              const niceAxisName =
                axisKey === "axis-0-neg"
                  ? "Stick ◀"
                  : axisKey === "axis-0-pos"
                  ? "Stick ▶"
                  : axisKey === "axis-1-neg"
                  ? "Stick ▲"
                  : "Stick ▼";

              setLastLiveInput(`Pad: ${niceAxisName}`);

              if (isWizardActive && wizardDevice === "gamepad") {
                const now = Date.now();
                if (now - lastActionTimestamp.current > 250) {
                  lastActionTimestamp.current = now;
                  playBeep();
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
                playBeep();
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

      // Update live glow for gamepad actions
      if (gamepadActionsHeld.size > 0) {
        setActiveTestActions((prev) => {
          const next = new Set(prev);
          gamepadActionsHeld.forEach((a) => next.add(a));
          return next;
        });
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

  const applyPreset = (preset: KeyboardMapping, label: string) => {
    playBeep();
    setKbMapping({ ...preset });
    savePlayerKeyboardMapping(selectedSlot, preset);
    setToastMessage(`Applied ${label} Preset to Player ${selectedSlot}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const resetAllDefaults = () => {
    playBeep();
    const defaultKb = selectedSlot === 2 ? WASD_KEYBOARD_MAPPING : DEFAULT_KEYBOARD_MAPPING;
    setKbMapping({ ...defaultKb });
    savePlayerKeyboardMapping(selectedSlot, defaultKb);

    setMapping({ ...DEFAULT_MAPPING });
    savePlayerGamepadMapping(selectedSlot, DEFAULT_MAPPING);

    setToastMessage(`Reset Player ${selectedSlot} to factory defaults!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper for virtual gamepad button
  const renderVirtualPadButton = (
    actionId: string,
    label: string,
    className?: string,
  ) => {
    const isLit = activeTestActions.has(actionId);
    const isRebinding = listeningKeyFor === actionId || listeningFor === actionId;
    const assignedKey = kbMapping[actionId] || "";

    return (
      <button
        key={actionId}
        type="button"
        onClick={() => startListeningKey(actionId)}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all duration-150 select-none group border rounded-xl",
          isLit
            ? "bg-emerald-400 text-black border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,1)] scale-110 font-black z-20"
            : isRebinding
            ? "bg-accent text-accent-foreground border-accent shadow-[0_0_20px_rgba(224,0,11,0.8)] animate-pulse ring-2 ring-accent scale-105 z-20"
            : "bg-neutral-800/90 text-neutral-200 border-neutral-700/80 hover:border-primary/60 hover:bg-neutral-700/80 hover:scale-105",
          className,
        )}
        title={`Click to rebind ${label}. Currently bound to [${formatKeyLabel(assignedKey)}]`}
      >
        <span className="text-[11px] font-black uppercase font-display tracking-tight leading-none">
          {label}
        </span>
        <span
          className={cn(
            "text-[9px] font-mono font-bold mt-0.5 px-1 rounded",
            isLit ? "bg-black/40 text-emerald-100" : "bg-black/60 text-muted-foreground",
          )}
        >
          {isRebinding ? "Press..." : formatKeyLabel(assignedKey)}
        </span>
      </button>
    );
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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-primary/50 font-sans shadow-2xl p-0">
        {/* Top Header Cyber Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-cyan-400 to-accent" />

        <div className="p-4 sm:p-6 space-y-4">
          <DialogHeader className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                  <Gamepad2 className="w-5 h-5 text-accent animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="font-display text-primary flex items-center gap-2 text-xl tracking-wide">
                    Controls & Keybind Setup
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    1-click presets, step-by-step wizard, or tap buttons below to test live!
                  </p>
                </div>
              </div>

              {/* Console Badge */}
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-bold py-1 px-3 uppercase tracking-wider self-start sm:self-auto",
                  consoleSys.badgeColor,
                )}
              >
                {consoleSys.name}
              </Badge>
            </div>

            {/* 1. Player Slot Selector Pills (4 slots) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
              <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1 mr-1">
                <Radio className="w-3.5 h-3.5 text-primary" /> Player Deck:
              </span>
              {[1, 2, 3, 4].map((slot) => {
                const isSelected = selectedSlot === slot;
                const isCurrentPlayer = playerSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(0,180,255,0.4)] ring-1 ring-primary scale-[1.02]"
                        : "bg-muted/40 text-muted-foreground border-border/70 hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Player {slot}</span>
                    {slot === 1 ? (
                      <span className="text-[10px] opacity-75 font-mono">(Host)</span>
                    ) : isCurrentPlayer ? (
                      <span className="text-[10px] text-accent font-bold font-mono">(You)</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* 2. 1-Click Instant Presets Bar */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400" /> 1-Click Instant Keyboard Presets:
                </span>
                {toastMessage && (
                  <span className="text-[11px] font-bold text-emerald-400 animate-in fade-in flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {toastMessage}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(DEFAULT_KEYBOARD_MAPPING, "Arrow Keys")}
                  className="h-8 text-xs font-semibold border-border hover:border-primary/60 hover:bg-primary/10 gap-1"
                >
                  <Keyboard className="w-3 h-3 text-cyan-400" />
                  <span>Arrows + Z/X/C</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(WASD_KEYBOARD_MAPPING, "WASD")}
                  className="h-8 text-xs font-semibold border-border hover:border-primary/60 hover:bg-primary/10 gap-1"
                >
                  <Keyboard className="w-3 h-3 text-amber-400" />
                  <span>WASD + J/K/L</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(NUMPAD_KEYBOARD_MAPPING, "Numpad")}
                  className="h-8 text-xs font-semibold border-border hover:border-primary/60 hover:bg-primary/10 gap-1"
                >
                  <Keyboard className="w-3 h-3 text-purple-400" />
                  <span>Numpad 8/4/6/2</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAllDefaults}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* 3. Step-by-Step Keybind Wizard HUD */}
          {isWizardActive ? (
            <div className="p-4 rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/20 via-card to-accent/20 shadow-[0_0_35px_rgba(0,180,255,0.35)] space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/30 border border-primary/50 flex items-center justify-center text-primary">
                    <Wand2 className="w-4 h-4 text-accent animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground font-display uppercase tracking-wider">
                      Setup Wizard · Player {selectedSlot} ({wizardDevice.toUpperCase()})
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Button {wizardStepIndex + 1} of {actions.length}
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
                    Skip
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelWizard}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Cancel (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted/80 h-2 rounded-full overflow-hidden border border-primary/30">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${((wizardStepIndex + 1) / actions.length) * 100}%` }}
                />
              </div>

              {/* Huge Action Prompt */}
              <div className="py-3 px-4 rounded-xl bg-background/90 border border-primary/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center justify-center sm:justify-start gap-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    Press Key or Button For:
                  </span>
                  <p className="text-2xl font-black text-foreground font-display tracking-wide uppercase">
                    {currentWizardAction.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Press any key on keyboard or gamepad button (Escape to cancel)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm font-mono py-1.5 px-3 border-primary/40 bg-card">
                    Current:{" "}
                    <strong className="text-accent ml-1">
                      {wizardDevice === "keyboard"
                        ? formatKeyLabel(kbMapping[currentWizardAction.id] || "")
                        : formatGamepadBinding(currentWizardAction.id)}
                    </strong>
                  </Badge>

                  {wizardJustMapped && (
                    <Badge
                      variant="outline"
                      className="text-xs font-mono py-1.5 px-2.5 border-emerald-500/50 bg-emerald-500/10 text-emerald-400 animate-in fade-in"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Bound: {wizardJustMapped}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Wizard Launch Banner */
            <div className="p-3.5 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-card to-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 font-display">
                  <Wand2 className="w-4 h-4 text-accent animate-pulse" /> 1-Click Step-by-Step Setup Wizard
                </h4>
                <p className="text-xs text-muted-foreground">
                  Walks you through each button one-by-one in 10 seconds with audio feedback.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => startWizard("keyboard")}
                  className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm shadow-primary/30"
                >
                  <Keyboard className="w-3.5 h-3.5" /> Wizard (Keyboard)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startWizard("gamepad")}
                  className="h-8 px-3 text-xs font-bold border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground gap-1.5"
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-accent" /> Wizard (Gamepad)
                </Button>
              </div>
            </div>
          )}

          {wizardCompleted && (
            <div className="p-3 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Setup Complete!</strong> All controls mapped and tested for Player {selectedSlot}.
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWizardCompleted(false)}
                className="h-6 text-xs text-emerald-400 hover:bg-emerald-500/20"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* 4. Interactive Visual Live Test Gamepad */}
          <div className="p-4 rounded-2xl border-2 border-border/80 bg-neutral-950/80 shadow-inner relative overflow-hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-accent" /> Live Input Tester Gamepad
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                {lastLiveInput ? (
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[10px] py-0.5">
                    Detected: {lastLiveInput}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground/80">Press any key/button to test</span>
                )}
                {connectedPad && (
                  <Badge variant="outline" className="border-border text-muted-foreground text-[10px] py-0.5 hidden sm:inline-flex">
                    <Circle className="w-1.5 h-1.5 fill-emerald-400 mr-1" /> {connectedPad}
                  </Badge>
                )}
              </div>
            </div>

            {/* Graphical Gamepad Chassis */}
            <div className="w-full max-w-lg mx-auto p-4 rounded-3xl bg-neutral-900/90 border border-neutral-700/80 shadow-2xl relative select-none">
              {/* Top Shoulder Triggers */}
              <div className="flex justify-between px-6 mb-3">
                {actions.some((a) => a.id === "l" || a.id === "l1") ? (
                  renderVirtualPadButton(
                    actions.find((a) => a.id === "l" || a.id === "l1")!.id,
                    "L1 / L",
                    "w-20 h-7 rounded-lg",
                  )
                ) : (
                  <div className="w-20" />
                )}

                {actions.some((a) => a.id === "r" || a.id === "r1") ? (
                  renderVirtualPadButton(
                    actions.find((a) => a.id === "r" || a.id === "r1")!.id,
                    "R1 / R",
                    "w-20 h-7 rounded-lg",
                  )
                ) : (
                  <div className="w-20" />
                )}
              </div>

              {/* Main Controller Face: D-Pad, Center Buttons, Action Buttons */}
              <div className="grid grid-cols-12 gap-2 items-center">
                {/* Left: D-Pad Cross (4 cols) */}
                <div className="col-span-4 flex flex-col items-center justify-center">
                  {renderVirtualPadButton("up", "▲", "w-11 h-10 mb-1")}
                  <div className="flex items-center gap-1">
                    {renderVirtualPadButton("left", "◀", "w-11 h-10")}
                    <div className="w-6 h-6 rounded-full bg-neutral-950 border border-neutral-800" />
                    {renderVirtualPadButton("right", "▶", "w-11 h-10")}
                  </div>
                  {renderVirtualPadButton("down", "▼", "w-11 h-10 mt-1")}
                </div>

                {/* Center: System Logo & Start/Select Buttons (4 cols) */}
                <div className="col-span-4 flex flex-col items-center justify-center space-y-3">
                  <div className="text-center">
                    <span className="font-display font-black tracking-widest text-xs uppercase text-primary/80">
                      {consoleSys.shortName}
                    </span>
                    <div className="text-[9px] font-mono text-muted-foreground/60">PLAYER {selectedSlot}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {actions.some((a) => a.id === "mode") &&
                      renderVirtualPadButton("mode", "SEL", "w-11 h-7 rounded-full text-[9px]")}
                    {actions.some((a) => a.id === "start") &&
                      renderVirtualPadButton("start", "START", "w-12 h-7 rounded-full text-[9px]")}
                  </div>
                </div>

                {/* Right: Face Action Buttons (4 cols) */}
                <div className="col-span-4 flex items-center justify-center">
                  {/* If Sega Genesis (6-button: X/Y/Z top, A/B/C bottom) */}
                  {actions.some((a) => a.id === "c") && actions.some((a) => a.id === "z") ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 justify-center">
                        {renderVirtualPadButton("x", "X", "w-9 h-9 rounded-full")}
                        {renderVirtualPadButton("y", "Y", "w-9 h-9 rounded-full")}
                        {renderVirtualPadButton("z", "Z", "w-9 h-9 rounded-full")}
                      </div>
                      <div className="flex items-center gap-1 justify-center">
                        {renderVirtualPadButton("a", "A", "w-10 h-10 rounded-full")}
                        {renderVirtualPadButton("b", "B", "w-10 h-10 rounded-full")}
                        {renderVirtualPadButton("c", "C", "w-10 h-10 rounded-full")}
                      </div>
                    </div>
                  ) : actions.some((a) => a.id === "x") && actions.some((a) => a.id === "y") ? (
                    /* 4-button Diamond (SNES / PSX) */
                    <div className="flex flex-col items-center">
                      {actions.some((a) => a.id === "x") &&
                        renderVirtualPadButton("x", actions.find((a) => a.id === "x")!.shortLabel || "X", "w-10 h-10 rounded-full mb-1")}
                      <div className="flex items-center gap-2">
                        {actions.some((a) => a.id === "y") &&
                          renderVirtualPadButton("y", actions.find((a) => a.id === "y")!.shortLabel || "Y", "w-10 h-10 rounded-full")}
                        {actions.some((a) => a.id === "a") &&
                          renderVirtualPadButton("a", actions.find((a) => a.id === "a")!.shortLabel || "A", "w-10 h-10 rounded-full")}
                      </div>
                      {actions.some((a) => a.id === "b") &&
                        renderVirtualPadButton("b", actions.find((a) => a.id === "b")!.shortLabel || "B", "w-10 h-10 rounded-full mt-1")}
                    </div>
                  ) : (
                    /* 2-button (NES / GBA) */
                    <div className="flex items-center gap-2 transform -rotate-12">
                      {actions.some((a) => a.id === "b") &&
                        renderVirtualPadButton("b", "B", "w-11 h-11 rounded-full")}
                      {actions.some((a) => a.id === "a") &&
                        renderVirtualPadButton("a", "A", "w-11 h-11 rounded-full")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-center text-muted-foreground/80 font-sans">
              Click any button above to rebind it immediately, or use keys on keyboard to watch them light up!
            </p>
          </div>

          {/* 5. Direct Button Rebinding List */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-primary" /> All Actions & Key Bindings:
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Player {selectedSlot} configuration
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {actions.map((act) => {
                const actionName = act.id;
                const isListeningKey = listeningKeyFor === actionName;
                const isListeningPad = listeningFor === actionName;
                const boundKey = kbMapping[actionName] || "";
                const boundGamepad = formatGamepadBinding(actionName);
                const isLit = activeTestActions.has(actionName);

                return (
                  <div
                    key={actionName}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl border transition-all",
                      isLit
                        ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        : "border-border/70 bg-card/60 hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isLit ? "bg-emerald-400 animate-ping" : "bg-muted-foreground/40",
                        )}
                      />
                      <span className="text-xs font-bold text-foreground truncate uppercase font-display">
                        {act.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Keyboard Button */}
                      <button
                        type="button"
                        onClick={() => startListeningKey(actionName)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-all",
                          isListeningKey
                            ? "bg-accent text-accent-foreground border-accent animate-pulse ring-2 ring-accent"
                            : "bg-background border-border hover:border-primary text-foreground hover:bg-primary/10",
                        )}
                        title="Click to rebind keyboard key"
                      >
                        {isListeningKey ? "Press key…" : formatKeyLabel(boundKey)}
                      </button>

                      {/* Gamepad Button */}
                      <button
                        type="button"
                        onClick={() => startListening(actionName)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-all",
                          isListeningPad
                            ? "bg-accent text-accent-foreground border-accent animate-pulse ring-2 ring-accent"
                            : "bg-muted/40 border-border/80 text-muted-foreground hover:border-primary hover:text-foreground",
                        )}
                        title="Click to rebind gamepad button"
                      >
                        {isListeningPad ? "Press pad…" : boundGamepad}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllDefaults}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults (P{selectedSlot})
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setListeningKeyFor(null);
                setListeningFor(null);
                setIsWizardActive(false);
                onClose();
              }}
              className="h-8 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/30"
            >
              Done / Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
