/**
 * Menu — все DOM-экраны: главное меню, магазин, настройки, пауза, геймовер.
 * Не содержит игровой логики — только UI и делегация в Game/Storage.
 */

import { SKINS } from "../utils/Storage.js";

const $ = (id) => document.getElementById(id);

export class Menu {
  /** @param {import("../core/Game.js").Game} game */
  constructor(game) {
    this.game = game;
    this.screens = {
      menu: $("screen-menu"),
      shop: $("screen-shop"),
      settings: $("screen-settings"),
      pause: $("screen-pause"),
      gameover: $("screen-gameover"),
    };
    this.hud = $("hud");
    this.hyperBtn = $("hyper-btn");
    this.resetArmed = false;
    this.resetTimer = 0;
    this.bind();
  }

  bind() {
    $("btn-play").addEventListener("click", () => this.game.startRound());
    $("btn-shop").addEventListener("click", () => this.show("shop"));
    $("btn-settings").addEventListener("click", () => this.show("settings"));
    $("btn-shop-back").addEventListener("click", () => this.show("menu"));
    $("btn-settings-back").addEventListener("click", () => this.show("menu"));
    $("pause-btn").addEventListener("click", () => this.game.togglePause());
    $("btn-resume").addEventListener("click", () => this.game.togglePause());
    $("btn-quit").addEventListener("click", () => this.game.quitToMenu());
    $("btn-again").addEventListener("click", () => this.game.startRound());
    $("btn-go-menu").addEventListener("click", () => this.game.quitToMenu());

    $("chk-vibro").addEventListener("change", (e) =>
      this.game.storage.setSetting("vibro", e.target.checked));
    $("chk-joystick").addEventListener("change", (e) =>
      this.game.storage.setSetting("joystick", e.target.checked));
    $("btn-reset").addEventListener("click", () => this.onResetClick());
  }

  // Сброс прогресса с защитой от случайного тапа (двойное нажатие).
  // confirm() не используем: в WebView он часто заблокирован.
  onResetClick() {
    const btn = $("btn-reset");
    if (!this.resetArmed) {
      this.resetArmed = true;
      btn.textContent = "Точно? Нажми ещё раз";
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.resetArmed = false;
        btn.textContent = "Сбросить прогресс";
      }, 3000);
      return;
    }
    clearTimeout(this.resetTimer);
    this.game.storage.reset();
    this.resetArmed = false;
    btn.textContent = "Прогресс сброшен";
    this.refreshSettings();
  }

  refreshSettings() {
    $("chk-vibro").checked = !!this.game.storage.data.vibro;
    $("chk-joystick").checked = !!this.game.storage.data.joystick;
  }

  /** Показать один экран, спрятать остальные + обновить его данные. */
  show(name) {
    for (const k of Object.keys(this.screens)) {
      this.screens[k].classList.toggle("hidden", k !== name);
    }
    const save = this.game.storage.data;
    if (name === "menu") {
      $("menu-coins").textContent = String(save.coins);
      $("menu-best").textContent = "Рекорд: " + save.best;
    } else if (name === "shop") {
      this.renderShop();
    } else if (name === "settings") {
      this.refreshSettings();
      this.resetArmed = false;
      $("btn-reset").textContent = "Сбросить прогресс";
    }
  }

  hideAll() {
    for (const k of Object.keys(this.screens)) {
      this.screens[k].classList.add("hidden");
    }
  }

  setHudVisible(v) {
    this.hud.classList.toggle("hidden", !v);
    this.hyperBtn.classList.toggle("hidden", !v);
  }

  renderShop() {
    const storage = this.game.storage;
    $("shop-coins").textContent = String(storage.data.coins);
    const list = $("shop-list");
    list.innerHTML = "";

    for (const sk of SKINS) {
      const owned = storage.ownsSkin(sk.id);
      const selected = storage.data.skin === sk.id;

      const card = document.createElement("div");
      card.className = "skin-card" + (selected ? " selected" : "");

      const swatch = document.createElement("div");
      swatch.className = "skin-swatch";
      swatch.style.background = sk.color;
      if (sk.glow) swatch.style.boxShadow = "0 0 12px " + sk.glow;
      card.appendChild(swatch);

      const info = document.createElement("div");
      info.className = "skin-info";
      const nm = document.createElement("div");
      nm.className = "skin-name";
      nm.textContent = sk.name;
      info.appendChild(nm);
      const pr = document.createElement("div");
      pr.className = "skin-price";
      if (owned) {
        pr.textContent = selected ? "Выбран" : "Куплено";
      } else {
        const coin = document.createElement("span");
        coin.className = "coin";
        pr.appendChild(coin);
        pr.appendChild(document.createTextNode(String(sk.price)));
      }
      info.appendChild(pr);
      card.appendChild(info);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skin-btn";
      if (selected) {
        btn.textContent = "Выбран";
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = "Выбрать";
        btn.addEventListener("click", () => {
          storage.selectSkin(sk.id);
          this.renderShop();
        });
      } else {
        btn.textContent = "Купить";
        btn.className += " buy";
        btn.disabled = storage.data.coins < sk.price;
        btn.addEventListener("click", () => {
          if (storage.buySkin(sk.id)) this.renderShop();
        });
      }
      card.appendChild(btn);
      list.appendChild(card);
    }
  }

  /** Заполняет цифры на экране геймовера (сам показ откладывает Game). */
  showGameOver(finalScore, earned) {
    $("go-score").textContent =
      "Очки: " + finalScore + "  ·  Рекорд: " + this.game.storage.data.best;
    $("go-coins").textContent =
      "+" + earned + " (всего: " + this.game.storage.data.coins + ")";
  }
}
