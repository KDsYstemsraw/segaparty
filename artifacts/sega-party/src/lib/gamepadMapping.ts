import { getRomCore } from "@/lib/romStore";

export interface GameAction {
  key: string;
  keyCode: number;
  code: string;
  label: string;
}

export const GENESIS_ACTIONS = [
  "up",
  "down",
  "left",
  "right",
  "a",
  "b",
  "c",
  "x",
  "y",
  "z",
  "start",
  "mode",
] as const;

export type GenesisAction = (typeof GENESIS_ACTIONS)[number];

export interface ConsoleActionInfo {
  id: string;
  label: string;
  shortLabel: string;
  category: "dpad" | "face" | "shoulder" | "system" | "cbutton";
}

export function getConsoleControllerTitle(coreId?: string): string {
  const normCore = (coreId || getRomCore() || "segaMD").toLowerCase();

  switch (normCore) {
    case "psx":
      return "PlayStation DualShock Pad";
    case "psp":
      return "PSP Handheld Controls";
    case "snes":
      return "Super Nintendo Controller";
    case "nds":
      return "Nintendo DS Dual-Screen Pad";
    case "n64":
      return "Nintendo 64 3-Prong Controller";
    case "gba":
      return "Game Boy Advance Handheld";
    case "gb":
      return "Game Boy Classic Pad";
    case "nes":
      return "NES Classic Controller";
    case "segams":
    case "master-system":
      return "Master System 2-Button Pad";
    case "segagg":
    case "gamegear":
      return "Sega Game Gear Portable";
    case "atari2600":
    case "atari":
      return "Atari CX40 Joystick";
    case "arcade":
    case "mame":
    case "fbneo":
      return "6-Button Arcade Fight Stick";
    case "segacd":
    case "sega32x":
    case "segamd":
    default:
      return "Sega Genesis 6-Button Arcade Pad";
  }
}

