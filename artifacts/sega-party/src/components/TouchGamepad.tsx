import React, { useCallback, useRef, useState } from "react";
import { getPlayerActionKey } from "@/lib/gamepadMapping";
import type { PlayerInputEvent } from "@/lib/webrtc";
import { cn } from "@/lib/utils";

interface VirtualDPadProps {
  onDirectionChange: (action: string, isDown: boolean) => void;
}

export function VirtualDPad({ onDirectionChange }: VirtualDPadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const activeDirectionsRef = useRef({ up: false, down: false, left: false, right: false });
  const activePointerIdRef = useRef<number | null>(null);
  const [activeDirs, setActiveDirs] = useState({ up: false, down: false, left: false, right: false });
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number } | null>(null);

  const updateDirections = useCallback(
    (up: boolean, down: boolean, left: boolean, right: boolean) => {
      const prev = activeDirectionsRef.current;
      if (prev.up !== up) {
        activeDirectionsRef.current.up = up;
        onDirectionChange("up", up);
      }
      if (prev.down !== down) {
        activeDirectionsRef.current.down = down;
        onDirectionChange("down", down);
      }
      if (prev.left !== left) {
        activeDirectionsRef.current.left = left;
        onDirectionChange("left", left);
      }
      if (prev.right !== right) {
        activeDirectionsRef.current.right = right;
        onDirectionChange("right", right);
      }
      setActiveDirs({ up, down, left, right });
    },
    [onDirectionChange],
  );

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!padRef.current) return;
      const rect = padRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const distance = Math.hypot(dx, dy);

      // Deadzone: 12px
      if (distance < 12) {
        setThumbPos({ x: 0, y: 0 });
        updateDirections(false, false, false, false);
        return;
      }

      // Constrain visual thumb to radius 38px
      const maxRadius = 38;
      const clampedDist = Math.min(distance, maxRadius);
      const angleRad = Math.atan2(dy, dx);
      setThumbPos({
        x: Math.cos(angleRad) * clampedDist,
        y: Math.sin(angleRad) * clampedDist,
      });

      // Angle in degrees (-180 to +180)
      const angle = (angleRad * 180) / Math.PI;

      // 8-Way Sector Mapping (45-degree slices):
      // Right: -67.5 to 67.5
      // Down: 22.5 to 157.5
      // Left: >= 112.5 or <= -112.5
      // Up: -157.5 to -22.5
      const right = angle >= -67.5 && angle <= 67.5;
      const down = angle >= 22.5 && angle <= 157.5;
      const left = angle >= 112.5 || angle <= -112.5;
      const up = angle >= -157.5 && angle <= -22.5;

      updateDirections(up, down, left, right);
    },
    [updateDirections],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    handlePointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      e.preventDefault();
      handlePointer(e);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      activePointerIdRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
      setThumbPos(null);
      updateDirections(false, false, false, false);
    }
  };

  return (
    <div
      ref={padRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="relative w-36 h-36 flex items-center justify-center touch-none select-none cursor-pointer"
      aria-label="Virtual D-Pad"
      role="group"
    >
      {/* Background cross arms */}
      <div className="absolute w-12 h-36 bg-muted/70 rounded-lg border border-border shadow-inner pointer-events-none" />
      <div className="absolute w-36 h-12 bg-muted/70 rounded-lg border border-border shadow-inner pointer-events-none" />

      {/* Directional arrow highlights */}
      <div
        className={cn(
          "absolute top-2 font-bold text-xs pointer-events-none transition-all",
          activeDirs.up ? "text-primary scale-125 font-black" : "text-muted-foreground"
        )}
      >
        ▲
      </div>
      <div
        className={cn(
          "absolute bottom-2 font-bold text-xs pointer-events-none transition-all",
          activeDirs.down ? "text-primary scale-125 font-black" : "text-muted-foreground"
        )}
      >
        ▼
      </div>
      <div
        className={cn(
          "absolute left-2 font-bold text-xs pointer-events-none transition-all",
          activeDirs.left ? "text-primary scale-125 font-black" : "text-muted-foreground"
        )}
      >
        ◀
      </div>
      <div
        className={cn(
          "absolute right-2 font-bold text-xs pointer-events-none transition-all",
          activeDirs.right ? "text-primary scale-125 font-black" : "text-muted-foreground"
        )}
      >
        ▶
      </div>

      {/* Center Pivot / Floating Thumb Tracking Indicator */}
      <div
        className={cn(
          "absolute w-9 h-9 rounded-full border pointer-events-none transition-transform duration-75 flex items-center justify-center",
          thumbPos
            ? "bg-primary/40 border-primary shadow-[0_0_12px_rgba(59,130,246,0.6)]"
            : "bg-black/40 border-white/20"
        )}
        style={{
          transform: thumbPos
            ? `translate(${thumbPos.x}px, ${thumbPos.y}px)`
            : "translate(0px, 0px)",
        }}
      >
        <div className="w-3 h-3 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

interface TouchGamepadProps {
  playerSlot: number | null;
  onInput: (event: PlayerInputEvent) => void;
  onActivity?: (action: string, isDown: boolean) => void;
  activeCore?: string;
}

export function TouchGamepad({ playerSlot, onInput, onActivity, activeCore }: TouchGamepadProps) {
  const normCore = (activeCore || "segaMD").toLowerCase();
  const is2Button =
    normCore === "nes" ||
    normCore === "gb" ||
    normCore === "gbc" ||
    normCore === "segams" ||
    normCore === "segagg";
  const is4ButtonDiamond =
    normCore === "snes" ||
    normCore === "gba" ||
    normCore === "psx" ||
    normCore === "nds" ||
    normCore === "psp";
  const isPsx = normCore === "psx";

  const triggerInput = useCallback(
    (action: string, isDown: boolean) => {
      onActivity?.(action, isDown);
      if (!playerSlot) return;

      if (isDown && typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }

      const keyInfo = getPlayerActionKey(playerSlot, action);
      if (!keyInfo) return;

      onInput({
        type: isDown ? "keydown" : "keyup",
        playerIndex: playerSlot,
        action,
        key: keyInfo.key,
        keyCode: keyInfo.keyCode,
        code: keyInfo.code,
      });
    },
    [playerSlot, onInput, onActivity],
  );

  const makeTouchHandlers = (action: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      triggerInput(action, true);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      triggerInput(action, false);
    },
    onTouchCancel: (e: React.TouchEvent) => {
      e.preventDefault();
      triggerInput(action, false);
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      triggerInput(action, true);
    },
    onMouseUp: (e: React.MouseEvent) => {
      e.preventDefault();
      triggerInput(action, false);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      triggerInput(action, false);
    },
  });

  return (
    <div className="w-full max-w-2xl mx-auto select-none p-3 bg-black/60 backdrop-blur rounded-xl border border-primary/40 shadow-2xl flex items-center justify-between touch-none">
      {/* Left: Continuous 8-Way Radial Thumbpad (DES-R2-02) */}
      <VirtualDPad onDirectionChange={triggerInput} />

      {/* Center: Mode / Select & Start (DES-R2-06 min 44px touch targets) */}
      <div className="flex flex-col gap-2.5 items-center">
        <button
          {...makeTouchHandlers("mode")}
          className="min-h-[44px] min-w-[56px] px-3.5 py-2 flex items-center justify-center bg-muted/80 active:bg-primary/60 border border-border rounded-full text-xs font-sans font-bold uppercase tracking-wider text-muted-foreground active:text-foreground shadow-sm transition-transform active:scale-95"
        >
          {is2Button || is4ButtonDiamond ? "Select" : "Mode"}
        </button>
        <button
          {...makeTouchHandlers("start")}
          className="min-h-[44px] min-w-[56px] px-3.5 py-2 flex items-center justify-center bg-accent/80 active:bg-accent border border-accent rounded-full text-xs font-sans font-black uppercase tracking-wider text-accent-foreground shadow-md transition-transform active:scale-95"
        >
          Start
        </button>
      </div>

      {/* Right: Console-Adaptive Action Buttons (DES-07) */}
      {is2Button ? (
        /* 2 Large Buttons (B, A) for NES / GB / GBC / SegaMS */
        <div className="flex items-center gap-3 pr-2">
          <button
            {...makeTouchHandlers("b")}
            className="w-14 h-14 rounded-full bg-red-950/80 active:bg-red-600 border-2 border-red-500 font-display font-black text-base text-red-300 active:text-white shadow-lg translate-y-2 flex items-center justify-center transition-transform"
          >
            B
          </button>
          <button
            {...makeTouchHandlers("a")}
            className="w-14 h-14 rounded-full bg-red-950/80 active:bg-red-600 border-2 border-red-500 font-display font-black text-base text-red-300 active:text-white shadow-lg -translate-y-2 flex items-center justify-center transition-transform"
          >
            A
          </button>
        </div>
      ) : is4ButtonDiamond ? (
        /* 4-Button Diamond Layout (X, Y, A, B) for SNES / GBA / PSX */
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Top: X (or △ for PSX) */}
          <button
            {...makeTouchHandlers("x")}
            className="absolute top-0 w-11 h-11 rounded-full bg-blue-950/80 active:bg-blue-600 border border-blue-500 font-display font-bold text-sm text-blue-300 active:text-white shadow flex items-center justify-center"
          >
            {isPsx ? "△" : "X"}
          </button>
          {/* Left: Y (or □ for PSX) */}
          <button
            {...makeTouchHandlers("y")}
            className="absolute left-0 w-11 h-11 rounded-full bg-blue-950/80 active:bg-blue-600 border border-blue-500 font-display font-bold text-sm text-blue-300 active:text-white shadow flex items-center justify-center"
          >
            {isPsx ? "□" : "Y"}
          </button>
          {/* Right: A (or ○ for PSX) */}
          <button
            {...makeTouchHandlers("a")}
            className="absolute right-0 w-12 h-12 rounded-full bg-red-950/80 active:bg-red-600 border-2 border-red-500 font-display font-black text-sm text-red-300 active:text-white shadow-lg flex items-center justify-center"
          >
            {isPsx ? "○" : "A"}
          </button>
          {/* Bottom: B (or ✕ for PSX) */}
          <button
            {...makeTouchHandlers("b")}
            className="absolute bottom-0 w-12 h-12 rounded-full bg-red-950/80 active:bg-red-600 border-2 border-red-500 font-display font-black text-sm text-red-300 active:text-white shadow-lg flex items-center justify-center"
          >
            {isPsx ? "✕" : "B"}
          </button>
        </div>
      ) : (
        /* 6-Button Arc (3x2: X Y Z top, A B C bottom) for Sega Genesis / Arcade / Default */
        <div className="flex flex-col gap-2">
          {/* Top row: X, Y, Z */}
          <div className="flex gap-2 justify-end">
            <button
              {...makeTouchHandlers("x")}
              className="w-10 h-10 rounded-full bg-blue-950/80 active:bg-blue-600 border border-blue-500 font-display font-bold text-xs text-blue-300 active:text-white shadow"
            >
              X
            </button>
            <button
              {...makeTouchHandlers("y")}
              className="w-10 h-10 rounded-full bg-blue-950/80 active:bg-blue-600 border border-blue-500 font-display font-bold text-xs text-blue-300 active:text-white shadow"
            >
              Y
            </button>
            <button
              {...makeTouchHandlers("z")}
              className="w-10 h-10 rounded-full bg-blue-950/80 active:bg-blue-600 border border-blue-500 font-display font-bold text-xs text-blue-300 active:text-white shadow"
            >
              Z
            </button>
          </div>

          {/* Bottom row: A, B, C */}
          <div className="flex gap-2 justify-end">
            <button
              {...makeTouchHandlers("a")}
              className="w-12 h-12 rounded-full bg-red-950/80 active:bg-red-600 border-2 border-red-500 font-display font-black text-sm text-red-300 active:text-white shadow-lg"
            >
              A
            </button>
            <button
              {...makeTouchHandlers("b")}
              className="w-12 h-12 rounded-full bg-red-950/80 active:bg-red-600 border-2 border-red-500 font-display font-black text-sm text-red-300 active:text-white shadow-lg"
            >
              B
            </button>
            <button
              {...makeTouchHandlers("c")}
              className="w-12 h-12 rounded-full bg-red-950/80 active:bg-red-600 border-2 border-red-500 font-display font-black text-sm text-red-300 active:text-white shadow-lg"
            >
              C
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
