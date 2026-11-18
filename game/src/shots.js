// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed always
// gives the same frame.

import { STEP, CITY } from './config.js';
import { ACTION_INTERACT } from './input.js';
import { PLACES, nearestRoadPoint } from './city.js';
import { stepWorld, resetWorld } from './world.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 10;
const CHASE_SECONDS = 10;
const MISSION_SECONDS = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** A frame object that walks toward (x, y), sidestepping when stuck. */
function walkFrame(state, x, y, stuck) {
  const player = state.player;
  const dx = x - player.x;
  const dy = y - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  let mx = dx / dist;
  let my = dy / dist;
  if (stuck > 0.5) {
    // Blocked by a building: slide along it.
    const side = stuck % 2 < 1 ? 1 : -1;
    const tx = mx;
    mx = -my * side;
    my = tx * side;
  }
  return { mx, my, aimX: x, aimY: y, fire: false, sprint: false };
}

/** A frame object that drives the player's car toward (x, y). */
function driveFrame(state, x, y) {
  const car = state.player.car;
  if (!car) return { mx: 0, my: 0, aimX: x, aimY: y, fire: false, sprint: false };
  const dx = x - car.x;
  const dy = y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const mx = clamp(diff * 2.2, -1, 1);
  let my = Math.abs(diff) > 1.1 ? 0.35 : 1;
  // Coast behind the car ahead instead of stopping or swerving into oncoming
  // traffic: the car keeps rolling at traffic speed. (Overtaking into the
  // oncoming lane caused head-on wrecks; reversing left it at 1 km/h.)
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(ox * -Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 30) { my = 0; break; }
  }
  return { mx, my, aimX: x, aimY: y, fire: false, sprint: false };
}

function nearestParkedCar(state) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'parked' || car.wrecked) continue;
    // Skip the marina curb row (south of the southern road): a car in the middle
    // of that row is boxed in by its neighbours and the autopilot cannot get out.
    if (car.y > 2234) continue;
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) { bestD = dist; best = car; }
  }
  return best;
}

/** The nearest police car that is still driving, if any. */
function nearestPoliceCar(state) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.wrecked) continue;
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) { bestD = dist; best = car; }
  }
  return best;
}
function nearestCarToPlayer(state) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) { bestD = dist; best = car; }
  }
  return best;
}

function nearestEnemy(state) {
  let best = null;
  let bestD = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) { bestD = dist; best = enemy; }
  }
  return best;
}

/** Pick a road intersection roughly ahead of the car to drive toward. */
function nextWaypoint(state) {
  const random = state.random;
  const car = state.player.car;
  const baseX = car ? car.x : state.player.x;
  const baseY = car ? car.y : state.player.y;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = 200 + Math.floor(random() * 7) * 400;
    const y = 200 + Math.floor(random() * 5) * 400;
    const dx = x - baseX;
    const dy = y - baseY;
    if (dx * dx + dy * dy > 200 * 200) return { x, y };
  }
  return { x: 1400, y: 1000 };
}

/** The road the car is on, from its position and heading. */
function roadOf(state) {
  const car = state.player.car;
  const point = nearestRoadPoint(car.x, car.y);
  let dir = 1;
  if (point.axis === 'x') dir = Math.sin(car.angle) >= 0 ? 1 : -1;
  else dir = Math.cos(car.angle) >= 0 ? 1 : -1;
  return { axis: point.axis, line: point.line, dir };
}

/**
 * The next intersection along `road` from the car's position, as a lane point (right-hand
 * traffic, 22 px off the centre line). When the road runs out, the direction flips. The
 * car follows roads this way instead of cutting across blocks, which is what wrecks it.
 */
function nextIntersection(state, road) {
  const car = state.player.car;
  const crossings = road.axis === 'x' ? CITY.roadsY : CITY.roadsX;
  const along = road.axis === 'x' ? car.y : car.x;
  let target = null;
  if (road.dir > 0) {
    for (const line of crossings) {
      if (line > along + 30 && (target === null || line < target)) target = line;
    }
  } else {
    for (const line of crossings) {
      if (line < along - 30 && (target === null || line > target)) target = line;
    }
  }
  if (target === null) {
    road.dir = -road.dir;
    return nextIntersection(state, road);
  }
  if (road.axis === 'x') return { point: { x: road.line + (road.dir > 0 ? -22 : 22), y: target }, crossing: target };
  return { point: { x: target, y: road.line + (road.dir > 0 ? 22 : -22) }, crossing: target };
}

