// The wanted level and the police who answer it. Stars rise with crime and fall when
// the player stays out of sight; police cars spawn off-screen, chase and ram, and foot
// cops run the player down and arrest them. At three stars and above the cops shoot.

import { CITY, POLICE, WANTED, CAR } from './config.js';
import { collideCircle, nearestRoadPoint } from './city.js';
import { randomPick } from './random.js';
import { damageCar } from './combat.js';

let nextCopId = 5000;

/** Raise the wanted level by `stars` (capped), stamping the last crime time. */
export function addWanted(state, stars) {
  if (stars > 0 && state.player.wanted < WANTED.max) {
    state.player.wanted = Math.min(WANTED.max, state.player.wanted + stars);
    state.audio.wantedUp();
  }
  state.player.lastCrime = state.time;
}

/** How many police cars the current wanted level calls for. */
export function wantedCarCount(wanted) {
  if (wanted <= 0) return 1; // one patrol car, minding its own business
  return Math.min(1 + wanted, 6);
}

/** How many foot cops the current wanted level calls for. */
export function wantedCopCount(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(wanted, 4);
}

function spawnPoliceCar(state, x, y) {
  const point = nearestRoadPoint(x, y);
  const car = {
    id: nextCopId += 1,
    x: point.x, y: point.y,
    angle: 0, speed: 0, targetSpeed: 0,
    color: '#2f5cb8',
    model: 'police',
    kind: 'police',
    health: 120,
    siren: true,
    axis: point.axis, line: point.line, dir: 1,
    stuck: 0,
  };
  state.cars.push(car);
  return car;
}

function spawnFootCop(state, x, y) {
  const cop = {
    id: nextCopId += 1,
    x, y,
    angle: 0, speed: POLICE.copSpeed,
    hp: 50,
    state: 'chase',
    arrestTimer: 0,
    shootCooldown: 1 + state.random() * 0.8,
  };
  state.cops.push(cop);
  return cop;
}

/** A spawn point on a road near the player but off the screen. */
function offscreenRoadPoint(state) {
  const random = state.random;
  const player = state.player;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const dist = POLICE.spawnDistance + random() * 220;
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;
    if (x < 80 || x > CITY.width - 80 || y < 80 || y > CITY.height - 80) continue;
    return nearestRoadPoint(x, y);
  }
  // Last resort: try the other way before spawning on top of the player.
  const fallback = player.x + POLICE.spawnDistance < CITY.width - 80
    ? { x: player.x + POLICE.spawnDistance, y: player.y }
    : { x: player.x - POLICE.spawnDistance, y: player.y };
  return nearestRoadPoint(fallback.x, fallback.y);
}

/** Keep the police presence matched to the wanted level. */
export function maintainPolice(state) {
  const wanted = state.player.wanted;
  const player = state.player;
  const wantCars = wantedCarCount(wanted);
  const wantCops = wantedCopCount(wanted);
  let cars = 0;
  let cops = 0;
  for (const car of state.cars) if (car.kind === 'police') cars += 1;
  for (const cop of state.cops) cops += 1;

  while (cars < wantCars) {
    const point = offscreenRoadPoint(state);
    spawnPoliceCar(state, point.x, point.y);
    cars += 1;
  }
  while (cops < wantCops && !player.inCar) {
    const point = offscreenRoadPoint(state);
    spawnFootCop(state, point.x, point.y);
    cops += 1;
  }
  // A patrol car at zero stars just cruises; the chase cars leave when the heat is off.
  if (wanted === 0) {
    for (let index = state.cars.length - 1; index >= 0; index -= 1) {
      const car = state.cars[index];
      if (car.kind !== 'police') continue;
      const dx = car.x - player.x;
      const dy = car.y - player.y;
      if (dx * dx + dy * dy > POLICE.despawnDistance * POLICE.despawnDistance && cars > 1) {
        state.cars.splice(index, 1);
        cars -= 1;
      }
    }
  }
}

