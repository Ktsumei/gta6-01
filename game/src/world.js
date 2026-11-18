// The world: one state object and the step that advances it. The player moves on foot or
// drives; cars collide with buildings, each other and pedestrians; the police, the traffic,
// the combat and the missions all run from this one step. Nothing here reads the clock or
// Math.random — every random choice comes from the seeded stream, so the same seed and the
// same inputs always give the same world.

import { CITY, VIEW, PLAYER, CAR, CLOCK, SAVE_KEY, BEST_KEY } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { generateCity, collideCircle, PLACES } from './city.js';
import { stepTraffic, makeTrafficCar, makePed, seedParkedCars, scarePeds } from './traffic.js';
import { stepPolice, addWanted } from './police.js';
import { stepCombat, playerAttack, damageCar, spawnPickup, burst } from './combat.js';
import { startMission, stepMissions, restartMission, missionTarget } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    vx: 0, vy: 0,
    health: PLAYER.health,
    armor: 0,
    money: 40,
    ammo: PLAYER.magSize,
    reserveAmmo: 48,
    weapon: 'fists',
    inCar: false,
    car: null,
    wanted: 0,
    wantedTimer: 0,
    lastCrime: -100,
    lastWitnessedShot: -100,
    invulnerable: 0,
    attackCooldown: 0,
    reloadTimer: 0,
  };
}

export function createWorld(random) {
  const city = generateCity(random);
  const audio = createAudio();
  const state = {
    random,
    city,
    audio,
    time: 0,
    clockMinutes: CLOCK.startMinutes,
    player: makePlayer(PLACES.ferryTerminal.x, PLACES.ferryTerminal.y),
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    skid: [],
    mission: null,
    storyComplete: false,
    camera: { x: PLACES.ferryTerminal.x, y: PLACES.ferryTerminal.y },
    shake: 0,
    score: 0,
    best: 0,
    events: 0,
    toasts: [],
    stats: { carsStolen: 0, pedsHit: 0, kills: 0, missionsDone: 0 },
    EVENT_BUSTED,
    EVENT_WASTED,
  };
  state.toast = (text) => {
    state.toasts.push({ text, timer: 4 });
    if (state.toasts.length > 3) state.toasts.shift();
  };
  state.save = () => {
    try {
      const player = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: player.money,
        missionIndex: state.mission ? state.mission.index : 0,
        x: player.x, y: player.y,
        health: player.health, armor: player.armor,
        weapon: player.weapon, ammo: player.ammo, reserveAmmo: player.reserveAmmo,
        score: state.score,
      }));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  };
  state.loadSave = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  state.readBest = () => {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  };
  state.writeBest = (value) => {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // Storage can be off: the best score then lasts this visit only.
    }
  };

  state.best = state.readBest();
  state.cars = seedParkedCars(random, city);
  for (let index = 0; index < 15; index += 1) {
    const car = makeTrafficCar(random, city, state.player.x, state.player.y, 300);
    if (car) state.cars.push(car);
  }
  for (let index = 0; index < 20; index += 1) {
    const ped = makePed(random, city, state.player.x, state.player.y, 200);
    if (ped) state.peds.push(ped);
  }
  // A few supplies near the ferry terminal so the first minutes are kind.
  spawnPickup(state, PLACES.ferryTerminal.x + 80, PLACES.ferryTerminal.y - 40, 'health', 0);
  spawnPickup(state, PLACES.ferryTerminal.x - 70, PLACES.ferryTerminal.y + 60, 'ammo', 0);
  startMission(state, 0);
  return state;
}

/** Rebuild the world from a fresh seeded stream (same seed, same city). */
export function resetWorld(state, seed) {
  const fresh = createWorld(createRandom(seed));
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.toast = fresh.toast;
  state.save = fresh.save;
  state.loadSave = fresh.loadSave;
  state.readBest = fresh.readBest;
  state.writeBest = fresh.writeBest;
}

/** Continue from a saved game: money, mission and position restored. */
export function applySave(state, save) {
  const player = state.player;
  player.money = save.money;
  player.health = save.health;
  player.armor = save.armor;
  player.weapon = save.weapon;
  player.ammo = save.ammo;
  player.reserveAmmo = save.reserveAmmo;
  player.x = save.x;
  player.y = save.y;
  state.score = save.score;
  state.camera.x = save.x;
  state.camera.y = save.y;
  startMission(state, Math.min(save.missionIndex, 5));
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < bestD) { bestD = dist; best = car; }
  }
  return best;
}

