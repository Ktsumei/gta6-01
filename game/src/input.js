// Keyboard and pointer input. Held keys give a movement vector and a sprint flag; the
// mouse gives a world-space aim point; one-shot presses (enter car, reload, start, pause,
// mute) are queued as bit flags and taken once by the loop, so a press between two frames
// is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_INTERACT = 8;
export const ACTION_RELOAD = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const INTERACT = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);

/**
 * `target` is the canvas; `toWorld(sx, sy)` converts a pointer's screen pixels to world
 * coordinates (the caller supplies the camera). The returned object reads the input every
 * frame and hands the loop one frame object plus the queued one-shot actions.
 */
export function createInput(target, toWorld) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || SPRINT.has(event.code)) held.add(event.code);
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  window.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  function axis(negative, positive) {
    let value = 0;
    for (const code of negative) if (held.has(code)) value -= 1;
    for (const code of positive) if (held.has(code)) value += 1;
    return value;
  }

  return {
    /** The movement vector, aim point and held fire state for this frame. */
    frame() {
      const mx = axis(LEFT, RIGHT);
      const my = axis(UP, DOWN);
      const aim = toWorld(mouseX, mouseY);
      let sprint = false;
      for (const code of SPRINT) if (held.has(code)) sprint = true;
      return { mx, my, aimX: aim.x, aimY: aim.y, fire: mouseDown, sprint };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
