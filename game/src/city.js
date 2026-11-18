// Port Solmar: a seeded grid city. Avenues and streets run on a 400 px grid; the blocks
// between them hold buildings, parks and parking lots; the south band is beach, water and
// a pier. Everything about the city is derived from one seeded stream, so the same seed
// always builds the same city. The module also answers the queries the traffic, the police
// and the collision code need: is this point on a road, what is the nearest road, and where
// does a circle end up after hitting a building.

import { CITY, PALETTE } from './config.js';
import { randomInt, randomPick } from './random.js';

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

/** The named places the story sends the player to. */
export const PLACES = {
  ferryTerminal: { x: 1600, y: 2100, label: 'Ferry Terminal' },
  marinaSlip: { x: 1500, y: 2160, label: 'Marina, Slip 9' },
  dealership: { x: 1050, y: 640, label: 'Veloce Motors' },
  garage: { x: 2250, y: 1050, label: "Delia's Garage" },
  warehouse: { x: 360, y: 1850, label: 'Dock Warehouse' },
  safehouse: { x: 2650, y: 1850, label: 'Safehouse, Gull St' },
  pierEnd: { x: 1600, y: 2370, label: 'The Pier' },
  plaza: { x: 1400, y: 1000, label: 'Solmar Plaza' },
  cashDropA: { x: 600, y: 1400, label: 'Cash drop' },
  cashDropB: { x: 2200, y: 600, label: 'Cash drop' },
  cashDropC: { x: 2600, y: 1400, label: 'Cash drop' },
};

export function generateCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];

  // Blocks are the cells between the roads. One block in five is a park; the rest hold
  // one to three buildings, or a parking lot with marked bays.
  for (let xi = 0; xi < CITY.roadsX.length - 1; xi += 1) {
    for (let yi = 0; yi < CITY.roadsY.length - 1; yi += 1) {
      const x0 = CITY.roadsX[xi] + CITY.roadHalf + CITY.sidewalk + 10;
      const x1 = CITY.roadsX[xi + 1] - CITY.roadHalf - CITY.sidewalk - 10;
      const y0 = CITY.roadsY[yi] + CITY.roadHalf + CITY.sidewalk + 10;
      const y1 = CITY.roadsY[yi + 1] - CITY.roadHalf - CITY.sidewalk - 10;
      if (y0 > CITY.beachY - 120) continue;
      const roll = random();
      if (roll < 0.16) {
        const park = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        parks.push(park);
        const treeCount = 6 + Math.floor(random() * 8);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: x0 + 20 + random() * (park.w - 40), y: y0 + 20 + random() * (park.h - 40), r: 12 + random() * 8 });
        }
        continue;
      }
      if (roll < 0.28) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const count = random() < 0.55 ? 2 : 1;
      if (count === 1) {
        const w = 120 + random() * 110;
        const h = 110 + random() * 110;
        buildings.push({
          x: x0 + (x1 - x0 - w) / 2, y: y0 + (y1 - y0 - h) / 2, w, h,
          color: randomPick(random, ROOFS), windows: 3 + Math.floor(random() * 3),
        });
      } else {
        const split = random() < 0.5 ? 'v' : 'h';
        for (let b = 0; b < 2; b += 1) {
          if (split === 'v') {
            const w = (x1 - x0) / 2 - 14;
            const h = 110 + random() * 120;
            buildings.push({
              x: x0 + b * ((x1 - x0) / 2 + 14), y: y0 + (y1 - y0 - h) / 2, w, h,
              color: randomPick(random, ROOFS), windows: 3 + Math.floor(random() * 3),
            });
          } else {
            const w = 130 + random() * 110;
            const h = (y1 - y0) / 2 - 14;
            buildings.push({
              x: x0 + (x1 - x0 - w) / 2, y: y0 + b * ((y1 - y0) / 2 + 14), w, h,
              color: randomPick(random, ROOFS), windows: 3 + Math.floor(random() * 3),
            });
          }
        }
      }
    }
  }

  return { buildings, parks, lots, trees };
}

/** True when the point is on asphalt (a road), ignoring the sidewalk band. */
export function isOnRoad(x, y) {
  for (const rx of CITY.roadsX) if (Math.abs(x - rx) <= CITY.roadHalf) return true;
  for (const ry of CITY.roadsY) if (Math.abs(y - ry) <= CITY.roadHalf) return true;
  return false;
}

/** True when the point is on a sidewalk band beside a road. */
export function isSidewalk(x, y) {
  for (const rx of CITY.roadsX) {
    const d = Math.abs(x - rx);
    if (d > CITY.roadHalf && d <= CITY.roadHalf + CITY.sidewalk) return true;
  }
  for (const ry of CITY.roadsY) {
    const d = Math.abs(y - ry);
    if (d > CITY.roadHalf && d <= CITY.roadHalf + CITY.sidewalk) return true;
  }
  return false;
}

/** The nearest point on a road centre line, and which road it is on. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of CITY.roadsX) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, axis: 'x', line: rx }; }
  }
  for (const ry of CITY.roadsY) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, axis: 'y', line: ry }; }
  }
  return best;
}

/** A random point on a road, for spawning traffic. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const rx = randomPick(random, CITY.roadsX);
    return { x: rx, y: 100 + random() * (CITY.height - 200), axis: 'x', line: rx };
  }
  const ry = randomPick(random, CITY.roadsY);
  return { x: 100 + random() * (CITY.width - 200), y: ry, axis: 'y', line: ry };
}

/** A random point on a sidewalk, for spawning pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  const off = CITY.roadHalf + CITY.sidewalk / 2;
  if (p.axis === 'x') return { x: p.x + (random() < 0.5 ? -off : off), y: p.y };
  return { x: p.x, y: p.y + (random() < 0.5 ? -off : off) };
}

/** True when the point is inside a building rectangle. */
export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** True when the point is in the water (south of the beach, off the pier). */
export function inWater(x, y) {
  if (y <= CITY.waterY) return false;
  if (x >= 1500 && x <= 1700) return false; // the pier
  return true;
}

/**
 * Push a circle out of buildings, the water and the city bounds. Returns the corrected
 * position and whether it hit something on each axis (for cars to bounce off).
 */
export function collideCircle(city, x, y, radius, canSwim) {
  let hitX = false;
  let hitY = false;
  for (const b of city.buildings) {
    const closestX = Math.max(b.x, Math.min(x, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    if (distSq === 0) {
      // Centre inside the building: push out along the shortest side.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) { x = b.x - radius; hitX = true; }
      else if (min === right) { x = b.x + b.w + radius; hitX = true; }
      else if (min === top) { y = b.y - radius; hitY = true; }
      else { y = b.y + b.h + radius; hitY = true; }
      continue;
    }
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    x += nx * push;
    y += ny * push;
    if (Math.abs(nx) > Math.abs(ny)) hitX = true;
    else hitY = true;
  }
  if (!canSwim && inWater(x, y)) {
    y = CITY.waterY - radius;
    hitY = true;
  }
  if (x < radius) { x = radius; hitX = true; }
  if (x > CITY.width - radius) { x = CITY.width - radius; hitX = true; }
  if (y < radius) { y = radius; hitY = true; }
  if (y > CITY.height - radius) { y = CITY.height - radius; hitY = true; }
  return { x, y, hitX, hitY };
}

/** A free point near (x, y): not inside a building, not in the water. */
export function freePointNear(city, random, x, y, radius) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const px = x + (random() * 2 - 1) * radius;
    const py = y + (random() * 2 - 1) * radius;
    if (!insideBuilding(city, px, py) && !inWater(px, py)) return { x: px, y: py };
  }
  return { x, y };
}
