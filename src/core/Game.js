/**
 * Game — точка входа и оркестратор: канвас/DPR, игровой цикл (rAF + dt),
 * машина состояний, счёт/экономика раунда, частицы и HUD.
 */

import { Player, HYPER_DURATION } from "../entities/Player.js";
import { EnemyManager } from "../entities/EnemyManager.js";
import { Menu } from "../ui/Menu.js";
import { Storage } from "../utils/Storage.js";

const COINS_PER_POINTS = 10; // 1 монета за 10 очков
const SCORE_PER_SECOND = 10;
const MAX_DT = 0.05;         // защита от скачков dt (вкладка в фоне)
const MAX_DPR = 2;

export class Game {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this.viewW = 0;
    this.viewH = 0;
    this.dpr = 1;
    window.addEventListener("resize", () => this.resize());
    this.resize();

    /** menu | shop | settings | playing | paused | gameover */
    this.state = "menu";
    this.score = 0;
    this.elapsed = 0;
    this.particles = [];
    this.lastTime = 0;

    this.storage = new Storage();
    this.player = new Player(this);
    this.enemies = new EnemyManager(this);
    this.menu = new Menu(this);

    this.scoreEl = document.getElementById("score-value");
    this.bestEl = document.getElementById("best-value");
    this.hyperBtn = document.getElementById("hyper-btn");
    this.hyperInner = document.getElementById("hyper-inner");

    this.hyperBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.player.activateHyper();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") {
        if (this.state === "playing" || this.state === "paused") this.togglePause();
      }
    });

    // Автопауза при сворачивании приложения/вкладки
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.togglePause();
    });
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.floor(this.viewW * this.dpr);
    this.canvas.height = Math.floor(this.viewH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  vibrate(ms) {
    if (this.storage.data.vibro && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* не поддерживается — молча */ }
    }
  }

  // ---------- Управление раундом ----------

  startRound() {
    this.state = "playing";
    this.menu.hideAll();
    this.menu.setHudVisible(true);
    this.enemies.reset();
    this.particles.length = 0;
    this.score = 0;
    this.elapsed = 0;
    this.player.reset(this.viewW / 2, this.viewH / 2);
    this.scoreEl.textContent = "0";
    this.bestEl.textContent = String(this.storage.data.best);
    this.updateHyperButton();
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.menu.show("pause");
    } else if (this.state === "paused") {
      this.state = "playing";
      this.menu.hideAll();
    }
  }

  quitToMenu() {
    this.state = "menu";
    this.menu.setHudVisible(false);
    this.enemies.reset();
    this.particles.length = 0;
    this.menu.show("menu");
  }

  gameOver() {
    this.state = "gameover";
    this.explode(this.player.x, this.player.y, this.player.skin.color);
    this.vibrate(200);

    const finalScore = Math.floor(this.score);
    const earned = Math.floor(finalScore / COINS_PER_POINTS);
    this.storage.addCoins(earned);
    this.storage.updateBest(finalScore);
    this.menu.showGameOver(finalScore, earned);

    // Короткая пауза, чтобы игрок увидел взрыв, а не мгновенный экран смерти
    setTimeout(() => {
      if (this.state === "gameover") {
        this.menu.setHudVisible(false);
        this.menu.show("gameover");
      }
    }, 600);
  }

  // ---------- Частицы ----------

  addParticle(p) {
    this.particles.push(p);
  }

  explode(x, y, color, count = 26) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 240;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5,
        age: 0,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  // ---------- HUD ----------

  updateHyperButton() {
    const hy = this.player.hyper;
    let frac, col;
    if (hy.active) {
      frac = hy.timeLeft / HYPER_DURATION;
      col = "#EAC26B";
    } else {
      frac = hy.charge;
      col = "#5E9FE8";
    }
    this.hyperBtn.style.background =
      "conic-gradient(" + col + " " + (frac * 360) + "deg, rgba(255,255,255,0.12) 0deg)";
    this.hyperBtn.classList.toggle("ready", !hy.active && hy.charge >= 1);
    this.hyperBtn.classList.toggle("active", hy.active);
    this.hyperInner.textContent = hy.active ? hy.timeLeft.toFixed(1) : "ГИПЕР";
  }

  // ---------- Цикл ----------

  update(dt) {
    if (this.state === "playing") {
      this.elapsed += dt;
      this.score += dt * SCORE_PER_SECOND;
      this.scoreEl.textContent = String(Math.floor(this.score));
      this.player.update(dt);
      this.enemies.update(dt);
      this.updateHyperButton();
    }

    // Частицы живут всегда (взрыв после смерти доигрывается на экране геймовера)
    for (let j = this.particles.length - 1; j >= 0; j--) {
      const p = this.particles[j];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(j, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - dt * 2);
      p.vy *= (1 - dt * 2);
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const step = 48;
    ctx.beginPath();
    for (let x = step; x < this.viewW; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.viewH);
    }
    for (let y = step; y < this.viewH; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.viewW, y);
    }
    ctx.stroke();
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#191919";
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    this.drawGrid();

    this.enemies.draw(ctx);

    if (this.state === "playing" || this.state === "paused") {
      this.player.draw(ctx);
    }

    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    this.player.drawJoystick(ctx);
  }

  loop = (ts) => {
    if (!this.lastTime) this.lastTime = ts;
    const dt = Math.min((ts - this.lastTime) / 1000, MAX_DT);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  };

  start() {
    this.menu.show("menu");
    requestAnimationFrame(this.loop);
  }
}

// ---------- Bootstrap ----------
const game = new Game();
game.start();

// Отладочный доступ из консоли и тестов. Не использовать в игровом коде.
window.SURVIVAL = game;