export function getConsoleActions(coreId?: string): ConsoleActionInfo[] {
  const normCore = (coreId || getRomCore() || "segaMD").toLowerCase();

  const dpad: ConsoleActionInfo[] = [
    { id: "up", label: "D-Pad Up", shortLabel: "▲", category: "dpad" },
    { id: "down", label: "D-Pad Down", shortLabel: "▼", category: "dpad" },
    { id: "left", label: "D-Pad Left", shortLabel: "◀", category: "dpad" },
    { id: "right", label: "D-Pad Right", shortLabel: "▶", category: "dpad" },
  ];

  if (normCore === "psx") {
    return [
      ...dpad,
      { id: "b", label: "Cross (✕)", shortLabel: "✕", category: "face" },
      { id: "y", label: "Square (□)", shortLabel: "□", category: "face" },
      { id: "a", label: "Circle (○)", shortLabel: "○", category: "face" },
      { id: "x", label: "Triangle (△)", shortLabel: "△", category: "face" },
      { id: "l1", label: "L1 Bumper", shortLabel: "L1", category: "shoulder" },
      { id: "r1", label: "R1 Bumper", shortLabel: "R1", category: "shoulder" },
      { id: "l2", label: "L2 Trigger", shortLabel: "L2", category: "shoulder" },
      { id: "r2", label: "R2 Trigger", shortLabel: "R2", category: "shoulder" },
      { id: "mode", label: "Select", shortLabel: "SEL", category: "system" },
      { id: "start", label: "Start", shortLabel: "START", category: "system" },
    ];
  }

  if (normCore === "psp") {
    return [
      ...dpad,
      { id: "b", label: "Cross (✕)", shortLabel: "✕", category: "face" },
      { id: "y", label: "Square (□)", shortLabel: "□", category: "face" },
      { id: "a", label: "Circle (○)", shortLabel: "○", category: "face" },
      { id: "x", label: "Triangle (△)", shortLabel: "△", category: "face" },
      { id: "l", label: "L Trigger", shortLabel: "L", category: "shoulder" },
      { id: "r", label: "R Trigger", shortLabel: "R", category: "shoulder" },
      { id: "mode", label: "Select", shortLabel: "SEL", category: "system" },
      { id: "start", label: "Start", shortLabel: "START", category: "system" },
    ];
  }

  if (normCore === "snes" || normCore === "nds") {
    return [
      ...dpad,
      { id: "b", label: "B Button", shortLabel: "B", category: "face" },
      { id: "a", label: "A Button", shortLabel: "A", category: "face" },
      { id: "y", label: "Y Button", shortLabel: "Y", category: "face" },
      { id: "x", label: "X Button", shortLabel: "X", category: "face" },
      { id: "l", label: "L Shoulder", shortLabel: "L", category: "shoulder" },
      { id: "r", label: "R Shoulder", shortLabel: "R", category: "shoulder" },
      { id: "mode", label: "Select", shortLabel: "SEL", category: "system" },
      { id: "start", label: "Start", shortLabel: "START", category: "system" },
    ];
  }

  if (normCore === "n64") {
    return [
      ...dpad,
      { id: "a", label: "A Button", shortLabel: "A", category: "face" },
      { id: "b", label: "B Button", shortLabel: "B", category: "face" },
      { id: "z", label: "Z Trigger", shortLabel: "Z", category: "shoulder" },
      { id: "l", label: "L Shoulder", shortLabel: "L", category: "shoulder" },
      { id: "r", label: "R Shoulder", shortLabel: "R", category: "shoulder" },
      { id: "c-up", label: "C-Up", shortLabel: "C▲", category: "cbutton" },
      { id: "c-down", label: "C-Down", shortLabel: "C▼", category: "cbutton" },
      { id: "c-left", label: "C-Left", shortLabel: "C◀", category: "cbutton" },
      { id: "c-right", label: "C-Right", shortLabel: "C▶", category: "cbutton" },
      { id: "start", label: "Start", shortLabel: "START", category: "system" },
    ];
  }

  if (normCore === "gba") {
    return [
      ...dpad,
      { id: "b", label: "B Button", shortLabel: "B", category: "face" },
      { id: "a", label: "A Button", shortLabel: "A", category: "face" },
      { id: "l", label: "L Shoulder", shortLabel: "L", category: "shoulder" },
      { id: "r", label: "R Shoulder", shortLabel: "R", category: "shoulder" },
      { id: "mode", label: "Select", shortLabel: "SEL", category: "system" },
      { id: "start", label: "Start", shortLabel: "START", category: "system" },
    ];
  }

  if (normCore === "nes" || normCore === "gb") {
    return [
      ...dpad,
      { id: "b", label: "B Button", shortLabel: "B", category: "face" },
      { id: "a", label: "A Button", shortLabel: "A", category: "face" },
      { id: "mode", label: "Select", shortLabel: "SEL", category: "system" },
      { id: "start", label: "Start", shortLabel: "START", category: "system" },
    ];
  }

  if (normCore === "segams" || normCore === "segagg") {
    return [
      ...dpad,
      { id: "b", label: "Button 1", shortLabel: "1", category: "face" },
      { id: "a", label: "Button 2", shortLabel: "2", category: "face" },
      { id: "start", label: "Start / Pause", shortLabel: "START", category: "system" },
    ];
  }

  if (normCore === "atari2600" || normCore === "atari") {
    return [
      ...dpad,
      { id: "b", label: "Fire Button", shortLabel: "FIRE", category: "face" },
      { id: "mode", label: "Game Select", shortLabel: "SEL", category: "system" },
      { id: "start", label: "Game Reset", shortLabel: "RESET", category: "system" },
    ];
  }

  if (normCore === "arcade" || normCore === "mame" || normCore === "fbneo") {
    return [
      ...dpad,
      { id: "a", label: "Button 1", shortLabel: "B1", category: "face" },
      { id: "b", label: "Button 2", shortLabel: "B2", category: "face" },
      { id: "c", label: "Button 3", shortLabel: "B3", category: "face" },
      { id: "x", label: "Button 4", shortLabel: "B4", category: "face" },
      { id: "y", label: "Button 5", shortLabel: "B5", category: "face" },
      { id: "z", label: "Button 6", shortLabel: "B6", category: "face" },
      { id: "mode", label: "Insert Coin", shortLabel: "COIN", category: "system" },
      { id: "start", label: "Player Start", shortLabel: "START", category: "system" },
    ];
  }

  // Default: Sega Genesis / Mega Drive / Sega CD / Sega 32X
  return [
    ...dpad,
    { id: "a", label: "A Button", shortLabel: "A", category: "face" },
    { id: "b", label: "B Button", shortLabel: "B", category: "face" },
    { id: "c", label: "C Button", shortLabel: "C", category: "face" },
    { id: "x", label: "X Button", shortLabel: "X", category: "face" },
    { id: "y", label: "Y Button", shortLabel: "Y", category: "face" },
    { id: "z", label: "Z Button", shortLabel: "Z", category: "face" },
    { id: "mode", label: "Mode", shortLabel: "MODE", category: "system" },
    { id: "start", label: "Start", shortLabel: "START", category: "system" },
  ];
}

// Action definitions for Player 1
export const GAME_ACTIONS: Record<string, GameAction> = {
  up:    { key: "ArrowUp",    keyCode: 38, code: "ArrowUp",    label: "D-Pad Up" },
  down:  { key: "ArrowDown",  keyCode: 40, code: "ArrowDown",  label: "D-Pad Down" },
  left:  { key: "ArrowLeft",  keyCode: 37, code: "ArrowLeft",  label: "D-Pad Left" },
  right: { key: "ArrowRight", keyCode: 39, code: "ArrowRight", label: "D-Pad Right" },
  a:     { key: "z",          keyCode: 90, code: "KeyZ",       label: "A Button" },
  b:     { key: "x",          keyCode: 88, code: "KeyX",       label: "B Button" },
  c:     { key: "c",          keyCode: 67, code: "KeyC",       label: "C Button" },
  x:     { key: "a",          keyCode: 65, code: "KeyA",       label: "X Button" },
  y:     { key: "s",          keyCode: 83, code: "KeyS",       label: "Y Button" },
  z:     { key: "d",          keyCode: 68, code: "KeyD",       label: "Z Button" },
  start: { key: "Enter",      keyCode: 13, code: "Enter",      label: "Start" },
  mode:  { key: " ",          keyCode: 32, code: "Space",      label: "Mode" },
};

