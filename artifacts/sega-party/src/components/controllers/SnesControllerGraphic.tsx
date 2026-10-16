import React from "react";
import { ControllerGraphicProps } from "./PsxControllerGraphic";

export function SnesControllerGraphic({
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
    filter: isActive ? "drop-shadow(0 0 10px rgba(168, 85, 247, 0.95)) brightness(1.3)" : undefined,
  });

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox="0 0 520 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
      >
        <defs>
          {/* Main Chassis Gradients */}
          <linearGradient id="snes-chassis" x1="260" y1="40" x2="260" y2="260" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="60%" stopColor="#d1d5db" />
            <stop offset="100%" stopColor="#9ca3af" />
          </linearGradient>
          <linearGradient id="snes-accent-oval" x1="260" y1="50" x2="260" y2="250" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#b4b9c2" />
            <stop offset="100%" stopColor="#878d96" />
          </linearGradient>
          <linearGradient id="snes-shoulder-l" x1="120" y1="15" x2="120" y2="45" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="snes-shoulder-r" x1="400" y1="15" x2="400" y2="45" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="snes-dpad-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          {/* Action button gradients */}
          <linearGradient id="snes-btn-y" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="snes-btn-x" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="snes-btn-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="snes-btn-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        {/* --- Top Shoulder Bumpers (L & R) --- */}
        {/* L Bumper */}
        <g
          id="btn-l"
          style={btnStyle(isPressed("l", ["l1"]), 130, 32)}
          onClick={() => onButtonClick?.("l")}
        >
          <path
            d="M 65 38 C 75 16, 175 16, 190 38 L 180 50 L 75 50 Z"
            fill="url(#snes-shoulder-l)"
            stroke="#475569"
            strokeWidth="2"
          />
          <text x="130" y="36" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
            L
          </text>
        </g>

        {/* R Bumper */}
        <g
          id="btn-r"
          style={btnStyle(isPressed("r", ["r1"]), 390, 32)}
          onClick={() => onButtonClick?.("r")}
        >
          <path
            d="M 330 38 C 345 16, 445 16, 455 38 L 445 50 L 340 50 Z"
            fill="url(#snes-shoulder-r)"
            stroke="#475569"
            strokeWidth="2"
          />
          <text x="390" y="36" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
            R
          </text>
        </g>

        {/* --- Main SNES Rounded Controller Body --- */}
        <path
          d="M 125 45 
             L 395 45 
             C 475 45, 510 100, 505 165 
             C 500 230, 440 260, 370 260 
             L 150 260 
             C 80 260, 20 230, 15 165 
             C 10 100, 45 45, 125 45 Z"
          fill="url(#snes-chassis)"
          stroke="#6b7280"
          strokeWidth="3.5"
        />

        {/* Inner Dark Gray Contour Oval Plate */}
        <path
          d="M 140 60 
             L 380 60 
             C 445 60, 480 105, 475 165 
             C 470 220, 425 245, 360 245 
             L 160 245 
             C 95 245, 50 220, 45 165 
             C 40 105, 75 60, 140 60 Z"
          fill="url(#snes-accent-oval)"
          stroke="#4b5563"
          strokeWidth="1.5"
          opacity="0.85"
        />

        {/* Center Logo Branding */}
        <g opacity="0.9">
          <text x="260" y="85" fill="#374151" fontSize="11" fontWeight="900" letterSpacing="1.5" textAnchor="middle">
            SUPER NINTENDO
          </text>
          <text x="260" y="98" fill="#4b5563" fontSize="7" fontWeight="bold" letterSpacing="0.8" textAnchor="middle">
            ENTERTAINMENT SYSTEM
          </text>
        </g>

        {/* --- D-Pad (Left) --- */}
        <g id="snes-dpad" transform="translate(110, 160)">
          {/* D-Pad Up */}
          <g
            style={btnStyle(isPressed("up"), 0, -25)}
            onClick={() => onButtonClick?.("up")}
          >
            <path d="M -13 -13 L 13 -13 L 13 -45 C 13 -48, -13 -48, -13 -45 Z" fill="url(#snes-dpad-grad)" stroke="#111827" strokeWidth="1.5" rx="2" />
            <polygon points="0,-40 6,-33 -6,-33" fill="#6b7280" />
          </g>
          {/* D-Pad Down */}
          <g
            style={btnStyle(isPressed("down"), 0, 25)}
            onClick={() => onButtonClick?.("down")}
          >
            <path d="M -13 13 L 13 13 L 13 45 C 13 48, -13 48, -13 45 Z" fill="url(#snes-dpad-grad)" stroke="#111827" strokeWidth="1.5" rx="2" />
            <polygon points="0,40 6,33 -6,33" fill="#6b7280" />
          </g>
          {/* D-Pad Left */}
          <g
            style={btnStyle(isPressed("left"), -25, 0)}
            onClick={() => onButtonClick?.("left")}
          >
            <path d="M -13 -13 L -13 13 L -45 13 C -48 13, -48 -13, -45 -13 Z" fill="url(#snes-dpad-grad)" stroke="#111827" strokeWidth="1.5" rx="2" />
            <polygon points="-40,0 -33,6 -33,-6" fill="#6b7280" />
          </g>
          {/* D-Pad Right */}
          <g
            style={btnStyle(isPressed("right"), 25, 0)}
            onClick={() => onButtonClick?.("right")}
          >
            <path d="M 13 -13 L 13 13 L 45 13 C 48 13, 48 -13, 45 -13 Z" fill="url(#snes-dpad-grad)" stroke="#111827" strokeWidth="1.5" rx="2" />
            <polygon points="40,0 33,6 33,-6" fill="#6b7280" />
          </g>
          {/* Center Hub */}
          <rect x="-13" y="-13" width="26" height="26" fill="url(#snes-dpad-grad)" />
          <circle cx="0" cy="0" r="7" fill="#1f2937" stroke="#111827" strokeWidth="1" />
        </g>

        {/* --- Center Slanted Rubber Buttons: Select & Start --- */}
        {/* Select */}
        <g
          id="btn-select"
          style={btnStyle(isPressed("select", ["mode"]), 220, 180)}
          onClick={() => onButtonClick?.("select")}
        >
          <rect
            x="208"
            y="172"
            width="24"
            height="11"
            rx="5.5"
            transform="rotate(-25, 220, 177)"
            fill="#374151"
            stroke="#1f2937"
            strokeWidth="1.2"
          />
          <text x="215" y="210" fill="#4b5563" fontSize="8" fontWeight="bold" textAnchor="middle">
            SELECT
          </text>
        </g>

        {/* Start */}
        <g
          id="btn-start"
          style={btnStyle(isPressed("start"), 280, 180)}
          onClick={() => onButtonClick?.("start")}
        >
          <rect
            x="268"
            y="172"
            width="24"
            height="11"
            rx="5.5"
            transform="rotate(-25, 280, 177)"
            fill="#374151"
            stroke="#1f2937"
            strokeWidth="1.2"
          />
          <text x="278" y="210" fill="#4b5563" fontSize="8" fontWeight="bold" textAnchor="middle">
            START
          </text>
        </g>

        {/* --- Action Buttons (Diamond Formation Right) --- */}
        {/* Button Pod Backdrop */}
        <g transform="translate(400, 160) rotate(-15)">
          <rect x="-65" y="-45" width="130" height="90" rx="45" fill="#717782" opacity="0.4" />
        </g>

        {/* X Button (Top / Yellow/Blue) */}
        <g
          id="btn-x"
          style={btnStyle(isPressed("x"), 390, 125)}
          onClick={() => onButtonClick?.("x")}
        >
          <circle cx="390" cy="125" r="16" fill="url(#snes-btn-x)" stroke="#92400e" strokeWidth="2" />
          <text x="390" y="131" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
            X
          </text>
        </g>

        {/* Y Button (Left / Cyan/Purple) */}
        <g
          id="btn-y"
          style={btnStyle(isPressed("y"), 355, 155)}
          onClick={() => onButtonClick?.("y")}
        >
          <circle cx="355" cy="155" r="16" fill="url(#snes-btn-y)" stroke="#0369a1" strokeWidth="2" />
          <text x="355" y="161" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
            Y
          </text>
        </g>

        {/* B Button (Bottom / Green/Dark Purple) */}
        <g
          id="btn-b"
          style={btnStyle(isPressed("b"), 400, 195)}
          onClick={() => onButtonClick?.("b")}
        >
          <circle cx="400" cy="195" r="16" fill="url(#snes-btn-b)" stroke="#15803d" strokeWidth="2" />
          <text x="400" y="201" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
            B
          </text>
        </g>

        {/* A Button (Right / Red/Violet) */}
        <g
          id="btn-a"
          style={btnStyle(isPressed("a"), 435, 165)}
          onClick={() => onButtonClick?.("a")}
        >
          <circle cx="435" cy="165" r="16" fill="url(#snes-btn-a)" stroke="#b91c1c" strokeWidth="2" />
          <text x="435" y="171" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
            A
          </text>
        </g>
      </svg>
    </div>
  );
}
