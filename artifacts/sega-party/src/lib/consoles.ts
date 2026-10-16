export interface ConsoleSystem {
  id: string; // e.g. "segaMD", "psx", "snes", "nes", "gba", "gb", "n64", "segaCD", "sega32x", "segaMS", "segaGG", "arcade"
  name: string; // e.g. "Sony PlayStation 1"
  shortName: string; // e.g. "PS1"
  core: string; // e.g. "pcsx_rearmed", "mupen64plus_next", "genesis_plus_gx", "snes9x", etc.
  extensions: string[];
  badgeColor: string; // Tailwind styling for badge, e.g. "bg-blue-600/20 text-blue-400 border-blue-500/40"
  description: string;
  buttons: string[]; // List of face/shoulder action names for this console
}

export const SUPPORTED_CONSOLES: ConsoleSystem[] = [
  {
    id: "segaMD",
    name: "Sega Genesis / Mega Drive",
    shortName: "Genesis",
    core: "segaMD",
    extensions: [".md", ".gen", ".smd", ".bin"],
    badgeColor: "bg-blue-600/20 text-blue-400 border-blue-500/40",
    description: "16-bit Sega classic with 6-button arcade action",
    buttons: ["A", "B", "C", "X", "Y", "Z", "Start", "Mode"],
  },
  {
    id: "psx",
    name: "Sony PlayStation 1",
    shortName: "PS1",
    core: "psx",
    extensions: [".chd", ".pbp", ".iso", ".cue"],
    badgeColor: "bg-indigo-600/20 text-indigo-400 border-indigo-500/40",
    description: "32-bit 3D gaming pioneer with CD-quality audio",
    buttons: ["Cross", "Square", "Circle", "Triangle", "L1", "R1", "L2", "R2", "Select", "Start"],
  },
  {
    id: "snes",
    name: "Super Nintendo",
    shortName: "SNES",
    core: "snes",
    extensions: [".sfc", ".smc"],
    badgeColor: "bg-purple-600/20 text-purple-400 border-purple-500/40",
    description: "16-bit Nintendo powerhouse with Mode 7 graphics",
    buttons: ["A", "B", "X", "Y", "L", "R", "Select", "Start"],
  },
  {
    id: "n64",
    name: "Nintendo 64",
    shortName: "N64",
    core: "n64",
    extensions: [".z64", ".n64", ".v64"],
    badgeColor: "bg-emerald-600/20 text-emerald-400 border-emerald-500/40",
    description: "64-bit 3D multiplayer icon with analog precision",
    buttons: ["A", "B", "Z", "L", "R", "C-Up", "C-Down", "C-Left", "C-Right", "Start"],
  },
  {
    id: "gba",
    name: "Game Boy Advance",
    shortName: "GBA",
    core: "gba",
    extensions: [".gba"],
    badgeColor: "bg-cyan-600/20 text-cyan-400 border-cyan-500/40",
    description: "32-bit portable powerhouse with vibrant 2D sprites",
    buttons: ["A", "B", "L", "R", "Select", "Start"],
  },
  {
    id: "gb",
    name: "Game Boy / Color",
    shortName: "GB",
    core: "gb",
    extensions: [".gb", ".gbc"],
    badgeColor: "bg-amber-600/20 text-amber-400 border-amber-500/40",
    description: "8-bit handheld legends in monochrome and color",
    buttons: ["A", "B", "Select", "Start"],
  },
  {
    id: "nes",
    name: "NES / Famicom",
    shortName: "NES",
    core: "nes",
    extensions: [".nes"],
    badgeColor: "bg-red-600/20 text-red-400 border-red-500/40",
    description: "8-bit pioneer that redefined home console gaming",
    buttons: ["A", "B", "Select", "Start"],
  },
  {
    id: "segaCD",
    name: "Sega CD",
    shortName: "Sega CD",
    core: "segaCD",
    extensions: [".chd", ".iso"],
    badgeColor: "bg-sky-600/20 text-sky-400 border-sky-500/40",
    description: "CD-ROM upgrade for Genesis featuring FMV and CD sound",
    buttons: ["A", "B", "C", "X", "Y", "Z", "Start", "Mode"],
  },
  {
    id: "sega32x",
    name: "Sega 32X",
    shortName: "32X",
    core: "sega32x",
    extensions: [".32x"],
    badgeColor: "bg-yellow-600/20 text-yellow-400 border-yellow-500/40",
    description: "32-bit twin RISC cartridge hardware add-on",
    buttons: ["A", "B", "C", "X", "Y", "Z", "Start", "Mode"],
  },
  {
    id: "segaMS",
    name: "Sega Master System",
    shortName: "SMS",
    core: "segaMS",
    extensions: [".sms"],
    badgeColor: "bg-teal-600/20 text-teal-400 border-teal-500/40",
    description: "8-bit Sega classic with crisp color graphics",
    buttons: ["1", "2"],
  },
  {
    id: "segaGG",
    name: "Sega Game Gear",
    shortName: "Game Gear",
    core: "segaGG",
    extensions: [".gg"],
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-400/40",
    description: "Full-color portable Sega console",
    buttons: ["1", "2", "Start"],
  },
  {
    id: "arcade",
    name: "Arcade / FBNeo",
    shortName: "Arcade",
    core: "arcade",
    extensions: [".zip"],
    badgeColor: "bg-orange-600/20 text-orange-400 border-orange-500/40",
    description: "Coin-op arcade emulation powered by FinalBurn Neo",
    buttons: ["Fire 1", "Fire 2", "Fire 3", "Fire 4", "Coin", "Start"],
  },
];

