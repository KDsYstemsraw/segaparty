export interface SampleRom {
  id: string;
  name: string;
  category: string;
  players: string;
  description: string;
  url: string;
  badge: string;
}

export const SAMPLE_ROMS: SampleRom[] = [
  {
    id: "sonic2-demo",
    name: "Sonic the Hedgehog 2 (Multiplayer Demo)",
    category: "Platformer",
    players: "2 Players (Split-Screen)",
    description: "Classic split-screen head-to-head race between Sonic and Tails. Supports 2 controllers.",
    url: "https://raw.githubusercontent.com/demoscene-archive/sega-roms/main/demos/sonic2_demo.bin",
    badge: "2-Player Split Screen",
  },
  {
    id: "mega-pong",
    name: "Mega Pong 2P (Genesis Homebrew)",
    category: "Arcade / Sports",
    players: "1-2 Players",
    description: "Fast-paced 2-player retro arcade paddle battle with power-ups and stereo sound effects.",
    url: "https://raw.githubusercontent.com/demoscene-archive/sega-roms/main/demos/megapong.bin",
    badge: "2 Players",
  },
  {
    id: "space-shooter-4p",
    name: "Cosmic Blast 4-Way Party",
    category: "Action Shooter",
    players: "1-4 Players (Multitap)",
    description: "Retro multi-tap 4-player cooperative and vs space arena combat.",
    url: "https://raw.githubusercontent.com/demoscene-archive/sega-roms/main/demos/spaceblast.bin",
    badge: "4 Players Multitap",
  },
  {
    id: "240p-suite",
    name: "240p Test Suite & Controller Diagnostic",
    category: "Utility",
    players: "1-4 Controllers",
    description: "Calibration suite and input latency tester. Test all 4 controllers, audio panning, and 240p video timing.",
    url: "https://raw.githubusercontent.com/demoscene-archive/sega-roms/main/demos/240pSuite.bin",
    badge: "Controller Test",
  },
];
