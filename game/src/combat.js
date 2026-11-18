// Combat: the player's pistol and fists, the gang members who shoot back, bullets,
// damage, pickups and the particles that sell every hit. Bullets are simple tracers with
// a short life; a hit tests the segment against a circle, so a fast bullet cannot skip
// through a target between two steps.

import { PLAYER, ENEMY, CAR } from './config.js';
import { collideCircle, insideBuilding } from './city.js';
import { addWanted } from './police.js';

export function burst(state, x, y, color, count, speed, life) {
  for (let index = 0; index < count; index += 1) {
    const angle = state.random() * Math.PI * 2;
    const power = speed * (0.4 + state.random() * 0.6);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * power, vy: Math.sin(angle) * power,
      life: life * (0.6 + state.random() * 0.4), maxLife: life,
      color, size: 2 + state.random() * 3,
    });
  }
  if (state.particles.length > 320) state.particles.splice(0, state.particles.length - 320);
}

export function damagePlayer(state, amount) {
  const player = state.player;
  if (player.invulnerable > 0) return;
  let left = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, left * 0.6);
    player.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  player.invulnerable = 0.35;
  if (player.health <= 0) {
    player.health = 0;
    state.events |= state.EVENT_WASTED;
  }
}

export function damageCar(state, car, amount) {
  car.health -= amount;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.health = 0;
    burst(state, car.x, car.y, '#ff9a3d', 26, 260, 0.9);
    burst(state, car.x, car.y, '#3a3f4a', 18, 160, 1.4);
    state.audio.explosion();
    state.shake = Math.min(14, state.shake + 8);
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    if (dx * dx + dy * dy < 130 * 130) {
      // Your own car blowing up hurts you; another car's blast is caught by your car.
      if (car === state.player.car) damagePlayer(state, CAR.explosionDamage);
      else if (state.player.inCar && state.player.car) damageCar(state, state.player.car, 20);
      else damagePlayer(state, CAR.explosionDamage);
    }
    if (car.kind === 'police') addWanted(state, 1);
    if (car === state.player.car) {
      state.player.inCar = false;
      state.player.car = null;
    }
  }
}

/** The player fires the pistol (or swings a fist) toward the aim point. */
export function playerAttack(state, aimX, aimY) {
  const player = state.player;
  if (player.attackCooldown > 0 || player.reloadTimer > 0) return;
  if (player.weapon === 'pistol') {
    if (player.ammo <= 0) {
      player.reloadTimer = PLAYER.reloadTime;
      return;
    }
    player.ammo -= 1;
    player.attackCooldown = PLAYER.pistolRate;
    const angle = Math.atan2(aimY - player.y, aimX - player.x);
    state.bullets.push({
      x: player.x + Math.cos(angle) * 18,
      y: player.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      from: 'player', life: PLAYER.bulletRange / PLAYER.bulletSpeed,
      damage: PLAYER.pistolDamage,
    });
    burst(state, player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, '#ffcf5a', 3, 120, 0.12);
    state.audio.gunshot();
    state.shake = Math.min(6, state.shake + 0.6);
    player.lastCrime = state.time;
    // A cop who sees the shot calls it in — at most one extra star every few seconds.
    if (state.time - player.lastWitnessedShot > 4) {
      for (const cop of state.cops) {
        const dx = cop.x - player.x;
        const dy = cop.y - player.y;
        if (dx * dx + dy * dy < 320 * 320) {
          addWanted(state, 1);
          player.lastWitnessedShot = state.time;
          break;
        }
      }
    }
  } else {
    player.attackCooldown = PLAYER.punchRate;
    const angle = Math.atan2(aimY - player.y, aimX - player.x);
    const hx = player.x + Math.cos(angle) * PLAYER.punchRange;
    const hy = player.y + Math.sin(angle) * PLAYER.punchRange;
    state.audio.punch();
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      const dx = enemy.x - hx;
      const dy = enemy.y - hy;
      if (dx * dx + dy * dy < 30 * 30) {
        enemy.hp -= PLAYER.punchDamage;
        // A landed punch shoves the target back, so fists can hold a doorway.
        enemy.x += Math.cos(angle) * 14;
        enemy.y += Math.sin(angle) * 14;
        burst(state, enemy.x, enemy.y, '#e5534b', 6, 140, 0.4);
      }
    }
    for (const cop of state.cops) {
      const dx = cop.x - hx;
      const dy = cop.y - hy;
      if (dx * dx + dy * dy < 30 * 30) {
        cop.hp -= PLAYER.punchDamage;
        if (cop.hp <= 0) {
          state.cops.splice(state.cops.indexOf(cop), 1);
          addWanted(state, 1);
        }
      }
    }
  }
}

/** A gang member who guards a spot and shoots at the player. */
export function spawnEnemy(state, x, y) {
  const enemy = {
    x, y,
    angle: 0,
    hp: ENEMY.hp,
    speed: ENEMY.speed,
    shootCooldown: 0.6 + state.random(),
    state: 'guard',
    homeX: x, homeY: y,
  };
  state.enemies.push(enemy);
  return enemy;
}

