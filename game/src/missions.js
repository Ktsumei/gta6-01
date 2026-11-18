// The story: six jobs for Mama Delia that take Rex Marlowe from the night ferry to the
// top of Port Solmar. Each mission is a short list of objectives — go somewhere, steal a
// car, clear a gang, lose the cops, collect the drops, run the checkpoints. The module
// owns the current mission, its objective, its marker and its reward; the world asks it
// every step whether the objective is done.

import { PLACES } from './city.js';
import { spawnEnemy, spawnPickup } from './combat.js';
import { addWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Drop',
    giver: 'Mama Delia',
    intro: ['A package. The marina, slip 9.', 'No questions, no stops.'],
    objectives: [
      { type: 'goto', x: PLACES.marinaSlip.x, y: PLACES.marinaSlip.y, r: 60, label: 'Deliver the package to the marina, slip 9' },
    ],
    reward: 150,
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    giver: 'Mama Delia',
    intro: ['The yellow Comet GT at Veloce Motors.', 'Bring it to my garage. Try not to scratch it.'],
    objectives: [
      { type: 'steal', special: 'comet', label: 'Steal the yellow Comet GT at Veloce Motors' },
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, r: 70, label: "Drive the Comet to Delia's Garage", needCar: true },
    ],
    reward: 250,
  },
  {
    id: 'm3',
    title: 'Loud Neighbors',
    giver: 'Mama Delia',
    intro: ['The Dock Rats think my warehouse is theirs.', 'Show them the door. Loudly.'],
    objectives: [
      { type: 'kill', count: 4, label: 'Clear the dock gang at the warehouse' },
    ],
    reward: 300,
  },
  {
    id: 'm4',
    title: 'Getaway',
    giver: 'Mama Delia',
    intro: ['The cops are crawling after that noise.', 'Lose them, then get to the safehouse on Gull Street.'],
    objectives: [
      { type: 'escape', label: 'Lose the cops — get your wanted level to zero' },
      { type: 'goto', x: PLACES.safehouse.x, y: PLACES.safehouse.y, r: 60, label: 'Reach the safehouse on Gull Street' },
    ],
    reward: 300,
  },
  {
    id: 'm5',
    title: 'The Collector',
    giver: 'Mama Delia',
    intro: ['Three drops around the city. My money, my streets.', 'Collect them all.'],
    objectives: [
      { type: 'collect', count: 3, label: 'Collect the three cash drops' },
    ],
    reward: 400,
  },
  {
    id: 'm6',
    title: 'Harbor Lights',
    giver: 'Mama Delia',
    intro: ['One last run. Four checkpoints, every cop in Solmar on your tail.', 'Finish at the pier and you are free — and rich.'],
    objectives: [
      { type: 'checkpoint', points: [
        { x: 600, y: 600 }, { x: 2600, y: 600 }, { x: 2600, y: 1800 }, { x: 1600, y: 2370 },
      ], label: 'Run the checkpoints — finish at the pier' },
    ],
    reward: 600,
  },
];

function startObjective(state, mission, objective) {
  const player = state.player;
  if (objective.type === 'kill') {
    const spots = [
      { x: PLACES.warehouse.x - 60, y: PLACES.warehouse.y - 40 },
      { x: PLACES.warehouse.x + 70, y: PLACES.warehouse.y - 60 },
      { x: PLACES.warehouse.x - 40, y: PLACES.warehouse.y + 70 },
      { x: PLACES.warehouse.x + 80, y: PLACES.warehouse.y + 50 },
    ];
    for (let index = 0; index < objective.count; index += 1) {
      spawnEnemy(state, spots[index].x, spots[index].y);
    }
    if (player.weapon !== 'pistol') {
      spawnPickup(state, player.x + 60, player.y + 20, 'weapon', 0);
      state.toast('A pistol is waiting by the warehouse door');
    }
  }
  if (objective.type === 'collect') {
    const points = [PLACES.cashDropA, PLACES.cashDropB, PLACES.cashDropC];
    for (const point of points) spawnPickup(state, point.x, point.y, 'cash', 120);
  }
  if (objective.type === 'escape') {
    if (player.wanted < 3) addWanted(state, 3 - player.wanted);
  }
  if (objective.type === 'checkpoint') {
    if (player.wanted < 2) addWanted(state, 2 - player.wanted);
  }
}

/** Begin mission `index` (0-based): banner, intro lines, first objective. */
export function startMission(state, index) {
  const mission = MISSIONS[index];
  state.mission = {
    index,
    id: mission.id,
    title: mission.title,
    giver: mission.giver,
    objectiveIndex: 0,
    objectives: mission.objectives,
    count: 0,
    needed: 0,
    banner: mission.title,
    bannerTimer: 3.2,
    done: false,
  };
  for (const line of mission.intro) state.toast(`${mission.giver}: ${line}`);
  startObjective(state, mission, mission.objectives[0]);
}

