import React from "react";
import { SUPPORTED_CONSOLES, ConsoleSystem, getConsoleSystem } from "@/lib/consoles";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Gamepad2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConsoleShowcaseProps {
  selectedCore: string;
  onSelectCore: (coreId: string) => void;
  detectedCore?: string;
  className?: string;
}

interface ConsoleCardMeta {
  id: string;
  generation: string;
  specs: string;
  accentGlow: string;
  svgIllustration: React.ReactNode;
}

const CONSOLE_METAS: Record<string, ConsoleCardMeta> = {
  psx: {
    id: "psx",
    generation: "5th Gen · 32-Bit",
    specs: "33.8 MHz MIPS R3000A · CD-ROM Audio",
    accentGlow: "rgba(99, 102, 241, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 140 85" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="ps1_chassis" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d1d5db" />
            <stop offset="40%" stopColor="#9ca3af" />
            <stop offset="100%" stopColor="#6b7280" />
          </linearGradient>
          <linearGradient id="ps1_topDeck" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3f4f6" />
            <stop offset="60%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <radialGradient id="ps1_lid" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="70%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
          <linearGradient id="ps1_laser" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <radialGradient id="ps1_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Neon Underglow */}
        <ellipse cx="70" cy="72" rx="60" ry="10" fill="url(#ps1_glow)" />

        {/* Beveled Main Chassis Base */}
        <rect x="10" y="14" width="120" height="56" rx="8" fill="url(#ps1_chassis)" stroke="#4b5563" strokeWidth="1.2" />
        <rect x="12" y="15" width="116" height="52" rx="7" fill="url(#ps1_topDeck)" />

        {/* Left & Right Ventilation Slots */}
        <g stroke="#64748b" strokeWidth="1" strokeLinecap="round" opacity="0.7">
          <line x1="16" y1="26" x2="26" y2="26" />
          <line x1="16" y1="30" x2="26" y2="30" />
          <line x1="16" y1="34" x2="26" y2="34" />
          <line x1="114" y1="26" x2="124" y2="26" />
          <line x1="114" y1="30" x2="124" y2="30" />
          <line x1="114" y1="34" x2="124" y2="34" />
        </g>

        {/* Circular CD-ROM Drive Lid */}
        <circle cx="70" cy="40" r="23" fill="url(#ps1_lid)" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="70" cy="40" r="19" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />

        {/* Spinning Iridescent Laser Hologram Ring */}
        <circle
          cx="70"
          cy="40"
          r="15"
          fill="none"
          stroke="url(#ps1_laser)"
          strokeWidth="1.8"
          strokeDasharray="6 3"
          className="animate-[spin_8s_linear_infinite]"
        />
        <circle cx="70" cy="40" r="10" fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 2" />
        <circle cx="70" cy="40" r="5" fill="#38bdf8" opacity="0.8" />
        <circle cx="70" cy="40" r="2" fill="#ffffff" />

        {/* Power Button & Green LED (Left) */}
        <circle cx="28" cy="50" r="5" fill="#475569" stroke="#334155" strokeWidth="1" />
        <circle cx="28" cy="50" r="2.5" fill="#22c55e" className="animate-pulse" />
        <text x="28" y="58" fill="#475569" fontSize="4" fontWeight="bold" textAnchor="middle">POWER</text>

        {/* Reset Button (Upper Left) */}
        <circle cx="28" cy="30" r="3" fill="#64748b" stroke="#475569" strokeWidth="0.8" />

        {/* Open Button (Right) */}
        <circle cx="112" cy="50" r="5" fill="#475569" stroke="#334155" strokeWidth="1" />
        <circle cx="112" cy="50" r="2.5" fill="#64748b" />
        <text x="112" y="58" fill="#475569" fontSize="4" fontWeight="bold" textAnchor="middle">OPEN</text>

        {/* Front Face: Dual Controller Ports & Memory Card Slots */}
        <rect x="38" y="62" width="28" height="7" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
        <rect x="42" y="58" width="20" height="3" rx="0.8" fill="#0f172a" />
        <circle cx="46" cy="65.5" r="1.2" fill="#94a3b8" />
        <circle cx="52" cy="65.5" r="1.2" fill="#94a3b8" />
        <circle cx="58" cy="65.5" r="1.2" fill="#94a3b8" />

        <rect x="74" y="62" width="28" height="7" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
        <rect x="78" y="58" width="20" height="3" rx="0.8" fill="#0f172a" />
        <circle cx="82" cy="65.5" r="1.2" fill="#94a3b8" />
        <circle cx="88" cy="65.5" r="1.2" fill="#94a3b8" />
        <circle cx="94" cy="65.5" r="1.2" fill="#94a3b8" />
      </svg>
    ),
  },
  n64: {
    id: "n64",
    generation: "5th Gen · 64-Bit",
    specs: "93.75 MHz VR4300 · 4 Controller Ports",
    accentGlow: "rgba(16, 185, 129, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 140 85" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="n64_body" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="40%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>
          <linearGradient id="n64_ridge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="50%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#52525b" />
          </linearGradient>
          <radialGradient id="n64_portGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </radialGradient>
          <radialGradient id="n64_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Emerald Underglow */}
        <ellipse cx="70" cy="74" rx="60" ry="10" fill="url(#n64_glow)" />

        {/* N64 Iconic Curved Chassis Silhouette */}
        <path
          d="M 14 36 C 18 16 38 12 70 12 C 102 12 122 16 126 36 L 130 64 C 130 68 124 70 118 70 L 22 70 C 16 70 10 68 10 64 Z"
          fill="url(#n64_body)"
          stroke="#52525b"
          strokeWidth="1.2"
        />

        {/* Cartridge Bay with Dust Flaps & Gold Connectors */}
        <rect x="38" y="18" width="64" height="15" rx="3" fill="#09090b" stroke="#10b981" strokeWidth="1" />
        <rect x="44" y="23" width="52" height="5" rx="1" fill="#10b981" opacity="0.6" />
        <line x1="48" y1="25.5" x2="92" y2="25.5" stroke="#facc15" strokeWidth="1" strokeDasharray="3 2" />

        {/* Memory Expansion Pak Jumper Bay Cover */}
        <rect x="52" y="36" width="36" height="12" rx="2" fill="#18181b" stroke="#3f3f46" strokeWidth="0.8" />
        <g stroke="#3f3f46" strokeWidth="0.8">
          <line x1="56" y1="39" x2="84" y2="39" />
          <line x1="56" y1="42" x2="84" y2="42" />
          <line x1="56" y1="45" x2="84" y2="45" />
        </g>

        {/* Red Faceted Jewel Power Indicator */}
        <circle cx="70" cy="53" r="3" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" className="animate-pulse" />
        <circle cx="69" cy="52" r="0.8" fill="#ffffff" />

        {/* Power & Reset Switches */}
        <rect x="22" y="44" width="8" height="6" rx="1" fill="#3f3f46" stroke="#27272a" strokeWidth="0.6" />
        <rect x="110" y="44" width="8" height="6" rx="1" fill="#3f3f46" stroke="#27272a" strokeWidth="0.6" />

        {/* 4 Front Controller Ports with Cyan/Emerald Glowing Rings */}
        <g>
          {[28, 56, 84, 112].map((x, i) => (
            <g key={i}>
              <circle cx={x} cy="62" r="5" fill="#09090b" stroke="url(#n64_portGlow)" strokeWidth="1" />
              <circle cx={x - 1.8} cy="61" r="0.8" fill="#10b981" />
              <circle cx={x + 1.8} cy="61" r="0.8" fill="#10b981" />
              <circle cx={x} cy="63.5" r="0.8" fill="#10b981" />
            </g>
          ))}
        </g>
      </svg>
    ),
  },
  snes: {
    id: "snes",
    generation: "4th Gen · 16-Bit",
    specs: "3.58 MHz 65C816 · Mode 7 Graphics",
    accentGlow: "rgba(168, 85, 247, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 140 85" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="snes_light" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="snes_dark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="snes_purple" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <radialGradient id="snes_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Purple Underglow */}
        <ellipse cx="70" cy="72" rx="60" ry="10" fill="url(#snes_glow)" />

        {/* Lower Light Grey Base Chassis */}
        <rect x="12" y="16" width="116" height="54" rx="7" fill="url(#snes_light)" stroke="#64748b" strokeWidth="1.2" />

        {/* Upper Sculpted Recessed Deck */}
        <rect x="22" y="18" width="96" height="34" rx="5" fill="url(#snes_dark)" stroke="#475569" strokeWidth="0.8" />

        {/* Cartridge Bay with Dust Flaps */}
        <rect x="34" y="24" width="72" height="14" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
        <rect x="38" y="28" width="64" height="6" rx="1" fill="#0f172a" />
        <line x1="42" y1="31" x2="98" y2="31" stroke="#8b5cf6" strokeWidth="0.8" opacity="0.8" />

        {/* Eject Lever Strip in Center */}
        <rect x="52" y="42" width="36" height="6" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
        <text x="70" y="46.5" fill="#475569" fontSize="3.5" fontWeight="black" textAnchor="middle">EJECT</text>

        {/* Left Purple Slide Switch (POWER) */}
        <rect x="26" y="48" width="14" height="11" rx="2" fill="url(#snes_purple)" stroke="#5b21b6" strokeWidth="0.8" />
        <rect x="28" y="52" width="10" height="3" rx="0.5" fill="#4c1d95" />
        <text x="33" y="63" fill="#6d28d9" fontSize="3.5" fontWeight="bold" textAnchor="middle">POWER</text>

        {/* Red Illuminated Power LED */}
        <circle cx="46" cy="54" r="2.2" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.6" className="animate-pulse" />

        {/* Right Purple Slide Switch (RESET) */}
        <rect x="100" y="48" width="14" height="11" rx="2" fill="url(#snes_purple)" stroke="#5b21b6" strokeWidth="0.8" />
        <rect x="102" y="52" width="10" height="3" rx="0.5" fill="#4c1d95" />
        <text x="107" y="63" fill="#6d28d9" fontSize="3.5" fontWeight="bold" textAnchor="middle">RESET</text>

        {/* Front 7-Pin Controller Ports */}
        <rect x="54" y="58" width="14" height="8" rx="2" fill="#334155" stroke="#475569" strokeWidth="0.8" />
        <circle cx="58" cy="61" r="0.7" fill="#cbd5e1" />
        <circle cx="61" cy="61" r="0.7" fill="#cbd5e1" />
        <circle cx="64" cy="61" r="0.7" fill="#cbd5e1" />
        <circle cx="59.5" cy="63.5" r="0.7" fill="#cbd5e1" />
        <circle cx="62.5" cy="63.5" r="0.7" fill="#cbd5e1" />

        <rect x="72" y="58" width="14" height="8" rx="2" fill="#334155" stroke="#475569" strokeWidth="0.8" />
        <circle cx="76" cy="61" r="0.7" fill="#cbd5e1" />
        <circle cx="79" cy="61" r="0.7" fill="#cbd5e1" />
        <circle cx="82" cy="61" r="0.7" fill="#cbd5e1" />
        <circle cx="77.5" cy="63.5" r="0.7" fill="#cbd5e1" />
        <circle cx="80.5" cy="63.5" r="0.7" fill="#cbd5e1" />
      </svg>
    ),
  },
  segaMD: {
    id: "segaMD",
    generation: "4th Gen · 16-Bit",
    specs: "7.67 MHz Motorola 68000 · YM2612 FM",
    accentGlow: "rgba(59, 130, 246, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 140 85" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="gen_chassis" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="50%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
          <linearGradient id="gen_gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#eab308" />
            <stop offset="70%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </linearGradient>
          <radialGradient id="gen_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Sega Blue Underglow */}
        <ellipse cx="70" cy="72" rx="60" ry="10" fill="url(#gen_glow)" />

        {/* Model 1 Matte Black Chassis */}
        <rect x="10" y="14" width="120" height="56" rx="8" fill="url(#gen_chassis)" stroke="#3f3f46" strokeWidth="1.2" />

        {/* Left Side Ventilation Grill Lines */}
        <g stroke="#27272a" strokeWidth="1.2">
          <line x1="16" y1="20" x2="34" y2="20" />
          <line x1="16" y1="24" x2="34" y2="24" />
          <line x1="16" y1="28" x2="34" y2="28" />
        </g>

        {/* Elevated Circular Pedestal with Iconic Metallic 16-BIT Ring */}
        <circle cx="68" cy="40" r="23" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
        <circle cx="68" cy="40" r="21" fill="none" stroke="url(#gen_gold)" strokeWidth="2.5" />
        <text
          x="68"
          y="28"
          fill="#facc15"
          fontSize="6.5"
          fontWeight="900"
          textAnchor="middle"
          letterSpacing="1.2"
          fontFamily="monospace"
        >
          16-BIT
        </text>

        {/* Cartridge Slot with Dark Flaps */}
        <rect x="42" y="34" width="52" height="12" rx="2" fill="#09090b" stroke="#52525b" strokeWidth="1" />
        <rect x="46" y="38" width="44" height="4" rx="1" fill="#18181b" />
        <line x1="48" y1="40" x2="88" y2="40" stroke="#dc2626" strokeWidth="0.8" />

        {/* Headphone Volume Slider & Mini-Jack */}
        <rect x="22" y="34" width="5" height="18" rx="1" fill="#09090b" stroke="#3f3f46" strokeWidth="0.6" />
        <rect x="21" y="42" width="7" height="4" rx="1" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.6" />
        <circle cx="24.5" cy="56" r="2.2" fill="#09090b" stroke="#52525b" strokeWidth="0.6" />

        {/* Power LED (Red) */}
        <circle cx="34" cy="56" r="2.2" fill="#ef4444" stroke="#991b1b" strokeWidth="0.6" className="animate-pulse" />

        {/* Power Toggle Switch */}
        <rect x="18" y="20" width="10" height="7" rx="1" fill="#3f3f46" stroke="#52525b" strokeWidth="0.8" />

        {/* Red Reset Button */}
        <circle cx="114" cy="46" r="5" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
        <circle cx="114" cy="46" r="3" fill="#ef4444" />
        <text x="114" y="56" fill="#71717a" fontSize="3.5" fontWeight="bold" textAnchor="middle">RESET</text>

        {/* Front 9-Pin Controller Ports */}
        <rect x="44" y="60" width="20" height="7" rx="2" fill="#09090b" stroke="#3f3f46" strokeWidth="0.8" />
        <rect x="72" y="60" width="20" height="7" rx="2" fill="#09090b" stroke="#3f3f46" strokeWidth="0.8" />
      </svg>
    ),
  },
  gba: {
    id: "gba",
    generation: "6th Gen · 32-Bit",
    specs: "16.78 MHz ARM7TDMI · Wide TFT Color",
    accentGlow: "rgba(6, 182, 212, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 140 85" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="gba_body" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4338ca" />
            <stop offset="50%" stopColor="#3730a3" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
          <linearGradient id="gba_screen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </linearGradient>
          <linearGradient id="gba_btn" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>
          <radialGradient id="gba_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Cyan Underglow */}
        <ellipse cx="70" cy="72" rx="60" ry="10" fill="url(#gba_glow)" />

        {/* Indigo Horizontal Ergonomic Handheld Body */}
        <path
          d="M 18 20 C 10 20 6 30 6 42 C 6 56 12 62 22 62 L 118 62 C 128 62 134 56 134 42 C 134 30 130 20 122 20 Z"
          fill="url(#gba_body)"
          stroke="#6366f1"
          strokeWidth="1.5"
        />

        {/* L and R Shoulder Bumper Buttons */}
        <path d="M 14 18 C 16 12 28 12 36 14 L 34 20 L 14 20 Z" fill="#c7d2fe" stroke="#6366f1" strokeWidth="0.8" />
        <path d="M 126 18 C 124 12 112 12 104 14 L 106 20 L 126 20 Z" fill="#c7d2fe" stroke="#6366f1" strokeWidth="0.8" />

        {/* Widescreen Bezel */}
        <rect x="36" y="20" width="68" height="38" rx="4" fill="#0f172a" stroke="#4f46e5" strokeWidth="1" />

        {/* Illuminated 3:2 Display with Cyber Scanlines */}
        <rect x="40" y="23" width="60" height="32" rx="2" fill="url(#gba_screen)" />
        <g stroke="#38bdf8" strokeWidth="0.5" opacity="0.3">
          <line x1="40" y1="28" x2="100" y2="28" />
          <line x1="40" y1="33" x2="100" y2="33" />
          <line x1="40" y1="38" x2="100" y2="38" />
          <line x1="40" y1="43" x2="100" y2="43" />
          <line x1="40" y1="48" x2="100" y2="48" />
        </g>

        {/* Screen Glass Sheen Streak */}
        <polygon points="40,23 70,23 55,55 40,55" fill="#ffffff" opacity="0.1" />

        {/* D-Pad on Left Side */}
        <g fill="#1e1b4b" stroke="#312e81" strokeWidth="0.8">
          <rect x="16" y="36" width="12" height="5" rx="1" />
          <rect x="19.5" y="32.5" width="5" height="12" rx="1" />
          <circle cx="22" cy="38.5" r="1.5" fill="#312e81" />
        </g>

        {/* Magenta A/B Action Buttons on Right Side */}
        <g>
          <circle cx="118" cy="35" r="4.2" fill="url(#gba_btn)" stroke="#9d174d" strokeWidth="0.8" />
          <text x="118" y="37.5" fill="#ffffff" fontSize="4.5" fontWeight="black" textAnchor="middle">A</text>
          <circle cx="110" cy="43" r="4.2" fill="url(#gba_btn)" stroke="#9d174d" strokeWidth="0.8" />
          <text x="110" y="45.5" fill="#ffffff" fontSize="4.5" fontWeight="black" textAnchor="middle">B</text>
        </g>

        {/* Start / Select Buttons */}
        <rect x="48" y="59" width="7" height="2.2" rx="1" fill="#1e1b4b" transform="rotate(-25 48 59)" />
        <rect x="62" y="59" width="7" height="2.2" rx="1" fill="#1e1b4b" transform="rotate(-25 62 59)" />

        {/* Power LED Indicator */}
        <circle cx="98" cy="21.5" r="1.5" fill="#22c55e" className="animate-pulse" />
      </svg>
    ),
  },
  arcade: {
    id: "arcade",
    generation: "Coin-Op Arcade",
    specs: "FinalBurn Neo Multi-CPU · 60 FPS Stereo",
    accentGlow: "rgba(249, 115, 22, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 140 85" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="arc_cab" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="50%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
          <linearGradient id="arc_marquee" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#fde047" />
            <stop offset="75%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="arc_crt" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="40%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <radialGradient id="arc_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Neon Orange Underglow */}
        <ellipse cx="70" cy="74" rx="60" ry="10" fill="url(#arc_glow)" />

        {/* Upright Cabinet Hull Silhouette */}
        <path
          d="M 22 10 L 118 10 L 126 30 L 128 66 L 12 66 L 14 30 Z"
          fill="url(#arc_cab)"
          stroke="#f97316"
          strokeWidth="1.5"
        />

        {/* Glowing Backlit Marquee Sign */}
        <rect x="26" y="12" width="88" height="16" rx="3" fill="url(#arc_marquee)" stroke="#ffedd5" strokeWidth="1" />
        <text
          x="70"
          y="23.5"
          fill="#09090b"
          fontSize="9"
          fontWeight="900"
          textAnchor="middle"
          letterSpacing="2.5"
          fontFamily="monospace"
        >
          ARCADE
        </text>

        {/* Curved 4:3 CRT Screen Bezel */}
        <rect x="34" y="32" width="72" height="23" rx="4" fill="#030712" stroke="#38bdf8" strokeWidth="1.2" />
        <rect x="36" y="34" width="68" height="19" rx="3" fill="url(#arc_crt)" opacity="0.85" />

        {/* CRT Scanlines */}
        <g stroke="#38bdf8" strokeWidth="0.5" opacity="0.4">
          <line x1="36" y1="37" x2="104" y2="37" />
          <line x1="36" y1="41" x2="104" y2="41" />
          <line x1="36" y1="45" x2="104" y2="45" />
          <line x1="36" y1="49" x2="104" y2="49" />
        </g>

        {/* Control Panel Deck (Angled Shelf) */}
        <polygon points="18,58 122,58 126,72 14,72" fill="#18181b" stroke="#52525b" strokeWidth="1" />

        {/* Player 1 Joystick (Red Ball-Top) */}
        <line x1="32" y1="65" x2="32" y2="60" stroke="#cbd5e1" strokeWidth="1.8" />
        <circle cx="32" cy="65" r="2.5" fill="#09090b" />
        <circle cx="32" cy="59" r="3.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" />

        {/* Player 1 Action Buttons */}
        <circle cx="44" cy="62" r="1.8" fill="#3b82f6" />
        <circle cx="49" cy="62" r="1.8" fill="#ef4444" />
        <circle cx="54" cy="62" r="1.8" fill="#eab308" />
        <circle cx="44" cy="67" r="1.8" fill="#10b981" />
        <circle cx="49" cy="67" r="1.8" fill="#a855f7" />
        <circle cx="54" cy="67" r="1.8" fill="#06b6d4" />

        {/* Player 2 Joystick (Blue Ball-Top) */}
        <line x1="84" y1="65" x2="84" y2="60" stroke="#cbd5e1" strokeWidth="1.8" />
        <circle cx="84" cy="65" r="2.5" fill="#09090b" />
        <circle cx="84" cy="59" r="3.5" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.8" />

        {/* Player 2 Action Buttons */}
        <circle cx="96" cy="62" r="1.8" fill="#3b82f6" />
        <circle cx="101" cy="62" r="1.8" fill="#ef4444" />
        <circle cx="106" cy="62" r="1.8" fill="#eab308" />
        <circle cx="96" cy="67" r="1.8" fill="#10b981" />
        <circle cx="101" cy="67" r="1.8" fill="#a855f7" />
        <circle cx="106" cy="67" r="1.8" fill="#06b6d4" />
      </svg>
    ),
  },
};

