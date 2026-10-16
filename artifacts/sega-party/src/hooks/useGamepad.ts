import { useEffect, useRef } from "react";
import { loadPlayerGamepadMapping, getPlayerActionKey } from "@/lib/gamepadMapping";
import type { PlayerInputEvent } from "@/lib/webrtc";

const AXIS_THRESHOLD = 0.5;

export function useGamepad(
  playerSlot: number | null,
  onInput: (event: PlayerInputEvent) => void,
  onButtonActivity?: (action: string, isDown: boolean) => void,
) {
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  const onActivityRef = useRef(onButtonActivity);
  onActivityRef.current = onButtonActivity;

  const slotRef = useRef(playerSlot);
  slotRef.current = playerSlot;

  useEffect(() => {
    const pressed = new Map<string, boolean>();
    let rafId: number;
    const slot = Math.max(1, Math.min(4, Math.floor(Number(playerSlot) || 1)));
    let mapping = loadPlayerGamepadMapping(slot);

    const reloadMapping = () => {
      mapping = loadPlayerGamepadMapping(slotRef.current || 1);
    };

    window.addEventListener("storage", reloadMapping);
    window.addEventListener("gamepad-mapping-changed", reloadMapping);
    window.addEventListener("controls-mapping-changed", reloadMapping);

    function fireInput(stateKey: string, actionName: string, isDown: boolean) {
      const wasDown = pressed.get(stateKey) ?? false;
      if (isDown === wasDown) return;
      pressed.set(stateKey, isDown);

      onActivityRef.current?.(actionName, isDown);

      const activeSlot = slotRef.current;
      if (!activeSlot) return; // Spectators don't send inputs to the game

      const keyInfo = getPlayerActionKey(activeSlot, actionName) || {
        key: actionName,
        keyCode: 0,
        code: actionName,
        label: actionName,
      };

      onInputRef.current({
        type: isDown ? "keydown" : "keyup",
        playerIndex: activeSlot,
        action: actionName,
        key: keyInfo.key,
        keyCode: keyInfo.keyCode,
        code: keyInfo.code,
      });
    }

    function poll() {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;
        const id = gp.index;

        // Digital buttons
        for (let i = 0; i < gp.buttons.length; i++) {
          const isDown = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
          const actionName = mapping[String(i)];
          if (actionName) fireInput(`${id}-btn-${i}`, actionName, isDown);
        }

        // Axes (left stick → d-pad)
        const axisMap: Array<[string, string, string]> = [
          ["axis-0-neg", "axis-0-pos", "0"],
          ["axis-1-neg", "axis-1-pos", "1"],
        ];
        for (const [negKey, posKey, axisIdx] of axisMap) {
          const val = gp.axes[Number(axisIdx)] ?? 0;
          const negAction = mapping[negKey];
          const posAction = mapping[posKey];
          if (negAction) fireInput(`${id}-axis-${axisIdx}-neg`, negAction, val < -AXIS_THRESHOLD);
          if (posAction) fireInput(`${id}-axis-${axisIdx}-pos`, posAction, val > AXIS_THRESHOLD);
        }
      }
      rafId = requestAnimationFrame(poll);
    }

    rafId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("storage", reloadMapping);
      window.removeEventListener("gamepad-mapping-changed", reloadMapping);
      window.removeEventListener("controls-mapping-changed", reloadMapping);
    };
  }, [playerSlot]);
}