/**
 * Set `state` to the named scene (start, drive, chase or mission; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, state, seed) {
  resetWorld(state, seed);
  const random = state.random;
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    // Title: the player strolls toward the plaza while the city lives behind the panel.
    let stuck = 0;
    let lastX = state.player.x;
    let lastY = state.player.y;
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      const frame = walkFrame(state, PLACES.plaza.x, PLACES.plaza.y, stuck);
      stepWorld(state, STEP, frame, 0);
      if (Math.hypot(state.player.x - lastX, state.player.y - lastY) < 0.5) stuck += STEP;
      else stuck = 0;
      lastX = state.player.x;
      lastY = state.player.y;
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'mission') {
    // The dock shootout: pistol in hand, four gang members at the warehouse.
    startMission(state, 2);
    const player = state.player;
    player.weapon = 'pistol';
    player.ammo = 12;
    player.reserveAmmo = 48;
    player.x = PLACES.warehouse.x - 160;
    player.y = PLACES.warehouse.y + 40;
    state.camera.x = player.x;
    state.camera.y = player.y;
    for (let index = 0; index < MISSION_SECONDS / STEP; index += 1) {
      const enemy = nearestEnemy(state);
      let frame;
      if (enemy) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.hypot(dx, dy);
        const approach = dist > 300 ? walkFrame(state, enemy.x, enemy.y, 0) : { mx: 0, my: 0, aimX: enemy.x, aimY: enemy.y, fire: dist < 480, sprint: false };
        frame = approach;
      } else {
        frame = walkFrame(state, PLACES.warehouse.x, PLACES.warehouse.y, 0);
      }
      stepWorld(state, STEP, frame, 0);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // drive / chase: get into the nearest parked car, then drive the road grid.
  let parked = nearestParkedCar(state);
  if (parked) {
    state.player.x = parked.x + 40;
    state.player.y = parked.y;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }
  let road = null;
  let target = { x: 1400, y: 1000 };
  let stuck = 0;
  const flee = name === 'chase'; // A getaway runs straight; a cruise turns at intersections.
  const seconds = name === 'chase' ? CHASE_SECONDS : DRIVE_SECONDS;
  for (let index = 0; index < seconds / STEP; index += 1) {
    let flags = 0;
    let frame;
    if (!state.player.inCar) {
      if (!parked || parked.wrecked) parked = nearestParkedCar(state);
      frame = walkFrame(state, parked ? parked.x : target.x, parked ? parked.y : target.y, 0);
      const dx = (parked ? parked.x : 0) - state.player.x;
      const dy = (parked ? parked.y : 0) - state.player.y;
      // E enters the nearest car of any kind, so only press it when that car is the
      // parked one being walked to — otherwise the autopilot steals a police car.
      if (parked && dx * dx + dy * dy < 54 * 54 && nearestCarToPlayer(state) === parked) flags |= ACTION_INTERACT;
    } else {
      // Escalate the chase halfway through: the player is already moving at speed,
      // so the police arrive in pursuit behind instead of swarming a parked car.
      if (name === 'chase' && state.player.wanted < 3 && index === 300) addWanted(state, 3);
      if (!road) {
        road = roadOf(state);
        target = nextIntersection(state, road).point;
      }
      const car = state.player.car;
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      if (dx * dx + dy * dy < 60 * 60) {
        // At the intersection: a getaway turns about half the time, away from the
        // nearest police car, so it never drives back into the swarm behind it; a
        // cruise turns sometimes. Long straights keep the speed up, and the cops
        // only catch up in the turns.
        if (flee ? state.random() < 0.2 : state.random() < 0.35) {
          const crossing = road.axis === 'x' ? target.y : target.x;
          const cop = flee ? nearestPoliceCar(state) : null;
          let dir = state.random() < 0.5 ? -1 : 1;
          if (cop) {
            // The new road runs along the other axis; head away from the cop on it.
            const alongCar = road.axis === 'x' ? car.x : car.y;
            const alongCop = road.axis === 'x' ? cop.x : cop.y;
            dir = alongCar >= alongCop ? 1 : -1;
          }
          road = { axis: road.axis === 'x' ? 'y' : 'x', line: crossing, dir };
        }
        target = nextIntersection(state, road).point;
      }
      // Ease off for sharp turns so the car stays on the road.
      const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      frame = driveFrame(state, target.x, target.y);
      if (Math.abs(diff) > 0.9) frame.my = Math.min(frame.my, 0.5);
      else if (Math.abs(diff) > 0.5) frame.my = Math.min(frame.my, 0.7);
      if (Math.abs(car.speed) < 8) stuck += STEP;
      else stuck = 0;
      if (stuck > 2.5) {
        frame = { mx: 0, my: -1, aimX: target.x, aimY: target.y, fire: false, sprint: false };
        if (stuck > 3.5) stuck = 0;
      }
    }
    stepWorld(state, STEP, frame, flags);
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