const FEATURED_CONSOLE_IDS = ["psx", "n64", "snes", "segaMD", "gba", "arcade"];

function ConsoleVisual({ meta }: { meta: ConsoleCardMeta }) {
  return (
    <div className="w-full h-18 sm:h-20 flex items-center justify-center p-0.5 transition-transform duration-300 group-hover:scale-105">
      {meta.svgIllustration}
    </div>
  );
}

export function ConsoleShowcase({
  selectedCore,
  onSelectCore,
  detectedCore,
  className,
}: ConsoleShowcaseProps) {
  return (
    <div className={cn("space-y-3 font-sans", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Gamepad2 className="w-3.5 h-3.5 text-primary" />
          Choose Emulation Platform
        </label>
        {detectedCore && (
          <span className="text-[10px] font-sans font-bold text-accent flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Auto-detected: {getConsoleSystem(detectedCore).shortName}
          </span>
        )}
      </div>

      {/* High-Detail Vector Console Deck Showcase Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {FEATURED_CONSOLE_IDS.map((coreId) => {
          const sys = getConsoleSystem(coreId);
          const meta = CONSOLE_METAS[coreId];
          const isSelected = selectedCore === coreId;
          const isDetected = detectedCore === coreId;

          return (
            <button
              key={coreId}
              type="button"
              onClick={() => onSelectCore(coreId)}
              style={{
                boxShadow: isSelected ? `0 0 20px ${meta.accentGlow}` : undefined,
              }}
              className={cn(
                "group relative p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between overflow-hidden",
                isSelected
                  ? "border-primary bg-card/90 ring-2 ring-primary scale-[1.02]"
                  : "border-border/70 bg-card/40 hover:border-primary/50 hover:bg-card/70 hover:scale-[1.01]",
              )}
            >
              {/* Subtle Ambient Glow Pill */}
              <div
                className="absolute -top-8 -right-8 w-16 h-16 rounded-full blur-xl opacity-30 pointer-events-none transition-opacity group-hover:opacity-60"
                style={{ backgroundColor: meta.accentGlow }}
              />

              {/* Header Badges */}
              <div className="flex items-center justify-between w-full mb-1 z-10">
                <Badge
                  variant="outline"
                  className={cn("text-[9px] font-bold py-0 px-1 uppercase tracking-wider", sys.badgeColor)}
                >
                  {sys.shortName}
                </Badge>
                {isDetected ? (
                  <span className="text-[9px] text-accent font-bold font-mono flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Auto
                  </span>
                ) : isSelected ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : null}
              </div>

              {/* Unified High-Detail Isometric Vector Visual */}
              <div className="my-1.5 flex items-center justify-center z-10">
                <ConsoleVisual meta={meta} />
              </div>

              {/* Title & Generation Info */}
              <div className="space-y-0.5 z-10">
                <h4 className="text-xs font-bold text-foreground truncate font-display tracking-wide">
                  {sys.shortName}
                </h4>
                <p className="text-[9px] text-muted-foreground font-mono truncate">
                  {meta.generation}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Select for Additional Platforms (NES, Sega CD, GB, etc.) */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-muted-foreground">
        <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider mr-1">
          Other Systems:
        </span>
        {SUPPORTED_CONSOLES.filter((c) => !FEATURED_CONSOLE_IDS.includes(c.id)).map((c) => {
          const isSelected = selectedCore === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCore(c.id)}
              className={cn(
                "px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono uppercase transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(0,71,187,0.4)]"
                  : "bg-muted/40 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