function enterCar(state, car) {
  const player = state.player;
  player.inCar = true;
  player.car = car;
  player.vx = 0;
  player.vy = 0;
  if (car.kind === 'parked' || car.kind === 'traffic' || car.kind === 'police') {
    addWanted(state, 1);
    state.stats.carsStolen += 1;
    state.toast(car.kind === 'police' ? 'You stole a police car — the whole city heard that' : 'Car stolen — the heat is on');
    scarePeds(state, car.x, car.y, 160);
  }
  car.kind = 'player';
  car.speed = 0;
}

function exitCar(state) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  const px = car.x + Math.cos(side) * 36;
  const py = car.y + Math.sin(side) * 36;
  const fixed = collideCircle(state.city, px, py, PLAYER.radius, false);
  player.x = fixed.x;
  player.y = fixed.y;
  player.angle = car.angle;
  player.inCar = false;
  player.car = null;
  car.kind = 'parked';
  car.speed = 0;
}

function stepPlayerOnFoot(state, dt, frame) {
  const player = state.player;
  let mx = frame.mx;
  let my = frame.my;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const speed = frame.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const nx = player.x + mx * speed * dt;
  const ny = player.y + my * speed * dt;
  const fixed = collideCircle(state.city, nx, ny, PLAYER.radius, false);
  player.x = fixed.x;
  player.y = fixed.y;
  player.angle = Math.atan2(frame.aimY - player.y, frame.aimX - player.x);
  if (frame.fire) playerAttack(state, frame.aimX, frame.aimY);
}

function stepPlayerDriving(state, dt, frame) {
  const player = state.player;
  const car = player.car;
  if (!car) {
    player.inCar = false;
    return;
  }
  const speedSign = car.speed >= 0 ? 1 : -1;
  const agility = Math.min(1, Math.abs(car.speed) / 140);
  car.angle += frame.mx * CAR.turnRate * agility * speedSign * dt;
  if (frame.my > 0) car.speed += CAR.accel * dt;
  else if (frame.my < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  }
  car.speed -= car.speed * CAR.drag * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideCircle(state.city, nx, ny, 22, false);
  if ((fixed.hitX || fixed.hitY) && Math.abs(car.speed) > 180) {
    damageCar(state, car, 6);
    state.audio.crash();
    state.shake = Math.min(10, state.shake + 4);
    burst(state, car.x, car.y, '#c8b25a', 6, 130, 0.4);
  }
  car.x = fixed.x;
  car.y = fixed.y;
  if (fixed.hitX || fixed.hitY) car.speed *= 0.55;
  // Hard cornering leaves skid marks.
  if (Math.abs(car.speed) > 320 && Math.abs(frame.mx) > 0.5) {
    state.skid.push({ x: car.x, y: car.y, angle: car.angle, life: 3 });
    if (state.skid.length > 120) state.skid.shift();
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  if (frame.fire) playerAttack(state, frame.aimX, frame.aimY);
  // A fast car sends pedestrians scattering before it reaches them.
  if (Math.abs(car.speed) > 60) {
    scarePeds(state, car.x + Math.cos(car.angle) * 70, car.y + Math.sin(car.angle) * 70, 140);
  }
  // Running over pedestrians.
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    if (dx * dx + dy * dy < 28 * 28 && Math.abs(car.speed) > 40) {
      ped.dead = true;
      ped.deadTimer = 0;
      burst(state, ped.x, ped.y, '#e5534b', 8, 150, 0.5);
      addWanted(state, 1);
      state.stats.pedsHit += 1;
      state.audio.crash();
      state.shake = Math.min(10, state.shake + 3);
    }
  }
}