/** A police car chases the player: steer at them, ram on contact. */
function stepPoliceCar(state, car, dt) {
  const player = state.player;
  const target = player.inCar ? player.car : null;
  const tx = target ? target.x + Math.cos(target.angle) * target.speed * 0.25 : player.x;
  const ty = target ? target.y + Math.sin(target.angle) * target.speed * 0.25 : player.y;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
  car.angle += turn;
  const top = POLICE.carSpeed + POLICE.carSpeedPerStar * player.wanted;
  car.speed += Math.max(-CAR.brake * dt, Math.min(CAR.accel * dt, top - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideCircle(state.city, car.x, car.y, 20, false);
  if (fixed.hitX || fixed.hitY) {
    car.x = fixed.x;
    car.y = fixed.y;
    car.speed *= 0.55;
    car.angle += (fixed.hitX ? 0.5 : -0.5) * dt * 8;
  }
  // Ram the player's car on contact: one hit per 0.6 s, not a drain.
  if (target) {
    const cdx = target.x - car.x;
    const cdy = target.y - car.y;
    car.ramCooldown = (car.ramCooldown ?? 0) - dt;
    if (cdx * cdx + cdy * cdy < 52 * 52) {
      if (car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        damageCar(state, target, CAR.ramDamage);
      }
      car.speed *= 0.92;
      state.shake = Math.min(10, state.shake + 3);
      if (Math.floor(state.time * 4) % 2 === 0) state.audio.crash();
    }
  }
  if (dist > POLICE.chaseGiveUp && player.wanted === 0) {
    car.speed = 0;
  }
}

/** A foot cop runs the player down; close enough for long enough and it is an arrest. */
function stepFootCop(state, cop, dt) {
  const player = state.player;
  if (player.inCar) {
    // Cops cannot arrest a moving car: they give up and walk back to the road.
    cop.state = 'chase';
    cop.arrestTimer = 0;
    const point = nearestRoadPoint(cop.x, cop.y);
    const dx = point.x - cop.x;
    const dy = point.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.x += (dx / dist) * cop.speed * 0.5 * dt;
    cop.y += (dy / dist) * cop.speed * 0.5 * dt;
    return;
  }
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  const step = Math.min(dist, cop.speed * dt);
  const nx = cop.x + (dx / dist) * step;
  const ny = cop.y + (dy / dist) * step;
  const fixed = collideCircle(state.city, nx, ny, 11, false);
  cop.x = fixed.x;
  cop.y = fixed.y;
  if (dist < 30) {
    cop.arrestTimer += dt;
    if (cop.arrestTimer >= 1.5) {
      state.events |= state.EVENT_BUSTED;
    }
  } else cop.arrestTimer = Math.max(0, cop.arrestTimer - dt);
  // At three stars the cops open fire instead of only grabbing.
  if (player.wanted >= POLICE.copShootStar && dist < 420 && dist > 60) {
    cop.shootCooldown -= dt;
    if (cop.shootCooldown <= 0) {
      cop.shootCooldown = POLICE.shootRate;
      const spread = (state.random() * 2 - 1) * POLICE.shootSpread;
      const aim = Math.atan2(dy, dx) + spread;
      state.bullets.push({
        x: cop.x, y: cop.y,
        vx: Math.cos(aim) * 780, vy: Math.sin(aim) * 780,
        from: 'enemy', life: 0.8, damage: POLICE.shootDamage,
      });
      state.audio.enemyShot();
    }
  }
}

/** Decay the wanted level when the player is out of sight and quiet. */
export function decayWanted(state, dt) {
  const player = state.player;
  if (player.wanted <= 0) return;
  if (state.time - player.lastCrime < WANTED.decayQuietSeconds) return;
  let seen = false;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    if (dx * dx + dy * dy < WANTED.hiddenRadius * WANTED.hiddenRadius) { seen = true; break; }
  }
  if (!seen) {
    for (const cop of state.cops) {
      const dx = cop.x - player.x;
      const dy = cop.y - player.y;
      if (dx * dx + dy * dy < WANTED.hiddenRadius * WANTED.hiddenRadius) { seen = true; break; }
    }
  }
  if (seen) return;
  player.wantedTimer += dt;
  if (player.wantedTimer >= WANTED.decayEverySeconds) {
    player.wantedTimer = 0;
    player.wanted -= 1;
  }
}

/** Advance every police unit one step. */
export function stepPolice(state, dt) {
  maintainPolice(state);
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    if (state.player.wanted > 0) stepPoliceCar(state, car, dt);
    else {
      // Patrol: cruise slowly along the road.
      car.speed = Math.min(car.speed + 60 * dt, 120);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = collideCircle(state.city, car.x, car.y, 20, false);
      car.x = fixed.x;
      car.y = fixed.y;
    }
  }
  for (const cop of state.cops) stepFootCop(state, cop, dt);
  // Cops too far away give up and leave.
  const px = state.player.x;
  const py = state.player.y;
  for (let index = state.cops.length - 1; index >= 0; index -= 1) {
    const cop = state.cops[index];
    const dx = cop.x - px;
    const dy = cop.y - py;
    if (dx * dx + dy * dy > 1200 * 1200) state.cops.splice(index, 1);
  }
  decayWanted(state, dt);
}
