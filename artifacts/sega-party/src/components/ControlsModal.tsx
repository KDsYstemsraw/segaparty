import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  RotateCcw,
  Wand2,
  X,
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
  if (key === "Mouse3") return "🖱️ M4 (Back)";
  if (key === "Mouse4") return "🖱️ M5 (Fwd)";
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

  if (normCore === "segams" || normCore === "segagg") {
    return [
      ...dpad,
      { id: "1", label: "1 Button", shortLabel: "1" },
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
  activeCore,
  playerSlot = 1,
  isHost,
  onTestInput,
}: ControlsModalProps) {
  const [selectedSlot, setSelectedSlot] = useState<number>(playerSlot || 1);
  const [mapping, setMapping] = useState<GamepadMapping>(() =>
    loadPlayerGamepadMapping(selectedSlot)
  );
  const [kbMapping, setKbMapping] = useState<KeyboardMapping>(() =>
    loadPlayerKeyboardMapping(selectedSlot)
  );
  const [chatHotkey, setChatHotkey] = useState<string>(() => loadChatHotkey(selectedSlot));

  // In-place rebinding target: { actionId, type: "keyboard" | "gamepad" }
  const [rebindTarget, setRebindTarget] = useState<{
    actionId: string;
    type: "keyboard" | "gamepad";
  } | null>(null);

  // Mouse listening mode for keyboard rebind
  const [mouseListenMode, setMouseListenMode] = useState(false);

  // In-Game Chat Overlay Hotkey rebinding
  const [listeningChatHotkey, setListeningChatHotkey] = useState(false);

  // "Set up all" Sequential Wizard state
  const [isWizardActive, setIsWizardActive] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);

  // Connected gamepad id
  const [connectedPad, setConnectedPad] = useState<string | null>(null);

  // Live test pressed actions tracking (state for UI glow)
  const [activeTestActions, setActiveTestActions] = useState<Set<string>>(new Set());

  // Input tracking refs
  const kbMouseHeldRef = useRef<Set<string>>(new Set());
  const padHeldRef = useRef<Set<string>>(new Set());
  const activeTestActionsRef = useRef<Set<string>>(new Set());
  const prevDownRef = useRef<Set<string>>(new Set());

  // Timestamp to ignore inputs for ~250ms after starting rebinding (prevents click-capture bug)
  const rebindStartTimeRef = useRef<number>(0);

  // Keep onTestInput in a ref to avoid recreating callbacks or triggering reset effects
  const onTestInputRef = useRef(onTestInput);
  useEffect(() => {
    onTestInputRef.current = onTestInput;
  }, [onTestInput]);

  const consoleSys = getConsoleSystem(activeCore || "segaMD");
  const actions = getConsoleActions(activeCore);

  // Helper to sync union of keyboard, mouse, and gamepad held actions, updating state and forwarding in-game
  const syncActiveTestActions = useCallback(() => {
    const union = new Set<string>();
    for (const a of kbMouseHeldRef.current) union.add(a);
    for (const a of padHeldRef.current) union.add(a);

    const prev = activeTestActionsRef.current;

    for (const a of union) {
      if (!prev.has(a)) {
        onTestInputRef.current?.(a, true);
      }
    }
    for (const a of prev) {
      if (!union.has(a)) {
        onTestInputRef.current?.(a, false);
      }
    }

    activeTestActionsRef.current = union;
    setActiveTestActions(new Set(union));
  }, []);

  // Clean release of all inputs
  const releaseAllInputs = useCallback(() => {
    for (const a of activeTestActionsRef.current) {
      onTestInputRef.current?.(a, false);
    }
    kbMouseHeldRef.current.clear();
    padHeldRef.current.clear();
    activeTestActionsRef.current.clear();
    setActiveTestActions(new Set());
  }, []);

  // Sync selectedSlot when playerSlot prop changes
  useEffect(() => {
    if (playerSlot) {
      setSelectedSlot(Math.max(1, Math.min(4, playerSlot)));
    }
  }, [playerSlot]);

  // Reload mappings ONLY when selectedSlot changes or modal opens/closes
  useEffect(() => {
    if (open) {
      setMapping(loadPlayerGamepadMapping(selectedSlot));
      setKbMapping(loadPlayerKeyboardMapping(selectedSlot));
      setChatHotkey(loadChatHotkey(selectedSlot));
      setRebindTarget(null);
      setMouseListenMode(false);
      setIsWizardActive(false);
      setListeningChatHotkey(false);
      releaseAllInputs();
    } else {
      releaseAllInputs();
      setRebindTarget(null);
      setMouseListenMode(false);
      setIsWizardActive(false);
      setListeningChatHotkey(false);
    }
  }, [open, selectedSlot, releaseAllInputs]);

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

  // Start single chip rebinding with 250ms guard
  const startRebind = (actionId: string, type: "keyboard" | "gamepad") => {
    if (rebindTarget?.actionId === actionId && rebindTarget.type === type) {
      setRebindTarget(null);
      setMouseListenMode(false);
      return;
    }
    rebindStartTimeRef.current = Date.now();
    setRebindTarget({ actionId, type });
    setMouseListenMode(false);
    setIsWizardActive(false);
    setListeningChatHotkey(false);
  };

  // 1-Click Preset appliers
  const applyPreset = (preset: KeyboardMapping) => {
    playBeep();
    setKbMapping(preset);
    savePlayerKeyboardMapping(selectedSlot, preset);
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
  };

  const clearKeyboardBinding = (actionId: string) => {
    playBeep();
    const updated = { ...kbMapping };
    delete updated[actionId];
    setKbMapping(updated);
    savePlayerKeyboardMapping(selectedSlot, updated);
  };

  const clearGamepadBinding = (actionId: string) => {
    playBeep();
    const updated = { ...mapping };
    for (const [k, v] of Object.entries(updated)) {
      if (v === actionId) delete updated[k];
    }
    setMapping(updated);
    savePlayerGamepadMapping(selectedSlot, updated);
  };

  // Keyboard Event Engine: Handles Wizard, Single-button rebinding, and Live Testing
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const timeSinceRebind = Date.now() - rebindStartTimeRef.current;

      // 0. Chat Hotkey Rebinding
      if (listeningChatHotkey) {
        e.preventDefault();
        e.stopPropagation();
        if (timeSinceRebind < 250) return;

        if (e.key === "Escape") {
          setListeningChatHotkey(false);
          return;
        }

        const newKey = e.key;
        playBeep();
        setChatHotkey(newKey);
        saveChatHotkey(newKey, selectedSlot);
        setListeningChatHotkey(false);
        return;
      }

      // 1. "Set up all" Sequential Wizard
      if (isWizardActive) {
        e.preventDefault();
        e.stopPropagation();
        if (timeSinceRebind < 250) return;

        if (e.key === "Escape") {
          setIsWizardActive(false);
          return;
        }
        if (e.repeat) return;

        const currentAction = actions[wizardStepIndex];
        if (!currentAction) {
          setIsWizardActive(false);
          return;
        }

        const newKey = e.key;
        playBeep();
        const updated = assignKeyboardBinding(kbMapping, currentAction.id, newKey);
        setKbMapping(updated);
        savePlayerKeyboardMapping(selectedSlot, updated);

        if (wizardStepIndex + 1 < actions.length) {
          rebindStartTimeRef.current = Date.now();
          setWizardStepIndex((prev) => prev + 1);
        } else {
          setIsWizardActive(false);
        }
        return;
      }

      // 2. Single Keyboard Chip Rebinding
      if (rebindTarget && rebindTarget.type === "keyboard") {
        e.preventDefault();
        e.stopPropagation();
        if (timeSinceRebind < 250) return;

        if (e.key === "Escape") {
          setRebindTarget(null);
          setMouseListenMode(false);
          return;
        }
        if (e.repeat) return;

        const newKey = e.key;
        playBeep();
        const updated = assignKeyboardBinding(kbMapping, rebindTarget.actionId, newKey);
        setKbMapping(updated);
        savePlayerKeyboardMapping(selectedSlot, updated);
        setRebindTarget(null);
        setMouseListenMode(false);
        return;
      }

      // 3. Close modal on Escape when not rebinding
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (rebindTarget) {
          setRebindTarget(null);
          return;
        }
        releaseAllInputs();
        onClose();
        return;
      }

      // 4. Passive Live Testing (Glow row when key held)
      if (
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        )
      ) {
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

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [
    open,
    rebindTarget,
    isWizardActive,
    wizardStepIndex,
    actions,
    kbMapping,
    selectedSlot,
    listeningChatHotkey,
    syncActiveTestActions,
    releaseAllInputs,
    onClose,
  ]);

  // Global mouse listeners: only captures mouse button if mouseListenMode is explicitly enabled
  useEffect(() => {
    if (!open) return;

    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (!mouseListenMode || !rebindTarget || rebindTarget.type !== "keyboard") return;
      if (Date.now() - rebindStartTimeRef.current < 250) return;

      e.preventDefault();
      e.stopPropagation();

      const token = mouseButtonToToken(e.button);
      playBeep();
      const updated = assignKeyboardBinding(kbMapping, rebindTarget.actionId, token);
      setKbMapping(updated);
      savePlayerKeyboardMapping(selectedSlot, updated);
      setRebindTarget(null);
      setMouseListenMode(false);
    };

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

    window.addEventListener("mousedown", handleGlobalMouseDown, true);
    window.addEventListener("mouseup", handleGlobalMouseUp, true);
    return () => {
      window.removeEventListener("mousedown", handleGlobalMouseDown, true);
      window.removeEventListener("mouseup", handleGlobalMouseUp, true);
    };
  }, [open, mouseListenMode, rebindTarget, kbMapping, selectedSlot, syncActiveTestActions]);

  // Gamepad Polling Loop (Buttons, Axes, and Live Testing)
  useEffect(() => {
    if (!open) return;

    let rafId: number;

    const poll = () => {
      const timeSinceRebind = Date.now() - rebindStartTimeRef.current;
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let foundPad: Gamepad | null = null;
      for (const gp of gamepads) {
        if (gp && gp.connected) {
          foundPad = gp;
          break;
        }
      }

      if (foundPad) {
        if (connectedPad !== foundPad.id) setConnectedPad(foundPad.id);
      } else if (connectedPad) {
        setConnectedPad(null);
      }

      const currentDown = new Set<string>();
      const gamepadActionsHeld = new Set<string>();

      if (foundPad) {
        // 1. Scan digital buttons
        for (let i = 0; i < foundPad.buttons.length; i++) {
          const isDown = foundPad.buttons[i].pressed || foundPad.buttons[i].value > 0.5;
          const btnKey = String(i);
          if (isDown) {
            currentDown.add(btnKey);
            const act = mapping[btnKey];
            if (act) gamepadActionsHeld.add(act);
          }

          const justPressed = isDown && !prevDownRef.current.has(btnKey);

          if (justPressed && timeSinceRebind >= 250) {
            // Wizard Gamepad Button Capture
            if (isWizardActive) {
              const currentAction = actions[wizardStepIndex];
              if (currentAction) {
                playBeep();
                const updated = assignGamepadBinding(mapping, currentAction.id, btnKey);
                setMapping(updated);
                savePlayerGamepadMapping(selectedSlot, updated);
                if (wizardStepIndex + 1 < actions.length) {
                  rebindStartTimeRef.current = Date.now();
                  setWizardStepIndex((prev) => prev + 1);
                } else {
                  setIsWizardActive(false);
                }
                prevDownRef.current = currentDown;
                rafId = requestAnimationFrame(poll);
                return;
              }
            }

            // Single Gamepad Chip Rebinding (Only if target is gamepad!)
            if (rebindTarget && rebindTarget.type === "gamepad") {
              playBeep();
              const updated = assignGamepadBinding(mapping, rebindTarget.actionId, btnKey);
              setMapping(updated);
              savePlayerGamepadMapping(selectedSlot, updated);
              setRebindTarget(null);
              prevDownRef.current = currentDown;
              rafId = requestAnimationFrame(poll);
              return;
            }
          }
        }

        // 2. Scan analog stick axes
        if (foundPad.axes && foundPad.axes.length >= 2) {
          const axisCandidates: [string, boolean][] = [
            ["axis-0-neg", foundPad.axes[0] < -0.65],
            ["axis-0-pos", foundPad.axes[0] > 0.65],
            ["axis-1-neg", foundPad.axes[1] < -0.65],
            ["axis-1-pos", foundPad.axes[1] > 0.65],
          ];

          for (const [axisKey, isDeflected] of axisCandidates) {
            if (isDeflected) {
              currentDown.add(axisKey);
              const act = mapping[axisKey];
              if (act) gamepadActionsHeld.add(act);
            }

            const axisJustPressed = isDeflected && !prevDownRef.current.has(axisKey);

            if (axisJustPressed && timeSinceRebind >= 250) {
              // Wizard Gamepad Axis Capture
              if (isWizardActive) {
                const currentAction = actions[wizardStepIndex];
                if (currentAction) {
                  playBeep();
                  const updated = assignGamepadBinding(mapping, currentAction.id, axisKey);
                  setMapping(updated);
                  savePlayerGamepadMapping(selectedSlot, updated);
                  if (wizardStepIndex + 1 < actions.length) {
                    rebindStartTimeRef.current = Date.now();
                    setWizardStepIndex((prev) => prev + 1);
                  } else {
                    setIsWizardActive(false);
                  }
                  prevDownRef.current = currentDown;
                  rafId = requestAnimationFrame(poll);
                  return;
                }
              }

              // Single Gamepad Chip Axis Rebinding
              if (rebindTarget && rebindTarget.type === "gamepad") {
                playBeep();
                const updated = assignGamepadBinding(mapping, rebindTarget.actionId, axisKey);
                setMapping(updated);
                savePlayerGamepadMapping(selectedSlot, updated);
                setRebindTarget(null);
                prevDownRef.current = currentDown;
                rafId = requestAnimationFrame(poll);
                return;
              }
            }
          }
        }
      }

      // Live glow synchronization
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
      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [
    open,
    rebindTarget,
    isWizardActive,
    wizardStepIndex,
    actions,
    mapping,
    selectedSlot,
    connectedPad,
    syncActiveTestActions,
  ]);

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
          if (rebindTarget || isWizardActive || listeningChatHotkey) {
            setRebindTarget(null);
            setMouseListenMode(false);
            setIsWizardActive(false);
            setListeningChatHotkey(false);
          } else {
            releaseAllInputs();
            onClose();
          }
        }
      }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-sans select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 bg-[#0d111d] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden my-auto"
      >
        {/* Top Header Cyber Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-cyan-400 to-accent shrink-0" />

        {/* 1. Header (one line): console badge + "Player N Controls" + slot switcher pills P1–P4 + ✕ close */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-mono font-bold uppercase tracking-wider py-0.5 px-2 rounded-md shrink-0",
                consoleSys.badgeColor
              )}
            >
              {consoleSys.name}
            </Badge>
            <h2 className="text-sm font-bold text-foreground truncate">
              Player {selectedSlot} Controls
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Slot switcher pills P1–P4 */}
            <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-xl border border-white/10">
              {[1, 2, 3, 4].map((slot) => {
                const isSelected = selectedSlot === slot;
                const isCurrentPlayer = playerSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-white hover:bg-white/10"
                    )}
                    title={`Switch to Player ${slot}${isCurrentPlayer ? " (You)" : ""}`}
                  >
                    <span>P{slot}</span>
                    {isCurrentPlayer && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ✕ Close button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                releaseAllInputs();
                setRebindTarget(null);
                setIsWizardActive(false);
                setListeningChatHotkey(false);
                onClose();
              }}
              className="w-7 h-7 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-white/15"
              title="Close Controls (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 2. One clean grid of controls */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-white/5">
            <div className="col-span-4">Action</div>
            <div className="col-span-4">Keyboard</div>
            <div className="col-span-4">Gamepad</div>
          </div>

          {/* Action Rows */}
          {actions.map((act, index) => {
            const isLit = activeTestActions.has(act.id);
            const isWizardTarget = isWizardActive && wizardStepIndex === index;
            const isKbListening = rebindTarget?.actionId === act.id && rebindTarget.type === "keyboard";
            const isPadListening = rebindTarget?.actionId === act.id && rebindTarget.type === "gamepad";

            const boundKey = kbMapping[act.id];
            const boundPad = formatGamepadBinding(act.id);

            return (
              <div
                key={act.id}
                className={cn(
                  "grid grid-cols-12 gap-2 items-center px-2.5 py-1.5 rounded-xl border transition-all text-xs",
                  isLit
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                    : isWizardTarget
                    ? "bg-amber-500/15 border-amber-400/60 text-amber-200 ring-1 ring-amber-400/50 animate-pulse"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                )}
              >
                {/* Action Name */}
                <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-muted-foreground shrink-0">
                    {act.shortLabel || act.id.toUpperCase()}
                  </span>
                  <span className="font-semibold truncate text-foreground">{act.label}</span>
                </div>

                {/* Keyboard Chip */}
                <div className="col-span-4">
                  {isKbListening ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRebindTarget(null)}
                        className="flex-1 h-7 px-2 rounded-lg bg-accent text-accent-foreground font-bold text-[11px] animate-pulse border border-accent flex items-center justify-center truncate"
                        title="Press any keyboard key, or click to cancel"
                      >
                        {mouseListenMode ? "🖱️ Click mouse..." : "Press key..."}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          rebindStartTimeRef.current = Date.now();
                          setMouseListenMode((prev) => !prev);
                        }}
                        className={cn(
                          "h-7 px-1.5 rounded-lg border text-[11px] transition-all font-bold shrink-0",
                          mouseListenMode
                            ? "bg-amber-500 text-black border-amber-400"
                            : "bg-white/10 hover:bg-white/20 text-slate-300 border-white/10"
                        )}
                        title="Toggle mouse button binding mode"
                      >
                        🖱️
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRebind(act.id, "keyboard")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearKeyboardBinding(act.id);
                      }}
                      className={cn(
                        "w-full h-7 px-2 rounded-lg border text-xs font-mono font-bold transition-all flex items-center justify-center truncate text-center",
                        isWizardTarget
                          ? "border-amber-400 bg-amber-500/20 text-amber-200 animate-pulse"
                          : boundKey
                          ? "bg-white/[0.04] hover:bg-white/[0.09] text-foreground border-white/10 hover:border-primary/50"
                          : "bg-transparent text-muted-foreground/40 border-dashed border-white/10 hover:border-white/30"
                      )}
                      title="Click to rebind. Right-click to clear."
                    >
                      {isWizardTarget ? "Press key..." : formatBindingLabel(boundKey)}
                    </button>
                  )}
                </div>

                {/* Gamepad Chip */}
                <div className="col-span-4">
                  {isPadListening ? (
                    <button
                      type="button"
                      onClick={() => setRebindTarget(null)}
                      className="w-full h-7 px-2 rounded-lg bg-amber-500 text-black font-bold text-[11px] animate-pulse border border-amber-400 flex items-center justify-center truncate"
                      title="Press any gamepad button or tilt stick, or click to cancel"
                    >
                      Press button...
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRebind(act.id, "gamepad")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearGamepadBinding(act.id);
                      }}
                      className={cn(
                        "w-full h-7 px-2 rounded-lg border text-xs font-mono font-bold transition-all flex items-center justify-center truncate text-center",
                        isWizardTarget
                          ? "border-amber-400 bg-amber-500/20 text-amber-200 animate-pulse"
                          : boundPad !== "—"
                          ? "bg-white/[0.04] hover:bg-white/[0.09] text-foreground border-white/10 hover:border-primary/50"
                          : "bg-transparent text-muted-foreground/40 border-dashed border-white/10 hover:border-white/30"
                      )}
                      title="Click to rebind. Right-click to clear."
                    >
                      {isWizardTarget ? "Press button..." : boundPad}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Footer (one row of small buttons) */}
        <div className="p-2.5 border-t border-white/10 bg-white/[0.02] shrink-0 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Presets & Setup All */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Presets dropdown */}
            <select
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === "default") applyPreset(DEFAULT_PRESET);
                if (val === "wasd") applyPreset(WASD_PRESET);
                if (val === "numpad") applyPreset(NUMPAD_PRESET);
                e.target.value = "";
              }}
              className="h-7 px-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer focus:outline-none"
              title="Apply quick keyboard preset"
            >
              <option value="" disabled className="bg-neutral-900 text-slate-400">
                Presets...
              </option>
              <option value="default" className="bg-neutral-900 text-white">
                Arrows + Z/X/C
              </option>
              <option value="wasd" className="bg-neutral-900 text-white">
                WASD + J/K/L
              </option>
              <option value="numpad" className="bg-neutral-900 text-white">
                Numpad 8/4/6/2
              </option>
            </select>

            {/* Set up all button */}
            <Button
              type="button"
              size="sm"
              variant={isWizardActive ? "destructive" : "outline"}
              onClick={() => {
                if (isWizardActive) {
                  setIsWizardActive(false);
                } else {
                  setRebindTarget(null);
                  setListeningChatHotkey(false);
                  rebindStartTimeRef.current = Date.now();
                  setWizardStepIndex(0);
                  setIsWizardActive(true);
                }
              }}
              className="h-7 px-2.5 text-xs font-semibold rounded-lg border-white/15 hover:border-primary/50"
              title="Sequentially rebind every button one-by-one"
            >
              {isWizardActive ? (
                <span>Stop Wizard ({wizardStepIndex + 1}/{actions.length})</span>
              ) : (
                <span className="flex items-center gap-1">
                  <Wand2 className="w-3 h-3 text-cyan-400" /> Set up all
                </span>
              )}
            </Button>

            {/* Reset Defaults button */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetAllDefaults}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-white rounded-lg gap-1"
              title="Reset player controls to factory defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </Button>
          </div>

          {/* Right: Chat Key Chip */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-mono">Chat:</span>
            <button
              type="button"
              onClick={() => {
                rebindStartTimeRef.current = Date.now();
                setListeningChatHotkey((prev) => !prev);
                setRebindTarget(null);
                setIsWizardActive(false);
              }}
              className={cn(
                "h-7 px-2.5 rounded-lg border text-xs font-mono font-bold transition-all flex items-center gap-1",
                listeningChatHotkey
                  ? "bg-accent text-accent-foreground border-accent animate-pulse shadow-sm"
                  : "bg-white/[0.06] hover:bg-white/[0.1] text-foreground border-white/15"
              )}
              title="Click to rebind In-Game Chat Hotkey"
            >
              <MessageSquare className="w-3 h-3 text-accent" />
              <span>{listeningChatHotkey ? "Press key..." : formatBindingLabel(chatHotkey)}</span>
            </button>
          </div>
        </div>

        {/* 4. Small muted hint line only */}
        <div className="text-[11px] text-muted-foreground/60 text-center font-mono py-1 bg-black/40 border-t border-white/5 shrink-0">
          Space = Start · Shift = Select · Enter = Chat
        </div>
      </div>
    </div>,
    portalTarget
  );
}