// Distinct virtual keycodes dispatched for each Player Slot (1 to 4)
export const PLAYER_KEY_MAPPINGS: Record<number, Record<string, GameAction>> = {
  1: {
    up:    { key: "ArrowUp",    keyCode: 38, code: "ArrowUp",    label: "D-Pad Up" },
    down:  { key: "ArrowDown",  keyCode: 40, code: "ArrowDown",  label: "D-Pad Down" },
    left:  { key: "ArrowLeft",  keyCode: 37, code: "ArrowLeft",  label: "D-Pad Left" },
    right: { key: "ArrowRight", keyCode: 39, code: "ArrowRight", label: "D-Pad Right" },
    a:     { key: "z",          keyCode: 90, code: "KeyZ",       label: "A Button" },
    b:     { key: "x",          keyCode: 88, code: "KeyX",       label: "B Button" },
    c:     { key: "c",          keyCode: 67, code: "KeyC",       label: "C Button" },
    x:     { key: "a",          keyCode: 65, code: "KeyA",       label: "X Button" },
    y:     { key: "s",          keyCode: 83, code: "KeyS",       label: "Y Button" },
    z:     { key: "d",          keyCode: 68, code: "KeyD",       label: "Z Button" },
    start: { key: "Enter",      keyCode: 13, code: "Enter",      label: "Start" },
    mode:  { key: " ",          keyCode: 32, code: "Space",      label: "Mode" },
  },
  2: {
    up:    { key: "i",          keyCode: 73, code: "KeyI",       label: "D-Pad Up" },
    down:  { key: "k",          keyCode: 75, code: "KeyK",       label: "D-Pad Down" },
    left:  { key: "j",          keyCode: 74, code: "KeyJ",       label: "D-Pad Left" },
    right: { key: "l",          keyCode: 76, code: "KeyL",       label: "D-Pad Right" },
    a:     { key: "u",          keyCode: 85, code: "KeyU",       label: "A Button" },
    b:     { key: "o",          keyCode: 79, code: "KeyO",       label: "B Button" },
    c:     { key: "p",          keyCode: 80, code: "KeyP",       label: "C Button" },
    x:     { key: "7",          keyCode: 55, code: "Digit7",     label: "X Button" },
    y:     { key: "8",          keyCode: 56, code: "Digit8",     label: "Y Button" },
    z:     { key: "9",          keyCode: 57, code: "Digit9",     label: "Z Button" },
    start: { key: "0",          keyCode: 48, code: "Digit0",     label: "Start" },
    mode:  { key: "-",          keyCode: 189,code: "Minus",      label: "Mode" },
  },
  3: {
    up:    { key: "t",          keyCode: 84, code: "KeyT",       label: "D-Pad Up" },
    down:  { key: "g",          keyCode: 71, code: "KeyG",       label: "D-Pad Down" },
    left:  { key: "f",          keyCode: 70, code: "KeyF",       label: "D-Pad Left" },
    right: { key: "h",          keyCode: 72, code: "KeyH",       label: "D-Pad Right" },
    a:     { key: "v",          keyCode: 86, code: "KeyV",       label: "A Button" },
    b:     { key: "b",          keyCode: 66, code: "KeyB",       label: "B Button" },
    c:     { key: "n",          keyCode: 78, code: "KeyN",       label: "C Button" },
    x:     { key: "4",          keyCode: 52, code: "Digit4",     label: "X Button" },
    y:     { key: "5",          keyCode: 53, code: "Digit5",     label: "Y Button" },
    z:     { key: "6",          keyCode: 54, code: "Digit6",     label: "Z Button" },
    start: { key: "1",          keyCode: 49, code: "Digit1",     label: "Start" },
    mode:  { key: "2",          keyCode: 50, code: "Digit2",     label: "Mode" },
  },
  4: {
    up:    { key: "8",          keyCode: 104,code: "Numpad8",    label: "D-Pad Up" },
    down:  { key: "2",          keyCode: 98, code: "Numpad2",    label: "D-Pad Down" },
    left:  { key: "4",          keyCode: 100,code: "Numpad4",    label: "D-Pad Left" },
    right: { key: "6",          keyCode: 102,code: "Numpad6",    label: "D-Pad Right" },
    a:     { key: "1",          keyCode: 97, code: "Numpad1",    label: "A Button" },
    b:     { key: "3",          keyCode: 99, code: "Numpad3",    label: "B Button" },
    c:     { key: "5",          keyCode: 101,code: "Numpad5",    label: "C Button" },
    x:     { key: "7",          keyCode: 103,code: "Numpad7",    label: "X Button" },
    y:     { key: "9",          keyCode: 105,code: "Numpad9",    label: "Y Button" },
    z:     { key: "+",          keyCode: 107,code: "NumpadAdd",  label: "Z Button" },
    start: { key: "Enter",      keyCode: 13, code: "NumpadEnter",label: "Start" },
    mode:  { key: ".",          keyCode: 110,code: "NumpadDecimal", label: "Mode" },
  },
};

