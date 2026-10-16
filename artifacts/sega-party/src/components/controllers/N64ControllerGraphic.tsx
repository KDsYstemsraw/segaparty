import React from "react";
import { ControllerGraphicProps } from "./PsxControllerGraphic";

export function N64ControllerGraphic({
  activeButtons,
  highlightButton,
  onButtonClick,
  className = "w-full max-w-md mx-auto",
}: ControllerGraphicProps) {
  const isPressed = (actionId: string, aliases: string[] = []): boolean => {
    const ids = [actionId, ...aliases].map((s) => s.toLowerCase());
    if (highlightButton && ids.includes(highlightButton.toLowerCase())) return true;
    if (!activeButtons) return false;
    for (const id of ids) {
      if (activeButtons.has(id)) return true;
    }
    return false;
  };

  const btnStyle = (isActive: boolean, cx: number, cy: number, glowColor = "rgba(59, 130, 246, 0.95)"): React.CSSProperties => ({
    cursor: "pointer",
    transformOrigin: `${cx}px ${cy}px`,
    transform: isActive ? "scale(0.92) translateY(2.5px)" : "none",
    transition: "transform 75ms cubic-bezier(0.2, 0.8, 0.4, 1), filter 75ms ease",
    filter: isActive ? `drop-shadow(0 0 10px ${glowColor}) brightness(1.3)` : undefined,
  });

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox="0 0 520 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
      >
        <defs>
          {/* Main Chassis Gradients */}
          <linearGradient id="n64-chassis" x1="260" y1="40" x2="260" y2="370" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="60%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="n64-shoulder" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <radialGradient id="n64-stick-gate" cx="260" cy="185" r="38" gradientUnits="userSpaceOnUse">
            <stop offset="70%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>
          <radialGradient id="n64-stick-cap" cx="260" cy="185" r="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="60%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
          {/* Buttons */}
          <linearGradient id="n64-btn-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="n64-btn-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="n64-btn-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          <linearGradient id="n64-btn-start" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
        </defs>

        {/* --- Top Shoulder Bumpers & Z-Trigger --- */}
        {/* L Bumper */}
        <g
          id="btn-l"
          style={btnStyle(isPressed("l", ["l1"]), 110, 42)}
          onClick={() => onButtonClick?.("l")}
        >
          <path
            d="M 65 48 C 75 24, 155 24, 165 48 L 155 58 L 75 58 Z"
            fill="url(#n64-shoulder)"
            stroke="#475569"
            strokeWidth="2"
          />
          <text x="115" y="44" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
            L
          </text>
        </g>

        {/* R Bumper */}
        <g
          id="btn-r"
          style={btnStyle(isPressed("r", ["r1"]), 410, 42)}
          onClick={() => onButtonClick?.("r")}
        >
          <path
            d="M 355 48 C 365 24, 445 24, 455 48 L 445 58 L 365 58 Z"
            fill="url(#n64-shoulder)"
            stroke="#475569"
            strokeWidth="2"
          />
          <text x="405" y="44" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
            R
          </text>
        </g>

        {/* Z-Trigger Indicator / Button (Top Center Behind) */}
        <g
          id="btn-z"
          style={btnStyle(isPressed("z"), 260, 32, "rgba(239, 68, 68, 0.95)")}
          onClick={() => onButtonClick?.("z")}
        >
          <path
            d="M 235 38 C 235 22, 285 22, 285 38 L 280 48 L 240 48 Z"
            fill="#475569"
            stroke="#334155"
            strokeWidth="1.5"
          />
          <text x="260" y="36" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">
            Z-TRIGGER
          </text>
        </g>

        {/* --- Main 3-Prong Trident Chassis --- */}
        <path
          d="M 120 55 
             L 400 55 
             C 475 55, 495 120, 475 220 
             C 455 310, 420 370, 385 370 
             C 355 370, 340 300, 330 250 
             C 320 220, 310 240, 305 320 
             C 300 370, 275 375, 260 375 
             C 245 375, 220 370, 215 320 
             C 210 240, 200 220, 190 250 
             C 180 300, 165 370, 135 370 
             C 100 370, 65 310, 45 220 
             C 25 120, 45 55, 120 55 Z"
          fill="url(#n64-chassis)"
          stroke="#64748b"
          strokeWidth="3.5"
        />

        {/* Center Logo Branding */}
        <g opacity="0.9">
          <text x="260" y="90" fill="#1e293b" fontSize="13" fontWeight="900" letterSpacing="1.5" textAnchor="middle">
            NINTENDO 64
          </text>
        </g>

        {/* --- Left Prong: D-Pad --- */}
        <g id="n64-dpad" transform="translate(115, 160)">
          {/* D-Pad Up */}
          <g
            style={btnStyle(isPressed("up"), 0, -22)}
            onClick={() => onButtonClick?.("up")}
          >
            <path d="M -11 -11 L 11 -11 L 11 -38 C 11 -40, -11 -40, -11 -38 Z" fill="#334155" stroke="#1e293b" strokeWidth="1.2" rx="2" />
            <polygon points="0,-34 5,-28 -5,-28" fill="#94a3b8" />
          </g>
          {/* D-Pad Down */}
          <g
            style={btnStyle(isPressed("down"), 0, 22)}
            onClick={() => onButtonClick?.("down")}
          >
            <path d="M -11 11 L 11 11 L 11 38 C 11 40, -11 40, -11 38 Z" fill="#334155" stroke="#1e293b" strokeWidth="1.2" rx="2" />
            <polygon points="0,34 5,28 -5,28" fill="#94a3b8" />
          </g>
          {/* D-Pad Left */}
          <g
            style={btnStyle(isPressed("left"), -22, 0)}
            onClick={() => onButtonClick?.("left")}
          >
            <path d="M -11 -11 L -11 11 L -38 11 C -40 11, -40 -11, -38 -11 Z" fill="#334155" stroke="#1e293b" strokeWidth="1.2" rx="2" />
            <polygon points="-34,0 -28,5 -28,-5" fill="#94a3b8" />
          </g>
          {/* D-Pad Right */}
          <g
            style={btnStyle(isPressed("right"), 22, 0)}
            onClick={() => onButtonClick?.("right")}
          >
            <path d="M 11 -11 L 11 11 L 38 11 C 40 11, 40 -11, 38 -11 Z" fill="#334155" stroke="#1e293b" strokeWidth="1.2" rx="2" />
            <polygon points="34,0 28,5 28,-5" fill="#94a3b8" />
          </g>
          {/* Center Hub */}
          <rect x="-11" y="-11" width="22" height="22" fill="#334155" />
          <circle cx="0" cy="0" r="5" fill="#1e293b" />
        </g>

        {/* --- Center Prong: START Button & Control Stick --- */}
        {/* Start Button */}
        <g
          id="btn-start"
          style={btnStyle(isPressed("start"), 260, 118, "rgba(239, 68, 68, 0.95)")}
          onClick={() => onButtonClick?.("start")}
        >
          <circle cx="260" cy="118" r="13" fill="url(#n64-btn-start)" stroke="#991b1b" strokeWidth="1.5" />
          <text x="260" y="140" fill="#dc2626" fontSize="8" fontWeight="bold" textAnchor="middle">
            START
          </text>
        </g>

        {/* Analog Control Stick */}
        <g id="n64-control-stick" transform="translate(260, 195)">
          {/* Octagonal Gate */}
          <polygon
            points="
              -35,-15 -15,-35 15,-35 35,-15
              35,15 15,35 -15,35 -35,15
            "
            fill="url(#n64-stick-gate)"
            stroke="#1e293b"
            strokeWidth="2"
          />
          {/* Analog Stick Thumb Cap */}
          <circle cx="0" cy="0" r="22" fill="url(#n64-stick-cap)" stroke="#475569" strokeWidth="2" />
          {/* Concentric Thumb Rings */}
          <circle cx="0" cy="0" r="15" fill="none" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="8" fill="none" stroke="#64748b" strokeWidth="1.5" />
        </g>

        {/* --- Right Prong: A, B & 4 C-Buttons --- */}
        {/* B Button (Green) */}
        <g
          id="btn-b"
          style={btnStyle(isPressed("b"), 345, 195, "rgba(34, 197, 94, 0.95)")}
          onClick={() => onButtonClick?.("b")}
        >
          <circle cx="345" cy="195" r="14" fill="url(#n64-btn-b)" stroke="#166534" strokeWidth="2" />
          <text x="345" y="200" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
            B
          </text>
        </g>

        {/* A Button (Blue - Larger) */}
        <g
          id="btn-a"
          style={btnStyle(isPressed("a"), 375, 230, "rgba(59, 130, 246, 0.95)")}
          onClick={() => onButtonClick?.("a")}
        >
          <circle cx="375" cy="230" r="16" fill="url(#n64-btn-a)" stroke="#1e40af" strokeWidth="2" />
          <text x="375" y="236" fill="#ffffff" fontSize="15" fontWeight="900" textAnchor="middle">
            A
          </text>
        </g>

        {/* C-Buttons Cluster (Diamond Formation) */}
        <circle cx="430" cy="165" r="42" fill="#717782" opacity="0.35" />

        {/* C-Up */}
        <g
          id="btn-c-up"
          style={btnStyle(isPressed("c-up", ["cup"]), 430, 138, "rgba(234, 179, 8, 0.95)")}
          onClick={() => onButtonClick?.("c-up")}
        >
          <circle cx="430" cy="138" r="12" fill="url(#n64-btn-c)" stroke="#a16207" strokeWidth="1.5" />
          <polygon points="430,132 434,138 426,138" fill="#1e293b" />
        </g>

        {/* C-Down */}
        <g
          id="btn-c-down"
          style={btnStyle(isPressed("c-down", ["cdown"]), 430, 192, "rgba(234, 179, 8, 0.95)")}
          onClick={() => onButtonClick?.("c-down")}
        >
          <circle cx="430" cy="192" r="12" fill="url(#n64-btn-c)" stroke="#a16207" strokeWidth="1.5" />
          <polygon points="430,198 434,192 426,192" fill="#1e293b" />
        </g>

        {/* C-Left */}
        <g
          id="btn-c-left"
          style={btnStyle(isPressed("c-left", ["cleft"]), 403, 165, "rgba(234, 179, 8, 0.95)")}
          onClick={() => onButtonClick?.("c-left")}
        >
          <circle cx="403" cy="165" r="12" fill="url(#n64-btn-c)" stroke="#a16207" strokeWidth="1.5" />
          <polygon points="397,165 403,161 403,169" fill="#1e293b" />
        </g>

        {/* C-Right */}
        <g
          id="btn-c-right"
          style={btnStyle(isPressed("c-right", ["cright"]), 457, 165, "rgba(234, 179, 8, 0.95)")}
          onClick={() => onButtonClick?.("c-right")}
        >
          <circle cx="457" cy="165" r="12" fill="url(#n64-btn-c)" stroke="#a16207" strokeWidth="1.5" />
          <polygon points="463,165 457,161 457,169" fill="#1e293b" />
        </g>
      </svg>
    </div>
  );
}
