import { useEffect, useRef } from "react";
import { loadMapping, GAME_ACTIONS } from "@/lib/gamepadMapping";
import type { InputEvent } from "@/lib/webrtc";

const AXIS_THRESHOLD = 0.5;

export function useGamepad(onInput: (event: InputEvent) => void) {
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  useEffect(() => {
    const pressed = new Map<string, boolean>();
    let rafId: number;
    let mapping = loadMapping();

    const reloadMapping = () => { mapping = loadMapping(); };
    window.addEventListener("storage", reloadMapping);
    // Also reload when localStorage is changed in same tab via custom event
    window.addEventListener("gamepad-mapping-changed", reloadMapping);

    function fireInput(stateKey: string, actionName: string, isDown: boolean) {
      const wasDown = pressed.get(stateKey) ?? false;
      if (isDown === wasDown) return;
      pressed.set(stateKey, isDown);
      const action = GAME_ACTIONS[actionName];
      if (!action) return;
      onInputRef.current({ type: isDown ? "keydown" : "keyup", key: action.key, keyCode: action.keyCode, code: action.code });
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
    };
  }, []);
}
