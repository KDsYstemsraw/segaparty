import React, { useRef, useState } from "react";
import {
  Upload,
  FolderOpen,
  X,
  AlertTriangle,
  Sparkles,
  Disc,
  Layers,
  CheckCircle2,
  HardDrive,
  Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cleanRomTitle, formatBytes } from "@/lib/romUtils";
import { detectConsoleFromFilename, detectCueWarning, getConsoleSystem } from "@/lib/consoles";
import { cn } from "@/lib/utils";

export interface RomDropzoneProps {
  selectedFile: File | null;
  onFileSelected: (file: File | null) => void;
  selectedCore?: string;
  compact?: boolean;
  className?: string;
}

export function isDiscMedia(filename?: string, coreId?: string): boolean {
  if (filename) {
    const ext = filename.toLowerCase().split(".").pop() || "";
    if (["chd", "iso", "pbp", "cue"].includes(ext)) return true;
  }
  if (coreId && ["psx", "segaCD"].includes(coreId)) return true;
  return false;
}

/* -------------------------------------------------------------------------- */
/* Holographic Iridescent Disc SVG Component                                   */
/* -------------------------------------------------------------------------- */
function HolographicDisc({
  isSpinning = true,
  isHovered = false,
  title,
  subtext,
}: {
  isSpinning?: boolean;
  isHovered?: boolean;
  title?: string;
  subtext?: string;
}) {
  return (
    <div className="relative flex items-center justify-center select-none py-1">
      {/* Dynamic iridescent aura glow */}
      <div
        className={cn(
          "absolute w-36 h-36 rounded-full blur-xl pointer-events-none transition-all duration-500",
          isHovered
            ? "bg-gradient-to-tr from-cyan-500/40 via-purple-500/40 to-pink-500/40 scale-125 opacity-90"
            : "bg-gradient-to-tr from-cyan-500/20 via-indigo-500/25 to-pink-500/20 opacity-70",
        )}
      />

      {/* Rotating Disc */}
      <div
        className={cn(
          "relative w-36 h-36 rounded-full flex items-center justify-center transition-transform",
          isSpinning && "animate-[spin_12s_linear_infinite]",
          isHovered && "scale-105",
        )}
        style={{
          boxShadow:
            "0 0 25px rgba(56, 189, 248, 0.35), inset 0 0 15px rgba(168, 85, 247, 0.3)",
        }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
          <defs>
            {/* Iridescent Rainbow Sheen Gradient */}
            <linearGradient id="discSheen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="25%" stopColor="#818cf8" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.85" />
              <stop offset="75%" stopColor="#f472b6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
            </linearGradient>

            {/* Metallic Disc Hub Gradient */}
            <radialGradient id="discHub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="45%" stopColor="#1e293b" />
              <stop offset="70%" stopColor="#475569" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>

            {/* Laser reflection highlights */}
            <linearGradient id="laserReflect" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="55%" stopColor="#c084fc" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Outer mirrored edge */}
          <circle cx="100" cy="100" r="96" fill="#090d16" stroke="#38bdf8" strokeWidth="1.5" />
          
          {/* Data storage area with iridescent sheen */}
          <circle cx="100" cy="100" r="92" fill="url(#discSheen)" opacity="0.35" />

          {/* Concentric etched tracks */}
          <circle cx="100" cy="100" r="84" fill="none" stroke="#67e8f9" strokeWidth="0.7" opacity="0.4" strokeDasharray="6 3" />
          <circle cx="100" cy="100" r="76" fill="none" stroke="#c084fc" strokeWidth="0.7" opacity="0.5" strokeDasharray="8 4" />
          <circle cx="100" cy="100" r="68" fill="none" stroke="#f472b6" strokeWidth="0.7" opacity="0.4" strokeDasharray="5 2" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="#38bdf8" strokeWidth="0.7" opacity="0.5" strokeDasharray="7 3" />
          <circle cx="100" cy="100" r="52" fill="none" stroke="#818cf8" strokeWidth="0.7" opacity="0.4" />

          {/* Holographic Laser Reflection Ray */}
          <polygon
            points="100,100 20,20 60,10"
            fill="url(#laserReflect)"
            opacity="0.6"
          />
          <polygon
            points="100,100 180,180 140,190"
            fill="url(#laserReflect)"
            opacity="0.6"
          />

          {/* Clear Plastic Inner Clamping Ring */}
          <circle cx="100" cy="100" r="42" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
          <circle cx="100" cy="100" r="34" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3 2" />

          {/* Spindle Hub */}
          <circle cx="100" cy="100" r="26" fill="url(#discHub)" stroke="#64748b" strokeWidth="1" />
          
          {/* Center spindle hole (see-through) */}
          <circle cx="100" cy="100" r="14" fill="#020617" stroke="#38bdf8" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="7" fill="#000000" />
        </svg>
      </div>

      {/* Laser pickup optical sensor dot */}
      <div className="absolute w-2 h-2 rounded-full bg-cyan-400 blur-[1px] animate-ping pointer-events-none" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Snap-Fit Cartridge SVG Component                                           */
/* -------------------------------------------------------------------------- */
function SnapFitCartridge({
  isHovered = false,
  title,
  systemName = "GENESIS",
}: {
  isHovered?: boolean;
  title?: string;
  systemName?: string;
}) {
  return (
    <div className="relative flex items-center justify-center select-none py-1">
      {/* Ambient Cartridge Neon Glow */}
      <div
        className={cn(
          "absolute w-40 h-32 rounded-xl blur-xl pointer-events-none transition-all duration-500",
          isHovered
            ? "bg-gradient-to-b from-blue-500/35 via-amber-500/25 to-primary/40 scale-110 opacity-90"
            : "bg-blue-600/20 opacity-60",
        )}
      />

      {/* Sculpted Cartridge body */}
      <div
        className={cn(
          "relative w-40 h-32 transition-transform duration-300",
          isHovered && "scale-105 -translate-y-1",
        )}
      >
        <svg viewBox="0 0 160 120" className="w-full h-full drop-shadow-2xl">
          <defs>
            {/* Gold Pin Connector Gradient */}
            <linearGradient id="goldPins" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>

            {/* Plastic Cartridge Casing Gradient */}
            <linearGradient id="cartridgeBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#27272a" />
              <stop offset="50%" stopColor="#18181b" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>

            {/* Glossy Sticker Gradient */}
            <linearGradient id="cartridgeSticker" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="40%" stopColor="#0284c7" />
              <stop offset="80%" stopColor="#0369a1" />
              <stop offset="100%" stopColor="#082f49" />
            </linearGradient>
          </defs>

          {/* Cartridge Outer Shell with Ergonomic Grips */}
          <path
            d="M 12 12 C 12 8 16 4 22 4 L 138 4 C 144 4 148 8 148 12 L 148 100 L 140 106 L 20 106 L 12 100 Z"
            fill="url(#cartridgeBody)"
            stroke="#3f3f46"
            strokeWidth="1.5"
          />

          {/* Top grip bevel lines */}
          <line x1="28" y1="8" x2="132" y2="8" stroke="#52525b" strokeWidth="1" />
          <line x1="32" y1="12" x2="128" y2="12" stroke="#52525b" strokeWidth="1" />

          {/* Side grip ridges */}
          <line x1="16" y1="24" x2="16" y2="80" stroke="#52525b" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="144" y1="24" x2="144" y2="80" stroke="#52525b" strokeWidth="2" strokeDasharray="3 3" />

          {/* Cartridge Art Label Insert */}
          <rect
            x="24"
            y="20"
            width="112"
            height="72"
            rx="4"
            fill="url(#cartridgeSticker)"
            stroke="#0ea5e9"
            strokeWidth="1.2"
          />

          {/* Glossy label light sheen */}
          <path
            d="M 24 20 L 110 20 L 70 92 L 24 92 Z"
            fill="#ffffff"
            opacity="0.08"
          />

          {/* System Banner Header on Label */}
          <rect x="24" y="20" width="112" height="15" rx="3" fill="#0f172a" opacity="0.9" />
          <text
            x="80"
            y="31"
            fill="#38bdf8"
            fontSize="8"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="2"
            fontFamily="monospace"
          >
            {systemName.toUpperCase()}
          </text>

          {/* Cartridge Title snippet */}
          <text
            x="80"
            y="55"
            fill="#ffffff"
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
            letterSpacing="0.5"
          >
            {title ? title.slice(0, 16) : "CARTRIDGE ROM"}
          </text>
          <text
            x="80"
            y="68"
            fill="#94a3b8"
            fontSize="6"
            textAnchor="middle"
            fontFamily="monospace"
          >
            OFFICIAL RETRO GAME
          </text>

          {/* Gold Quality Seal */}
          <circle cx="118" cy="74" r="8" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />
          <text x="118" y="76.5" fill="#713f12" fontSize="5" fontWeight="bold" textAnchor="middle">
            SEAL
          </text>

          {/* Bottom Edge Gold Connector Pins */}
          <g>
            <rect x="28" y="106" width="104" height="10" fill="#09090b" stroke="#27272a" strokeWidth="1" />
            {[
              32, 38, 44, 50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110, 116, 122,
            ].map((x) => (
              <rect
                key={x}
                x={x}
                y="107"
                width="4"
                height="8"
                rx="0.5"
                fill="url(#goldPins)"
                className="opacity-90"
              />
            ))}
          </g>

          {/* Power LED Indicator */}
          <circle cx="28" cy="84" r="2.5" fill="#22c55e" className="animate-pulse" />
        </svg>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RomDropzone Main Component                                                 */
/* -------------------------------------------------------------------------- */
export function RomDropzone({
  selectedFile,
  onFileSelected,
  selectedCore = "segaMD",
  compact = false,
  className,
}: RomDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelected(file);
    }
  };

  const triggerPicker = () => {
    fileInputRef.current?.click();
  };

  // Determine media attributes
  const cleanTitle = selectedFile ? cleanRomTitle(selectedFile.name) : "";
  const detectedSys = selectedFile ? detectConsoleFromFilename(selectedFile.name) : null;
  const isCue = selectedFile ? detectCueWarning(selectedFile.name) : false;

  const activeSystem = detectedSys || getConsoleSystem(selectedCore);
  const isDisc = isDiscMedia(selectedFile?.name, activeSystem.id);

  return (
    <div className={cn("w-full font-sans space-y-2.5", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".chd,.pbp,.iso,.bin,.md,.gen,.smd,.sfc,.smc,.nes,.gba,.gb,.gbc,.z64,.n64,.zip"
        onChange={handleInputChange}
        className="hidden"
      />

      {selectedFile ? (
        /* ================================================================= */
        /* LOADED MEDIA VIEW (Holographic Disc or Snap-Fit Cartridge)        */
        /* ================================================================= */
        <div className="space-y-2.5">
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-card via-card/90 to-primary/5 shadow-xl backdrop-blur-md overflow-hidden transition-all duration-300 flex flex-col md:flex-row items-center justify-between gap-5"
          >
            {/* Subtle ambient accent glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

            {/* Media Hologram (Disc or Cartridge) */}
            <div className="shrink-0 flex items-center justify-center">
              {isDisc ? (
                <HolographicDisc
                  isSpinning={true}
                  isHovered={isHovered}
                  title={cleanTitle}
                  subtext={activeSystem.shortName}
                />
              ) : (
                <SnapFitCartridge
                  isHovered={isHovered}
                  title={cleanTitle}
                  systemName={activeSystem.shortName}
                />
              )}
            </div>

            {/* Media Metadata & Status Information */}
            <div className="flex-1 min-w-0 space-y-2 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold py-0.5 px-2.5 uppercase tracking-wide rounded-md shadow-sm",
                    activeSystem.badgeColor,
                  )}
                >
                  <Sparkles className="w-2.5 h-2.5 mr-1" /> {activeSystem.shortName}
                </Badge>

                <Badge
                  variant="outline"
                  className="text-[10px] py-0.5 px-2.5 border-white/10 text-white font-medium bg-white/5 rounded-md"
                >
                  {isDisc ? "Optical Disc" : "Game Cartridge"}
                </Badge>

                <Badge
                  variant="outline"
                  className="text-[10px] py-0.5 px-2.5 border-white/10 text-muted-foreground font-mono rounded-md"
                >
                  {formatBytes(selectedFile.size)}
                </Badge>

                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ready to Play
                </span>
              </div>

              <div>
                <h3
                  className="text-base sm:text-lg font-bold text-white tracking-tight truncate max-w-md font-display"
                  title={cleanTitle}
                >
                  {cleanTitle}
                </h3>
                <p
                  className="text-xs font-mono text-muted-foreground/80 truncate max-w-sm sm:max-w-md mt-0.5"
                  title={selectedFile.name}
                >
                  {selectedFile.name}
                </p>
              </div>

              <p className="text-xs text-muted-foreground font-sans">
                {isDisc
                  ? "Optical disc verified · Ready for emulation"
                  : "Cartridge verified · Ready for emulation"}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex sm:flex-col items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={triggerPicker}
                className="w-full sm:w-auto h-9 px-3.5 text-xs font-semibold rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white gap-1.5 shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary" /> Change Game
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onFileSelected(null)}
                className="w-full sm:w-auto h-9 px-3.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5"
                title="Eject ROM"
              >
                <X className="w-3.5 h-3.5" /> Eject
              </Button>
            </div>
          </div>

          {/* Multi-track .CUE Warning Banner */}
          {isCue && (
            <div className="p-3.5 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-amber-300">
                  Notice for Multi-track .CUE Files:
                </span>
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  In-browser web emulators cannot reliably load separate multi-track .bin files from cue sheets. For PSX and Sega CD, we strongly recommend converting to single-file <strong>.chd</strong> format using chdman!
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================================================================= */
        /* EMPTY / IDLE DROPZONE                                             */
        /* ================================================================= */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerPicker}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            "group relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-6 text-center overflow-hidden",
            compact ? "h-36" : "h-52",
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01] shadow-xl shadow-primary/10"
              : "border-white/15 bg-card/60 hover:border-primary/50 hover:bg-white/[0.02] hover:shadow-xl",
          )}
        >
          {/* Hologram Media Preview Badge */}
          <div className="relative mb-3 flex items-center justify-center">
            {/* Ambient pulse halo */}
            <div
              className={cn(
                "absolute w-16 h-16 rounded-full blur-xl transition-all duration-300",
                isDragging
                  ? "bg-primary/40 scale-125"
                  : isHovered
                  ? "bg-primary/25 scale-110"
                  : "bg-primary/10",
              )}
            />

            <div
              className={cn(
                "relative w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-300",
                isDragging
                  ? "border-primary bg-primary/20 text-primary scale-110"
                  : "border-white/10 bg-white/5 text-primary group-hover:border-primary/50 group-hover:scale-105 group-hover:bg-primary/10",
              )}
            >
              {isDisc ? (
                <Disc className="w-7 h-7 text-primary animate-[spin_8s_linear_infinite]" />
              ) : (
                <HardDrive className="w-7 h-7 text-primary" />
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1 mb-3 z-10">
            <h4 className="font-display font-bold text-sm sm:text-base text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>
                {isDragging
                  ? "Release to Load Game File"
                  : isDisc
                  ? "Insert Disc / Drop CD-ROM Image"
                  : "Insert Cartridge / Drop Game File"}
              </span>
            </h4>
            <p className="text-xs text-muted-foreground font-sans max-w-md">
              Drag & drop any supported game file here, or click to browse local files
            </p>
          </div>

          {/* Formats Pills */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center text-[10px] font-mono text-muted-foreground z-10">
            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
              .CHD
            </span>
            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
              .BIN
            </span>
            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
              .MD
            </span>
            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
              .SFC
            </span>
            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
              .Z64
            </span>
            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
              .GBA
            </span>
            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
              .ZIP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
