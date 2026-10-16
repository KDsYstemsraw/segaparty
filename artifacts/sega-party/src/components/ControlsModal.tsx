import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Gamepad2,
  Keyboard,
  Mouse,
  MessageSquare,
  RotateCcw,
  Circle,
  Wand2,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
  Radio,
  Sliders,
  ChevronLeft,
  ChevronRight,
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
  onTestInput?: (action: string, isDown: boolean) => void;
}

export interface ConsoleActionInfo {
  id: string;
  label: string;
  shortLabel?: string;
}

export function mouseButtonToToken(button: number): string {
  return `Mouse${button}`;
}

export function isMouseBinding(key?: string): boolean {
  return Boolean(key && key.startsWith("Mouse"));
}

export function formatBindingLabel(key?: string): string {
  if (!key) return "—";
  if (key === "Mouse0") return "🖱️ Left Click";
  if (key === "Mouse1") return "🖱️ Middle Click";
  if (key === "Mouse2") return "🖱️ Right Click";
  if (key === "Mouse3") return "🖱️ Mouse Back (M4)";
  if (key === "Mouse4") return "🖱️ Mouse Fwd (M5)";
  if (key.startsWith("Mouse")) return `🖱️ ${key}`;
  return formatKeyLabel(key);
}

export function getConsoleControllerTitle(coreId?: string): string {
  const norm = (coreId || "segaMD").toLowerCase();
  if (norm === "n64") return "Nintendo 64 Trident Controller (Analog + C-Buttons)";
  if (norm === "psx") return "PlayStation DualShock / Classic Controller (△ □ ○ ✕)";
  if (norm === "snes") return "Super Nintendo 4-Button Diamond Controller (A B X Y)";
  if (norm === "gba") return "Game Boy Advance Handheld (D-Pad, A, B, L, R)";
  if (norm === "gb" || norm === "gbc") return "Game Boy Handheld (D-Pad, A, B, Start, Select)";
  if (norm === "nes") return "NES 2-Button Rectangular Controller (A, B)";
  if (norm === "segaMS") return "Sega Master System Control Pad (1 & 2 Buttons)";
  if (norm === "segaGG") return "Sega Game Gear Handheld (1 & 2 Buttons)";
  if (norm === "atari2600") return "Atari 2600 Joystick (1 Fire Button + Stick)";
  return "Sega Genesis 6-Button Arcade Pad (A/B/C + X/Y/Z)";
}

