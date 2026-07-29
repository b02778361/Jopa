/**
 * Enemy + EnemyManager — спавн, поведение и столкновения врагов.
 * Два типа: "drifter" летит по прямой через центральную зону,
 * "chaser" преследует игрока с плавным доворотом.
 */

const CHASER_PROBABILITY = 0.35;
const OFFSCREEN_MARGIN = 120;     // px за экраном до удаления
const ENEMY_HITBOX_SCALE = 0.8;   // хитбокс меньше спрайта — визуально честнее
const PLAYER_HITBOX_SCALE = 0.85;
const HYPER_KILL_BONUS = 5;       // очки за уничтожение врага в гипере

export class Enemy {
  constructor({ x, y, size, vx, vy, speed, chaser, spin, rot }) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.speed = speed;
    this.chaser = chaser;
    this.spin = spin;
    this.rot = rot;
  }

  update(dt, player) {
    if (this.chaser) {
      const ang = Math.atan2(player.y - this.y, player.x - this.x);
      const targetVx = Math.cos(ang) * this.speed;
      const targetVy = Math.sin(ang) * this.speed;
      this.vx += (targetVx - this.vx) * Math.min(dt * 2.5, 1);
      this.vy += (targetVy - this.vy) * Math.min(dt * 2.5, 1);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.chaser ? "#E97366" : "#DE9255";
    const h = this.size / 2;
    ctx.fillRect(-h, -h, this.size, this.size);
    ctx.restore();
  }
}

export class EnemyManager {
  /** @param {import("../core/Game.js").Game} game */
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.spawnTimer = 0;
  }

  reset() {
    this.enemies.length = 0;
    this.spawnTimer = 0;
  }

  /** Интервал спавна: 1.1с на старте, ужимается до 0.35с к 90-й секунде. */
  spawnInterval() {
    const t = Math.min(this.game.elapsed / 90, 1);
    return 1.1 - 0.75 * t;
  }

  spawn() {
    const g = this.game;
    const side = Math.floor(Math.random() * 4); // 0 верх, 1 право, 2 низ, 3 лево
    const size = 18 + Math.random() * 18;
    let x, y;
    if (side === 0) { x = Math.random() * g.viewW; y = -size; }
    else if (side === 1) { x = g.viewW + size; y = Math.random() * g.viewH; }
    else if (side === 2) { x = Math.random() * g.viewW; y = g.viewH + size; }
    else { x = -size; y = Math.random() * g.viewH; }

    const difficulty = 1 + g.elapsed / 10 * 0.15; // +15% скорости каждые 10 сек
    const speed = (70 + Math.random() * 90) * difficulty;
    const chaser = Math.random() < CHASER_PROBABILITY;

    let angle;
    if (chaser) {
      angle = Math.atan2(g.player.y - y, g.player.x - x);
    } else {
      // Направление в случайную точку центральной трети экрана
      const tx = g.viewW * (0.33 + Math.random() * 0.34);
      const ty = g.viewH * (0.33 + Math.random() * 0.34);
      angle = Math.atan2(ty - y, tx - x);
    }

    this.enemies.push(new Enemy({
      x, y, size,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speed,
      chaser,
      spin: (Math.random() - 0.5) * 4,
      rot: Math.random() * Math.PI * 2,
    }));
  }

  update(dt) {
    const g = this.game;
    const p = g.player;

    // Спавн
    this.spawnTimer -= dt;
    while (this.spawnTimer <= 0) {
      this.spawn();
      if (g.elapsed > 30 && Math.random() < 0.3) this.spawn(); // поздняя игра: иногда двое
      this.spawnTimer += this.spawnInterval();
    }

    // Движение + столкновения (AABB без учёта поворота)
    const half = p.size / 2;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.update(dt, p);

      if (
        en.x < -OFFSCREEN_MARGIN || en.x > g.viewW + OFFSCREEN_MARGIN ||
        en.y < -OFFSCREEN_MARGIN || en.y > g.viewH + OFFSCREEN_MARGIN
      ) {
        this.enemies.splice(i, 1);
        continue;
      }

      const eh = en.size / 2 * ENEMY_HITBOX_SCALE;
      if (p.hyper.active) {
        // Гипер: касание уничтожает врага, полный хитбокс игрока
        if (Math.abs(en.x - p.x) < eh + half && Math.abs(en.y - p.y) < eh + half) {
          g.explode(en.x, en.y, en.chaser ? "#E97366" : "#DE9255", 16);
          this.enemies.splice(i, 1);
          g.score += HYPER_KILL_BONUS;
          g.vibrate(30);
          continue;
        }
      } else if (p.invulnUntil <= 0) {
        const ph = half * PLAYER_HITBOX_SCALE;
        if (Math.abs(en.x - p.x) < eh + ph && Math.abs(en.y - p.y) < eh + ph) {
          g.gameOver();
          break;
        }
      }
    }
  }

  draw(ctx) {
    for (const en of this.enemies) en.draw(ctx);
  }
}
