import React, { useState } from "react";
import { SUPPORTED_CONSOLES, ConsoleSystem, getConsoleSystem } from "@/lib/consoles";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Gamepad2, CheckCircle2, Box } from "lucide-react";
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
  imageSrc?: string;
  svgIllustration: React.ReactNode;
}

const CONSOLE_METAS: Record<string, ConsoleCardMeta> = {
  psx: {
    id: "psx",
    generation: "5th Gen · 32-Bit",
    specs: "33.8 MHz MIPS R3000A · CD-ROM Audio",
    accentGlow: "rgba(99, 102, 241, 0.45)",
    imageSrc: "/assets/consoles/ps1.jpg",
    svgIllustration: (
      <svg viewBox="0 0 120 70" className="w-full h-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
        <rect x="10" y="10" width="100" height="52" rx="6" fill="#9ca3af" stroke="#6b7280" strokeWidth="1.5" />
        <rect x="14" y="13" width="92" height="46" rx="4" fill="#cbd5e1" />
        <circle cx="60" cy="36" r="21" fill="#94a3b8" stroke="#64748b" strokeWidth="1.2" />
        <circle cx="60" cy="36" r="16" fill="#64748b" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 2" className="animate-[spin_10s_linear_infinite]" />
        <circle cx="60" cy="36" r="5" fill="#0ea5e9" opacity="0.8" />
        <circle cx="22" cy="46" r="4.5" fill="#475569" />
        <circle cx="22" cy="46" r="2.5" fill="#22c55e" className="animate-pulse" />
        <circle cx="98" cy="46" r="4.5" fill="#475569" />
        <rect x="36" y="52" width="20" height="6" rx="2" fill="#334155" />
        <rect x="64" y="52" width="20" height="6" rx="2" fill="#334155" />
      </svg>
    ),
  },
  n64: {
    id: "n64",
    generation: "5th Gen · 64-Bit",
    specs: "93.75 MHz VR4300 · 4 Controller Ports",
    accentGlow: "rgba(16, 185, 129, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 120 70" className="w-full h-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
        <path d="M12 28 Q30 8 60 8 Q90 8 108 28 L112 56 Q112 60 106 60 L14 60 Q8 60 8 56 Z" fill="#1e2229" stroke="#334155" strokeWidth="1.5" />
        <rect x="32" y="16" width="56" height="12" rx="3" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
        <rect x="38" y="20" width="44" height="4" rx="1" fill="#10b981" opacity="0.7" />
        <circle cx="60" cy="34" r="2.5" fill="#ef4444" className="animate-pulse" />
        <circle cx="30" cy="50" r="4" fill="#0f172a" stroke="#10b981" strokeWidth="0.8" />
        <circle cx="48" cy="50" r="4" fill="#0f172a" stroke="#10b981" strokeWidth="0.8" />
        <circle cx="72" cy="50" r="4" fill="#0f172a" stroke="#10b981" strokeWidth="0.8" />
        <circle cx="90" cy="50" r="4" fill="#0f172a" stroke="#10b981" strokeWidth="0.8" />
      </svg>
    ),
  },
  snes: {
    id: "snes",
    generation: "4th Gen · 16-Bit",
    specs: "3.58 MHz 65C816 · Mode 7 Graphics",
    accentGlow: "rgba(168, 85, 247, 0.45)",
    imageSrc: "/assets/consoles/snes.jpg",
    svgIllustration: (
      <svg viewBox="0 0 120 70" className="w-full h-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
        <rect x="12" y="12" width="96" height="50" rx="6" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        <rect x="22" y="15" width="76" height="28" rx="4" fill="#94a3b8" />
        <rect x="30" y="20" width="60" height="12" rx="2" fill="#334155" />
        <rect x="24" y="48" width="10" height="8" rx="2" fill="#8b5cf6" />
        <rect x="86" y="48" width="10" height="8" rx="2" fill="#8b5cf6" />
        <circle cx="42" cy="52" r="2" fill="#ef4444" />
        <rect x="52" y="50" width="14" height="6" rx="2" fill="#475569" />
        <rect x="70" y="50" width="14" height="6" rx="2" fill="#475569" />
      </svg>
    ),
  },
  segaMD: {
    id: "segaMD",
    generation: "4th Gen · 16-Bit",
    specs: "7.67 MHz Motorola 68000 · YM2612 FM",
    accentGlow: "rgba(59, 130, 246, 0.45)",
    imageSrc: "/assets/consoles/genesis.jpg",
    svgIllustration: (
      <svg viewBox="0 0 120 70" className="w-full h-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
        <rect x="10" y="12" width="100" height="50" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
        <circle cx="56" cy="35" r="21" fill="#27272a" stroke="#eab308" strokeWidth="2.5" />
        <text x="56" y="25" fill="#facc15" fontSize="6" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">16-BIT</text>
        <rect x="32" y="30" width="48" height="9" rx="2" fill="#09090b" stroke="#71717a" strokeWidth="0.8" />
        <circle cx="92" cy="42" r="4" fill="#dc2626" />
        <rect x="88" y="22" width="4" height="12" rx="1" fill="#3b82f6" />
        <circle cx="22" cy="46" r="2" fill="#ef4444" className="animate-pulse" />
      </svg>
    ),
  },
  gba: {
    id: "gba",
    generation: "6th Gen · 32-Bit",
    specs: "16.78 MHz ARM7TDMI · Wide TFT Color",
    accentGlow: "rgba(6, 182, 212, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 120 70" className="w-full h-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
        <path d="M16 20 C10 20 8 30 8 42 C8 54 12 58 20 58 L100 58 C108 58 112 54 112 42 C112 30 110 20 104 20 Z" fill="#3730a3" stroke="#6366f1" strokeWidth="1.5" />
        <rect x="34" y="22" width="52" height="32" rx="4" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="1" />
        <rect x="38" y="25" width="44" height="26" rx="2" fill="#0284c7" opacity="0.8" />
        <rect x="18" y="34" width="10" height="4" rx="1" fill="#1e1b4b" />
        <rect x="21" y="31" width="4" height="10" rx="1" fill="#1e1b4b" />
        <circle cx="98" cy="34" r="3" fill="#ec4899" />
        <circle cx="93" cy="40" r="3" fill="#ec4899" />
      </svg>
    ),
  },
  arcade: {
    id: "arcade",
    generation: "Coin-Op Arcade",
    specs: "FinalBurn Neo Multi-CPU · 60 FPS Stereo",
    accentGlow: "rgba(249, 115, 22, 0.45)",
    svgIllustration: (
      <svg viewBox="0 0 120 70" className="w-full h-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
        <path d="M18 10 L102 10 L108 30 L112 60 L8 60 L12 30 Z" fill="#18181b" stroke="#f97316" strokeWidth="1.5" />
        <rect x="22" y="14" width="76" height="18" rx="3" fill="#7c2d12" stroke="#fb923c" strokeWidth="1" />
        <text x="60" y="26" fill="#fed7aa" fontSize="7" fontWeight="black" textAnchor="middle" letterSpacing="1">ARCADE</text>
        <rect x="30" y="34" width="60" height="22" rx="4" fill="#030712" stroke="#38bdf8" strokeWidth="1" />
        <circle cx="24" cy="50" r="4" fill="#ef4444" />
        <circle cx="96" cy="46" r="2.5" fill="#3b82f6" />
        <circle cx="102" cy="50" r="2.5" fill="#eab308" />
      </svg>
    ),
  },
};