export function getConsoleSystem(coreId: string): ConsoleSystem {
  const match = SUPPORTED_CONSOLES.find((c) => c.id === coreId || c.core === coreId);
  return match || SUPPORTED_CONSOLES[0]; // defaults to segaMD
}

export function detectConsoleFromFilename(filename: string): ConsoleSystem {
  const name = (filename || "").toLowerCase().trim();
  const dotIdx = name.lastIndexOf(".");
  const ext = dotIdx !== -1 ? name.slice(dotIdx) : "";

  if (ext === ".z64" || ext === ".n64" || ext === ".v64") {
    return getConsoleSystem("n64");
  }
  if (ext === ".sfc" || ext === ".smc") {
    return getConsoleSystem("snes");
  }
  if (ext === ".nes") {
    return getConsoleSystem("nes");
  }
  if (ext === ".gba") {
    return getConsoleSystem("gba");
  }
  if (ext === ".gb" || ext === ".gbc") {
    return getConsoleSystem("gb");
  }
  if (ext === ".sms") {
    return getConsoleSystem("segaMS");
  }
  if (ext === ".gg") {
    return getConsoleSystem("segaGG");
  }
  if (ext === ".32x") {
    return getConsoleSystem("sega32x");
  }
  if (ext === ".pbp") {
    return getConsoleSystem("psx");
  }
  if (ext === ".chd") {
    return /sega.*cd|segacd|mega.*cd/i.test(name)
      ? getConsoleSystem("segaCD")
      : getConsoleSystem("psx");
  }
  if (ext === ".iso" || ext === ".cue") {
    return /sega.*cd|segacd|mega.*cd/i.test(name)
      ? getConsoleSystem("segaCD")
      : getConsoleSystem("psx");
  }
  if (ext === ".zip") {
    return getConsoleSystem("arcade");
  }
  if (ext === ".md" || ext === ".gen" || ext === ".smd" || ext === ".bin") {
    return getConsoleSystem("segaMD");
  }
  return getConsoleSystem("segaMD");
}

export function detectCueWarning(filename: string): boolean {
  return (filename || "").toLowerCase().trim().endsWith(".cue");
}
