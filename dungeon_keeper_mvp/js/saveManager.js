import { SDK } from "./sdk.js";
import { SHOP_UPGRADES } from "./config.js";

const DEFAULT_DATA = {
  version: 6,
  wave: 1,
  gold: 120,
  souls: 0,
  crystalHP: 20,
  maxCrystalHP: 20,
  board: [],

  // Базовые
  trapDamageBonus: 1,
  monsterDamageBonus: 1,
  goldMultiplier: 1,
  soulMultiplier: 1,
  costDiscount: 1,
  regenPerWave: 2,
  startGold: 120,

  // === НОВЫЕ ПОЛЯ ===
  // Кристалл
  autoHealAmount: 0,
  autoHealInterval: 15000,
  secondChanceCharges: 0,
  crystalDamageReduction: 0,

  // Урон
  critChance: 0,
  critMultiplier: 2,
  bossDamageBonus: 1,

  // Экономика
  waveBonusMultiplier: 1,
  eraseRefundBonus: 0.5,

  // Ловушки
  trapSpeedBonus: 1,
  trapRangeBonus: 1,
  poisonBonus: 1,
  slowBonus: 1,

  // Монстры
  monsterSpeedBonus: 1,
  monsterRangeBonus: 1,
  mergeLevelBonus: 1,
  necroBonusExtra: 0,

  upgrades: {},

  settings: {
    sfx: true, music: true,
    sfxVolume: 0.8, musicVolume: 0.4,
    language: null,
  },

  dailyStreak: 0,
  dailyLastClaimAt: 0,
  wheelLastFreeSpinAt: 0,
  wheelTotalSpins: 0,

  stats: {
    maxWave: 0, totalKills: 0, bossKills: 0,
    upgradesBought: 0, totalMerges: 0, maxLevelMerge: 0,
  },
  achievements: {},
};

function cloneDefault() { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }

class SaveManager {
  constructor() {
    this.data = cloneDefault();
    this._pendingSave = false;
    this._saveTimer = null;
    this._lastSaved = 0;
  }

  async load() {
    const saved = await SDK.loadData();
    this.data = {
      ...cloneDefault(),
      ...(saved || {}),
      upgrades: { ...DEFAULT_DATA.upgrades, ...(saved?.upgrades || {}) },
      settings: { ...DEFAULT_DATA.settings, ...(saved?.settings || {}) },
      stats: { ...DEFAULT_DATA.stats, ...(saved?.stats || {}) },
      achievements: { ...(saved?.achievements || {}) },
    };
    if (!Array.isArray(this.data.board)) this.data.board = [];
    this.recalcBonuses();
    return this.data;
  }

  async save() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    this._pendingSave = false;
    this._lastSaved = performance.now();
    await SDK.saveData(this.data);
  }

  saveThrottled() {
    this._pendingSave = true;
    if (this._saveTimer) return;
    const elapsed = performance.now() - this._lastSaved;
    const delay = Math.max(0, 2000 - elapsed);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this._pendingSave) this.save();
    }, delay);
  }

  async reset() {
    const keepUpgrades = { ...this.data.upgrades };
    const keepSouls = this.data.souls;
    const keepDaily = { streak: this.data.dailyStreak, last: this.data.dailyLastClaimAt };
    const keepWheel = { last: this.data.wheelLastFreeSpinAt, total: this.data.wheelTotalSpins };
    const keepStats = { ...this.data.stats };
    const keepAch = { ...this.data.achievements };
    const keepSettings = { ...this.data.settings };

    this.data = cloneDefault();
    this.data.upgrades = keepUpgrades;
    this.data.souls = keepSouls;
    this.data.dailyStreak = keepDaily.streak;
    this.data.dailyLastClaimAt = keepDaily.last;
    this.data.wheelLastFreeSpinAt = keepWheel.last;
    this.data.wheelTotalSpins = keepWheel.total;
    this.data.stats = keepStats;
    this.data.achievements = keepAch;
    this.data.settings = keepSettings;

    this.recalcBonuses();
    this.data.gold = this.data.startGold;
    this.data.crystalHP = this.data.maxCrystalHP;
    await this.save();
  }

  async hardReset() { this.data = cloneDefault(); await this.save(); }

  getUpgradeLevel(id) { return this.data.upgrades[id] || 0; }

  canBuyUpgrade(id) {
    const def = SHOP_UPGRADES[id];
    if (!def) return false;
    const lvl = this.getUpgradeLevel(id);
    if (lvl >= def.maxLevel) return false;
    return this.data[def.currency] >= Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl));
  }

  buyUpgrade(id) {
    const def = SHOP_UPGRADES[id];
    if (!def || !this.canBuyUpgrade(id)) return false;
    const lvl = this.getUpgradeLevel(id);
    const cost = Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl));
    this.data[def.currency] -= cost;
    this.data.upgrades[id] = lvl + 1;
    this.data.stats.upgradesBought = (this.data.stats.upgradesBought || 0) + 1;
    this.recalcBonuses();
    return true;
  }

  recalcBonuses() {
    for (const [id, def] of Object.entries(SHOP_UPGRADES)) {
      def.apply(this.data, this.data.upgrades[id] || 0);
    }
  }

  incStat(key, by = 1) {
    if (!this.data.stats) this.data.stats = {};
    this.data.stats[key] = (this.data.stats[key] || 0) + by;
  }

  setStatMax(key, value) {
    if (!this.data.stats) this.data.stats = {};
    if (value > (this.data.stats[key] || 0)) this.data.stats[key] = value;
  }
}

export const saveManager = new SaveManager();