/**
 * Generates an isolated internal virtual keyCode for EmulatorJS ports (0..3) and RetroPad button IDs (0..29).
 * Physical keyboard keyCodes are <= 255. By mapping EmulatorJS ports 0..3 to keyCodes 1000..1329:
 * 1) No physical key or typed character (e.g. WASD, chat text, 1/2/3) can ever directly match controls[i][j].value === e.keyCode.
 * 2) All 4 players can use the exact same keyboard bindings (e.g. WASD or Arrow keys) with zero cross-player interference.
 */
export function getInternalEmulatorKeyCode(port: number, btnId: number): number {
  const safePort = Math.max(0, Math.min(3, Math.floor(Number(port) || 0)));
  const safeBtn = Math.max(0, Math.min(29, Math.floor(Number(btnId) || 0)));
  return 1000 + safePort * 100 + safeBtn;
}

export function getPlayerActionKey(
  playerIndex: number,
  actionName: string,
  core?: string,
): GameAction | null {
  const slot = Math.max(1, Math.min(4, Math.floor(Number(playerIndex) || 1)));
  const port = slot - 1;
  const actionMap = getCoreActionToButtonId(core || getRomCore() || "segaMD");
  const normAction = (actionName || "").toLowerCase().trim();

  // Map non-Genesis or cross-console action aliases to sensible defaults
  const CONSOLE_ALIASES: Record<string, string> = {
    cross: "a",
    circle: "b",
    square: "x",
    triangle: "y",
    select: "mode",
    l1: "l",
    r1: "r",
    l2: "z",
    r2: "c",
  };

  let btnId = actionMap[normAction];
  if (btnId === undefined) {
    const alias = CONSOLE_ALIASES[normAction];
    if (alias && actionMap[alias] !== undefined) {
      btnId = actionMap[alias];
    }
  }

  if (btnId !== undefined) {
    const vKeyCode = getInternalEmulatorKeyCode(port, btnId);
    const vCode = `EJS_P${slot}_BTN_${btnId}`;
    return {
      key: vCode,
      keyCode: vKeyCode,
      code: vCode,
      label: normAction,
    };
  }

  const slotMap = PLAYER_KEY_MAPPINGS[slot] || PLAYER_KEY_MAPPINGS[1];
  if (slotMap[normAction]) return slotMap[normAction];
  const alias = CONSOLE_ALIASES[normAction];
  if (alias && slotMap[alias]) {
    return slotMap[alias];
  }

  return null;
}

// Maps gamepad button index → action name. Axis entries use "axis-0-neg" etc.
export type GamepadMapping = Record<string, string>;

export const DEFAULT_MAPPING: GamepadMapping = {
  "0":  "a",      // South (A / Cross) -> Sega A button
  "1":  "b",      // East  (B / Circle) -> Sega B button
  "2":  "x",      // West  (X / Square) -> Sega X button
  "3":  "y",      // North (Y / Triangle) -> Sega Y button
  "4":  "c",      // L1 / LB -> Sega C button
  "5":  "z",      // R1 / RB -> Sega Z button
  "8":  "mode",   // Select / Back / View
  "9":  "start",  // Start / Menu
  "12": "up",
  "13": "down",
  "14": "left",
  "15": "right",
  // Left-stick axes as virtual buttons
  "axis-0-neg": "left",
  "axis-0-pos": "right",
  "axis-1-neg": "up",
  "axis-1-pos": "down",
};

export const STORAGE_KEY = "sega-party-gamepad-mapping";
export const KEYBOARD_STORAGE_KEY = "sega-party-keyboard-mapping";

export const getPlayerKeyboardStorageKey = (slot: number) => `retroparty-controls-p${slot}-keyboard`;
export const getPlayerGamepadStorageKey = (slot: number) => `retroparty-controls-p${slot}-gamepad`;

export type KeyboardMapping = Record<string, string>; // actionName -> keyName (e.g. up -> ArrowUp, a -> z)

export const DEFAULT_KEYBOARD_MAPPING: KeyboardMapping = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  a: "z",
  b: "x",
  c: "c",
  x: "a",
  y: "s",
  z: "d",
  l: "q",
  r: "e",
  l1: "q",
  r1: "e",
  l2: "1",
  r2: "3",
  select: "Shift",
  start: "Backspace",
  mode: " ",
};

export const WASD_KEYBOARD_MAPPING: KeyboardMapping = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
  a: "j",
  b: "k",
  c: "l",
  x: "u",
  y: "i",
  z: "o",
  l: "q",
  r: "e",
  l1: "q",
  r1: "e",
  l2: "1",
  r2: "3",
  select: "Shift",
  start: "Backspace",
  mode: "Shift",
};

export const CHAT_HOTKEY_STORAGE_KEY = "retroparty-chat-hotkey";

export function loadChatHotkey(playerSlot?: number): string {
  if (typeof window === "undefined") return "Enter";
  try {
    const slotKey = playerSlot ? `${CHAT_HOTKEY_STORAGE_KEY}-p${playerSlot}` : null;
    const stored =
      (slotKey ? localStorage.getItem(slotKey) : null) ||
      localStorage.getItem(CHAT_HOTKEY_STORAGE_KEY);
    return stored || "Enter";
  } catch {
    return "Enter";
  }
}

