import React, { useCallback } from "react";
import { getPlayerActionKey } from "@/lib/gamepadMapping";
import type { PlayerInputEvent } from "@/lib/webrtc";

interface TouchGamepadProps {
  playerSlot: number | null;
  onInput: (event: PlayerInputEvent) => void;
  onActivity?: (action: string, isDown: boolean) => void;
}

export function TouchGamepad({ playerSlot, onInput, onActivity }: TouchGamepadProps) {
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
      {/* Left: D-Pad */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Center cross bg */}
        <div className="absolute w-12 h-36 bg-muted/60 rounded-md border border-border" />
        <div className="absolute w-36 h-12 bg-muted/60 rounded-md border border-border" />

        {/* Up */}
        <button
          {...makeTouchHandlers("up")}
          className="absolute top-0 w-12 h-12 flex items-center justify-center font-bold text-foreground active:bg-primary/50 rounded-t-md"
        >
          ▲
        </button>
        {/* Down */}
        <button
          {...makeTouchHandlers("down")}
          className="absolute bottom-0 w-12 h-12 flex items-center justify-center font-bold text-foreground active:bg-primary/50 rounded-b-md"
        >
          ▼
        </button>
        {/* Left */}
        <button
          {...makeTouchHandlers("left")}
          className="absolute left-0 w-12 h-12 flex items-center justify-center font-bold text-foreground active:bg-primary/50 rounded-l-md"
        >
          ◀
        </button>
        {/* Right */}
        <button
          {...makeTouchHandlers("right")}
          className="absolute right-0 w-12 h-12 flex items-center justify-center font-bold text-foreground active:bg-primary/50 rounded-r-md"
        >
          ▶
        </button>
      </div>

      {/* Center: Mode & Start */}
      <div className="flex flex-col gap-3 items-center">
        <button
          {...makeTouchHandlers("mode")}
          className="px-3 py-1 bg-muted/80 active:bg-primary/60 border border-border rounded-full text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground active:text-foreground"
        >
          Mode
        </button>
        <button
          {...makeTouchHandlers("start")}
          className="px-4 py-1.5 bg-accent/80 active:bg-accent border border-accent rounded-full text-xs font-sans font-black uppercase tracking-wider text-accent-foreground shadow-md"
        >
          Start
        </button>
      </div>

      {/* Right: 6-Button Arc (X Y Z top, A B C bottom) */}
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
    </div>
  );
}
