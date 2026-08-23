import { SDK } from "./sdk.js";
import { SHOP_UPGRADES, TOOL_DEFS, HERO_TYPES, TALENTS, TALENT_BRANCHES, QUEST_POOLS, CHAPTERS, validateBoard } from "./config.js";

export const SAVE_VERSION = 10;
const MAX_CURRENCY = 1_000_000_000;
const MAX_WAVE = 1_000_000;
const DEFAULT_DATA = {
  version: SAVE_VERSION, revision: 0, updatedAt: 0, offlineLastAt: 0,
  wave: 1, gold: 120, souls: 0, darkCrystals: 0, essence: 0, crystalHP: 20, maxCrystalHP: 20, board: [],
  trapDamageBonus: 1, monsterDamageBonus: 1, goldMultiplier: 1, soulMultiplier: 1, costDiscount: 1, regenPerWave: 2,
  startGold: 120, autoHealAmount: 0, autoHealInterval: 15000, secondChanceCharges: 0, crystalDamageReduction: 0,
  critChance: 0, critMultiplier: 2, bossDamageBonus: 1, waveBonusMultiplier: 1, eraseRefundBonus: 0.5,
  trapSpeedBonus: 1, trapRangeBonus: 1, poisonBonus: 1, slowBonus: 1, monsterSpeedBonus: 1,
  monsterRangeBonus: 1, mergeLevelBonus: 1, necroBonusExtra: 0, offlineBonus: 1, essenceDropChance: 0,
  upgrades: {}, talents: {}, seenChapters: [],
  settings: { sfx: true, music: true, sfxVolume: 0.8, musicVolume: 0.4, language: null },
  dailyStreak: 0, dailyLastClaimAt: 0, wheelLastFreeSpinAt: 0, wheelTotalSpins: 0,
  quests: { daily: { key: "", baseline: {}, claimed: {} }, weekly: { key: "", baseline: {}, claimed: {} } },
  discovered: { units: {}, heroes: {} },
  stats: { maxWave: 0, totalKills: 0, bossKills: 0, upgradesBought: 0, totalMerges: 0, maxLevelMerge: 0,
    wavesCompleted: 0, endlessMaxWave: 0, dailyQuestsCompleted: 0, weeklyQuestsCompleted: 0,
    darkCrystalsTotal: 0, essenceTotal: 0, discoveredUnits: 0, discoveredHeroes: 0, talentsBought: 0 },
  achievements: {},
};
const cloneDefault = () => JSON.parse(JSON.stringify(DEFAULT_DATA));
const num = (v, fallback, min = 0, max = MAX_CURRENCY) => Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const int = (v, fallback, min = 0, max = MAX_CURRENCY) => Math.floor(num(v, fallback, min, max));

