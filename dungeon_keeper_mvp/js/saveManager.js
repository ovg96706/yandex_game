import { SDK } from "./sdk.js";
import { SHOP_UPGRADES, TOOL_DEFS, MAX_MERGE_LEVEL } from "./config.js";

export const SAVE_VERSION = 8;
const MAX_CURRENCY = 1_000_000_000;
const MAX_WAVE = 1_000_000;
const DEFAULT_DATA = {
  version: SAVE_VERSION, revision: 0, updatedAt: 0, offlineLastAt: 0,
  wave: 1, gold: 120, souls: 0, crystalHP: 20, maxCrystalHP: 20, board: [],
  trapDamageBonus: 1, monsterDamageBonus: 1, goldMultiplier: 1, soulMultiplier: 1, costDiscount: 1, regenPerWave: 2,
  startGold: 120, autoHealAmount: 0, autoHealInterval: 15000, secondChanceCharges: 0, crystalDamageReduction: 0,
  critChance: 0, critMultiplier: 2, bossDamageBonus: 1, waveBonusMultiplier: 1, eraseRefundBonus: 0.5,
  trapSpeedBonus: 1, trapRangeBonus: 1, poisonBonus: 1, slowBonus: 1, monsterSpeedBonus: 1,
  monsterRangeBonus: 1, mergeLevelBonus: 1, necroBonusExtra: 0,
  upgrades: {}, settings: { sfx: true, music: true, sfxVolume: 0.8, musicVolume: 0.4, language: null },
  dailyStreak: 0, dailyLastClaimAt: 0, wheelLastFreeSpinAt: 0, wheelTotalSpins: 0,
  stats: { maxWave: 0, totalKills: 0, bossKills: 0, upgradesBought: 0, totalMerges: 0, maxLevelMerge: 0 },
  achievements: {},
};
const cloneDefault = () => JSON.parse(JSON.stringify(DEFAULT_DATA));
const num = (v, fallback, min = 0, max = MAX_CURRENCY) => Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const int = (v, fallback, min = 0, max = MAX_CURRENCY) => Math.floor(num(v, fallback, min, max));

/** Converts untrusted local/cloud JSON into a safe, current save. */
export function validateSave(raw) {
  const d = cloneDefault();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  d.version = SAVE_VERSION;
  d.revision = int(raw.revision, 0, 0, Number.MAX_SAFE_INTEGER);
  d.updatedAt = int(raw.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER);
  d.offlineLastAt = int(raw.offlineLastAt, d.updatedAt, 0, Number.MAX_SAFE_INTEGER);
  d.wave = int(raw.wave, d.wave, 1, MAX_WAVE);
  d.gold = int(raw.gold, d.gold); d.souls = int(raw.souls, d.souls);
  d.crystalHP = int(raw.crystalHP, d.crystalHP, 0, 100000);
  d.dailyStreak = int(raw.dailyStreak, 0, 0, 100000); d.dailyLastClaimAt = int(raw.dailyLastClaimAt, 0, 0, Number.MAX_SAFE_INTEGER);
  d.wheelLastFreeSpinAt = int(raw.wheelLastFreeSpinAt, 0, 0, Number.MAX_SAFE_INTEGER); d.wheelTotalSpins = int(raw.wheelTotalSpins, 0, 0, MAX_CURRENCY);
  const s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  d.settings = { sfx: s.sfx !== false, music: s.music !== false, sfxVolume: num(s.sfxVolume, .8, 0, 1), musicVolume: num(s.musicVolume, .4, 0, 1), language: ["ru", "en", "tr"].includes(s.language) ? s.language : null };
  const rawUpgrades = raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : {};
  for (const [id, def] of Object.entries(SHOP_UPGRADES)) d.upgrades[id] = int(rawUpgrades[id], 0, 0, def.maxLevel);
  const rs = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  for (const key of Object.keys(d.stats)) d.stats[key] = int(rs[key], 0, 0, key === "maxWave" ? MAX_WAVE : MAX_CURRENCY);
  d.achievements = raw.achievements && typeof raw.achievements === "object" && !Array.isArray(raw.achievements) ? raw.achievements : {};
  if (Array.isArray(raw.board)) {
    const occupied = new Set();
    for (const item of raw.board.slice(0, 40)) {
      if (!item || !TOOL_DEFS[item.type]) continue;
      const row = Number.isInteger(item.row) ? item.row : -1, col = Number.isInteger(item.col) ? item.col : -1;
      const key = `${row}_${col}`;
      if (row < 0 || row > 7 || col < 0 || col > 4 || occupied.has(key)) continue;
      occupied.add(key); d.board.push({ row, col, kind: TOOL_DEFS[item.type].kind, type: item.type, level: int(item.level, 1, 1, MAX_MERGE_LEVEL) });
    }
  }
  // Derived fields are recalculated below and must never be trusted from storage.
  return d;
}

