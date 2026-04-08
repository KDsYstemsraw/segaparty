export interface GameAction {
  key: string;
  keyCode: number;
  code: string;
  label: string;
}

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

// Maps gamepad button index → action name. Axis entries use "axis-0-neg" etc.
export type GamepadMapping = Record<string, string>;

export const DEFAULT_MAPPING: GamepadMapping = {
  "0":  "b",      // South (A / Cross)
  "1":  "c",      // East  (B / Circle)
  "2":  "a",      // West  (X / Square)
  "3":  "y",      // North (Y / Triangle)
  "4":  "x",      // L1 / LB
  "5":  "z",      // R1 / RB
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