const FEATURED_CONSOLE_IDS = ["psx", "n64", "snes", "segaMD", "gba", "arcade"];

function ConsoleVisual({ meta }: { meta: ConsoleCardMeta }) {
  const [imgError, setImgError] = useState(false);

  if (meta.imageSrc && !imgError) {
    return (
      <div className="relative w-full h-16 flex items-center justify-center p-0.5 overflow-hidden">
        <img
          src={meta.imageSrc}
          alt={meta.generation}
          loading="eager"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain filter drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)] transition-all duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none rounded opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div className="w-full h-16 flex items-center justify-center transition-transform group-hover:scale-105 duration-200">
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
  const currentSys = getConsoleSystem(selectedCore);

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

      {/* 3D Console Deck Showcase Grid */}
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
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] font-bold py-0 px-1 uppercase tracking-wider", sys.badgeColor)}
                  >
                    {sys.shortName}
                  </Badge>
                  {meta.imageSrc && (
                    <Badge
                      variant="outline"
                      className="text-[8px] font-mono py-0 px-1 border-primary/40 text-primary bg-primary/10 flex items-center gap-0.5"
                      title="3D Hardware Deck Render"
                    >
                      <Box className="w-2 h-2" /> 3D
                    </Badge>
                  )}
                </div>
                {isDetected ? (
                  <span className="text-[9px] text-accent font-bold font-mono flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Auto
                  </span>
                ) : isSelected ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : null}
              </div>

              {/* 3D Model / SVG Isometric Visual */}
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
