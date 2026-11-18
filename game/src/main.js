// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, resetWorld, applySave, stepWorld, respawn, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_INTERACT, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readSave() {
  return state.loadSave();
}

function runShot(name) {
  const scene = stageShot(name, state, seed);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (sx, sy) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return {
      x: state.camera.x + (sx - rect.left) * scaleX - 640,
      y: state.camera.y + (sy - rect.top) * scaleY - 360,
    };
  });
  let screen = SCREEN_TITLE;
  let best = state.readBest();
  let saveExists = !!readSave();
  let accumulator = 0;
  let last = performance.now();
  let continuePressed = false;
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && !event.repeat) continuePressed = true;
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetWorld(state, seed);
    saveExists = !!readSave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    state.audio.unlock();
    announce('Playing. Mama Delia has a job for you.');
  }

  function continueGame() {
    const save = readSave();
    resetWorld(state, seed);
    if (save) applySave(state, save);
    saveExists = !!save;
    accumulator = 0;
    screen = SCREEN_PLAY;
    state.audio.unlock();
    announce('Continuing your game in Port Solmar.');
  }

  function endGame(kind) {
    screen = kind === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
    const finalScore = state.score + state.player.money;
    if (finalScore > best) {
      best = finalScore;
      state.writeBest(best);
    }
    announce(kind === 'busted' ? 'Busted. The police took you in.' : 'Wasted. Port Solmar is not kind to the careless.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      state.audio.setMuted(!state.audio.isMuted());
      return actions & (ACTION_INTERACT | ACTION_RELOAD);
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      if (screen === SCREEN_TITLE) startGame();
      else {
        respawn(state, screen === SCREEN_BUSTED ? 'busted' : 'wasted');
        screen = SCREEN_PLAY;
      }
      return 0;
    }
    if (continuePressed && screen === SCREEN_TITLE && saveExists) {
      continuePressed = false;
      continueGame();
      return 0;
    }
    continuePressed = false;
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions & (ACTION_INTERACT | ACTION_RELOAD);
  }

  const IDLE_FRAME = { mx: 0, my: 0, aimX: 0, aimY: 0, fire: false, sprint: false };

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    let pending = handleActions(actions);
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title panel.
      while (accumulator >= STEP) {
        stepWorld(state, STEP, IDLE_FRAME, 0);
        accumulator -= STEP;
      }
      renderer.draw(state, screen, best, saveExists);
      return;
    }
    if (screen !== SCREEN_PLAY) {
      accumulator = 0;
      renderer.draw(state, screen, best, saveExists);
      return;
    }
    while (accumulator >= STEP) {
      const frameInput = input.frame();
      const events = stepWorld(state, STEP, frameInput, pending);
      pending = 0;
      accumulator -= STEP;
      if (events & EVENT_BUSTED) { endGame('busted'); break; }
      if (events & EVENT_WASTED) { endGame('wasted'); break; }
    }
    renderer.draw(state, screen, best, saveExists);
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLMAR Neon Streets. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