const KNOWN_QUEST_IDS = new Set([...QUEST_POOLS.daily, ...QUEST_POOLS.weekly].map((q) => q.id));

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
  d.darkCrystals = int(raw.darkCrystals, 0); d.essence = int(raw.essence, 0);
  d.crystalHP = int(raw.crystalHP, d.crystalHP, 0, 100000);
  d.dailyStreak = int(raw.dailyStreak, 0, 0, 100000); d.dailyLastClaimAt = int(raw.dailyLastClaimAt, 0, 0, Number.MAX_SAFE_INTEGER);
  d.wheelLastFreeSpinAt = int(raw.wheelLastFreeSpinAt, 0, 0, Number.MAX_SAFE_INTEGER); d.wheelTotalSpins = int(raw.wheelTotalSpins, 0, 0, MAX_CURRENCY);
  const s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  d.settings = { sfx: s.sfx !== false, music: s.music !== false, sfxVolume: num(s.sfxVolume, .8, 0, 1), musicVolume: num(s.musicVolume, .4, 0, 1), language: ["ru", "en", "tr"].includes(s.language) ? s.language : null };
  const rawUpgrades = raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : {};
  for (const [id, def] of Object.entries(SHOP_UPGRADES)) d.upgrades[id] = int(rawUpgrades[id], 0, 0, def.maxLevel);
  const rawTalents = raw.talents && typeof raw.talents === "object" && !Array.isArray(raw.talents) ? raw.talents : {};
  for (const [id, def] of Object.entries(TALENTS)) d.talents[id] = int(rawTalents[id], 0, 0, def.maxLevel);
  const rq = raw.quests && typeof raw.quests === "object" && !Array.isArray(raw.quests) ? raw.quests : {};
  for (const kind of ["daily", "weekly"]) {
    const src = rq[kind] && typeof rq[kind] === "object" ? rq[kind] : {};
    const key = typeof src.key === "string" ? src.key.slice(0, 32) : "";
    const baseline = src.baseline && typeof src.baseline === "object" ? src.baseline : {};
    const claimed = src.claimed && typeof src.claimed === "object" ? src.claimed : {};
    const cleanBase = {}, cleanClaimed = {};
    for (const id of KNOWN_QUEST_IDS) {
      if (Number.isFinite(baseline[id])) cleanBase[id] = Math.max(0, Math.floor(baseline[id]));
      if (claimed[id] === true) cleanClaimed[id] = true;
    }
    d.quests[kind] = { key, baseline: cleanBase, claimed: cleanClaimed };
  }
  const rd = raw.discovered && typeof raw.discovered === "object" && !Array.isArray(raw.discovered) ? raw.discovered : {};
  const units = rd.units && typeof rd.units === "object" ? rd.units : {};
  const heroes = rd.heroes && typeof rd.heroes === "object" ? rd.heroes : {};
  for (const id of Object.keys(TOOL_DEFS)) if (units[id] === true) d.discovered.units[id] = true;
  for (const id of Object.keys(HERO_TYPES)) if (heroes[id] === true) d.discovered.heroes[id] = true;
  const rs = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  for (const key of Object.keys(d.stats)) d.stats[key] = int(rs[key], 0, 0, key === "maxWave" || key === "endlessMaxWave" ? MAX_WAVE : MAX_CURRENCY);
  d.achievements = raw.achievements && typeof raw.achievements === "object" && !Array.isArray(raw.achievements) ? raw.achievements : {};
  if (Array.isArray(raw.seenChapters)) {
    const known = new Set(CHAPTERS.map((c) => c.id));
    for (const id of raw.seenChapters) {
      if (typeof id === "string" && known.has(id) && !d.seenChapters.includes(id)) d.seenChapters.push(id);
    }
  }
  // Доска: комбо «ловушка + монстр» на клетке, дракон 2×2 — единые правила в config.
  d.board = validateBoard(raw.board);
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
    this._resyncDiscoveryStats();
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
    const keep = { upgrades: { ...this.data.upgrades }, talents: { ...this.data.talents }, souls: this.data.souls, darkCrystals: this.data.darkCrystals, essence: this.data.essence, dailyStreak: this.data.dailyStreak, dailyLastClaimAt: this.data.dailyLastClaimAt, wheelLastFreeSpinAt: this.data.wheelLastFreeSpinAt, wheelTotalSpins: this.data.wheelTotalSpins, quests: JSON.parse(JSON.stringify(this.data.quests)), discovered: JSON.parse(JSON.stringify(this.data.discovered)), stats: { ...this.data.stats }, achievements: { ...this.data.achievements }, settings: { ...this.data.settings } };
    this.data = { ...cloneDefault(), ...keep }; this.recalcBonuses(); this.data.gold = this.data.startGold; this.data.crystalHP = this.data.maxCrystalHP; await this.save();
  }
  async hardReset() { this.data = cloneDefault(); await this.save(); }
  getUpgradeLevel(id) { return this.data.upgrades[id] || 0; }
  canBuyUpgrade(id) { const def = SHOP_UPGRADES[id]; if (!def) return false; const lvl = this.getUpgradeLevel(id); return lvl < def.maxLevel && this.data[def.currency] >= Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl)); }
  buyUpgrade(id) { const def = SHOP_UPGRADES[id]; if (!def || !this.canBuyUpgrade(id)) return false; const lvl = this.getUpgradeLevel(id), cost = Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl)); this.data[def.currency] -= cost; this.data.upgrades[id] = lvl + 1; this.data.stats.upgradesBought++; this.recalcBonuses(); return true; }

  getTalentLevel(id) { return this.data.talents[id] || 0; }
  _talentCurrency(def) { return TALENT_BRANCHES[def.branch]?.currency || "souls"; }
  canBuyTalent(id) {
    const def = TALENTS[id]; if (!def) return false;
    const lvl = this.getTalentLevel(id);
    if (lvl >= def.maxLevel) return false;
    if (def.requires && this.getTalentLevel(def.requires) < 1) return false;
    const cost = Math.max(1, Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl)));
    return this.data[this._talentCurrency(def)] >= cost;
  }
  buyTalent(id) {
    const def = TALENTS[id]; if (!def || !this.canBuyTalent(id)) return false;
    const lvl = this.getTalentLevel(id), cost = Math.max(1, Math.floor(def.baseCost * Math.pow(def.costMultiplier, lvl)));
    const currency = this._talentCurrency(def);
    this.data[currency] -= cost; this.data.talents[id] = lvl + 1;
    this.incStat("talentsBought", 1); this.recalcBonuses();
    return true;
  }

  /** Начисляет награду (валюта) и обновляет суммарные статики премиум-валют. */
  grantReward(reward) {
    if (!reward || typeof reward !== "object") return;
    if (reward.gold) this.data.gold = int(this.data.gold + reward.gold);
    if (reward.souls) this.data.souls = int(this.data.souls + reward.souls);
    if (reward.darkCrystals) { this.data.darkCrystals = int(this.data.darkCrystals + reward.darkCrystals); this.incStat("darkCrystalsTotal", reward.darkCrystals); }
    if (reward.essence) { this.data.essence = int(this.data.essence + reward.essence); this.incStat("essenceTotal", reward.essence); }
  }

  /** Отмечает объект/героя открытым в бестиарии. Возвращает true, если открытие новое. */
  markDiscovered(category, id) {
    const known = category === "heroes" ? HERO_TYPES[id] : TOOL_DEFS[id];
    if (!known || category !== "heroes" && category !== "units") return false;
    const store = this.data.discovered[category];
    if (store[id]) return false;
    store[id] = true;
    this.incStat(category === "heroes" ? "discoveredHeroes" : "discoveredUnits", 1);
    return true;
  }
  /** Восстанавливает счётчики открытия после валидации/миграции сейва. */
  _resyncDiscoveryStats() {
    this.data.stats.discoveredUnits = Object.keys(this.data.discovered.units || {}).length;
    this.data.stats.discoveredHeroes = Object.keys(this.data.discovered.heroes || {}).length;
  }

  recalcBonuses() {
    for (const [id, def] of Object.entries(SHOP_UPGRADES)) def.apply(this.data, this.data.upgrades[id] || 0);
    for (const [id, def] of Object.entries(TALENTS)) def.apply(this.data, this.data.talents[id] || 0);
  }
  incStat(key, by = 1) { if (!this.data.stats) this.data.stats = {}; this.data.stats[key] = int((this.data.stats[key] || 0) + by, 0); }
  setStatMax(key, value) { if (!this.data.stats) this.data.stats = {}; if (value > (this.data.stats[key] || 0)) this.data.stats[key] = int(value, 0); }
}
export const saveManager = new SaveManager();
