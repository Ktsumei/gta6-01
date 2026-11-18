// Traffic and pedestrians. Traffic cars drive the road grid in lanes, turn at
// intersections and brake for whatever is ahead of them; pedestrians stroll the sidewalks
// and run from danger. Both keep the city alive around the player and respawn near the
// camera when they drift too far away.

import { CITY, TRAFFIC, PALETTE } from './config.js';
import { collideCircle, isOnRoad, nearestRoadPoint, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { randomInt, randomPick } from './random.js';

const MODELS = ['sedan', 'sedan', 'hatch', 'truck', 'sport', 'taxi'];
const LANE = 22;

let nextCarId = 1000;

/** The lane centre for a road: right-hand traffic on both axes. */
export function lanePoint(axis, line, dir, along) {
  if (axis === 'x') return { x: line + (dir > 0 ? LANE : -LANE), y: along };
  return { x: along, y: line + (dir > 0 ? LANE : -LANE) };
}

/** A new traffic car on a road, heading along it. */
export function makeTrafficCar(random, city, nearX, nearY, minDist) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const point = randomRoadPoint(random);
    const dx = point.x - nearX;
    const dy = point.y - nearY;
    if (dx * dx + dy * dy < minDist * minDist) continue;
    const dir = random() < 0.5 ? -1 : 1;
    const at = lanePoint(point.axis, point.line, dir, point.axis === 'x' ? point.y : point.x);
    return {
      id: nextCarId += 1,
      x: at.x, y: at.y,
      angle: point.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: TRAFFIC.speed + (random() * 2 - 1) * TRAFFIC.speedJitter,
      targetSpeed: TRAFFIC.speed + (random() * 2 - 1) * TRAFFIC.speedJitter,
      color: randomPick(random, PALETTE.carColors),
      model: randomPick(random, MODELS),
      kind: 'traffic',
      health: 100,
      siren: false,
      axis: point.axis,
      line: point.line,
      dir,
      stuck: 0,
    };
  }
  return null;
}

/** A parked car in a lot or along a curb. */
export function makeParkedCar(random, x, y, angle) {
  return {
    id: nextCarId += 1,
    x, y, angle,
    speed: 0, targetSpeed: 0,
    color: randomPick(random, PALETTE.carColors),
    model: randomPick(random, MODELS),
    kind: 'parked',
    health: 100,
    siren: false,
    axis: 'x', line: x, dir: 1,
    stuck: 0,
  };
}

/** A pedestrian strolling a sidewalk. */
export function makePed(random, city, nearX, nearY, minDist) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const point = randomSidewalkPoint(random);
    const dx = point.x - nearX;
    const dy = point.y - nearY;
    if (dx * dx + dy * dy < minDist * minDist) continue;
    const target = randomSidewalkPoint(random);
    return {
      x: point.x, y: point.y,
      angle: random() * Math.PI * 2,
      speed: TRAFFIC.pedSpeed * (0.8 + random() * 0.5),
      color: randomPick(random, PALETTE.pedShirt),
      state: 'walk',
      tx: target.x, ty: target.y,
      fleeX: 0, fleeY: 0, fleeTimer: 0,
      dead: false, deadTimer: 0,
    };
  }
  return null;
}

/** The next road after this intersection: straight on, or a turn onto the crossing road. */
function chooseNextRoad(random, car) {
  const crossings = car.axis === 'x' ? CITY.roadsY : CITY.roadsX;
  const here = car.axis === 'x' ? car.y : car.x;
  let nearest = crossings[0];
  let nearestD = Infinity;
  for (const line of crossings) {
    const d = Math.abs(line - here);
    if (d < nearestD) { nearestD = d; nearest = line; }
  }
  if (nearestD > 30) return null; // not at an intersection yet
  if (random() < 0.65) return null; // keep going straight
  const newAxis = car.axis === 'x' ? 'y' : 'x';
  const newDir = random() < 0.5 ? -1 : 1;
  return { axis: newAxis, line: nearest, dir: newDir };
}

/** Is there a car or a pedestrian in front of this car, within `distance`? */
function blockedAhead(state, car, distance) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead > 0 && ahead < distance && Math.abs(dx * fy - dy * fx) < 26) return true;
  }
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead > 0 && ahead < distance && Math.abs(dx * fy - dy * fx) < 22) return true;
  }
  return false;
}