export function saveChatHotkey(key: string, playerSlot?: number): void {
  if (typeof window === "undefined") return;
  const safeKey = key || "Enter";
  try {
    if (playerSlot) {
      localStorage.setItem(`${CHAT_HOTKEY_STORAGE_KEY}-p${playerSlot}`, safeKey);
    }
    localStorage.setItem(CHAT_HOTKEY_STORAGE_KEY, safeKey);
  } catch {}

  window.dispatchEvent(
    new CustomEvent("chat-hotkey-changed", {
      detail: { key: safeKey, playerSlot },
    }),
  );
}

export function loadPlayerKeyboardMapping(playerSlot: number): KeyboardMapping {
  const slot = Math.max(1, Math.min(4, Math.floor(Number(playerSlot) || 1)));
  const defaultMapping = DEFAULT_KEYBOARD_MAPPING;
  try {
    const key = getPlayerKeyboardStorageKey(slot);
    const stored = localStorage.getItem(key);
    let mapping: KeyboardMapping | null = null;
    if (stored) {
      mapping = { ...defaultMapping, ...JSON.parse(stored) };
    } else if (slot === 1) {
      const legacy = localStorage.getItem(KEYBOARD_STORAGE_KEY);
      if (legacy) {
        mapping = { ...defaultMapping, ...JSON.parse(legacy) };
      }
    }
    if (mapping) {
      // If stored mapping still had start: "Enter" but chat hotkey is also "Enter",
      // migrate start to "Backspace" to prevent chat hotkey conflict
      const chatHotkey = loadChatHotkey(slot);
      if (mapping.start?.toLowerCase() === "enter" && chatHotkey.toLowerCase() === "enter") {
        mapping.start = "Backspace";
      }
      return mapping;
    }
  } catch {}
  return { ...defaultMapping };
}

export function savePlayerKeyboardMapping(playerSlot: number, mapping: KeyboardMapping): void {
  const slot = Math.max(1, Math.min(4, Math.floor(Number(playerSlot) || 1)));
  try {
    const key = getPlayerKeyboardStorageKey(slot);
    localStorage.setItem(key, JSON.stringify(mapping));
    if (slot === 1) {
      localStorage.setItem(KEYBOARD_STORAGE_KEY, JSON.stringify(mapping));
    }
  } catch {}

  syncEmulatorJSControls(slot, mapping);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("controls-mapping-changed", { detail: { playerSlot: slot } }));
    window.dispatchEvent(new Event("keyboard-mapping-changed"));
  }
}

export function loadPlayerGamepadMapping(playerSlot: number): GamepadMapping {
  const slot = Math.max(1, Math.min(4, Math.floor(Number(playerSlot) || 1)));
  try {
    const key = getPlayerGamepadStorageKey(slot);
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...DEFAULT_MAPPING, ...JSON.parse(stored) };
    }
    // Check legacy storage key for slot 1
    if (slot === 1) {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        return { ...DEFAULT_MAPPING, ...JSON.parse(legacy) };
      }
    }
  } catch {}
  return { ...DEFAULT_MAPPING };
}

export function savePlayerGamepadMapping(playerSlot: number, mapping: GamepadMapping): void {
  const slot = Math.max(1, Math.min(4, Math.floor(Number(playerSlot) || 1)));
  try {
    const key = getPlayerGamepadStorageKey(slot);
    localStorage.setItem(key, JSON.stringify(mapping));
    if (slot === 1) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
    }
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("controls-mapping-changed", { detail: { playerSlot: slot } }));
    window.dispatchEvent(new Event("gamepad-mapping-changed"));
  }
}

// Legacy wrappers for backwards compatibility
export function loadMapping(): GamepadMapping {
  return loadPlayerGamepadMapping(1);
}

export function saveMapping(mapping: GamepadMapping): void {
  savePlayerGamepadMapping(1, mapping);
}

export function loadKeyboardMapping(): KeyboardMapping {
  return loadPlayerKeyboardMapping(1);
}

export function saveKeyboardMapping(mapping: KeyboardMapping): void {
  savePlayerKeyboardMapping(1, mapping);
}

/**
 * Assigns a key to an action, unbinding any other action that already uses that key
 * to prevent duplicate input conflicts across all console action IDs.
 */
export function assignKeyboardBinding(
  mapping: KeyboardMapping,
  actionToAssign: string,
  newKey: string
): KeyboardMapping {
  const updated: KeyboardMapping = { ...mapping };
  const targetAction = (actionToAssign || "").trim().toLowerCase();
  const targetKey = (newKey || "").trim();

  if (!targetAction) return updated;

  // If empty key passed, unbind the action
  if (!targetKey) {
    for (const action of Object.keys(updated)) {
      if (action.toLowerCase() === targetAction) {
        delete updated[action];
      }
    }
    return updated;
  }

  const targetKeyLower = targetKey.toLowerCase();

  // 1. Remove any conflicting action currently bound to newKey (case-insensitive)
  for (const [action, key] of Object.entries(updated)) {
    if (action.toLowerCase() !== targetAction && key.trim().toLowerCase() === targetKeyLower) {
      delete updated[action];
    }
  }

  // 2. Clear any existing key for targetAction (regardless of key casing)
  for (const action of Object.keys(updated)) {
    if (action.toLowerCase() === targetAction) {
      delete updated[action];
    }
  }

  updated[targetAction] = targetKey;
  return updated;
}

