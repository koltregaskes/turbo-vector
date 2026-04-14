import type { ControlState } from "../types";

type TouchAction = "left" | "right" | "throttle" | "brake" | "boost";

function isHandledKey(key: string) {
  return (
    key === "arrowleft" ||
    key === "a" ||
    key === "arrowright" ||
    key === "d" ||
    key === "arrowup" ||
    key === "w" ||
    key === "arrowdown" ||
    key === "s" ||
    key === " " ||
    key === "shift" ||
    key === "r"
  );
}

export class InputController {
  private enabled = false;
  private readonly held = {
    left: false,
    right: false,
    throttle: false,
    brake: false,
    boost: false,
  };
  private restartPressed = false;
  private readonly touchCleanup = new Map<HTMLElement, () => void>();

  private readonly keyDownHandler = (event: KeyboardEvent) => {
    if (!this.enabled) return;
    const key = event.key.toLowerCase();
    if (isHandledKey(key)) {
      event.preventDefault();
    }

    if (key === "arrowleft" || key === "a") this.held.left = true;
    if (key === "arrowright" || key === "d") this.held.right = true;
    if (key === "arrowup" || key === "w") this.held.throttle = true;
    if (key === "arrowdown" || key === "s") this.held.brake = true;
    if (key === " " || key === "shift") this.held.boost = true;
    if (key === "r" && !event.repeat) this.restartPressed = true;
  };

  private readonly keyUpHandler = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (this.enabled && isHandledKey(key)) {
      event.preventDefault();
    }
    if (key === "arrowleft" || key === "a") this.held.left = false;
    if (key === "arrowright" || key === "d") this.held.right = false;
    if (key === "arrowup" || key === "w") this.held.throttle = false;
    if (key === "arrowdown" || key === "s") this.held.brake = false;
    if (key === " " || key === "shift") this.held.boost = false;
  };

  constructor() {
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.clearHeld();
    }
  }

  private clearHeld() {
    this.held.left = false;
    this.held.right = false;
    this.held.throttle = false;
    this.held.brake = false;
    this.held.boost = false;
    this.restartPressed = false;
  }

  bindTouchButton(element: HTMLElement, action: TouchAction) {
    this.unbindTouchButton(element);

    const setPressed = (pressed: boolean) => {
      if (!this.enabled) return;
      this.held[action] = pressed;
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      setPressed(true);
    };
    const onPointerUp = (event: PointerEvent) => {
      event.preventDefault();
      setPressed(false);
    };
    const onPointerLeave = () => setPressed(false);

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("pointerleave", onPointerLeave);

    this.touchCleanup.set(element, () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("pointerleave", onPointerLeave);
    });
  }

  unbindTouchButton(element: HTMLElement) {
    this.touchCleanup.get(element)?.();
    this.touchCleanup.delete(element);
  }

  snapshot(): ControlState {
    if (!this.enabled) {
      return {
        throttle: false,
        brake: false,
        left: false,
        right: false,
        boost: false,
        restartPressed: false,
      };
    }

    return {
      throttle: this.held.throttle,
      brake: this.held.brake,
      left: this.held.left,
      right: this.held.right,
      boost: this.held.boost,
      restartPressed: this.restartPressed,
    };
  }

  endFrame() {
    this.restartPressed = false;
  }

  destroy() {
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    for (const cleanup of this.touchCleanup.values()) {
      cleanup();
    }
    this.touchCleanup.clear();
  }
}
