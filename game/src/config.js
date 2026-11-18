// Every tuning number and colour for SOLMAR — Neon Streets, in one place.
// The city is a fixed 3200x2400 world; the camera shows a 1280x720 window of it.
// The simulation runs in fixed 1/60 s steps, so no rule depends on the frame rate.

export const STEP = 1 / 60;

/** The city, in world pixels. Roads run on a 400 px grid; the south band is beach and water. */
export const CITY = {
  width: 3200,
  height: 2400,
  roadGap: 400,
  roadHalf: 45,
  sidewalk: 16,
  beachY: 2240,
  waterY: 2340,
  roadsX: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  roadsY: [200, 600, 1000, 1400, 1800, 2200],
};

/** The 1280x720 window the renderer paints. */
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  sprintSpeed: 305,
  health: 100,
  armor: 50,
  punchDamage: 22,
  punchRange: 38,
  punchRate: 0.34,
  pistolDamage: 34,
  pistolRate: 0.22,
  magSize: 12,
  reloadTime: 0.9,
  bulletSpeed: 940,
  bulletRange: 560,
  arrestTime: 1.5,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 430,
  brake: 620,
  maxSpeed: 540,
  maxReverse: 190,
  turnRate: 2.7,
  drag: 0.55,
  health: 140,
  ramDamage: 6,
  explosionDamage: 45,
};

export const TRAFFIC = {
  cars: 15,
  speed: 165,
  speedJitter: 45,
  // Busier sidewalks: the city should read alive at a glance, even on foot.
  peds: 24,
  pedSpeed: 52,
  pedFleeSpeed: 165,
};

export const POLICE = {
  baseCars: 1,
  carSpeed: 280,
  carSpeedPerStar: 20,
  copSpeed: 235,
  copShootStar: 3,
  shootRate: 1.35,
  shootDamage: 7,
  shootSpread: 0.22,
  spawnDistance: 420,
  despawnDistance: 950,
  chaseGiveUp: 1100,
};

export const ENEMY = {
  hp: 70,
  speed: 150,
  shootRate: 1.25,
  shootDamage: 8,
  shootSpread: 0.3,
  sight: 520,
};

export const WANTED = {
  max: 5,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 1,
  killEnemy: 0,
  decayQuietSeconds: 10,
  decayEverySeconds: 8,
  hiddenRadius: 520,
};

/** In-game clock: one game hour per 180 sim seconds, starting at 08:00. */
export const CLOCK = { startMinutes: 8 * 60, minutesPerSecond: 60 / 180 };

export const SAVE_KEY = 'solmar.save.v1';
export const BEST_KEY = 'solmar.best';

export const PALETTE = {
  backdrop: '#10131c',
  grass: '#5d8a4e',
  grassDark: '#527a45',
  asphalt: '#33373f',
  asphaltLine: '#c8b25a',
  sidewalk: '#8d8578',
  curb: '#6f6a60',
  sand: '#d9b380',
  water: '#2f6f96',
  waterDeep: '#245a7c',
  pier: '#7a5c3e',
  roofA: '#b5543f',
  roofB: '#4f6d8f',
  roofC: '#c98f3d',
  roofD: '#6d5a7a',
  roofE: '#3f7a5a',
  buildingShadow: 'rgba(0,0,0,0.28)',
  windowLit: '#ffd98a',
  windowDark: '#2c3442',
  tree: '#3e6b34',
  treeDark: '#2f5228',
  player: '#f2f2f2',
  playerJacket: '#e8b13c',
  cop: '#3b6fd4',
  copCar: '#2f5cb8',
  enemy: '#c93b3b',
  pedShirt: ['#d97b4f', '#7fa8c9', '#a5c96b', '#c97ba8', '#e0c25a', '#8a7fd0'],
  carColors: ['#c94f43', '#4f7fc9', '#e0b13c', '#5aa37a', '#8a5fc9', '#d8d8d8', '#3a3f4a', '#c97b4f'],
  policeWhite: '#e8e8e8',
  health: '#58c96b',
  armor: '#5aa8e0',
  money: '#e0c25a',
  star: '#f2c94c',
  starEmpty: '#5a5f6b',
  mission: '#ffd94d',
  text: '#eef1f5',
  muted: '#9aa2b1',
  panel: 'rgba(16, 20, 30, 0.88)',
  toast: 'rgba(16, 20, 30, 0.82)',
  banner: '#ffd94d',
  danger: '#e5534b',
  bullet: '#ffe9a8',
  muzzle: '#ffcf5a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
