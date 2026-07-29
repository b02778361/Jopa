/**
 * Storage — мета-прогресс и персистентность.
 * Единственное место в проекте, которое трогает localStorage.
 * Здесь же живёт каталог скинов: это данные экономики,
 * связанные с полями сохранения (owned/skin/price).
 */

const SAVE_KEY = "survival_save_v2";
const LEGACY_BEST_KEY = "survival_best";

export const SKINS = [
  { id: "blue", name: "Стандартный синий", color: "#5E9FE8", glow: null,      trail: false, price: 0 },
  { id: "neon", name: "Неоновый зелёный",  color: "#4DE88A", glow: "#4DE88A", trail: false, price: 50 },
  { id: "fire", name: "Огненный красный",  color: "#E95E44", glow: "#F0A05A", trail: true,  price: 100 },
  { id: "gold", name: "Золотой",           color: "#EAC26B", glow: "#EAC26B", trail: false, price: 200 },
];

export function skinById(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export const DEFAULT_SAVE = {
  best: 0,
  coins: 0,
  owned: ["blue"],
  skin: "blue",
  vibro: true,
  joystick: true,
};

export class Storage {
  constructor() {
    this.data = this.load();
  }

  load() {
    const d = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        for (const k of Object.keys(d)) {
          if (p[k] !== undefined) d[k] = p[k];
        }
      } else {
        // Миграция рекорда из первой (однофайловой) версии
        const oldBest = parseInt(localStorage.getItem(LEGACY_BEST_KEY) || "0", 10);
        if (oldBest > 0) d.best = oldBest;
      }
    } catch (e) {
      // localStorage недоступен (приватный режим) — играем на дефолтах
    }
    if (!Array.isArray(d.owned)) d.owned = ["blue"];
    if (!d.owned.includes("blue")) d.owned.push("blue");
    return d;
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      // молча продолжаем без сохранения
    }
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    this.persist();
  }

  addCoins(n) {
    this.data.coins += n;
    this.persist();
  }

  updateBest(score) {
    if (score > this.data.best) {
      this.data.best = score;
      this.persist();
    }
  }

  ownsSkin(id) {
    return this.data.owned.includes(id);
  }

  /** @returns {boolean} true, если покупка прошла */
  buySkin(id) {
    const sk = skinById(id);
    if (this.ownsSkin(id) || this.data.coins < sk.price) return false;
    this.data.coins -= sk.price;
    this.data.owned.push(id);
    this.data.skin = id; // купил — сразу надел
    this.persist();
    return true;
  }

  selectSkin(id) {
    if (!this.ownsSkin(id)) return;
    this.data.skin = id;
    this.persist();
  }

  setSetting(key, value) {
    this.data[key] = value;
    this.persist();
  }
}