export function getConsoleActions(coreId?: string): ConsoleActionInfo[] {
  const normCore = (coreId || "segaMD").toLowerCase();

  const dpad: ConsoleActionInfo[] = [
    { id: "up", label: "D-Pad Up", shortLabel: "▲" },
    { id: "down", label: "D-Pad Down", shortLabel: "▼" },
    { id: "left", label: "D-Pad Left", shortLabel: "◀" },
    { id: "right", label: "D-Pad Right", shortLabel: "▶" },
  ];

  if (normCore === "n64") {
    return [
      ...dpad,
      { id: "a", label: "A Button", shortLabel: "A" },
      { id: "b", label: "B Button", shortLabel: "B" },
      { id: "z", label: "Z Trigger", shortLabel: "Z" },
      { id: "l", label: "L Shoulder", shortLabel: "L" },
      { id: "r", label: "R Shoulder", shortLabel: "R" },
      { id: "c-up", label: "C-Up", shortLabel: "C▲" },
      { id: "c-down", label: "C-Down", shortLabel: "C▼" },
      { id: "c-left", label: "C-Left", shortLabel: "C◀" },
      { id: "c-right", label: "C-Right", shortLabel: "C▶" },
      { id: "start", label: "Start", shortLabel: "STA" },
    ];
  }

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

  if (normCore === "gba") {
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

  if (normCore === "gb" || normCore === "gbc" || normCore === "nes") {
    return [
      ...dpad,
      { id: "b", label: "B Button", shortLabel: "B" },
      { id: "a", label: "A Button", shortLabel: "A" },
      { id: "mode", label: "Select", shortLabel: "SEL" },
      { id: "start", label: "Start", shortLabel: "STA" },
    ];
  }

  if (normCore === "segaMS" || normCore === "segaGG") {
    return [
      ...dpad,
      { id: "1", label: "1 Button (Start)", shortLabel: "1" },
      { id: "2", label: "2 Button", shortLabel: "2" },
      { id: "start", label: "Start", shortLabel: "STA" },
    ];
  }

  if (normCore === "atari2600") {
    return [
      ...dpad,
      { id: "a", label: "Fire Button", shortLabel: "FIRE" },
      { id: "start", label: "Reset / Start", shortLabel: "STA" },
      { id: "mode", label: "Select", shortLabel: "SEL" },
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

export function loadChatHotkey(playerSlot?: number): string {
  try {
    const key = `retroparty-chat-hotkey-p${playerSlot || 1}`;
    const stored = localStorage.getItem(key) || localStorage.getItem("retroparty-chat-hotkey");
    if (stored) return stored;
  } catch {}
  return "Enter";
}

export function saveChatHotkey(hotkey: string, playerSlot?: number): void {
  try {
    const key = `retroparty-chat-hotkey-p${playerSlot || 1}`;
    localStorage.setItem(key, hotkey);
    localStorage.setItem("retroparty-chat-hotkey", hotkey);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chat-hotkey-changed", { detail: { hotkey, playerSlot } })
      );
    }
  } catch {}
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
  start: " ",
  mode: "0",
  select: "0",
};

const DEFAULT_PRESET: KeyboardMapping = {
  ...DEFAULT_KEYBOARD_MAPPING,
  start: " ",
  mode: "Shift",
  select: "Shift",
};

const WASD_PRESET: KeyboardMapping = {
  ...WASD_KEYBOARD_MAPPING,
  start: " ",
  mode: "Shift",
  select: "Shift",
};

const NUMPAD_PRESET: KeyboardMapping = {
  ...NUMPAD_KEYBOARD_MAPPING,
  start: " ",
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

export function ControlsModal({
  open,
  onClose,
  activeCore = "segaMD",
  playerSlot = 1,
  isHost = true,
  onTestInput,
}: ControlsModalProps) {
  // Selected slot state (1 to 4)
  const [selectedSlot, setSelectedSlot] = useState<number>(() =>
    Math.max(1, Math.min(4, playerSlot || 1)),
  );

  // Mappings for the selected slot
  const [mapping, setMapping] = useState<GamepadMapping>(() => loadPlayerGamepadMapping(selectedSlot));
  const [kbMapping, setKbMapping] = useState<KeyboardMapping>(() =>
    loadPlayerKeyboardMapping(selectedSlot),
  );

  // Unified single-button rebinding action ID
  const [listeningActionId, setListeningActionId] = useState<string | null>(null);

  // In-Game Chat Overlay Hotkey state
  const [chatHotkey, setChatHotkey] = useState<string>(() => loadChatHotkey(selectedSlot));
  const [listeningChatHotkey, setListeningChatHotkey] = useState(false);

  // Connected gamepad diagnostic
  const [connectedPad, setConnectedPad] = useState<string | null>(null);
  const [lastLiveInput, setLastLiveInput] = useState<string | null>(null);

  // Sequential Wizard Engine state
  const [isWizardActive, setIsWizardActive] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [wizardJustMapped, setWizardJustMapped] = useState<string | null>(null);

  // Toast / feedback message on preset apply
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live test pressed actions tracking (state for UI re-renders)
  const [activeTestActions, setActiveTestActions] = useState<Set<string>>(new Set());

  // Input tracking refs for bug-free light up and in-game forwarding
  const kbMouseHeldRef = useRef<Set<string>>(new Set());
  const padHeldRef = useRef<Set<string>>(new Set());
  const activeTestActionsRef = useRef<Set<string>>(new Set());

  const listenTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const prevDownRef = useRef<Set<string>>(new Set());
  const lastActionTimestamp = useRef<number>(0);

  const consoleSys = getConsoleSystem(activeCore);
  const actions = getConsoleActions(activeCore);
  const currentWizardAction = actions[wizardStepIndex] || actions[0];

  // Helper to sync union of keyboard, mouse, and gamepad held actions, updating state and forwarding in-game
  const syncActiveTestActions = useCallback(() => {
    const union = new Set<string>();
    for (const a of kbMouseHeldRef.current) union.add(a);
    for (const a of padHeldRef.current) union.add(a);

    const prev = activeTestActionsRef.current;

    // Newly pressed actions
    for (const a of union) {
      if (!prev.has(a)) {
        onTestInput?.(a, true);
      }
    }

    // Released actions
    for (const a of prev) {
      if (!union.has(a)) {
        onTestInput?.(a, false);
      }
    }

    activeTestActionsRef.current = union;
    setActiveTestActions(new Set(union));
  }, [onTestInput]);

  // Clean release of all inputs
  const releaseAllInputs = useCallback(() => {
    for (const a of activeTestActionsRef.current) {
      onTestInput?.(a, false);
    }
    kbMouseHeldRef.current.clear();
    padHeldRef.current.clear();
    activeTestActionsRef.current.clear();
    setActiveTestActions(new Set());
  }, [onTestInput]);

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
      setChatHotkey(loadChatHotkey(selectedSlot));
      setIsWizardActive(false);
      setWizardCompleted(false);
      setListeningActionId(null);
      setListeningChatHotkey(false);
      releaseAllInputs();
    } else {
      releaseAllInputs();
      setListeningChatHotkey(false);
    }
  }, [selectedSlot, open, releaseAllInputs]);

  // Release all inputs on window blur
  useEffect(() => {
    if (!open) return;
    const handleBlur = () => {
      releaseAllInputs();
    };
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, [open, releaseAllInputs]);

  // Global mouseup listener to release held mouse test actions
  useEffect(() => {
    if (!open) return;
    const handleGlobalMouseUp = (e: MouseEvent) => {
      const token = mouseButtonToToken(e.button);
      let changed = false;
      for (const [actionId, boundKey] of Object.entries(kbMapping)) {
        if (boundKey === token && kbMouseHeldRef.current.has(actionId)) {
          kbMouseHeldRef.current.delete(actionId);
          changed = true;
        }
      }
      if (changed) {
        syncActiveTestActions();
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [open, kbMapping, syncActiveTestActions]);

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

  // Mouse binding handler: works for both the active Wizard and single-button rebinding
  const handleMouseBinding = (buttonIndex: number, targetActionId?: string) => {
    const actionToBind = targetActionId || (isWizardActive ? currentWizardAction?.id : null);
    if (!actionToBind) return;

    const token = mouseButtonToToken(buttonIndex);
    playBeep();
    setLastLiveInput(`Mouse: ${formatBindingLabel(token)}`);

    const updated = assignKeyboardBinding(kbMapping, actionToBind, token);
    setKbMapping(updated);
    savePlayerKeyboardMapping(selectedSlot, updated);

    if (isWizardActive) {
      setWizardJustMapped(formatBindingLabel(token));
      if (wizardStepIndex + 1 < actions.length) {
        setWizardStepIndex((prev) => prev + 1);
      } else {
        setIsWizardActive(false);
        setWizardCompleted(true);
      }
    }

    if (listeningActionId) {
      setListeningActionId(null);
      if (listenTimeout.current) clearTimeout(listenTimeout.current);
    }
  };

  // Mouse live testing handlers
  const handleMouseTestDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = mouseButtonToToken(e.button);
    setLastLiveInput(`Mouse: ${formatBindingLabel(token)}`);
    let changed = false;

    for (const [actionId, boundKey] of Object.entries(kbMapping)) {
      if (boundKey === token) {
        if (!kbMouseHeldRef.current.has(actionId)) {
          kbMouseHeldRef.current.add(actionId);
          changed = true;
        }
      }
    }

    if (changed) {
      syncActiveTestActions();
    }
  };

  const handleMouseTestUp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = mouseButtonToToken(e.button);
    let changed = false;

    for (const [actionId, boundKey] of Object.entries(kbMapping)) {
      if (boundKey === token) {
        if (kbMouseHeldRef.current.has(actionId)) {
          kbMouseHeldRef.current.delete(actionId);
          changed = true;
        }
      }
    }

    if (changed) {
      syncActiveTestActions();
    }
  };

  // Keyboard Event Engine: Handles Wizard, Single-button rebinding, and Live Virtual Joypad Glow
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 0. Chat Hotkey Rebinding
      if (listeningChatHotkey) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setListeningChatHotkey(false);
          return;
        }

        const newKey = e.key;
        playBeep();
        setChatHotkey(newKey);
        saveChatHotkey(newKey, selectedSlot);
        setListeningChatHotkey(false);
        setToastMessage(`Chat Overlay key set to [${formatBindingLabel(newKey)}]!`);
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      // 1. Wizard Key Capture
      if (isWizardActive) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setIsWizardActive(false);
          return;
        }

        if (e.repeat) return;

        const newKey = e.key;
        playBeep();
        setLastLiveInput(`Key: ${formatBindingLabel(newKey)}`);
        setWizardJustMapped(formatBindingLabel(newKey));

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

      // 2. Manual Single-Action Rebinding
      if (listeningActionId) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setListeningActionId(null);
          return;
        }

        const newKey = e.key;
        playBeep();
        setLastLiveInput(`Key: ${formatBindingLabel(newKey)}`);
        const updated = assignKeyboardBinding(kbMapping, listeningActionId, newKey);
        setKbMapping(updated);
        savePlayerKeyboardMapping(selectedSlot, updated);
        setListeningActionId(null);
        if (listenTimeout.current) clearTimeout(listenTimeout.current);
        return;
      }

      // Close modal on Escape when not in rebinding/wizard mode
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        releaseAllInputs();
        setIsWizardActive(false);
        setListeningActionId(null);
        setListeningChatHotkey(false);
        onClose();
        return;
      }

      // 3. Passive Live Testing
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setLastLiveInput(`Key: ${formatBindingLabel(e.key)}`);
        const lowerKey = e.key.toLowerCase();
        let changed = false;

        for (const [actionId, boundKey] of Object.entries(kbMapping)) {
          if (boundKey && boundKey.toLowerCase() === lowerKey) {
            if (!kbMouseHeldRef.current.has(actionId)) {
              kbMouseHeldRef.current.add(actionId);
              changed = true;
            }
          }
        }

        if (changed) {
          syncActiveTestActions();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const lowerKey = e.key.toLowerCase();
      let changed = false;

      for (const [actionId, boundKey] of Object.entries(kbMapping)) {
        if (boundKey && boundKey.toLowerCase() === lowerKey) {
          if (kbMouseHeldRef.current.has(actionId)) {
            kbMouseHeldRef.current.delete(actionId);
            changed = true;
          }
        }
      }

      if (changed) {
        syncActiveTestActions();
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
    listeningActionId,
    listeningChatHotkey,
    isWizardActive,
    wizardStepIndex,
    actions,
    currentWizardAction,
    kbMapping,
    selectedSlot,
    syncActiveTestActions,
  ]);

  // Gamepad Polling Engine: Handles Wizard, Single-button rebinding, and Live Glow + Release
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
            if (isWizardActive) {
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
            if (listeningActionId) {
              playBeep();
              const updated = assignGamepadBinding(mapping, listeningActionId, btnKey);
              setMapping(updated);
              savePlayerGamepadMapping(selectedSlot, updated);
              setListeningActionId(null);
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

              if (isWizardActive) {
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

              if (listeningActionId) {
                playBeep();
                const updated = assignGamepadBinding(mapping, listeningActionId, axisKey);
                setMapping(updated);
                savePlayerGamepadMapping(selectedSlot, updated);
                setListeningActionId(null);
                if (listenTimeout.current) clearTimeout(listenTimeout.current);
                prevDownRef.current = currentDown;
                return;
              }
            }
          }
        }
      }

      // Live glow & in-game trigger synchronization: fires on both press AND release!
      let padChanged = false;
      if (gamepadActionsHeld.size !== padHeldRef.current.size) {
        padChanged = true;
      } else {
        for (const act of gamepadActionsHeld) {
          if (!padHeldRef.current.has(act)) {
            padChanged = true;
            break;
          }
        }
      }

      if (padChanged) {
        padHeldRef.current = gamepadActionsHeld;
        syncActiveTestActions();
      }

      prevDownRef.current = currentDown;
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    open,
    listeningActionId,
    isWizardActive,
    wizardStepIndex,
    actions,
    currentWizardAction,
    mapping,
    selectedSlot,
    syncActiveTestActions,
  ]);

  const startSingleRebind = (actionId: string) => {
    setIsWizardActive(false);
    setListeningActionId(actionId);
    if (listenTimeout.current) clearTimeout(listenTimeout.current);
    listenTimeout.current = setTimeout(() => setListeningActionId(null), 8000);
  };

  const startWizard = () => {
    setListeningActionId(null);
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

  const prevWizardStep = () => {
    if (wizardStepIndex > 0) {
      setWizardStepIndex((prev) => prev - 1);
    }
  };

  const cancelWizard = () => {
    setIsWizardActive(false);
    setWizardJustMapped(null);
  };

  // 1-Click Preset appliers
  const applyPreset = (preset: KeyboardMapping, label: string) => {
    playBeep();
    setKbMapping(preset);
    savePlayerKeyboardMapping(selectedSlot, preset);
    setToastMessage(`Applied ${label} preset to Player ${selectedSlot}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const resetAllDefaults = () => {
    playBeep();
    const defaultKb = selectedSlot === 2 ? WASD_PRESET : DEFAULT_PRESET;
    setKbMapping(defaultKb);
    savePlayerKeyboardMapping(selectedSlot, defaultKb);

    setMapping(DEFAULT_MAPPING);
    savePlayerGamepadMapping(selectedSlot, DEFAULT_MAPPING);

    saveChatHotkey("Enter", selectedSlot);
    setChatHotkey("Enter");

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
    const isRebinding = listeningActionId === actionId;
    const isWizardTarget = isWizardActive && currentWizardAction?.id === actionId;
    const assignedKey = kbMapping[actionId] || "";
    const assignedPad = formatGamepadBinding(actionId);

    return (
      <button
        key={actionId}
        type="button"
        onClick={() => startSingleRebind(actionId)}
        onContextMenu={(e) => {
          // If in rebinding mode, right-click binds Mouse2
          if (listeningActionId === actionId) {
            e.preventDefault();
            e.stopPropagation();
            handleMouseBinding(e.button, actionId);
          }
        }}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all duration-150 select-none group border rounded-xl p-1 text-center",
          isLit
            ? "bg-emerald-400 text-black border-emerald-300 shadow-[0_0_22px_rgba(52,211,153,1)] scale-110 font-black z-30"
            : isWizardTarget
            ? "ring-4 ring-amber-400 bg-amber-500/30 text-amber-200 border-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.9)] animate-pulse scale-110 z-30"
            : isRebinding
            ? "bg-accent text-accent-foreground border-accent shadow-[0_0_20px_rgba(224,0,11,0.8)] animate-pulse ring-2 ring-accent scale-105 z-20"
            : "bg-neutral-800/90 text-neutral-200 border-neutral-700/80 hover:border-primary/60 hover:bg-neutral-700/80 hover:scale-105",
          className,
        )}
        title={`Click to rebind ${label}. Currently bound to [${formatBindingLabel(assignedKey)}] / [${assignedPad}]`}
      >
        <span className="text-[11px] font-black uppercase font-display tracking-tight leading-none">
          {label}
        </span>
        <span
          className={cn(
            "text-[8px] font-mono font-bold mt-0.5 px-1 rounded truncate max-w-full",
            isLit
              ? "bg-black/50 text-emerald-200"
              : isWizardTarget
              ? "bg-amber-950/80 text-amber-200"
              : "bg-black/60 text-muted-foreground",
          )}
        >
          {isRebinding ? "Press..." : formatBindingLabel(assignedKey)}
        </span>
        {connectedPad && assignedPad !== "—" && (
          <span className="text-[7px] font-mono text-muted-foreground/80 truncate max-w-full hidden sm:block">
            {assignedPad}
          </span>
        )}
      </button>
    );
  };

  const normCore = (activeCore || "segaMD").toLowerCase();

  const portalTarget =
    (typeof document !== "undefined" && (document.fullscreenElement as HTMLElement)) ||
    (typeof document !== "undefined" ? document.body : null);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          releaseAllInputs();
          setIsWizardActive(false);
          setListeningActionId(null);
          onClose();
        }
      }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/20 bg-[#0d111d] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] p-0 my-auto"
      >
        {/* Top Header Cyber Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-cyan-400 to-accent sticky top-0 z-30" />

        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-3">
            {/* 1. Auto-Detected Console & Controller High-Contrast Banner */}
            <div className="p-4 rounded-2xl bg-neutral-900/95 border border-white/15 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3.5 relative">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 shadow-[0_0_20px_rgba(0,180,255,0.25)]">
                  <Gamepad2 className="w-6 h-6 text-accent animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-bold py-0.5 px-2.5 uppercase tracking-wider font-mono rounded-full",
                        consoleSys.badgeColor,
                      )}
                    >
                      {consoleSys.name}
                    </Badge>
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Detected Console & Controller
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold text-foreground font-sans flex items-center gap-2">
                    {getConsoleControllerTitle(activeCore)}
                  </h2>
                  <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                    <span className="text-primary font-semibold">{actions.length} Controller Buttons Mapped</span>
                    <span>•</span>
                    <span>System Core: <code className="text-accent">{activeCore || "segaMD"}</code></span>
                  </p>
                </div>
              </div>

              {/* Player Slot Selector Pills & Close Button */}
              <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
                <div className="flex items-center gap-1.5 flex-wrap">
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
                            : "bg-white/[0.04] text-muted-foreground border-white/10 hover:border-white/20 hover:text-foreground hover:bg-white/[0.08]",
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

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    releaseAllInputs();
                    setIsWizardActive(false);
                    setListeningActionId(null);
                    onClose();
                  }}
                  className="h-8 px-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/15 border border-white/15 gap-1 shrink-0 ml-auto"
                  title="Close Controls (Esc)"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Close</span>
                </Button>
              </div>
            </div>

            {/* 2. 1-Click Instant Presets Bar */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" /> 1-Click Instant Keyboard Presets:
                </span>
                {toastMessage && (
                  <span className="text-[11px] font-bold text-emerald-400 animate-in fade-in flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {toastMessage}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(DEFAULT_PRESET, "Arrow Keys")}
                  className="h-8 text-xs font-semibold rounded-xl border-white/10 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.08] gap-1.5"
                >
                  <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Arrows + Z/X/C (Space = Start)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(WASD_PRESET, "WASD")}
                  className="h-8 text-xs font-semibold rounded-xl border-white/10 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.08] gap-1.5"
                >
                  <Keyboard className="w-3.5 h-3.5 text-amber-400" />
                  <span>WASD + J/K/L (Space = Start)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(NUMPAD_PRESET, "Numpad")}
                  className="h-8 text-xs font-semibold rounded-xl border-white/10 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.08] gap-1.5"
                >
                  <Keyboard className="w-3.5 h-3.5 text-purple-400" />
                  <span>Numpad 8/4/6/2</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAllDefaults}
                  className="h-8 text-xs rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </Button>
              </div>
            </div>

            {/* 3. In-Game Chat Overlay Hotkey & Isolated Controls Bar */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
                  <MessageSquare className="w-4 h-4 text-accent" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground font-sans flex items-center gap-1.5">
                      🔒 Isolated Virtual Controls
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-2 rounded-full border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold">
                      Zero Key Conflicts
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    All players can use the exact same hotkeys (like WASD or Arrows) without interfering with other players.
                  </p>
                  <p className="text-[11px] text-accent/90 font-sans font-medium">
                    Start is mapped to [Space] and Select/Mode to [Shift] so [Enter] is always free for In-Game Chat!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <span className="text-xs font-bold text-muted-foreground font-sans">
                  💬 Chat Overlay Key:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setListeningChatHotkey(true)}
                  className={cn(
                    "h-8 px-3 rounded-xl text-xs font-bold transition-all border",
                    listeningChatHotkey
                      ? "bg-accent text-accent-foreground border-accent shadow-[0_0_15px_rgba(224,0,11,0.6)] animate-pulse ring-2 ring-accent"
                      : "bg-white/[0.04] hover:bg-white/[0.08] text-foreground border-white/15"
                  )}
                  title="Click to change Chat Overlay Hotkey"
                >
                  <Keyboard className="w-3.5 h-3.5 text-accent" />
                  <span>{listeningChatHotkey ? "Press any key..." : formatBindingLabel(chatHotkey)}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 3. Single Unified Step-by-Step Setup Wizard (Keyboard + Mouse + Gamepad) */}
          {isWizardActive ? (
            <div className="p-4 sm:p-5 rounded-2xl border border-primary/50 bg-gradient-to-br from-primary/15 via-card to-accent/15 shadow-[0_0_35px_rgba(0,180,255,0.25)] space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                    <Wand2 className="w-4 h-4 text-accent animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground font-sans uppercase tracking-wider">
                      Unified Setup Wizard · Player {selectedSlot}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Step {wizardStepIndex + 1} of {actions.length} · {actions[wizardStepIndex]?.label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={prevWizardStep}
                    disabled={wizardStepIndex === 0}
                    className="h-7 px-2.5 rounded-xl text-xs font-semibold border-white/15 hover:border-primary/50 gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={skipWizardStep}
                    className="h-7 px-2.5 rounded-xl text-xs font-semibold border-white/15 hover:border-primary/50 gap-1"
                  >
                    Skip <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelWizard}
                    className="h-7 px-2 text-xs rounded-xl text-muted-foreground hover:text-destructive gap-1"
                    title="Stop Wizard (Esc)"
                  >
                    <X className="w-3.5 h-3.5" /> Stop (Esc)
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-primary via-cyan-400 to-accent transition-all duration-300"
                  style={{ width: `${((wizardStepIndex + 1) / actions.length) * 100}%` }}
                />
              </div>

              {/* Huge Action Prompt Card */}
              <div className="py-3.5 px-4 rounded-xl bg-background/95 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1 text-center md:text-left">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center justify-center md:justify-start gap-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    Press Desired Input for:
                  </span>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-foreground font-sans tracking-tight uppercase">
                      {currentWizardAction.label}
                    </span>
                    {currentWizardAction.shortLabel && (
                      <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-base px-2 py-0.5 rounded-lg">
                        {currentWizardAction.shortLabel}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Press any <strong>Keyboard Key</strong>, move/press <strong>Gamepad Button/Stick</strong>, or click the box below for <strong>Mouse</strong>!
                  </p>
                </div>

                <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono py-1 px-2.5 rounded-xl border-white/15 bg-white/[0.04]">
                      Keyboard/Mouse:{" "}
                      <strong className="text-cyan-400 ml-1">
                        {formatBindingLabel(kbMapping[currentWizardAction.id])}
                      </strong>
                    </Badge>
                    <Badge variant="outline" className="text-xs font-mono py-1 px-2.5 rounded-xl border-white/15 bg-white/[0.04]">
                      Gamepad:{" "}
                      <strong className="text-amber-400 ml-1">
                        {formatGamepadBinding(currentWizardAction.id)}
                      </strong>
                    </Badge>
                  </div>

                  {wizardJustMapped && (
                    <Badge
                      variant="outline"
                      className="text-xs font-mono py-1 px-2.5 rounded-xl border-emerald-500/40 bg-emerald-500/10 text-emerald-400 animate-in fade-in"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mapped: {wizardJustMapped}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Mouse Capture Target Pad inside Wizard */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMouseBinding(e.button);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="w-full p-3 rounded-xl border-2 border-dashed border-accent/60 bg-accent/10 hover:bg-accent/20 cursor-pointer flex items-center justify-center gap-2 text-accent font-bold text-xs transition-all hover:scale-[1.01] select-none shadow-sm"
                title="Click with ANY mouse button (Left, Right, Middle, Back, Forward) to bind"
              >
                <Mouse className="w-4 h-4 text-accent animate-bounce" />
                <span>🖱️ Click Here with Any Mouse Button (Left, Right, Middle, Side) to Bind Mouse</span>
              </div>
            </div>
          ) : (
            /* Unified Wizard Launch Banner */
            <div className="p-4 rounded-2xl border border-white/15 bg-gradient-to-r from-primary/10 via-card to-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-lg">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 font-sans">
                  <Wand2 className="w-4 h-4 text-accent animate-pulse" /> Unified Setup Wizard
                </h4>
                <p className="text-xs text-muted-foreground">
                  Walks through each controller button in sequence — works seamlessly with Keyboard, Mouse, or Controller!
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={startWizard}
                className="h-9 px-4 text-xs font-extrabold rounded-xl bg-gradient-to-r from-primary via-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground gap-2 shadow-[0_0_20px_rgba(0,180,255,0.4)] animate-pulse hover:animate-none hover:scale-105 transition-all"
              >
                <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span>Start Interactive Keybind Wizard (Keyboard, Mouse, or Controller)</span>
              </Button>
            </div>
          )}

          {wizardCompleted && (
            <div className="p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
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
                className="h-6 text-xs rounded-lg text-emerald-400 hover:bg-emerald-500/20"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Active Single-Button Rebinding Helper Card */}
          {listeningActionId && (
            <div className="p-3.5 rounded-2xl border border-accent/60 bg-accent/10 text-accent-foreground flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_20px_rgba(224,0,11,0.25)] animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center font-bold text-accent">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div>
                  <p className="text-xs font-bold font-sans uppercase tracking-wider">
                    Rebinding: {actions.find((a) => a.id === listeningActionId)?.label || listeningActionId}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Press any <strong>Keyboard Key</strong>, move/press <strong>Gamepad</strong>, or click the button below to bind <strong>Mouse</strong> (Escape to cancel).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMouseBinding(e.button, listeningActionId);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="px-3 py-1.5 rounded-xl border-2 border-dashed border-accent bg-background/80 hover:bg-accent/20 cursor-pointer text-xs font-bold text-accent flex items-center gap-1.5 shadow-sm"
                >
                  <Mouse className="w-3.5 h-3.5" />
                  <span>Click to Bind Mouse</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setListeningActionId(null)}
                  className="h-8 px-2 text-xs rounded-xl text-muted-foreground hover:text-foreground"
                >
                  Cancel (Esc)
                </Button>
              </div>
            </div>
          )}

          {/* 4. Interactive Visual Live Test Gamepad */}
          <div className="p-4 sm:p-5 rounded-2xl border border-white/15 bg-neutral-950/90 shadow-inner relative overflow-hidden space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-accent" /> Live Input Tester Gamepad
                </span>
              </div>

              {/* Live Test Pad & Detected Badges */}
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
                {/* Mouse Test Pad Button */}
                <div
                  onMouseDown={handleMouseTestDown}
                  onMouseUp={handleMouseTestUp}
                  onContextMenu={(e) => e.preventDefault()}
                  className="px-2.5 py-1 rounded-lg border border-dashed border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold cursor-pointer select-none flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Click with Left, Right, Middle, or Side buttons to test mouse controls live"
                >
                  <Mouse className="w-3.5 h-3.5 text-emerald-400" />
                  <span>🖱️ Click Here to Test Mouse Buttons</span>
                </div>

                {lastLiveInput ? (
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[10px] py-0.5">
                    Detected: {lastLiveInput}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground/80">Press key/pad to test</span>
                )}
                {connectedPad && (
                  <Badge variant="outline" className="border-border text-muted-foreground text-[10px] py-0.5 hidden sm:inline-flex">
                    <Circle className="w-1.5 h-1.5 fill-emerald-400 mr-1" /> {connectedPad}
                  </Badge>
                )}
              </div>
            </div>

            {/* Graphical Gamepad Chassis: Dynamically Adapts to Console */}
            <div className="w-full max-w-xl mx-auto p-4 sm:p-5 rounded-3xl bg-neutral-900/90 border border-white/10 shadow-2xl relative select-none">
              {/* Top Shoulder Triggers */}
              <div className="flex justify-between items-center px-4 mb-3 gap-2">
                {normCore === "n64" ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      {renderVirtualPadButton("l", "L Bumper", "w-16 h-7 rounded-lg text-[10px]")}
                      {renderVirtualPadButton("z", "Z Trigger", "w-16 h-7 rounded-lg text-[10px] bg-red-950/60 border-red-500/50 text-red-200")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {renderVirtualPadButton("r", "R Bumper", "w-16 h-7 rounded-lg text-[10px]")}
                    </div>
                  </>
                ) : normCore === "psx" ? (
                  <>
                    <div className="flex items-center gap-1">
                      {renderVirtualPadButton("l2", "L2", "w-12 h-6 rounded-lg text-[9px]")}
                      {renderVirtualPadButton("l1", "L1", "w-12 h-6 rounded-lg text-[9px]")}
                    </div>
                    <div className="flex items-center gap-1">
                      {renderVirtualPadButton("r1", "R1", "w-12 h-6 rounded-lg text-[9px]")}
                      {renderVirtualPadButton("r2", "R2", "w-12 h-6 rounded-lg text-[9px]")}
                    </div>
                  </>
                ) : actions.some((a) => a.id === "l" || a.id === "l1") || actions.some((a) => a.id === "r" || a.id === "r1") ? (
                  <>
                    <div>
                      {actions.some((a) => a.id === "l" || a.id === "l1") ? (
                        renderVirtualPadButton(
                          actions.find((a) => a.id === "l" || a.id === "l1")!.id,
                          "L Shoulder",
                          "w-20 h-7 rounded-lg text-[10px]",
                        )
                      ) : (
                        <div className="w-20" />
                      )}
                    </div>
                    <div>
                      {actions.some((a) => a.id === "r" || a.id === "r1") ? (
                        renderVirtualPadButton(
                          actions.find((a) => a.id === "r" || a.id === "r1")!.id,
                          "R Shoulder",
                          "w-20 h-7 rounded-lg text-[10px]",
                        )
                      ) : (
                        <div className="w-20" />
                      )}
                    </div>
                  </>
                ) : null}
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

                {/* Center: System Logo & Start/Select Buttons (3 cols) */}
                <div className="col-span-3 flex flex-col items-center justify-center space-y-3">
                  <div className="text-center">
                    <span className="font-display font-black tracking-widest text-xs uppercase text-primary/80">
                      {consoleSys.shortName}
                    </span>
                    <div className="text-[9px] font-mono text-muted-foreground/60">PLAYER {selectedSlot}</div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {actions.some((a) => a.id === "mode" || a.id === "select") &&
                      renderVirtualPadButton(
                        actions.find((a) => a.id === "mode" || a.id === "select")!.id,
                        actions.find((a) => a.id === "mode" || a.id === "select")!.shortLabel || "SEL",
                        "w-11 h-7 rounded-full text-[9px]",
                      )}
                    {actions.some((a) => a.id === "start") &&
                      renderVirtualPadButton("start", "START", "w-12 h-7 rounded-full text-[9px]")}
                  </div>
                </div>

                {/* Right: Face Action Buttons (5 cols) */}
                <div className="col-span-5 flex items-center justify-center">
                  {normCore === "n64" ? (
                    /* N64 Action Buttons + 4 Yellow C-Buttons Diamond */
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex flex-col items-center gap-2 transform -rotate-12">
                        {renderVirtualPadButton("b", "B", "w-9 h-9 rounded-full bg-blue-950 border-blue-500/50 text-blue-200")}
                        {renderVirtualPadButton("a", "A", "w-10 h-10 rounded-full bg-emerald-950 border-emerald-500/50 text-emerald-200")}
                      </div>
                      <div className="flex flex-col items-center p-1 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                        {renderVirtualPadButton("c-up", "C▲", "w-8 h-8 rounded-full bg-amber-900/50 border-amber-500/60 text-amber-300 text-[10px] mb-0.5")}
                        <div className="flex items-center gap-0.5">
                          {renderVirtualPadButton("c-left", "C◀", "w-8 h-8 rounded-full bg-amber-900/50 border-amber-500/60 text-amber-300 text-[10px]")}
                          <div className="w-3.5 h-3.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                          {renderVirtualPadButton("c-right", "C▶", "w-8 h-8 rounded-full bg-amber-900/50 border-amber-500/60 text-amber-300 text-[10px]")}
                        </div>
                        {renderVirtualPadButton("c-down", "C▼", "w-8 h-8 rounded-full bg-amber-900/50 border-amber-500/60 text-amber-300 text-[10px] mt-0.5")}
                      </div>
                    </div>
                  ) : actions.some((a) => a.id === "c") && actions.some((a) => a.id === "z") ? (
                    /* Sega Genesis / Mega Drive (6-Button: X/Y/Z top, A/B/C bottom) */
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
                    /* 2-Button / 1-Button (NES / GBA / GB / Sega Master System / Atari) */
                    <div className="flex items-center gap-2 transform -rotate-12">
                      {actions.some((a) => a.id === "b" || a.id === "1") &&
                        renderVirtualPadButton(
                          actions.find((a) => a.id === "b" || a.id === "1")!.id,
                          actions.find((a) => a.id === "b" || a.id === "1")!.shortLabel || "B",
                          "w-11 h-11 rounded-full",
                        )}
                      {actions.some((a) => a.id === "a" || a.id === "2") &&
                        renderVirtualPadButton(
                          actions.find((a) => a.id === "a" || a.id === "2")!.id,
                          actions.find((a) => a.id === "a" || a.id === "2")!.shortLabel || "A",
                          "w-11 h-11 rounded-full",
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-center text-muted-foreground/80 font-sans">
              Click any button above to rebind, or test on your Keyboard, Mouse, or Controller to watch them glow green and move in-game!
            </p>
          </div>

          {/* 5. Direct Button Rebinding List */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" /> All Actions & Key Bindings:
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Player {selectedSlot} configuration · {actions.length} Total
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {actions.map((act) => {
                const actionName = act.id;
                const isListening = listeningActionId === actionName;
                const isWizardTarget = isWizardActive && currentWizardAction?.id === actionName;
                const boundKey = kbMapping[actionName] || "";
                const boundGamepad = formatGamepadBinding(actionName);
                const isLit = activeTestActions.has(actionName);

                return (
                  <div
                    key={actionName}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                      isLit
                        ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        : isWizardTarget
                        ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-400"
                        : isListening
                        ? "border-accent bg-accent/15 ring-2 ring-accent"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-colors shrink-0",
                          isLit
                            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]"
                            : "bg-neutral-600",
                        )}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-foreground block truncate">
                          {act.label}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-cyan-400">
                            {formatBindingLabel(boundKey)}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60">•</span>
                          <span className="text-[10px] font-mono text-amber-400">
                            {boundGamepad}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isListening ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => setListeningActionId(null)}
                            className="h-7 px-2.5 text-xs font-bold rounded-lg"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startSingleRebind(actionName)}
                          className="h-7 px-2.5 text-xs font-semibold rounded-lg border-white/15 hover:border-primary/60 hover:bg-primary/10"
                        >
                          Rebind
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