/** Car-on-car collisions: push apart, trade speed, dent at high closing speed. */
function stepCarCollisions(state) {
  const cars = state.cars;
  for (let a = 0; a < cars.length; a += 1) {
    const carA = cars[a];
    if (carA.wrecked) continue;
    for (let b = a + 1; b < cars.length; b += 1) {
      const carB = cars[b];
      if (carB.wrecked) continue;
      const dx = carB.x - carA.x;
      const dy = carB.y - carA.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= 46 || dist === 0) continue;
      const push = (46 - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      carA.x -= nx * push;
      carA.y -= ny * push;
      carB.x += nx * push;
      carB.y += ny * push;
      const closing = Math.abs(carA.speed - carB.speed);
      // Dent at most once per half second per car: without this, a pile-up
      // re-collides every step and a car melts in two seconds.
      if (closing > 160 && state.time - (carA.lastCollideDamage ?? -99) > 0.5 && state.time - (carB.lastCollideDamage ?? -99) > 0.5) {
        carA.lastCollideDamage = state.time;
        carB.lastCollideDamage = state.time;
        damageCar(state, carA, 4);
        damageCar(state, carB, 4);
        state.audio.crash();
        if (carA === state.player.car || carB === state.player.car) state.shake = Math.min(10, state.shake + 3);
      }
      if (carA.kind === 'player') carA.speed *= 0.85;
      if (carB.kind === 'player') carB.speed *= 0.85;
    }
  }
}

/** One fixed step of the whole world. Returns the events raised this step. */
export function stepWorld(state, dt, frame, actionFlags) {
  state.events = 0;
  state.time += dt;
  state.clockMinutes += (60 / 180) * dt;
  const player = state.player;

  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      const need = PLAYER.magSize - player.ammo;
      const take = Math.min(need, player.reserveAmmo);
      player.ammo += take;
      player.reserveAmmo -= take;
    }
  }
  if (actionFlags & 16) { // ACTION_RELOAD
    if (player.weapon === 'pistol' && player.ammo < PLAYER.magSize && player.reserveAmmo > 0 && player.reloadTimer <= 0) {
      player.reloadTimer = PLAYER.reloadTime;
    }
  }
  if (actionFlags & 8) { // ACTION_INTERACT
    if (player.inCar) exitCar(state);
    else {
      const car = nearestCar(state, player.x, player.y, 54);
      if (car) enterCar(state, car);
    }
  }

  if (player.inCar) stepPlayerDriving(state, dt, frame);
  else stepPlayerOnFoot(state, dt, frame);

  stepCarCollisions(state);
  stepTraffic(state, dt);
  stepPolice(state, dt);
  stepCombat(state, dt);
  stepMissions(state, dt);

  for (let index = state.toasts.length - 1; index >= 0; index -= 1) {
    state.toasts[index].timer -= dt;
    if (state.toasts[index].timer <= 0) state.toasts.splice(index, 1);
  }
  if (state.mission && state.mission.bannerTimer > 0) state.mission.bannerTimer -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

  // The camera follows the player and stays inside the city.
  const tx = Math.max(VIEW.width / 2, Math.min(CITY.width - VIEW.width / 2, player.x));
  const ty = Math.max(VIEW.height / 2, Math.min(CITY.height - VIEW.height / 2, player.y));
  const follow = Math.min(1, 6 * dt);
  state.camera.x += (tx - state.camera.x) * follow;
  state.camera.y += (ty - state.camera.y) * follow;

  let policeNear = false;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    if (dx * dx + dy * dy < 600 * 600) { policeNear = true; break; }
  }
  state.audio.update(dt, player.inCar && player.car ? player.car.speed : 0, policeNear);

  if (player.health <= 0) state.events |= EVENT_WASTED;
  return state.events;
}

/** What the world looks like after busted/wasted: pay the price, restart the mission. */
export function respawn(state, kind) {
  const player = state.player;
  if (kind === 'busted') {
    player.money = Math.max(0, player.money - 100);
    player.wanted = 0;
    player.wantedTimer = 0;
    state.audio.busted();
    state.toast('Busted — $100 bail, and Delia is not happy');
  } else {
    player.money = Math.max(0, player.money - 50);
    player.wanted = 0;
    player.wantedTimer = 0;
    state.toast('Wasted — the hospital took $50');
  }
  if (player.inCar && player.car) {
    player.car.kind = 'parked';
    player.car.speed = 0;
    player.car = null;
    player.inCar = false;
  }
  player.health = PLAYER.health;
  player.armor = 0;
  player.x = PLACES.safehouse.x;
  player.y = PLACES.safehouse.y;
  player.angle = -Math.PI / 2;
  state.camera.x = player.x;
  state.camera.y = player.y;
  for (const cop of state.cops) {
    const dx = cop.x - player.x;
    const dy = cop.y - player.y;
    if (dx * dx + dy * dy < 200 * 200) { cop.x += 400; cop.y += 400; }
  }
  restartMission(state);
  state.save();
}

export { missionTarget };