/**
 * Assigns a gamepad button or axis to an action, clearing any previous assignments
 * to that button/axis or to that action to prevent conflict across all console action IDs.
 */
export function assignGamepadBinding(
  mapping: GamepadMapping,
  actionToAssign: string,
  newButtonOrAxis: string
): GamepadMapping {
  const updated: GamepadMapping = { ...mapping };
  const targetAction = (actionToAssign || "").trim().toLowerCase();
  const targetBtn = (newButtonOrAxis || "").trim();

  if (!targetAction) return updated;

  // If empty button/axis passed, unbind this action
  if (!targetBtn) {
    for (const [btn, act] of Object.entries(updated)) {
      if (act.trim().toLowerCase() === targetAction) {
        delete updated[btn];
      }
    }
    return updated;
  }

  const isTargetAxis = targetBtn.startsWith("axis");

  for (const [btn, act] of Object.entries(updated)) {
    // 1. Clear whatever was previously assigned to this physical button/axis
    if (btn === targetBtn) {
      delete updated[btn];
    }
    // 2. Clear previous assignments for this action:
    // If target is an axis (e.g. axis-0-neg), clear any other axis mapped to targetAction.
    // If target is a button (e.g. "0"), clear any other button mapped to targetAction (preserving stick axes).
    const isBtnAxis = btn.startsWith("axis");
    if (act.trim().toLowerCase() === targetAction) {
      if (isTargetAxis ? isBtnAxis : !isBtnAxis) {
        delete updated[btn];
      }
    }
  }

  updated[targetBtn] = targetAction;
  return updated;
}

/**
 * Converts a mouse button index (0..4) into a persistent binding token.
 */
export function mouseButtonToToken(button: number): string {
  switch (button) {
    case 0:
      return "Mouse0";
    case 1:
      return "Mouse1";
    case 2:
      return "Mouse2";
    case 3:
      return "Mouse3";
    case 4:
      return "Mouse4";
    default:
      return `Mouse${button}`;
  }
}

/**
 * Returns true if the key binding token represents a mouse button.
 */
export function isMouseBinding(key: string): boolean {
  return /^mouse[0-9]+$/i.test((key || "").trim());
}

