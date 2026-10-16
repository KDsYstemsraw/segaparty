import React from "react";
import { ControllerGraphicProps } from "./PsxControllerGraphic";

export function GenesisControllerGraphic({
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

  const btnStyle = (isActive: boolean, cx: number, cy: number): React.CSSProperties => ({
    cursor: "pointer",
    transformOrigin: `${cx}px ${cy}px`,
    transform: isActive ? "scale(0.92) translateY(2.5px)" : "none",
    transition: "transform 75ms cubic-bezier(0.2, 0.8, 0.4, 1), filter 75ms ease",
    filter: isActive ? "drop-shadow(0 0 10px rgba(239, 68, 68, 0.95)) brightness(1.3)" : undefined,
  });

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox="0 0 520 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
      >
        <defs>
          {/* Main Chassis Gradients */}
          <linearGradient id="genesis-chassis" x1="260" y1="30" x2="260" y2="290" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2c2d33" />
            <stop offset="50%" stopColor="#1a1b1f" />
            <stop offset="100%" stopColor="#101114" />
          </linearGradient>
          <linearGradient id="genesis-rim" x1="260" y1="40" x2="260" y2="280" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#43464f" />
            <stop offset="100%" stopColor="#141517" />
          </linearGradient>
          {/* D-Pad disc gradient */}
          <radialGradient id="genesis-dpad-disc" cx="130" cy="165" r="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3b3d45" />
            <stop offset="70%" stopColor="#232429" />
            <stop offset="100%" stopColor="#121316" />
          </radialGradient>
          {/* Action button gradients */}
          <linearGradient id="genesis-btn-big" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3e4149" />
            <stop offset="100%" stopColor="#202227" />
          </linearGradient>
          <linearGradient id="genesis-btn-small" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b4e57" />
            <stop offset="100%" stopColor="#282a30" />
          </linearGradient>
        </defs>

        {/* --- Top Shoulder / Mode Button --- */}
        <g
          id="btn-mode"
          style={btnStyle(isPressed("mode", ["select"]), 415, 38)}
          onClick={() => onButtonClick?.("mode")}
        >
          <path
            d="M 385 45 C 385 28, 445 28, 445 45 L 438 52 L 392 52 Z"
            fill="#374151"
            stroke="#1f2937"
            strokeWidth="1.5"
          />
          <text x="415" y="41" fill="#e5e7eb" fontSize="9" fontWeight="bold" textAnchor="middle">
            MODE
          </text>
        </g>

        {/* --- Main 6-Button Boomerang Chassis --- */}
        <path
          d="M 140 45 
             C 210 40, 310 40, 380 45 
             C 455 52, 505 105, 500 180 
             C 495 245, 435 285, 380 285 
             C 335 285, 315 220, 260 220 
             C 205 220, 185 285, 140 285 
             C 85 285, 25 245, 20 180 
             C 15 105, 65 52, 140 45 Z"
          fill="url(#genesis-chassis)"
          stroke="#4b5563"
          strokeWidth="3.5"
        />

        {/* Inner Ergonomic Grip Grooves */}
        <path
          d="M 135 55 C 80 62, 38 110, 35 175 C 32 230, 80 270, 130 270 C 165 270, 180 220, 225 212"
          fill="none"
          stroke="url(#genesis-rim)"
          strokeWidth="2.5"
          opacity="0.7"
        />
        <path
          d="M 385 55 C 440 62, 482 110, 485 175 C 488 230, 440 270, 390 270 C 355 270, 340 220, 295 212"
          fill="none"
          stroke="url(#genesis-rim)"
          strokeWidth="2.5"
          opacity="0.7"
        />

        {/* Iconic Red Accent Ring for 16-BIT Heritage */}
        <circle cx="130" cy="165" r="54" fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.85" />
        <circle cx="130" cy="165" r="51" fill="#151619" stroke="#0a0a0b" strokeWidth="1.5" />

        {/* Center Sega Logo */}
        <g opacity="0.95">
          <text x="260" y="88" fill="#f3f4f6" fontSize="22" fontWeight="900" letterSpacing="4" textAnchor="middle" fontFamily="sans-serif">
            SEGA
          </text>
          <text x="260" y="104" fill="#9ca3af" fontSize="7" fontWeight="bold" letterSpacing="2" textAnchor="middle">
            16-BIT CONTROL PAD
          </text>
        </g>

        {/* --- D-Pad Assembly (Left) --- */}
        <circle cx="130" cy="165" r="46" fill="url(#genesis-dpad-disc)" stroke="#27292f" strokeWidth="1.5" />

        {/* D-Pad Up */}
        <g
          id="btn-up"
          style={btnStyle(isPressed("up"), 130, 138)}
          onClick={() => onButtonClick?.("up")}
        >
          <path d="M 119 122 C 119 120, 141 120, 141 122 L 138 148 L 122 148 Z" fill="#2d2f36" rx="2" />
          <polygon points="130,126 135,133 125,133" fill="#9ca3af" />
        </g>

        {/* D-Pad Down */}
        <g
          id="btn-down"
          style={btnStyle(isPressed("down"), 130, 192)}
          onClick={() => onButtonClick?.("down")}
        >
          <path d="M 122 182 L 138 182 L 141 208 C 141 210, 119 210, 119 208 Z" fill="#2d2f36" rx="2" />
          <polygon points="130,204 135,197 125,197" fill="#9ca3af" />
        </g>

        {/* D-Pad Left */}
        <g
          id="btn-left"
          style={btnStyle(isPressed("left"), 103, 165)}
          onClick={() => onButtonClick?.("left")}
        >
          <path d="M 87 154 C 85 154, 85 176, 87 176 L 113 173 L 113 157 Z" fill="#2d2f36" rx="2" />
          <polygon points="91,165 98,160 98,170" fill="#9ca3af" />
        </g>

        {/* D-Pad Right */}
        <g
          id="btn-right"
          style={btnStyle(isPressed("right"), 157, 165)}
          onClick={() => onButtonClick?.("right")}
        >
          <path d="M 147 157 L 147 173 L 173 176 C 175 176, 175 154, 173 154 Z" fill="#2d2f36" rx="2" />
          <polygon points="169,165 162,160 162,170" fill="#9ca3af" />
        </g>

        {/* Center D-Pad Dimple */}
        <circle cx="130" cy="165" r="10" fill="#1b1c20" stroke="#121316" strokeWidth="1" />

        {/* --- Center: START Button --- */}
        <g
          id="btn-start"
          style={btnStyle(isPressed("start"), 260, 155)}
          onClick={() => onButtonClick?.("start")}
        >
          <rect
            x="245"
            y="148"
            width="30"
            height="14"
            rx="7"
            fill="#3b82f6"
            stroke="#1d4ed8"
            strokeWidth="1.5"
          />
          <text x="260" y="174" fill="#ef4444" fontSize="8" fontWeight="bold" letterSpacing="0.8" textAnchor="middle">
            START
          </text>
        </g>

        {/* --- 6-Button Arcade Array (Right) --- */}
        {/* Top Row: X, Y, Z (Smaller Turbo Buttons) */}
        {/* X Button */}
        <g
          id="btn-x"
          style={btnStyle(isPressed("x"), 345, 125)}
          onClick={() => onButtonClick?.("x")}
        >
          <circle cx="345" cy="125" r="13" fill="url(#genesis-btn-small)" stroke="#1a1b1e" strokeWidth="1.5" />
          <text x="345" y="130" fill="#9ca3af" fontSize="11" fontWeight="bold" textAnchor="middle">
            X
          </text>
        </g>

        {/* Y Button */}
        <g
          id="btn-y"
          style={btnStyle(isPressed("y"), 385, 118)}
          onClick={() => onButtonClick?.("y")}
        >
          <circle cx="385" cy="118" r="13" fill="url(#genesis-btn-small)" stroke="#1a1b1e" strokeWidth="1.5" />
          <text x="385" y="123" fill="#9ca3af" fontSize="11" fontWeight="bold" textAnchor="middle">
            Y
          </text>
        </g>

        {/* Z Button */}
        <g
          id="btn-z"
          style={btnStyle(isPressed("z"), 425, 125)}
          onClick={() => onButtonClick?.("z")}
        >
          <circle cx="425" cy="125" r="13" fill="url(#genesis-btn-small)" stroke="#1a1b1e" strokeWidth="1.5" />
          <text x="425" y="130" fill="#9ca3af" fontSize="11" fontWeight="bold" textAnchor="middle">
            Z
          </text>
        </g>

        {/* Bottom Row: A, B, C (Large Primary Arcade Buttons) */}
        {/* A Button */}
        <g
          id="btn-a"
          style={btnStyle(isPressed("a"), 340, 175)}
          onClick={() => onButtonClick?.("a")}
        >
          <circle cx="340" cy="175" r="17" fill="url(#genesis-btn-big)" stroke="#111215" strokeWidth="2" />
          <text x="340" y="181" fill="#f3f4f6" fontSize="14" fontWeight="900" textAnchor="middle">
            A
          </text>
        </g>

        {/* B Button */}
        <g
          id="btn-b"
          style={btnStyle(isPressed("b"), 385, 168)}
          onClick={() => onButtonClick?.("b")}
        >
          <circle cx="385" cy="168" r="17" fill="url(#genesis-btn-big)" stroke="#111215" strokeWidth="2" />
          <text x="385" y="174" fill="#f3f4f6" fontSize="14" fontWeight="900" textAnchor="middle">
            B
          </text>
        </g>

        {/* C Button */}
        <g
          id="btn-c"
          style={btnStyle(isPressed("c"), 430, 175)}
          onClick={() => onButtonClick?.("c")}
        >
          <circle cx="430" cy="175" r="17" fill="url(#genesis-btn-big)" stroke="#111215" strokeWidth="2" />
          <text x="430" y="181" fill="#f3f4f6" fontSize="14" fontWeight="900" textAnchor="middle">
            C
          </text>
        </g>
      </svg>
    </div>
  );
}
