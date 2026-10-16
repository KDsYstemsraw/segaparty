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

export function getPlayerActionKey(playerIndex: number, actionName: string): GameAction | null {
  const slotMap = PLAYER_KEY_MAPPINGS[playerIndex] || PLAYER_KEY_MAPPINGS[1];
  return slotMap[actionName] || null;
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

const STORAGE_KEY = "sega-party-gamepad-mapping";

export function loadMapping(): GamepadMapping {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_MAPPING, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_MAPPING };
}

export function saveMapping(mapping: GamepadMapping): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gamepad-mapping-changed"));
  }
}

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
  start: "Enter",
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
  start: "Enter",
  mode: "Shift",
};

const KEYBOARD_STORAGE_KEY = "sega-party-keyboard-mapping";

export function loadKeyboardMapping(): KeyboardMapping {
  try {
    const stored = localStorage.getItem(KEYBOARD_STORAGE_KEY);
    if (stored) return { ...DEFAULT_KEYBOARD_MAPPING, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_KEYBOARD_MAPPING };
}

export function saveKeyboardMapping(mapping: KeyboardMapping): void {
  localStorage.setItem(KEYBOARD_STORAGE_KEY, JSON.stringify(mapping));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("keyboard-mapping-changed"));
  }
}

export function formatKeyLabel(key: string): string {
  if (!key) return "—";
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

// Maps Sega Genesis action name to EmulatorJS / RetroPad button index (0..11)
export const EJS_ACTION_TO_BUTTON_ID: Record<string, number> = {
  b: 0,
  a: 1,
  mode: 2,
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

/**
 * Simulates controller input into EmulatorJS directly via the C-core GameManager,
 * falling back to synthetic KeyboardEvents if the C-core is not ready.
 * Returns true when direct C-core input succeeded, or false when it fell back to KeyboardEvent.
 */
export function simulateEmulatorInput(playerIndex: number, action: string, isDown: boolean): boolean {
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
      timestamp: number;
    };
  };

  const btnId = EJS_ACTION_TO_BUTTON_ID[normAction];

  // Store debug diagnostic on window for E2E tests and debugging
  try {
    win.__lastSimulatedInput = {
      port,
      playerIndex,
      action: normAction,
      btnId,
      isDown,
      timestamp: Date.now(),
    };
  } catch {}

  const gm = win.EJS_emulator?.gameManager;
  if (btnId !== undefined && gm) {
    try {
      if (typeof gm.functions?.simulateInput === "function") {
        gm.functions.simulateInput(port, btnId, isDown ? 1 : 0);
        return true;
      }
      if (typeof gm.simulateInput === "function") {
        gm.simulateInput(port, btnId, isDown ? 1 : 0);
        return true;
      }
    } catch {}
  }

  // Fallback: dispatch KeyboardEvent using player's assigned key mapping
  const keyAction = getPlayerActionKey(playerIndex, normAction);
  if (!keyAction) return false;

  const target = win.EJS_emulator?.elements?.parent || document.getElementById("game") || window;
  const eventType = isDown ? "keydown" : "keyup";
  const event = new KeyboardEvent(eventType, {
    key: keyAction.key,
    code: keyAction.code,
    keyCode: keyAction.keyCode,
    which: keyAction.keyCode,
    bubbles: true,
    cancelable: true,
  });

  try {
    Object.defineProperty(event, "keyCode", { get: () => keyAction.keyCode });
    Object.defineProperty(event, "which", { get: () => keyAction.keyCode });
  } catch {}

  target.dispatchEvent(event);
  return false;
}