/** Restart the current mission from its first objective (after busted / wasted). */
export function restartMission(state) {
  const index = state.mission ? state.mission.index : 0;
  state.enemies.length = 0;
  startMission(state, index);
}

/** The objective the player is working on right now, or null when the story is done. */
export function currentObjective(state) {
  if (!state.mission || state.mission.done) return null;
  return state.mission.objectives[state.mission.objectiveIndex] ?? null;
}

/** The marker position for the current objective, or null. */
export function missionTarget(state) {
  const objective = currentObjective(state);
  if (!objective) return null;
  if (objective.type === 'goto') return { x: objective.x, y: objective.y };
  if (objective.type === 'steal') {
    for (const car of state.cars) if (car.special === objective.special) return { x: car.x, y: car.y };
    return null;
  }
  if (objective.type === 'kill') return { x: PLACES.warehouse.x, y: PLACES.warehouse.y };
  if (objective.type === 'escape') return { x: PLACES.safehouse.x, y: PLACES.safehouse.y };
  if (objective.type === 'collect') {
    for (const pickup of state.pickups) if (pickup.kind === 'cash') return { x: pickup.x, y: pickup.y };
    return null;
  }
  if (objective.type === 'checkpoint') {
    const point = objective.points[state.mission.count];
    return point ? { x: point.x, y: point.y } : null;
  }
  return null;
}

/** One line for the HUD: the mission title and the objective, with progress. */
export function missionObjectiveText(state) {
  const objective = currentObjective(state);
  if (!objective) return state.storyComplete ? 'Story complete — Port Solmar is yours' : '';
  const mission = MISSIONS[state.mission.index];
  let progress = '';
  if (objective.type === 'kill') progress = ` ${state.mission.count}/${objective.count}`;
  if (objective.type === 'collect') progress = ` ${state.mission.count}/${objective.count}`;
  if (objective.type === 'checkpoint') progress = ` ${state.mission.count}/${objective.points.length}`;
  return `${mission.title} — ${objective.label}${progress}`;
}

function completeMission(state) {
  const mission = MISSIONS[state.mission.index];
  state.player.money += mission.reward;
  state.stats.missionsDone += 1;
  state.score += mission.reward;
  state.mission.banner = `MISSION COMPLETE — $${mission.reward}`;
  state.mission.bannerTimer = 3.2;
  state.audio.missionDone();
  state.toast(`$${mission.reward} — ${mission.title} done`);
  state.save();
  if (state.mission.index + 1 < MISSIONS.length) {
    startMission(state, state.mission.index + 1);
  } else {
    state.mission.done = true;
    state.storyComplete = true;
    state.mission.banner = 'STORY COMPLETE — PORT SOLMAR IS YOURS';
    state.mission.bannerTimer = 5;
  }
}

/** Advance the current objective; returns nothing, but completes missions as they finish. */
export function stepMissions(state, dt) {
  if (!state.mission || state.mission.done) return;
  if (state.mission.bannerTimer > 0) state.mission.bannerTimer -= dt;
  const objective = currentObjective(state);
  if (!objective) return;
  const player = state.player;
  const dx = objective.x !== undefined ? player.x - objective.x : 0;
  const dy = objective.y !== undefined ? player.y - objective.y : 0;
  const dist = Math.hypot(dx, dy);

  let advanced = false;
  if (objective.type === 'goto') {
    if (dist < objective.r && (!objective.needCar || player.inCar)) advanced = true;
  } else if (objective.type === 'steal') {
    if (player.inCar && player.car && player.car.special === objective.special) advanced = true;
  } else if (objective.type === 'kill') {
    state.mission.count = objective.count - state.enemies.length;
    if (state.enemies.length === 0 && state.mission.count >= objective.count) advanced = true;
  } else if (objective.type === 'escape') {
    if (player.wanted === 0) advanced = true;
  } else if (objective.type === 'collect') {
    state.mission.count = objective.count - state.pickups.filter((p) => p.kind === 'cash').length;
    if (state.pickups.filter((p) => p.kind === 'cash').length === 0) advanced = true;
  } else if (objective.type === 'checkpoint') {
    const point = objective.points[state.mission.count];
    if (point) {
      const pdx = player.x - point.x;
      const pdy = player.y - point.y;
      if (Math.hypot(pdx, pdy) < 70) {
        state.mission.count += 1;
        state.audio.pickup();
        if (state.mission.count >= objective.points.length) advanced = true;
      }
    }
  }

  if (advanced) {
    state.mission.objectiveIndex += 1;
    state.mission.count = 0;
    if (state.mission.objectiveIndex >= state.mission.objectives.length) {
      completeMission(state);
    } else {
      const next = state.mission.objectives[state.mission.objectiveIndex];
      state.mission.banner = '';
      startObjective(state, MISSIONS[state.mission.index], next);
    }
  }
}
