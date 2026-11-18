// Drawing only: the world's state and the current screen in, pixels out. The camera
// follows the player through the 3200x2400 city and the 1280x720 window shows what is
// around them; the HUD, the minimap and the panels are drawn in screen space on top.

import { CITY, VIEW, FONT, PALETTE, PLAYER } from './config.js';
import { missionTarget, missionObjectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const MINIMAP = { x: VIEW.width - 216, y: VIEW.height - 166, w: 200, h: 150 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const moneyLabel = cachedLabel('$');
  const healthLabel = cachedLabel('');
  const ammoLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(state) {
    const city = state.city;
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, CITY.width, CITY.height);
    // Beach and water along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, CITY.beachY, CITY.width, CITY.height - CITY.beachY);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, CITY.waterY, CITY.width, CITY.height - CITY.waterY);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < CITY.width; x += 90) {
      context.fillRect(x, CITY.waterY + 30 + ((x / 90) % 3) * 8, 46, 3);
    }
    // The pier.
    context.fillStyle = PALETTE.pier;
    context.fillRect(1500, CITY.beachY - 40, 200, CITY.height - CITY.beachY + 40);
    context.fillStyle = '#8a6a48';
    for (let y = CITY.beachY - 30; y < CITY.height; y += 26) context.fillRect(1500, y, 200, 4);
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.grassDark;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of city.trees) {
      context.fillStyle = PALETTE.treeDark;
      context.beginPath();
      context.arc(tree.x + 3, tree.y + 4, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
    }
    // Parking lots.
    for (const lot of city.lots) {
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(lot.x, lot.y, lot.w, lot.h);
      context.strokeStyle = 'rgba(238,241,245,0.35)';
      context.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 52) {
        context.beginPath();
        context.moveTo(x, lot.y + 8);
        context.lineTo(x, lot.y + 34);
        context.stroke();
      }
    }
    // Roads: asphalt, sidewalks, centre dashes, crosswalks at every crossing.
    for (const ry of CITY.roadsY) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, ry - CITY.roadHalf - CITY.sidewalk, CITY.width, (CITY.roadHalf + CITY.sidewalk) * 2);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(0, ry - CITY.roadHalf, CITY.width, CITY.roadHalf * 2);
    }
    for (const rx of CITY.roadsX) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - CITY.roadHalf - CITY.sidewalk, 0, (CITY.roadHalf + CITY.sidewalk) * 2, CITY.height);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(rx - CITY.roadHalf, 0, CITY.roadHalf * 2, CITY.height);
    }
    context.fillStyle = PALETTE.asphaltLine;
    for (const ry of CITY.roadsY) {
      for (let x = 20; x < CITY.width; x += 64) context.fillRect(x, ry - 2, 30, 4);
    }
    for (const rx of CITY.roadsX) {
      for (let y = 20; y < CITY.height; y += 64) context.fillRect(rx - 2, y, 4, 30);
    }
    context.fillStyle = 'rgba(238,241,245,0.55)';
    for (const rx of CITY.roadsX) {
      for (const ry of CITY.roadsY) {
        for (let i = -2; i <= 2; i += 1) {
          context.fillRect(rx - CITY.roadHalf + 8 + i * 16, ry - CITY.roadHalf + 4, 8, 10);
          context.fillRect(rx - CITY.roadHalf + 8 + i * 16, ry + CITY.roadHalf - 14, 8, 10);
        }
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      context.fillStyle = PALETTE.buildingShadow;
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(b.x, b.y, b.w, 10);
      context.fillStyle = PALETTE.windowDark;
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx * 7 + cy * 5 + Math.floor(b.x)) % 4 === 0) context.fillStyle = PALETTE.windowLit;
          else context.fillStyle = PALETTE.windowDark;
          context.fillRect(b.x + 12 + cx * 34, b.y + 14 + cy * 34, 16, 12);
        }
      }
    }
  }

  function drawSkid(state) {
    context.strokeStyle = 'rgba(20,20,24,0.5)';
    context.lineWidth = 5;
    for (const mark of state.skid) {
      context.globalAlpha = Math.min(1, mark.life / 3);
      context.beginPath();
      context.moveTo(mark.x - Math.cos(mark.angle) * 18, mark.y - Math.sin(mark.angle) * 18);
      context.lineTo(mark.x + Math.cos(mark.angle) * 18, mark.y + Math.sin(mark.angle) * 18);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawPickup(state, pickup) {
    const bob = Math.sin(pickup.bob) * 3;
    const colors = { health: PALETTE.health, armor: PALETTE.armor, ammo: '#e0c25a', cash: PALETTE.money, weapon: '#c96bd8' };
    context.fillStyle = colors[pickup.kind] ?? PALETTE.money;
    context.beginPath();
    context.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#10131c';
    context.font = 'bold 13px ' + FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const glyph = { health: '+', armor: 'A', ammo: '»', cash: '$', weapon: 'P' }[pickup.kind] ?? '?';
    context.fillText(glyph, pickup.x, pickup.y + bob + 1);
    context.textBaseline = 'alphabetic';
  }

  function drawCarShape(state, car) {
    const length = car.model === 'truck' ? 62 : 54;
    const width = car.model === 'truck' ? 28 : 26;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Wheels.
    context.fillStyle = '#14161c';
    context.fillRect(-length / 2 + 6, -width / 2 - 3, 12, 6);
    context.fillRect(-length / 2 + 6, width / 2 - 3, 12, 6);
    context.fillRect(length / 2 - 18, -width / 2 - 3, 12, 6);
    context.fillRect(length / 2 - 18, width / 2 - 3, 12, 6);
    // Body.
    context.fillStyle = car.color;
    roundRect(-length / 2, -width / 2, length, width, 8);
    context.fill();
    if (car.kind === 'police') {
      context.fillStyle = PALETTE.policeWhite;
      context.fillRect(-6, -width / 2, 12, width);
      context.fillStyle = '#10131c';
      context.font = 'bold 9px ' + FONT;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('SPPD', 0, 0);
      context.textBaseline = 'alphabetic';
    } else if (car.model === 'taxi') {
      context.fillStyle = '#10131c';
      context.fillRect(-8, -width / 2, 16, 6);
      context.fillStyle = PALETTE.money;
      context.fillRect(-10, -4, 20, 8);
    }
    // Windshield and roof.
    context.fillStyle = 'rgba(20,28,40,0.85)';
    context.fillRect(length / 2 - 20, -width / 2 + 4, 10, width - 8);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(-8, -width / 2 + 4, 16, width - 8);
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(length / 2 - 2, -width / 2 + 3, 3, 5);
    context.fillRect(length / 2 - 2, width / 2 - 8, 3, 5);
    // Wreck smoke.
    if (car.wrecked) {
      context.fillStyle = 'rgba(40,40,44,0.6)';
      context.beginPath();
      context.arc(-6, -4, 10, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (car.siren) {
      const phase = Math.floor(state.time * 3) % 2 === 0;
      context.fillStyle = phase ? '#ff3b30' : '#3b6fd4';
      context.beginPath();
      context.arc(car.x, car.y - 16, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPerson(x, y, angle, shirt, pants) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = pants ?? '#2c3442';
    context.fillRect(-5, -5, 10, 10);
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(4, 0, 4.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawEntities(state) {
    drawSkid(state);
    for (const pickup of state.pickups) drawPickup(state, pickup);
    for (const car of state.cars) drawCarShape(state, car);
    for (const ped of state.peds) {
      if (ped.dead) {
        context.fillStyle = '#7a2e2e';
        context.beginPath();
        context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.color);
    }
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, PALETTE.cop, '#1d2f55');
      context.fillStyle = '#1d2f55';
      context.beginPath();
      context.arc(cop.x, cop.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const enemy of state.enemies) {
      drawPerson(enemy.x, enemy.y, enemy.angle, PALETTE.enemy, '#3a2020');
      // A gun in hand.
      context.strokeStyle = '#14161c';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(enemy.x + Math.cos(enemy.angle) * 8, enemy.y + Math.sin(enemy.angle) * 8);
      context.lineTo(enemy.x + Math.cos(enemy.angle) * 18, enemy.y + Math.sin(enemy.angle) * 18);
      context.stroke();
    }
    // The player: yellow jacket, white cap, weapon in hand.
    const player = state.player;
    if (!player.inCar) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
      if (!blink) {
        drawPerson(player.x, player.y, player.angle, PALETTE.playerJacket, '#2c3442');
        context.fillStyle = PALETTE.player;
        context.beginPath();
        context.arc(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4, 4, 0, Math.PI * 2);
        context.fill();
        if (player.weapon === 'pistol') {
          context.strokeStyle = '#14161c';
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8);
          context.lineTo(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20);
          context.stroke();
        }
      }
    }
    // Bullets as tracers.
    context.strokeStyle = PALETTE.bullet;
    context.lineWidth = 2;
    for (const bullet of state.bullets) {
      context.beginPath();
      context.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawMissionMarker(state) {
    const target = missionTarget(state);
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    // A column of light at the target, so it reads from across the city.
    context.fillStyle = 'rgba(255, 217, 77, 0.16)';
    context.fillRect(target.x - 14, target.y - 260, 28, 260);
    context.save();
    context.translate(target.x, target.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.mission;
    const size = 13 * pulse;
    context.fillRect(-size / 2, -size / 2, size, size);
    context.restore();
    context.strokeStyle = PALETTE.mission;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(target.x, target.y, 22 * pulse, 0, Math.PI * 2);
    context.stroke();
  }

  function drawEdgeArrow(state) {
    const target = missionTarget(state);
    if (!target) return;
    const cam = state.camera;
    const left = cam.x - VIEW.width / 2;
    const top = cam.y - VIEW.height / 2;
    if (target.x > left + 40 && target.x < left + VIEW.width - 40 && target.y > top + 40 && target.y < top + VIEW.height - 40) return;
    const cx = Math.max(left + 30, Math.min(left + VIEW.width - 30, target.x));
    const cy = Math.max(top + 30, Math.min(top + VIEW.height - 30, target.y));
    const angle = Math.atan2(target.y - (top + VIEW.height / 2), target.x - (left + VIEW.width / 2));
    const dist = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y));
    context.save();
    context.translate(cx, cy);
    context.rotate(angle);
    context.fillStyle = PALETTE.mission;
    context.beginPath();
    context.moveTo(14, 0);
    context.lineTo(-10, -10);
    context.lineTo(-10, 10);
    context.closePath();
    context.fill();
    context.restore();
    // Distance label on a dark pill so it reads over the road, the HUD or a car.
    // Near the top edge the label goes under the arrow, or it is clipped off-screen.
    // (cx, cy are world coordinates — the screen position is cy minus the view top.)
    const label = String(dist) + 'm';
    context.font = '600 15px "Trebuchet MS", Verdana, sans-serif';
    const labelWidth = context.measureText(label).width + 16;
    const screenY = cy - top;
    const labelY = screenY < 70 ? cy + 12 : cy - 34;
    context.fillStyle = 'rgba(16, 20, 30, 0.85)';
    context.fillRect(cx - labelWidth / 2, labelY, labelWidth, 22);
    text(label, cx, labelY + 18, 15, PALETTE.mission, 'center');
  }

  function drawMinimap(state) {
    const scale = MINIMAP.w / CITY.width;
    context.fillStyle = 'rgba(16, 20, 30, 0.85)';
    context.fillRect(MINIMAP.x - 4, MINIMAP.y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    context.fillStyle = '#2f6f96';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.fillStyle = '#5d8a4e';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, (CITY.beachY - 100) * scale);
    context.fillStyle = '#d9b380';
    context.fillRect(MINIMAP.x, MINIMAP.y + CITY.beachY * scale, MINIMAP.w, MINIMAP.h - CITY.beachY * scale);
    context.strokeStyle = '#33373f';
    context.lineWidth = 3;
    for (const rx of CITY.roadsX) {
      context.beginPath();
      context.moveTo(MINIMAP.x + rx * scale, MINIMAP.y);
      context.lineTo(MINIMAP.x + rx * scale, MINIMAP.y + MINIMAP.h);
      context.stroke();
    }
    for (const ry of CITY.roadsY) {
      context.beginPath();
      context.moveTo(MINIMAP.x, MINIMAP.y + ry * scale);
      context.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + ry * scale);
      context.stroke();
    }
    const target = missionTarget(state);
    if (target) {
      context.fillStyle = PALETTE.mission;
      context.beginPath();
      context.arc(MINIMAP.x + target.x * scale, MINIMAP.y + target.y * scale, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = '#3b6fd4';
      context.beginPath();
      context.arc(MINIMAP.x + car.x * scale, MINIMAP.y + car.y * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const enemy of state.enemies) {
      context.fillStyle = PALETTE.enemy;
      context.beginPath();
      context.arc(MINIMAP.x + enemy.x * scale, MINIMAP.y + enemy.y * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
    const player = state.player;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(MINIMAP.x + player.x * scale, MINIMAP.y + player.y * scale, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(238,241,245,0.6)';
    context.lineWidth = 1;
    context.strokeRect(MINIMAP.x - 4, MINIMAP.y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    text('SOLMAR', MINIMAP.x, MINIMAP.y - 8, 13, PALETTE.muted, 'left');
  }

  function drawHud(state) {
    const player = state.player;
    context.textBaseline = 'alphabetic';
    // Health and armor bars, top left.
    context.fillStyle = 'rgba(16,20,30,0.6)';
    context.fillRect(16, 14, 240, 54);
    context.fillStyle = '#3a3f4a';
    context.fillRect(24, 22, 180, 12);
    context.fillStyle = PALETTE.health;
    context.fillRect(24, 22, 180 * Math.max(0, player.health / 100), 12);
    text(healthLabel(Math.round(player.health)), 210, 34, 14, PALETTE.text, 'left');
    context.fillStyle = '#3a3f4a';
    context.fillRect(24, 40, 180, 8);
    context.fillStyle = PALETTE.armor;
    context.fillRect(24, 40, 180 * Math.max(0, player.armor / 100), 8);
    text('$', 24, 62, 16, PALETTE.money, 'left');
    text(moneyLabel(player.money), 40, 62, 16, PALETTE.text, 'left');
    // Wanted stars, top right.
    const starX = VIEW.width - 24;
    for (let star = 0; star < 5; star += 1) {
      text('★', starX - star * 30, 40, 28, star < player.wanted ? PALETTE.star : PALETTE.starEmpty, 'right');
    }
    // Clock, under the stars.
    const hours = Math.floor(state.clockMinutes / 60) % 24;
    const minutes = Math.floor(state.clockMinutes % 60);
    const clock = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    text(clock, VIEW.width - 24, 66, 16, PALETTE.text, 'right');
    // Mission objective, top centre: truncated so it never reaches the stars.
    const objective = missionObjectiveText(state);
    if (objective) {
      let shown = objective;
      context.font = '600 17px "Trebuchet MS", Verdana, sans-serif';
      while (shown.length > 4 && context.measureText(shown).width > 640) shown = shown.slice(0, -2);
      if (shown !== objective) shown = shown.slice(0, -1) + '…';
      text(shown, VIEW.width / 2, 34, 17, PALETTE.mission, 'center');
    }
    // Weapon and ammo, bottom centre.
    const weapon = player.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
    const ammo = player.weapon === 'pistol' ? ammoLabel(player.ammo + ' / ' + player.reserveAmmo) : '';
    text(weapon + (ammo ? '  ' + ammo : ''), VIEW.width / 2, VIEW.height - 16, 16, PALETTE.text, 'center');
    if (player.reloadTimer > 0) text('RELOADING…', VIEW.width / 2, VIEW.height - 38, 15, PALETTE.muted, 'center');
    // Speed, when driving.
    if (player.inCar && player.car) {
      const kmh = Math.round(Math.abs(player.car.speed) * 0.18);
      text(kmh + ' km/h', 24, VIEW.height - 16, 18, PALETTE.text, 'left');
      text('E — exit car', 24, VIEW.height - 40, 14, PALETTE.muted, 'left');
    } else {
      text('E — enter car   •   Click — shoot/punch   •   R — reload   •   P — pause', 24, VIEW.height - 16, 14, PALETTE.muted, 'left');
    }
    // Toasts, under the objective.
    let toastY = 62;
    for (const toast of state.toasts) {
      context.globalAlpha = Math.min(1, toast.timer);
      context.fillStyle = PALETTE.toast;
      const w = context.measureText(toast.text).width + 24;
      context.fillRect(VIEW.width / 2 - w / 2, toastY - 20, w, 26);
      context.globalAlpha = 1;
      text(toast.text, VIEW.width / 2, toastY, 15, PALETTE.text, 'center');
      toastY += 32;
    }
    // Mission banner, centre screen.
    if (state.mission && state.mission.banner && state.mission.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, state.mission.bannerTimer);
      text(state.mission.banner, VIEW.width / 2, VIEW.height / 2 - 120, 30, PALETTE.banner, 'center');
      context.globalAlpha = 1;
    }
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const lineHeight = 30;
    const height = 150 + lines.length * lineHeight + 64;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.banner;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 64, 42, PALETTE.banner, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      textPlain(lines[index], VIEW.width / 2, y + 116 + index * lineHeight, 19, PALETTE.text, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 28, 20, PALETTE.mission, 'center');
  }

  const TITLE_LINES = [
    'Port Solmar. You came off the night ferry with $40 and a dead phone.',
    'Mama Delia runs the docks — and she remembers your father’s name.',
    'Do her jobs. Don’t get caught. Make the city yours.',
    'WASD move • Mouse aim • Click shoot / punch • E enter & steal cars',
    'R reload • Shift sprint • P pause • M mute • Save: automatic',
  ];

  /** Paint one frame: the city, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, saveExists) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (state.random() * 2 - 1) * state.shake : 0;
    const shakeY = state.shake > 0 ? (state.random() * 2 - 1) * state.shake : 0;
    const camX = state.camera.x + shakeX;
    const camY = state.camera.y + shakeY;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - (camX - VIEW.width / 2) * view.scale, view.y - (camY - VIEW.height / 2) * view.scale);
    drawGround(state);
    drawBuildings(state);
    drawMissionMarker(state);
    drawEntities(state);
    drawEdgeArrow(state);
    // Time-of-day tint: golden hour in the evening, blue at night.
    const hour = (state.clockMinutes / 60) % 24;
    if (hour >= 17.5 && hour < 20) {
      context.fillStyle = 'rgba(255, 140, 60, 0.10)';
      context.fillRect(camX - VIEW.width / 2, camY - VIEW.height / 2, VIEW.width, VIEW.height);
    } else if (hour >= 20 || hour < 6) {
      context.fillStyle = 'rgba(20, 40, 90, 0.16)';
      context.fillRect(camX - VIEW.width / 2, camY - VIEW.height / 2, VIEW.width, VIEW.height);
    }
    // Back to screen space for the HUD and panels.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(10, 12, 20, 0.45)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const lines = saveExists ? TITLE_LINES.concat(['', 'A saved game is waiting for you.']) : TITLE_LINES;
      drawPanel('SOLMAR', lines, saveExists ? 'Press Space to start — or C to continue' : 'Press Space or click to start');
      text('NEON STREETS', VIEW.width / 2, (VIEW.height - (150 + lines.length * 30 + 64)) / 2 + 96, 20, PALETTE.muted, 'center');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', 'Your progress is saved automatically.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar police took you in.', 'Bail: $100. The mission restarts.'], 'Press Space to get out');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Port Solmar is not kind to the careless.', 'Hospital bill: $50. The mission restarts.'], 'Press Space to try again');
    }
    if (state.storyComplete && screen === SCREEN_PLAY) {
      text('STORY COMPLETE — free roam', VIEW.width / 2, 96, 20, PALETTE.banner, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
