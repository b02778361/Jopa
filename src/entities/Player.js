/**
 * Player — игрок: физика, ввод (клавиатура + плавающий тач-джойстик),
 * неуязвимость после спавна и гипер-способность.
 */

import { skinById } from "../utils/Storage.js";

export const BASE_SIZE = 26;
export const HYPER_SIZE = 46;
export const HYPER_CHARGE_TIME = 15; // секунд до полной шкалы
export const HYPER_DURATION = 4;     // секунд действия

const SPAWN_INVULN = 1.0; // секунд неуязвимости на старте раунда
const TOUCH_DEADZONE = 10; // px до начала движения
const TOUCH_MAX = 60;      // px до максимальной скорости

const KEY_MAP = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down",
  A: "left", D: "right", W: "up", S: "down",
  "ф": "left", "в": "right", "ц": "up", "ы": "down",
  "Ф": "left", "В": "right", "Ц": "up", "Ы": "down",
};

export class Player {
  /** @param {import("../core/Game.js").Game} game */
  constructor(game) {
    this.game = game;
    this.x = 0;
    this.y = 0;
    this.size = BASE_SIZE;
    this.speed = 280; // px/сек
    this.invulnUntil = 0;
    this.hyper = { charge: 0, active: false, timeLeft: 0 };

    this.keys = Object.create(null);
    this.touch = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 };

    this.bindKeyboard();
    this.bindTouch(game.canvas);
  }

  get skin() {
    return skinById(this.game.storage.data.skin);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.size = BASE_SIZE;
    this.invulnUntil = SPAWN_INVULN;
    this.hyper.charge = 0;
    this.hyper.active = false;
    this.hyper.timeLeft = 0;
  }

  bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      const dir = KEY_MAP[e.key];
      if (dir) {
        this.keys[dir] = true;
        e.preventDefault();
        return;
      }
      if (e.key === " " || e.key === "e" || e.key === "E" || e.key === "у" || e.key === "У") {
        if (this.game.state === "playing") {
          e.preventDefault();
          this.activateHyper();
        }
      }
    });
    window.addEventListener("keyup", (e) => {
      const dir = KEY_MAP[e.key];
      if (dir) this.keys[dir] = false;
    });
  }

  // Плавающий джойстик: палец задаёт направление относительно точки
  // касания; если палец уходит далеко — центр тянется за ним.
  bindTouch(canvas) {
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (this.game.state !== "playing") return;
      if (this.touch.active) return; // второй палец игнорируем
      const t = e.changedTouches[0];
      this.touch.active = true;
      this.touch.id = t.identifier;
      this.touch.startX = t.clientX;
      this.touch.startY = t.clientY;
      this.touch.dx = 0;
      this.touch.dy = 0;
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (!this.touch.active) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        this.touch.dx = t.clientX - this.touch.startX;
        this.touch.dy = t.clientY - this.touch.startY;
        const dist = Math.hypot(this.touch.dx, this.touch.dy);
        if (dist > TOUCH_MAX) {
          const k = (dist - TOUCH_MAX) / dist;
          this.touch.startX += this.touch.dx * k;
          this.touch.startY += this.touch.dy * k;
          this.touch.dx = t.clientX - this.touch.startX;
          this.touch.dy = t.clientY - this.touch.startY;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          this.touch.active = false;
          this.touch.dx = 0;
          this.touch.dy = 0;
        }
      }
    };
    canvas.addEventListener("touchend", endTouch, { passive: false });
    canvas.addEventListener("touchcancel", endTouch, { passive: false });
  }

  activateHyper() {
    if (this.game.state !== "playing" || this.hyper.active || this.hyper.charge < 1) return;
    this.hyper.active = true;
    this.hyper.timeLeft = HYPER_DURATION;
    this.hyper.charge = 0;
    this.game.vibrate(60);
    this.game.explode(this.x, this.y, "#EAC26B", 20);
  }

  /** Нормализованный вектор ввода из клавиатуры или тача. */
  moveInput() {
    let ix = 0, iy = 0;
    if (this.keys.left) ix -= 1;
    if (this.keys.right) ix += 1;
    if (this.keys.up) iy -= 1;
    if (this.keys.down) iy += 1;

    if (this.touch.active) {
      const d = Math.hypot(this.touch.dx, this.touch.dy);
      if (d > TOUCH_DEADZONE) {
        const strength = Math.min((d - TOUCH_DEADZONE) / (TOUCH_MAX - TOUCH_DEADZONE), 1);
        ix = (this.touch.dx / d) * strength;
        iy = (this.touch.dy / d) * strength;
      } else {
        ix = 0;
        iy = 0;
      }
    } else {
      const len = Math.hypot(ix, iy);
      if (len > 1) { ix /= len; iy /= len; }
    }
    return { ix, iy };
  }

  update(dt) {
    // Гипер: таймер действия / набор заряда
    if (this.hyper.active) {
      this.hyper.timeLeft -= dt;
      if (this.hyper.timeLeft <= 0) {
        this.hyper.active = false;
        this.hyper.timeLeft = 0;
      }
    } else if (this.hyper.charge < 1) {
      this.hyper.charge = Math.min(this.hyper.charge + dt / HYPER_CHARGE_TIME, 1);
    }

    // Размер: плавный лерп к цели вместо скачка
    const targetSize = this.hyper.active ? HYPER_SIZE : BASE_SIZE;
    this.size += (targetSize - this.size) * Math.min(dt * 8, 1);

    // Движение
    const { ix, iy } = this.moveInput();
    this.x += ix * this.speed * dt;
    this.y += iy * this.speed * dt;

    const half = this.size / 2;
    this.x = Math.max(half, Math.min(this.game.viewW - half, this.x));
    this.y = Math.max(half, Math.min(this.game.viewH - half, this.y));

    if (this.invulnUntil > 0) this.invulnUntil -= dt;

    // След огненного скина
    const sk = this.skin;
    if (sk.trail && (ix !== 0 || iy !== 0) && Math.random() < 0.6) {
      this.game.addParticle({
        x: this.x - ix * half,
        y: this.y - iy * half,
        vx: -ix * 40 + (Math.random() - 0.5) * 30,
        vy: -iy * 40 + (Math.random() - 0.5) * 30,
        life: 0.35,
        age: 0,
        size: 3 + Math.random() * 4,
        color: Math.random() < 0.5 ? "#E95E44" : "#F0A05A",
      });
    }
  }

  draw(ctx) {
    const blink = !this.hyper.active &&
      this.invulnUntil > 0 &&
      Math.floor(this.invulnUntil * 10) % 2 === 0;
    if (blink) return;

    const sk = this.skin;
    const half = this.size / 2;
    ctx.save();
    if (this.hyper.active) {
      ctx.shadowColor = "#EAC26B";
      ctx.shadowBlur = 30;
    } else if (sk.glow) {
      ctx.shadowColor = sk.glow;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = sk.color;
    ctx.fillRect(this.x - half, this.y - half, this.size, this.size);
    ctx.shadowBlur = 0;
    if (this.hyper.active) {
      ctx.strokeStyle = "#EAC26B";
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x - half - 4, this.y - half - 4, this.size + 8, this.size + 8);
    }
    ctx.fillStyle = "#191919";
    ctx.fillRect(this.x - 4, this.y - 4, 8, 8);
    ctx.restore();
  }

  drawJoystick(ctx) {
    if (!this.touch.active) return;
    if (this.game.state !== "playing") return;
    if (!this.game.storage.data.joystick) return;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.touch.startX, this.touch.startY, TOUCH_MAX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.arc(this.touch.startX + this.touch.dx, this.touch.startY + this.touch.dy, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}