export function formatKeyLabel(key: string): string {
  if (!key) return "—";
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();

  // Mouse button tokens
  if (lower === "mouse0") return "Mouse Left";
  if (lower === "mouse1") return "Mouse Mid";
  if (lower === "mouse2") return "Mouse Right";
  if (lower === "mouse3") return "Mouse 4";
  if (lower === "mouse4") return "Mouse 5";
  if (lower.startsWith("mouse")) {
    return `Mouse ${lower.replace("mouse", "")}`;
  }

  if (key === " ") return "Space";
  if (key === "ArrowUp") return "▲ Up Arrow";
  if (key === "ArrowDown") return "▼ Down Arrow";
  if (key === "ArrowLeft") return "◀ Left Arrow";
  if (key === "ArrowRight") return "▶ Right Arrow";
  if (key === "Enter") return "Enter";
  if (key === "Shift") return "Shift";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function buttonLabel(buttonIndex: number): string {
  const names: Record<number, string> = {
    0: "A / Cross",    1: "B / Circle",  2: "X / Square",  3: "Y / Triangle",
    4: "L1 / LB",      5: "R1 / RB",     6: "L2 / LT",     7: "R2 / RT",
    8: "Select / Back",9: "Start",       10: "L3",          11: "R3",
    12: "D-Up",        13: "D-Down",     14: "D-Left",      15: "D-Right",
    16: "Home",
  };
  return names[buttonIndex] ?? `Button ${buttonIndex}`;
}

// RetroPad button indices used by RetroArch / EmulatorJS
export const RETROPAD_BUTTON_IDS: Record<string, number> = {
  b: 0,
  y: 1,
  mode: 2,
  start: 3,
  up: 4,
  down: 5,
  left: 6,
  right: 7,
  c: 8,
  x: 9,
  a: 10,
  z: 11,
};

// D-Pad and Analog Left Stick button IDs for RetroPad
export const D_PAD_IDS: Record<string, number> = {
  up: 4,
  down: 5,
  left: 6,
  right: 7,
};

export const ANALOG_STICK_IDS: Record<string, number> = {
  up: 19,
  down: 18,
  left: 17,
  right: 16,
};

// Maps action name to RetroPad button index according to the active console core
export function getCoreActionToButtonId(core?: string): Record<string, number> {
  const normCore = (core || "segaMD").toLowerCase();

  if (normCore === "psx") {
    return {
      cross: 0,
      b: 0,
      square: 1,
      y: 1,
      select: 2,
      mode: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
      circle: 8,
      a: 8,
      triangle: 9,
      x: 9,
      l1: 10,
      l: 10,
      r1: 11,
      r: 11,
      l2: 12,
      r2: 13,
    };
  }

  if (normCore === "psp") {
    return {
      cross: 0,
      b: 0,
      square: 1,
      y: 1,
      select: 2,
      mode: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
      circle: 8,
      a: 8,
      triangle: 9,
      x: 9,
      l: 10,
      l1: 10,
      r: 11,
      r1: 11,
    };
  }

  if (normCore === "snes" || normCore === "nds") {
    return {
      b: 0,
      y: 1,
      select: 2,
      mode: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
      a: 8,
      x: 9,
      l: 10,
      l1: 10,
      r: 11,
      r1: 11,
    };
  }

  if (normCore === "gba" || normCore === "gb" || normCore === "nes") {
    return {
      b: 0,
      select: 2,
      mode: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
      a: 8,
      l: 10,
      r: 11,
    };
  }

  if (normCore === "n64") {
    return {
      b: 0,
      y: 1,
      select: 2,
      mode: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
      a: 8,
      x: 9,
      l: 10,
      r: 11,
      z: 12,
      l2: 12,
      r2: 13,
      "c-up": 19,
      "c-down": 18,
      "c-left": 17,
      "c-right": 16,
    };
  }

  if (normCore === "segams" || normCore === "segagg") {
    return {
      b: 0,
      a: 8,
      select: 2,
      mode: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
    };
  }

  if (normCore === "atari2600" || normCore === "atari") {
    return {
      b: 0,
      a: 0,
      mode: 2,
      select: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
    };
  }

  if (normCore === "arcade" || normCore === "mame" || normCore === "fbneo") {
    return {
      b: 0,
      a: 1,
      mode: 2,
      select: 2,
      start: 3,
      up: 4,
      down: 5,
      left: 6,
      right: 7,
      c: 8,
      y: 9,
      x: 10,
      z: 11,
    };
  }

  // Default: Sega Genesis / Mega Drive / Sega CD / Sega 32X
  return {
    b: 0,
    a: 1,
    mode: 2,
    select: 2,
    start: 3,
    up: 4,
    down: 5,
    left: 6,
    right: 7,
    c: 8,
    y: 9,
    x: 10,
    z: 11,
  };
}

// Backward compatible alias
export const EJS_ACTION_TO_BUTTON_ID: Record<string, number> = getCoreActionToButtonId("segaMD");

/**
 * Converts keyboard key name into a standard numeric JavaScript keyCode for EmulatorJS.
 */
export function keyNameToKeyCode(key: string): number {
  if (!key) return 0;
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();

  const SPECIAL: Record<string, number> = {
    arrowup: 38,
    arrowdown: 40,
    arrowleft: 37,
    arrowright: 39,
    enter: 13,
    return: 13,
    " ": 32,
    space: 32,
    spacebar: 32,
    shift: 16,
    shiftleft: 16,
    shiftright: 16,
    control: 17,
    ctrl: 17,
    controlleft: 17,
    controlright: 17,
    alt: 18,
    altleft: 18,
    altright: 18,
    tab: 9,
    backspace: 8,
    escape: 27,
    esc: 27,
    ",": 188,
    comma: 188,
    ".": 190,
    period: 190,
    "/": 191,
    slash: 191,
    ";": 186,
    semicolon: 186,
    "-": 189,
    minus: 189,
    "=": 187,
    equal: 187,
    equals: 187,
    "[": 219,
    "]": 221,
    "'": 222,
    quote: 222,
    "`": 192,
    backquote: 192,
    "\\": 220,
    backslash: 220,
  };

  if (SPECIAL[lower] !== undefined) return SPECIAL[lower];

  // Numpad 0-9 & Numpad operations
  const numpadMatch = lower.match(/^numpad(\d)$/);
  if (numpadMatch) {
    return 96 + parseInt(numpadMatch[1], 10);
  }
  if (lower === "numpadadd") return 107;
  if (lower === "numpadsubtract") return 109;
  if (lower === "numpadmultiply") return 106;
  if (lower === "numpaddivide") return 111;
  if (lower === "numpaddecimal") return 110;
  if (lower === "numpadenter") return 13;

  // Numbers 0-9
  const digitMatch = lower.match(/^(?:digit)?(\d)$/);
  if (digitMatch) {
    return 48 + parseInt(digitMatch[1], 10);
  }

  // Letters a-z
  const keyLetterMatch = lower.match(/^(?:key)?([a-z])$/);
  if (keyLetterMatch) {
    return 65 + (keyLetterMatch[1].charCodeAt(0) - 97);
  }

  // Fallback: if single character, uppercase charCode
  if (trimmed.length === 1) {
    return trimmed.toUpperCase().charCodeAt(0);
  }

  return 0;
}

/**
 * Synchronizes EmulatorJS native controls structure by locking all 4 ports (0..3)
 * to predefined non-overlapping internal virtual keycodes (1000..1329) for RetroPad button indices (0..23),
 * and clearing special indices (24..29: save/load state, fast-forward, rewind) to eliminate interference.
 */
export function syncEmulatorJSControls(
  _playerSlot?: number,
  _mapping?: KeyboardMapping,
  _core?: string,
): void {
  if (typeof window === "undefined") return;
  const win = window as unknown as {
    EJS_emulator?: {
      controls?: Record<number, Record<number, { value?: number | string }>>;
    };
  };
  const ejsControls = win.EJS_emulator?.controls;
  if (!ejsControls) return;

  for (let p = 0; p < 4; p++) {
    if (!ejsControls[p]) ejsControls[p] = {};
    for (let b = 0; b <= 23; b++) {
      if (!ejsControls[p][b]) ejsControls[p][b] = {};
      ejsControls[p][b].value = getInternalEmulatorKeyCode(p, b);
    }
    // Clear special EmulatorJS hotkeys (24..29: Save/Load State, Fast Forward, Rewind)
    for (let special = 24; special <= 29; special++) {
      if (ejsControls[p][special]) {
        delete ejsControls[p][special].value;
      }
    }
  }
}

/**
 * Simulates controller input into EmulatorJS directly via the C-core GameManager,
 * falling back to synthetic KeyboardEvents with isolated internal keycodes if the C-core is not ready.
 * Dual-routes directionals to both D-Pad and Left Analog Stick for PSX/N64.
 * Returns true when direct C-core input succeeded, or false when it fell back to KeyboardEvent.
 */
export function simulateEmulatorInput(
  playerIndex: number,
  action: string,
  isDown: boolean,
  core?: string,
): boolean {
  const activeCore = core || getRomCore() || "segaMD";
  const normAction = (action?.toLowerCase?.() || "").trim();
  const port = Math.max(0, Math.min(3, (Number(playerIndex) || 1) - 1));

  const win = window as unknown as {
    EJS_emulator?: {
      gameManager?: {
        simulateInput?: (player: number, index: number, value: number) => void;
        functions?: { simulateInput?: (player: number, index: number, value: number) => void };
      };
      elements?: { parent?: HTMLElement };
    };
    __lastSimulatedInput?: {
      port: number;
      playerIndex: number;
      action: string;
      btnId: number | undefined;
      isDown: boolean;
      activeCore: string;
      timestamp: number;
    };
  };

  const actionMap = getCoreActionToButtonId(activeCore);
  const btnId = actionMap[normAction];

  // Store debug diagnostic on window for E2E tests and debugging
  try {
    win.__lastSimulatedInput = {
      port,
      playerIndex,
      action: normAction,
      btnId,
      isDown,
      activeCore,
      timestamp: Date.now(),
    };
  } catch {}

  const gm = win.EJS_emulator?.gameManager;
  if (gm) {
    const sendToGm = (buttonIndex: number) => {
      try {
        if (typeof gm.simulateInput === "function") {
          gm.simulateInput(port, buttonIndex, isDown ? 1 : 0);
          return true;
        }
      } catch {}
      try {
        if (typeof gm.functions?.simulateInput === "function") {
          gm.functions.simulateInput(port, buttonIndex, isDown ? 1 : 0);
          return true;
        }
      } catch {}
      return false;
    };

    let sent = false;
    if (btnId !== undefined) {
      if (sendToGm(btnId)) {
        sent = true;
      }
    }

    // Dual-Route Directionals: When activeCore is n64 or psx, also send to Left Analog Stick!
    const isDirectional = normAction in D_PAD_IDS;
    if ((activeCore === "n64" || activeCore === "psx") && isDirectional) {
      const stickId = ANALOG_STICK_IDS[normAction];
      if (stickId !== undefined && stickId !== btnId) {
        if (sendToGm(stickId)) {
          sent = true;
        }
      }
    }

    if (sent) return true;
  }

  // Fallback: dispatch KeyboardEvent using player's assigned key mapping or synthesized key
  let keyAction = getPlayerActionKey(playerIndex, normAction, activeCore);
  if (!keyAction) {
    try {
      const userMapping = loadPlayerKeyboardMapping(playerIndex);
      const mappedKey = userMapping[normAction];
      if (mappedKey) {
        keyAction = {
          key: mappedKey,
          keyCode: 0,
          code: mappedKey.length === 1 ? `Key${mappedKey.toUpperCase()}` : mappedKey,
          label: normAction,
        };
      }
    } catch {}
  }

  if (!keyAction) {
    keyAction = {
      key: normAction,
      keyCode: 0,
      code: normAction,
      label: normAction,
    };
  }

  const internalKeyCode =
    btnId !== undefined
      ? getInternalEmulatorKeyCode(port, btnId)
      : (keyNameToKeyCode(keyAction.key) || keyAction.keyCode || 0);

  const target = win.EJS_emulator?.elements?.parent || document.getElementById("game") || window;
  const eventType = isDown ? "keydown" : "keyup";
  const event = new KeyboardEvent(eventType, {
    key: keyAction.key,
    code: keyAction.code,
    keyCode: internalKeyCode,
    which: internalKeyCode,
    bubbles: true,
    cancelable: true,
  });

  try {
    Object.defineProperty(event, "keyCode", { get: () => internalKeyCode });
    Object.defineProperty(event, "which", { get: () => internalKeyCode });
    Object.defineProperty(event, "__isInternalEmulatorKey", { value: true });
  } catch {}

  target.dispatchEvent(event);
  return false;
}