function stepEnemy(state, enemy, dt) {
  if (enemy.hp <= 0) return;
  const player = state.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.angle = Math.atan2(dy, dx);
  if (dist < ENEMY.sight) {
    enemy.state = 'fight';
    if (dist > 240) {
      const step = Math.min(dist - 220, enemy.speed * dt);
      const nx = enemy.x + (dx / dist) * step;
      const ny = enemy.y + (dy / dist) * step;
      const fixed = collideCircle(state.city, nx, ny, 11, false);
      enemy.x = fixed.x;
      enemy.y = fixed.y;
    }
    enemy.shootCooldown -= dt;
    if (enemy.shootCooldown <= 0 && dist < 480) {
      enemy.shootCooldown = ENEMY.shootRate;
      const spread = (state.random() * 2 - 1) * ENEMY.shootSpread;
      const aim = Math.atan2(dy, dx) + spread;
      state.bullets.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(aim) * 780, vy: Math.sin(aim) * 780,
        from: 'enemy', life: 0.8, damage: ENEMY.shootDamage,
      });
      state.audio.enemyShot();
    }
  } else if (enemy.state === 'fight') {
    // Lost the player: drift back to the post.
    const hx = enemy.homeX - enemy.x;
    const hy = enemy.homeY - enemy.y;
    const hd = Math.hypot(hx, hy);
    if (hd > 10) {
      enemy.x += (hx / hd) * enemy.speed * 0.6 * dt;
      enemy.y += (hy / hd) * enemy.speed * 0.6 * dt;
    } else enemy.state = 'guard';
  }
}

/** A segment from (x0, y0) to (x1, y1) passes within `radius` of (cx, cy)? */
function segmentHits(x0, y0, x1, y1, cx, cy, radius) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((cx - x0) * dx + (cy - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + dx * t;
  const py = y0 + dy * t;
  const ex = cx - px;
  const ey = cy - py;
  return ex * ex + ey * ey < radius * radius;
}

function stepBullets(state, dt) {
  for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
    const bullet = state.bullets[index];
    const x0 = bullet.x;
    const y0 = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0;
    if (!dead && insideBuilding(state.city, bullet.x, bullet.y)) {
      burst(state, bullet.x, bullet.y, '#c8b25a', 3, 90, 0.25);
      dead = true;
    }
    if (!dead && bullet.from === 'player') {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        if (segmentHits(x0, y0, bullet.x, bullet.y, enemy.x, enemy.y, 14)) {
          enemy.hp -= bullet.damage;
          burst(state, enemy.x, enemy.y, '#e5534b', 6, 140, 0.4);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (segmentHits(x0, y0, bullet.x, bullet.y, cop.x, cop.y, 13)) {
            cop.hp -= bullet.damage;
            burst(state, cop.x, cop.y, '#e5534b', 6, 140, 0.4);
            if (cop.hp <= 0) {
              state.cops.splice(state.cops.indexOf(cop), 1);
              addWanted(state, 1);
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.dead) continue;
          if (segmentHits(x0, y0, bullet.x, bullet.y, ped.x, ped.y, 11)) {
            ped.dead = true;
            ped.deadTimer = 0;
            burst(state, ped.x, ped.y, '#e5534b', 8, 150, 0.5);
            addWanted(state, 1);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.kind === 'player' || car.wrecked) continue;
          const along = (car.x - x0) * Math.cos(car.angle) + (car.y - y0) * Math.sin(car.angle);
          const across = (car.x - x0) * -Math.sin(car.angle) + (car.y - y0) * Math.cos(car.angle);
          if (Math.abs(along) < 30 && Math.abs(across) < 16) {
            damageCar(state, car, bullet.damage);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && bullet.from === 'enemy') {
      const player = state.player;
      if (player.inCar) {
        const car = player.car;
        if (car && segmentHits(x0, y0, bullet.x, bullet.y, car.x, car.y, 26)) {
          damageCar(state, car, bullet.damage * 0.5);
          dead = true;
        }
      } else if (segmentHits(x0, y0, bullet.x, bullet.y, player.x, player.y, 13)) {
        damagePlayer(state, bullet.damage);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(index, 1);
  }
}

export function spawnPickup(state, x, y, kind, amount) {
  state.pickups.push({ x, y, kind, amount: amount ?? 0, bob: state.random() * Math.PI * 2 });
}

function stepPickups(state, dt) {
  const player = state.player;
  for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
    const pickup = state.pickups[index];
    pickup.bob += dt * 3;
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    if (dx * dx + dy * dy < 30 * 30) {
      if (pickup.kind === 'health') {
        player.health = Math.min(100, player.health + 40);
        state.audio.pickup();
      } else if (pickup.kind === 'armor') {
        player.armor = Math.min(100, player.armor + 40);
        state.audio.pickup();
      } else if (pickup.kind === 'ammo') {
        player.reserveAmmo += 24;
        state.audio.pickup();
      } else if (pickup.kind === 'cash') {
        player.money += pickup.amount;
        state.audio.cash();
      } else if (pickup.kind === 'weapon') {
        player.weapon = 'pistol';
        player.reserveAmmo += 36;
        state.audio.pickup();
        state.toast('Pistol acquired — click to shoot, R to reload');
      }
      burst(state, pickup.x, pickup.y, '#58c96b', 8, 120, 0.4);
      state.pickups.splice(index, 1);
    }
  }
}

/** Advance enemies, bullets and pickups one step; remove the dead. */
export function stepCombat(state, dt) {
  for (const enemy of state.enemies) stepEnemy(state, enemy, dt);
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    if (state.enemies[index].hp <= 0) {
      burst(state, state.enemies[index].x, state.enemies[index].y, '#e5534b', 10, 160, 0.5);
      state.enemies.splice(index, 1);
      state.stats.kills += 1;
    }
  }
  stepBullets(state, dt);
  stepPickups(state, dt);
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const p = state.particles[index];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(index, 1);
  }
  for (let index = state.skid.length - 1; index >= 0; index -= 1) {
    state.skid[index].life -= dt;
    if (state.skid[index].life <= 0) state.skid.splice(index, 1);
  }
}
