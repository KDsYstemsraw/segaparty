import React from "react";

export interface ControllerGraphicProps {
  activeButtons?: Set<string>;
  highlightButton?: string | null;
  onButtonClick?: (actionId: string) => void;
  className?: string;
}

export function PsxControllerGraphic({
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
    filter: isActive ? "drop-shadow(0 0 10px rgba(59, 130, 246, 0.95)) brightness(1.3)" : undefined,
  });

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox="0 0 520 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
      >
        <defs>
          {/* Chassis body gradients */}
          <linearGradient id="psx-chassis" x1="260" y1="50" x2="260" y2="350" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#cfd2d8" />
            <stop offset="50%" stopColor="#b4b8be" />
            <stop offset="100%" stopColor="#969aa1" />
          </linearGradient>
          <linearGradient id="psx-inner-rim" x1="260" y1="60" x2="260" y2="330" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e4e7ec" />
            <stop offset="100%" stopColor="#83878e" />
          </linearGradient>
          <radialGradient id="psx-dpad-well" cx="135" cy="185" r="55" gradientUnits="userSpaceOnUse">
            <stop offset="70%" stopColor="#9a9fa7" />
            <stop offset="100%" stopColor="#7a7e85" />
          </radialGradient>
          <radialGradient id="psx-btn-well" cx="385" cy="185" r="55" gradientUnits="userSpaceOnUse">
            <stop offset="70%" stopColor="#9a9fa7" />
            <stop offset="100%" stopColor="#7a7e85" />
          </radialGradient>
          {/* Button face gradients */}
          <linearGradient id="psx-btn-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#43464d" />
            <stop offset="100%" stopColor="#222428" />
          </linearGradient>
          <linearGradient id="psx-shoulder" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9da2aa" />
            <stop offset="100%" stopColor="#676b73" />
          </linearGradient>
        </defs>

        {/* --- Top Shoulder Triggers (L2 / R2, L1 / R1) --- */}
        {/* L2 Trigger */}
        <g
          id="btn-l2"
          style={btnStyle(isPressed("l2"), 110, 38)}
          onClick={() => onButtonClick?.("l2")}
        >
          <path
            d="M 85 45 C 85 28, 135 28, 135 45 L 132 58 L 88 58 Z"
            fill="url(#psx-shoulder)"
            stroke="#53565c"
            strokeWidth="2"
          />
          <text x="110" y="42" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">
            L2
          </text>
        </g>

        {/* R2 Trigger */}
        <g
          id="btn-r2"
          style={btnStyle(isPressed("r2"), 410, 38)}
          onClick={() => onButtonClick?.("r2")}
        >
          <path
            d="M 385 45 C 385 28, 435 28, 435 45 L 432 58 L 388 58 Z"
            fill="url(#psx-shoulder)"
            stroke="#53565c"
            strokeWidth="2"
          />
          <text x="410" y="42" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">
            R2
          </text>
        </g>

        {/* L1 Bumper */}
        <g
          id="btn-l1"
          style={btnStyle(isPressed("l1", ["l"]), 110, 68)}
          onClick={() => onButtonClick?.("l1")}
        >
          <path
            d="M 75 75 C 75 58, 145 58, 145 75 L 140 85 L 80 85 Z"
            fill="url(#psx-shoulder)"
            stroke="#53565c"
            strokeWidth="2"
          />
          <text x="110" y="73" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
            L1
          </text>
        </g>

        {/* R1 Bumper */}
        <g
          id="btn-r1"
          style={btnStyle(isPressed("r1", ["r"]), 410, 68)}
          onClick={() => onButtonClick?.("r1")}
        >
          <path
            d="M 375 75 C 375 58, 445 58, 445 75 L 440 85 L 380 85 Z"
            fill="url(#psx-shoulder)"
            stroke="#53565c"
            strokeWidth="2"
          />
          <text x="410" y="73" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
            R1
          </text>
        </g>

        {/* --- Main Controller Chassis --- */}
        <path
          d="M 160 82 
             C 210 88, 310 88, 360 82 
             C 415 75, 475 110, 485 180 
             C 498 250, 445 340, 400 342 
             C 365 344, 345 285, 335 240 
             C 320 200, 200 200, 185 240 
             C 175 285, 155 344, 120 342 
             C 75 340, 22 250, 35 180 
             C 45 110, 105 75, 160 82 Z"
          fill="url(#psx-chassis)"
          stroke="#7f838a"
          strokeWidth="3"
        />

        {/* Subtle Grip Bevels */}
        <path
          d="M 155 92 C 110 88, 55 125, 48 185 C 38 245, 85 325, 118 328 C 145 330, 162 280, 172 235"
          fill="none"
          stroke="url(#psx-inner-rim)"
          strokeWidth="2.5"
          opacity="0.6"
        />
        <path
          d="M 365 92 C 410 88, 465 125, 472 185 C 482 245, 435 325, 402 328 C 375 330, 358 280, 348 235"
          fill="none"
          stroke="url(#psx-inner-rim)"
          strokeWidth="2.5"
          opacity="0.6"
        />

        {/* Center PlayStation Branding & Bridge */}
        <g opacity="0.85">
          <circle cx="260" cy="115" r="16" fill="#9da1a9" stroke="#7e828a" strokeWidth="1" />
          {/* PS Logo representation */}
          <path d="M 256 106 L 256 124" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" />
          <path d="M 256 109 C 263 107, 267 113, 260 116" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 252 121 C 256 123, 266 123, 268 119" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
          <text x="260" y="142" fill="#585c63" fontSize="8" fontWeight="bold" letterSpacing="2" textAnchor="middle">
            SONY
          </text>
        </g>

        {/* --- D-Pad Wells & Cross Assembly (Left) --- */}
        <circle cx="135" cy="185" r="54" fill="url(#psx-dpad-well)" stroke="#6d7178" strokeWidth="1.5" />

        {/* D-Pad Up */}
        <g
          id="btn-dpad-up"
          style={btnStyle(isPressed("up"), 135, 155)}
          onClick={() => onButtonClick?.("up")}
        >
          <path
            d="M 124 135 C 124 132, 146 132, 146 135 L 146 166 L 124 166 Z"
            fill="url(#psx-btn-dark)"
            stroke="#1b1c1e"
            strokeWidth="1.5"
            rx="3"
          />
          <path d="M 135 142 L 140 149 L 130 149 Z" fill="#696d75" />
        </g>

        {/* D-Pad Down */}
        <g
          id="btn-dpad-down"
          style={btnStyle(isPressed("down"), 135, 215)}
          onClick={() => onButtonClick?.("down")}
        >
          <path
            d="M 124 204 L 146 204 L 146 235 C 146 238, 124 238, 124 235 Z"
            fill="url(#psx-btn-dark)"
            stroke="#1b1c1e"
            strokeWidth="1.5"
            rx="3"
          />
          <path d="M 135 228 L 140 221 L 130 221 Z" fill="#696d75" />
        </g>

        {/* D-Pad Left */}
        <g
          id="btn-dpad-left"
          style={btnStyle(isPressed("left"), 105, 185)}
          onClick={() => onButtonClick?.("left")}
        >
          <path
            d="M 85 174 C 82 174, 82 196, 85 196 L 116 196 L 116 174 Z"
            fill="url(#psx-btn-dark)"
            stroke="#1b1c1e"
            strokeWidth="1.5"
            rx="3"
          />
          <path d="M 92 185 L 99 180 L 99 190 Z" fill="#696d75" />
        </g>

        {/* D-Pad Right */}
        <g
          id="btn-dpad-right"
          style={btnStyle(isPressed("right"), 165, 185)}
          onClick={() => onButtonClick?.("right")}
        >
          <path
            d="M 154 174 L 185 174 C 188 174, 188 196, 185 196 L 154 196 Z"
            fill="url(#psx-btn-dark)"
            stroke="#1b1c1e"
            strokeWidth="1.5"
            rx="3"
          />
          <path d="M 178 185 L 171 180 L 171 190 Z" fill="#696d75" />
        </g>

        {/* Center D-Pad Pivot Indent */}
        <circle cx="135" cy="185" r="9" fill="#1b1c1e" opacity="0.6" />

        {/* --- Center Buttons: Select & Start --- */}
        {/* Select */}
        <g
          id="btn-select"
          style={btnStyle(isPressed("select", ["mode"]), 220, 195)}
          onClick={() => onButtonClick?.("select")}
        >
          <rect x="208" y="190" width="24" height="10" rx="5" fill="#43464d" stroke="#25262a" strokeWidth="1" />
          <text x="220" y="213" fill="#585c63" fontSize="8" fontWeight="bold" textAnchor="middle">
            SELECT
          </text>
        </g>

        {/* Start */}
        <g
          id="btn-start"
          style={btnStyle(isPressed("start"), 300, 195)}
          onClick={() => onButtonClick?.("start")}
        >
          <rect x="288" y="190" width="24" height="10" rx="5" fill="#43464d" stroke="#25262a" strokeWidth="1" />
          <text x="300" y="213" fill="#585c63" fontSize="8" fontWeight="bold" textAnchor="middle">
            START
          </text>
        </g>

        {/* --- Action Buttons (Right) --- */}
        <circle cx="385" cy="185" r="54" fill="url(#psx-btn-well)" stroke="#6d7178" strokeWidth="1.5" />

        {/* Triangle (Top / Y) */}
        <g
          id="btn-triangle"
          style={btnStyle(isPressed("triangle", ["y"]), 385, 150)}
          onClick={() => onButtonClick?.("triangle")}
        >
          <circle cx="385" cy="150" r="15" fill="url(#psx-btn-dark)" stroke="#1a1c1e" strokeWidth="1.5" />
          <polygon
            points="385,142 393,155 377,155"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>

        {/* Circle (Right / B) */}
        <g
          id="btn-circle"
          style={btnStyle(isPressed("circle", ["b"]), 420, 185)}
          onClick={() => onButtonClick?.("circle")}
        >
          <circle cx="420" cy="185" r="15" fill="url(#psx-btn-dark)" stroke="#1a1c1e" strokeWidth="1.5" />
          <circle cx="420" cy="185" r="6.5" fill="none" stroke="#ef4444" strokeWidth="2.5" />
        </g>

        {/* Cross (Bottom / A) */}
        <g
          id="btn-cross"
          style={btnStyle(isPressed("cross", ["a"]), 385, 220)}
          onClick={() => onButtonClick?.("cross")}
        >
          <circle cx="385" cy="220" r="15" fill="url(#psx-btn-dark)" stroke="#1a1c1e" strokeWidth="1.5" />
          <line x1="379" y1="214" x2="391" y2="226" stroke="#3b82f6" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="391" y1="214" x2="379" y2="226" stroke="#3b82f6" strokeWidth="2.8" strokeLinecap="round" />
        </g>

        {/* Square (Left / X) */}
        <g
          id="btn-square"
          style={btnStyle(isPressed("square", ["x"]), 350, 185)}
          onClick={() => onButtonClick?.("square")}
        >
          <circle cx="350" cy="185" r="15" fill="url(#psx-btn-dark)" stroke="#1a1c1e" strokeWidth="1.5" />
          <rect
            x="344"
            y="179"
            width="12"
            height="12"
            fill="none"
            stroke="#ec4899"
            strokeWidth="2.5"
            rx="1"
          />
        </g>
      </svg>
    </div>
  );
}
