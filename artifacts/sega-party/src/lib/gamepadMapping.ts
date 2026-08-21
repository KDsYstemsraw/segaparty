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