/** Advance one traffic car along its road. */
function stepTrafficCar(state, car, dt, random) {
  if (car.kind !== 'traffic') return;
  const want = blockedAhead(state, car, 62) ? 0 : car.targetSpeed;
  car.speed += Math.max(-260 * dt, Math.min(180 * dt, want - car.speed));
  if (car.speed < 1) {
    car.stuck += dt;
    if (car.stuck > 4) {
      // Give up on this road: turn around.
      car.dir = -car.dir;
      car.angle += Math.PI;
      car.stuck = 0;
    }
  } else car.stuck = 0;
  const next = chooseNextRoad(random, car);
  if (next) {
    car.axis = next.axis;
    car.line = next.line;
    car.dir = next.dir;
  }
  const along = (car.axis === 'x' ? car.y : car.x) + car.dir * car.speed * dt;
  const at = lanePoint(car.axis, car.line, car.dir, along);
  car.x = at.x;
  car.y = at.y;
  const targetAngle = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
  if (car.x < 60 || car.x > CITY.width - 60 || car.y < 60 || car.y > CITY.height - 60) {
    // Drove out of the city: send it back along a road.
    const point = randomRoadPoint(random);
    const dir = random() < 0.5 ? -1 : 1;
    const fresh = lanePoint(point.axis, point.line, dir, point.axis === 'x' ? point.y : point.x);
    car.x = fresh.x;
    car.y = fresh.y;
    car.axis = point.axis;
    car.line = point.line;
    car.dir = dir;
  }
}

/** Scare every pedestrian near (x, y): they run away from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.state = 'flee';
      ped.fleeX = x;
      ped.fleeY = y;
      ped.fleeTimer = 1.6;
    }
  }
}

function stepPed(state, ped, dt, random) {
  if (ped.dead) {
    ped.deadTimer += dt;
    return;
  }
  let tx = ped.tx;
  let ty = ped.ty;
  let speed = ped.speed;
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    const dx = ped.x - ped.fleeX;
    const dy = ped.y - ped.fleeY;
    const dist = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / dist) * 200;
    ty = ped.y + (dy / dist) * 200;
    speed = TRAFFIC.pedFleeSpeed;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    if (ped.state === 'walk') {
      const target = randomSidewalkPoint(random);
      ped.tx = target.x;
      ped.ty = target.y;
    }
    return;
  }
  const step = Math.min(dist, speed * dt);
  const nx = ped.x + (dx / dist) * step;
  const ny = ped.y + (dy / dist) * step;
  const fixed = collideCircle(state.city, nx, ny, 10, false);
  ped.x = fixed.x;
  ped.y = fixed.y;
  ped.angle = Math.atan2(dy, dx);
}

/** Advance all traffic and pedestrians one step, keeping the counts near the player. */
export function stepTraffic(state, dt) {
  const random = state.random;
  for (const car of state.cars) stepTrafficCar(state, car, dt, random);
  for (const ped of state.peds) stepPed(state, ped, dt, random);

  // Keep the street busy near the camera: replace cars and peds that wandered far away.
  const px = state.player.x;
  const py = state.player.y;
  let trafficCount = 0;
  for (const car of state.cars) if (car.kind === 'traffic') trafficCount += 1;
  for (let index = state.cars.length - 1; index >= 0; index -= 1) {
    const car = state.cars[index];
    if (car.kind !== 'traffic') continue;
    const dx = car.x - px;
    const dy = car.y - py;
    if (dx * dx + dy * dy > 1100 * 1100) state.cars.splice(index, 1);
  }
  while (state.cars.filter((car) => car.kind === 'traffic').length < TRAFFIC.cars) {
    const car = makeTrafficCar(random, state.city, px, py, 500);
    if (!car) break;
    state.cars.push(car);
  }
  for (let index = state.peds.length - 1; index >= 0; index -= 1) {
    const ped = state.peds[index];
    if (ped.dead && ped.deadTimer > 14) { state.peds.splice(index, 1); continue; }
    const dx = ped.x - px;
    const dy = ped.y - py;
    if (!ped.dead && dx * dx + dy * dy > 1000 * 1000) state.peds.splice(index, 1);
  }
  while (state.peds.filter((ped) => !ped.dead).length < TRAFFIC.peds) {
    const ped = makePed(random, state.city, px, py, 420);
    if (!ped) break;
    state.peds.push(ped);
  }
}

/** Parked cars for the city: in lots, and a row along the marina curb. */
export function seedParkedCars(random, city) {
  const parked = [];
  for (const lot of city.lots) {
    const count = 2 + Math.floor(random() * 3);
    for (let index = 0; index < count; index += 1) {
      const x = lot.x + 40 + random() * Math.max(20, lot.w - 80);
      const y = lot.y + 40 + random() * Math.max(20, lot.h - 80);
      parked.push(makeParkedCar(random, x, y, random() < 0.5 ? 0 : Math.PI / 2));
    }
  }
  // A row of cars along the marina curb, and one special yellow Comet GT at the dealership.
  // The curb sits just south of the southern road (y 2200, half-width 34), so the
  // row is off the asphalt: parked on the road itself, it boxed the player in.
  for (let index = 0; index < 6; index += 1) {
    parked.push(makeParkedCar(random, 1420 + index * 62, 2262, 0));
  }
  const comet = makeParkedCar(random, 1050, 640, Math.PI / 2);
  comet.color = '#e0b13c';
  comet.model = 'sport';
  comet.special = 'comet';
  parked.push(comet);
  return parked;
}