class SaveManager {
  constructor() { this.data = cloneDefault(); this._pendingSave = false; this._saveTimer = null; this._lastSaved = 0; this._saveQueue = Promise.resolve(); }
  async load() {
    const { local, cloud } = await SDK.loadDataCandidates();
    const safeLocal = validateSave(local), safeCloud = validateSave(cloud);
    this.data = safeCloud.updatedAt > safeLocal.updatedAt || (safeCloud.updatedAt === safeLocal.updatedAt && safeCloud.revision > safeLocal.revision) ? safeCloud : safeLocal;
    this.recalcBonuses();
    this.data.crystalHP = Math.min(this.data.crystalHP, this.data.maxCrystalHP);
    return this.data;
  }
  _touch() { this.data.version = SAVE_VERSION; this.data.revision = (this.data.revision || 0) + 1; this.data.updatedAt = Date.now(); this.data.offlineLastAt = this.data.updatedAt; }
  async save() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    this._pendingSave = false; this._lastSaved = performance.now(); this._touch();
    const snapshot = JSON.parse(JSON.stringify(this.data));
    this._saveQueue = this._saveQueue.catch(() => {}).then(() => SDK.saveData(snapshot));
    await this._saveQueue;
  }
  saveThrottled() { this._pendingSave = true; if (this._saveTimer) return; const delay = Math.max(0, 2000 - (performance.now() - this._lastSaved)); this._saveTimer = setTimeout(() => { this._saveTimer = null; if (this._pendingSave) this.save(); }, delay); }
  async reset() {
    const keep = { upgrades: { ...this.data.upgrades }, souls: this.data.souls, dailyStreak: this.data.dailyStreak, dailyLastClaimAt: this.data.dailyLastClaimAt, wheelLastFreeSpinAt: this.data.wheelLastFreeSpinAt, wheelTotalSpins: this.data.wheelTotalSpins, stats: { ...this.data.stats }, achievements: { ...this.data.achievements }, settings: { ...this.data.settings } };
    this.data = { ...cloneDefault(), ...keep }; this.recalcBonuses(); this.data.gold = this.data.startGold; this.data.crystalHP = this.data.maxCrystalHP; await this.save();
  }
  async hardReset() { this.data = cloneDefault(); await this.save(); }
  getUpgradeLevel(id) { return this.data.upgrades[id] || 0; }
  canBuyUpgrade(id) { const def = SHOP_UPGRADES[id]; if (!def) return false; const lvl = this.getUpgradeLevel(id); return lvl < def.maxLevel && this.data[def.currency] >= Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl)); }
  buyUpgrade(id) { const def = SHOP_UPGRADES[id]; if (!def || !this.canBuyUpgrade(id)) return false; const lvl = this.getUpgradeLevel(id), cost = Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl)); this.data[def.currency] -= cost; this.data.upgrades[id] = lvl + 1; this.data.stats.upgradesBought++; this.recalcBonuses(); return true; }
  recalcBonuses() { for (const [id, def] of Object.entries(SHOP_UPGRADES)) def.apply(this.data, this.data.upgrades[id] || 0); }
  incStat(key, by = 1) { if (!this.data.stats) this.data.stats = {}; this.data.stats[key] = int((this.data.stats[key] || 0) + by, 0); }
  setStatMax(key, value) { if (!this.data.stats) this.data.stats = {}; if (value > (this.data.stats[key] || 0)) this.data.stats[key] = int(value, 0); }
}
export const saveManager = new SaveManager();
