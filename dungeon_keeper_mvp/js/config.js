export const GAME_CONFIG = {
  width: 540, height: 960, backgroundColor: "#1a1a2e",
  grid: { cols: 5, rows: 8, cell: 64, offsetX: 110, offsetY: 155 },
};

export const SAVE_KEY = "dk_keeper_save";
export const MAX_MERGE_LEVEL = 5;
export const LEADERBOARD_NAME = "maxWave";

import { t } from "./i18n.js";

// ============================
// ЛОВУШКИ И МОНСТРЫ
// ============================

export const TOOL_DEFS = {
  spikes: { id: "spikes", labelKey: "unit_spikes", descKey: "unit_spikes_desc", kind: "trap", label: "Шипы", icon: "▲", cost: 30, damage: 25, cooldown: 700, color: 0xb0b0b0, mergeColors: [0xb0b0b0, 0xc8c8c8, 0xe0d060, 0xff9933, 0xff3333], description: "Урон при наступании." },
  fire_tile: { id: "fire_tile", labelKey: "unit_fire_tile", descKey: "unit_fire_tile_desc", kind: "trap", label: "Огонь", icon: "🔥", cost: 55, damage: 35, cooldown: 850, color: 0xff6b35, mergeColors: [0xff6b35, 0xff8844, 0xffaa22, 0xff5500, 0xff0000], description: "Высокий урон, поджигает.", unlockWave: 5 },
  ice_wall: { id: "ice_wall", labelKey: "unit_ice_wall", descKey: "unit_ice_wall_desc", kind: "trap", label: "Лёд", icon: "❄", cost: 50, damage: 12, cooldown: 1200, slowFactor: 0.4, slowDuration: 2000, color: 0x74b9ff, mergeColors: [0x74b9ff, 0x55ccff, 0x33ddff, 0x00eeff, 0x00ffff], description: "Замедляет на 60%.", unlockWave: 10 },
  poison: { id: "poison", labelKey: "unit_poison", descKey: "unit_poison_desc", kind: "trap", label: "Яд", icon: "☠", cost: 65, damage: 8, cooldown: 1500, color: 0x6c5ce7, mergeColors: [0x6c5ce7, 0x7d6cf0, 0x9b59b6, 0xbe2edd, 0xff00ff], description: "Ядовит. Урон 5 сек.", unlockWave: 18, poisonDPS: 8, poisonDuration: 5000 },
  lightning: { id: "lightning", labelKey: "unit_lightning", descKey: "unit_lightning_desc", kind: "trap", label: "Молния", icon: "⚡", cost: 85, damage: 50, cooldown: 2000, color: 0xf9ca24, mergeColors: [0xf9ca24, 0xfbda52, 0xfdeb71, 0xffff00, 0xffffff], description: "Цепная молния (3 цели).", unlockWave: 25, chainCount: 3, chainRange: 2.5 },
  teleport: { id: "teleport", labelKey: "unit_teleport", descKey: "unit_teleport_desc", kind: "trap", label: "Телепорт", icon: "🌀", cost: 100, damage: 0, cooldown: 4000, color: 0xa855f7, mergeColors: [0xa855f7, 0xb86ef8, 0xc884f9, 0xd89afa, 0xe8b0fb], description: "Отбрасывает наверх.", unlockWave: 35, teleportRows: 5 },
  blackhole: { id: "blackhole", labelKey: "unit_blackhole", descKey: "unit_blackhole_desc", kind: "trap", label: "Чёрн. дыра", icon: "🕳️", cost: 150, damage: 20, cooldown: 3000, color: 0x2d1b69, mergeColors: [0x2d1b69, 0x3d2b79, 0x4d3b89, 0x5d4b99, 0x7d6bb9], description: "Притягивает + AoE.", unlockWave: 50, pullRadius: 2.5, aoeDamage: 15 },

  slime: { id: "slime", labelKey: "unit_slime", descKey: "unit_slime_desc", kind: "monster", label: "Слайм", icon: "S", cost: 45, damage: 18, cooldown: 900, range: 2.2, color: 0x57ffb8, mergeColors: [0x57ffb8, 0x44ff99, 0x33ff77, 0x22ff55, 0x00ff33], description: "Ближний бой." },
  skeleton: { id: "skeleton", labelKey: "unit_skeleton", descKey: "unit_skeleton_desc", kind: "monster", label: "Скелет", icon: "💀", cost: 70, damage: 30, cooldown: 1100, range: 1.8, color: 0xe8dcc8, mergeColors: [0xe8dcc8, 0xf0e8d8, 0xf8f0e0, 0xffcc66, 0xff6600], description: "Сильный ближний бой.", unlockWave: 8 },
  goblin: { id: "goblin", labelKey: "unit_goblin", descKey: "unit_goblin_desc", kind: "monster", label: "Гоблин", icon: "G", cost: 90, damage: 22, cooldown: 600, range: 3.5, color: 0x88cc44, mergeColors: [0x88cc44, 0x99dd44, 0xaaee44, 0xccff00, 0xffff00], description: "Дальний, быстрый.", unlockWave: 15 },
  elemental: { id: "elemental", labelKey: "unit_elemental", descKey: "unit_elemental_desc", kind: "monster", label: "Элементаль", icon: "🔥", cost: 110, damage: 28, cooldown: 1300, range: 2.0, color: 0xff6348, mergeColors: [0xff6348, 0xff7b5e, 0xff9374, 0xffab8a, 0xffc3a0], description: "AoE урон в 2 клетках.", unlockWave: 20, aoeRange: 2 },
  dark_knight: { id: "dark_knight", labelKey: "unit_dark_knight", descKey: "unit_dark_knight_desc", kind: "monster", label: "Тёмн. рыцарь", icon: "⚔", cost: 140, damage: 45, cooldown: 1500, range: 1.5, color: 0x2c3e50, mergeColors: [0x2c3e50, 0x34495e, 0x3d566e, 0x4a6480, 0x5d7a96], description: "Танк + контратака.", unlockWave: 30, counterDamage: 20 },
  necromancer: { id: "necromancer", labelKey: "unit_necromancer", descKey: "unit_necromancer_desc", kind: "monster", label: "Некромант", icon: "👻", cost: 180, damage: 15, cooldown: 2000, range: 3.0, color: 0x6c3483, mergeColors: [0x6c3483, 0x7d3c98, 0x8e44ad, 0xa04cbf, 0xb355d1], description: "Усиливает соседей.", unlockWave: 40, buffRadius: 2, buffAmount: 0.3 },
  dragon: { id: "dragon", labelKey: "unit_dragon", descKey: "unit_dragon_desc", kind: "monster", label: "Дракон", icon: "🐉", cost: 250, damage: 60, cooldown: 2200, range: 4.0, color: 0x8b0000, mergeColors: [0x8b0000, 0xa01010, 0xb52020, 0xcc3030, 0xff4444], description: "Огненное дыхание.", unlockWave: 55, breathWidth: 1 },
};

// ============================
// ГЕРОИ
// ============================

export const HERO_TYPES = {
  peasant: { id: "peasant", labelKey: "hero_peasant", label: "Крестьянин", hpMult: 1, speedMult: 1.1, goldReward: 4, soulReward: 2, isBoss: false, minWave: 1, weight: 10, scale: 1 },
  warrior: { id: "warrior", labelKey: "hero_warrior", label: "Воин", hpMult: 1.5, speedMult: 0.95, goldReward: 6, soulReward: 3, isBoss: false, minWave: 3, weight: 8, scale: 1 },
  mage: { id: "mage", labelKey: "hero_mage", label: "Маг", hpMult: 0.8, speedMult: 0.85, goldReward: 8, soulReward: 5, trapDestroyInterval: 5000, isBoss: false, minWave: 6, weight: 6, scale: 1 },
  thief: { id: "thief", labelKey: "hero_thief", label: "Вор", hpMult: 0.7, speedMult: 1.6, goldReward: 7, soulReward: 4, isBoss: false, minWave: 8, weight: 5, scale: 0.9 },
  knight: { id: "knight", labelKey: "hero_knight", label: "Рыцарь", hpMult: 2.2, speedMult: 0.7, goldReward: 10, soulReward: 6, isBoss: false, minWave: 10, weight: 5, scale: 1.1 },
  healer: { id: "healer", labelKey: "hero_healer", label: "Целитель", hpMult: 1.0, speedMult: 0.9, goldReward: 9, soulReward: 5, healAmount: 0.1, healInterval: 3000, isBoss: false, minWave: 12, weight: 4, scale: 1 },
  paladin: { id: "paladin", labelKey: "hero_paladin", label: "Паладин", hpMult: 6, speedMult: 0.5, goldReward: 40, soulReward: 25, isBoss: true, minWave: 10, bossInterval: 5, scale: 1.5, shieldHits: 3, weaknessTool: "poison" },
  archmage: { id: "archmage", labelKey: "hero_archmage", label: "Архимаг", hpMult: 8, speedMult: 0.45, goldReward: 70, soulReward: 45, isBoss: true, minWave: 20, bossInterval: 5, scale: 1.5, disableTraps: true, monsterDebuffInterval: 4000, weaknessTool: "fire_tile" },
  king: { id: "king", labelKey: "hero_king", label: "Король", hpMult: 15, speedMult: 0.35, goldReward: 150, soulReward: 100, isBoss: true, minWave: 30, bossInterval: 10, scale: 1.8, summonInterval: 4000, summonCount: 2, weaknessTool: "lightning" },
};

/** Бонус урона по слабости босса (+25%). */
export const BOSS_WEAKNESS_BONUS = 0.25;

// ============================
// КАТЕГОРИИ УЛУЧШЕНИЙ
// ============================

export const UPGRADE_CATEGORIES = {
  crystal:  { labelKey: "upgr_cat_crystal",  icon: "💎", color: 0x00fff5 },
  damage:   { labelKey: "upgr_cat_damage",   icon: "⚔️", color: 0xff6666 },
  economy:  { labelKey: "upgr_cat_economy",  icon: "🪙", color: 0xffd700 },
  traps:    { labelKey: "upgr_cat_traps",    icon: "🎯", color: 0xaa66ff },
  monsters: { labelKey: "upgr_cat_monsters", icon: "🐲", color: 0x57ffb8 },
};

// ============================
// МАГАЗИН УЛУЧШЕНИЙ (24 шт.)
// ============================

export const SHOP_UPGRADES = {
  // === КРИСТАЛЛ ===
  crystal_hp: {
    id: "crystal_hp", category: "crystal",
    labelKey: "upgr_crystal_hp", descKey: "upgr_crystal_hp_desc",
    icon: "💎", maxLevel: 20, baseCost: 50, costMultiplier: 1.4, currency: "souls",
    apply(s, l) { s.maxCrystalHP = 20 + l * 5; s.crystalHP = Math.min(s.crystalHP, s.maxCrystalHP); }
  },
  regen: {
    id: "regen", category: "crystal",
    labelKey: "upgr_regen", descKey: "upgr_regen_desc",
    icon: "💚", maxLevel: 10, baseCost: 100, costMultiplier: 1.6, currency: "souls",
    apply(s, l) { s.regenPerWave = 2 + l; }
  },
  auto_heal: {
    id: "auto_heal", category: "crystal",
    labelKey: "upgr_auto_heal", descKey: "upgr_auto_heal_desc",
    icon: "❤️", maxLevel: 10, baseCost: 200, costMultiplier: 1.7, currency: "souls",
    apply(s, l) { s.autoHealAmount = l; s.autoHealInterval = 15000; }
  },
  second_chance: {
    id: "second_chance", category: "crystal",
    labelKey: "upgr_second_chance", descKey: "upgr_second_chance_desc",
    icon: "🛡️", maxLevel: 3, baseCost: 500, costMultiplier: 3.0, currency: "souls",
    apply(s, l) { s.secondChanceCharges = l; }
  },
  crystal_shield: {
    id: "crystal_shield", category: "crystal",
    labelKey: "upgr_crystal_shield", descKey: "upgr_crystal_shield_desc",
    icon: "🔷", maxLevel: 10, baseCost: 150, costMultiplier: 1.6, currency: "souls",
    apply(s, l) { s.crystalDamageReduction = Math.min(0.5, l * 0.05); }
  },

  // === УРОН ===
  trap_damage: {
    id: "trap_damage", category: "damage",
    labelKey: "upgr_trap_damage", descKey: "upgr_trap_damage_desc",
    icon: "⚔️", maxLevel: 15, baseCost: 80, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.trapDamageBonus = 1 + l * 0.1; }
  },
  monster_damage: {
    id: "monster_damage", category: "damage",
    labelKey: "upgr_monster_damage", descKey: "upgr_monster_damage_desc",
    icon: "🐲", maxLevel: 15, baseCost: 80, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.monsterDamageBonus = 1 + l * 0.1; }
  },
  crit_chance: {
    id: "crit_chance", category: "damage",
    labelKey: "upgr_crit_chance", descKey: "upgr_crit_chance_desc",
    icon: "🎲", maxLevel: 20, baseCost: 150, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.critChance = Math.min(0.5, l * 0.025); }
  },
  crit_damage: {
    id: "crit_damage", category: "damage",
    labelKey: "upgr_crit_damage", descKey: "upgr_crit_damage_desc",
    icon: "💥", maxLevel: 10, baseCost: 200, costMultiplier: 1.7, currency: "souls",
    apply(s, l) { s.critMultiplier = 2 + l * 0.3; }
  },
  boss_damage: {
    id: "boss_damage", category: "damage",
    labelKey: "upgr_boss_damage", descKey: "upgr_boss_damage_desc",
    icon: "👑", maxLevel: 15, baseCost: 250, costMultiplier: 1.6, currency: "souls",
    apply(s, l) { s.bossDamageBonus = 1 + l * 0.15; }
  },

  // === ЭКОНОМИКА ===
  gold_bonus: {
    id: "gold_bonus", category: "economy",
    labelKey: "upgr_gold_bonus", descKey: "upgr_gold_bonus_desc",
    icon: "🪙", maxLevel: 15, baseCost: 60, costMultiplier: 1.4, currency: "souls",
    apply(s, l) { s.goldMultiplier = 1 + l * 0.15; }
  },
  soul_bonus: {
    id: "soul_bonus", category: "economy",
    labelKey: "upgr_soul_bonus", descKey: "upgr_soul_bonus_desc",
    icon: "💀", maxLevel: 15, baseCost: 60, costMultiplier: 1.4, currency: "souls",
    apply(s, l) { s.soulMultiplier = 1 + l * 0.15; }
  },
  merge_discount: {
    id: "merge_discount", category: "economy",
    labelKey: "upgr_merge_discount", descKey: "upgr_merge_discount_desc",
    icon: "🔀", maxLevel: 5, baseCost: 120, costMultiplier: 2.0, currency: "souls",
    apply(s, l) { s.costDiscount = 1 - l * 0.1; }
  },
  start_gold: {
    id: "start_gold", category: "economy",
    labelKey: "upgr_start_gold", descKey: "upgr_start_gold_desc",
    icon: "💰", maxLevel: 10, baseCost: 40, costMultiplier: 1.3, currency: "souls",
    apply(s, l) { s.startGold = 120 + l * 30; }
  },
  wave_bonus: {
    id: "wave_bonus", category: "economy",
    labelKey: "upgr_wave_bonus", descKey: "upgr_wave_bonus_desc",
    icon: "🏆", maxLevel: 15, baseCost: 100, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.waveBonusMultiplier = 1 + l * 0.2; }
  },
  erase_refund: {
    id: "erase_refund", category: "economy",
    labelKey: "upgr_erase_refund", descKey: "upgr_erase_refund_desc",
    icon: "♻️", maxLevel: 10, baseCost: 80, costMultiplier: 1.4, currency: "souls",
    apply(s, l) { s.eraseRefundBonus = 0.5 + l * 0.03; }
  },

  // === ЛОВУШКИ ===
  trap_speed: {
    id: "trap_speed", category: "traps",
    labelKey: "upgr_trap_speed", descKey: "upgr_trap_speed_desc",
    icon: "⏩", maxLevel: 15, baseCost: 100, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.trapSpeedBonus = 1 - Math.min(0.5, l * 0.033); }
  },
  trap_range: {
    id: "trap_range", category: "traps",
    labelKey: "upgr_trap_range", descKey: "upgr_trap_range_desc",
    icon: "📏", maxLevel: 10, baseCost: 180, costMultiplier: 1.6, currency: "souls",
    apply(s, l) { s.trapRangeBonus = 1 + l * 0.1; }
  },
  poison_potency: {
    id: "poison_potency", category: "traps",
    labelKey: "upgr_poison_potency", descKey: "upgr_poison_potency_desc",
    icon: "🧪", maxLevel: 10, baseCost: 150, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.poisonBonus = 1 + l * 0.2; }
  },
  slow_potency: {
    id: "slow_potency", category: "traps",
    labelKey: "upgr_slow_potency", descKey: "upgr_slow_potency_desc",
    icon: "🥶", maxLevel: 10, baseCost: 130, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.slowBonus = 1 + l * 0.15; }
  },

  // === МОНСТРЫ ===
  monster_speed: {
    id: "monster_speed", category: "monsters",
    labelKey: "upgr_monster_speed", descKey: "upgr_monster_speed_desc",
    icon: "⏩", maxLevel: 15, baseCost: 100, costMultiplier: 1.5, currency: "souls",
    apply(s, l) { s.monsterSpeedBonus = 1 - Math.min(0.5, l * 0.033); }
  },
  monster_range: {
    id: "monster_range", category: "monsters",
    labelKey: "upgr_monster_range", descKey: "upgr_monster_range_desc",
    icon: "🎯", maxLevel: 10, baseCost: 180, costMultiplier: 1.6, currency: "souls",
    apply(s, l) { s.monsterRangeBonus = 1 + l * 0.1; }
  },
  merge_power: {
    id: "merge_power", category: "monsters",
    labelKey: "upgr_merge_power", descKey: "upgr_merge_power_desc",
    icon: "⭐", maxLevel: 10, baseCost: 300, costMultiplier: 1.8, currency: "souls",
    apply(s, l) { s.mergeLevelBonus = 1 + l * 0.1; }
  },
  necro_boost: {
    id: "necro_boost", category: "monsters",
    labelKey: "upgr_necro_boost", descKey: "upgr_necro_boost_desc",
    icon: "👻", maxLevel: 10, baseCost: 250, costMultiplier: 1.7, currency: "souls",
    apply(s, l) { s.necroBonusExtra = l * 0.05; }
  },
};

// ============================
// ДЕРЕВО ТАЛАНТОВ КРИСТАЛЛА
// ============================

export const TALENT_BRANCHES = {
  shadow:  { labelKey: "talents_branch_shadow",  icon: "🗡️", currency: "souls",         color: 0x57ffb8 },
  abyss:   { labelKey: "talents_branch_abyss",   icon: "💎", currency: "darkCrystals",  color: 0x00fff5 },
  essence: { labelKey: "talents_branch_essence", icon: "🔮", currency: "essence",       color: 0xcc88ff },
};

// Ветка линейная: талант доступен, если предыдущий (requires) имеет уровень >= 1.
export const TALENTS = {
  shadow_power: {
    id: "shadow_power", branch: "shadow", tier: 1, requires: null,
    labelKey: "talent_shadow_power", descKey: "talent_shadow_power_desc",
    icon: "🗡️", maxLevel: 5, baseCost: 150, costMultiplier: 1.6,
    apply(s, l) { s.trapDamageBonus *= 1 + 0.04 * l; s.monsterDamageBonus *= 1 + 0.04 * l; },
  },
  shadow_crit: {
    id: "shadow_crit", branch: "shadow", tier: 2, requires: "shadow_power",
    labelKey: "talent_shadow_crit", descKey: "talent_shadow_crit_desc",
    icon: "🎲", maxLevel: 3, baseCost: 400, costMultiplier: 1.8,
    apply(s, l) { s.critChance = Math.min(0.8, s.critChance + 0.02 * l); },
  },
  shadow_speed: {
    id: "shadow_speed", branch: "shadow", tier: 3, requires: "shadow_crit",
    labelKey: "talent_shadow_speed", descKey: "talent_shadow_speed_desc",
    icon: "⏩", maxLevel: 3, baseCost: 350, costMultiplier: 1.7,
    apply(s, l) { const k = 1 - 0.04 * l; s.trapSpeedBonus = Math.max(0.4, s.trapSpeedBonus * k); s.monsterSpeedBonus = Math.max(0.4, s.monsterSpeedBonus * k); },
  },
  shadow_merge: {
    id: "shadow_merge", branch: "shadow", tier: 4, requires: "shadow_speed",
    labelKey: "talent_shadow_merge", descKey: "talent_shadow_merge_desc",
    icon: "🔀", maxLevel: 3, baseCost: 500, costMultiplier: 1.8,
    apply(s, l) { s.mergeLevelBonus *= 1 + 0.06 * l; },
  },

  abyss_hp: {
    id: "abyss_hp", branch: "abyss", tier: 1, requires: null,
    labelKey: "talent_abyss_hp", descKey: "talent_abyss_hp_desc",
    icon: "💗", maxLevel: 5, baseCost: 2, costMultiplier: 1.5,
    apply(s, l) { s.maxCrystalHP += 15 * l; s.crystalHP = Math.min(s.crystalHP, s.maxCrystalHP); },
  },
  abyss_regen: {
    id: "abyss_regen", branch: "abyss", tier: 2, requires: "abyss_hp",
    labelKey: "talent_abyss_regen", descKey: "talent_abyss_regen_desc",
    icon: "💚", maxLevel: 3, baseCost: 3, costMultiplier: 1.6,
    apply(s, l) { s.regenPerWave += l; },
  },
  abyss_offline: {
    id: "abyss_offline", branch: "abyss", tier: 3, requires: "abyss_regen",
    labelKey: "talent_abyss_offline", descKey: "talent_abyss_offline_desc",
    icon: "🌙", maxLevel: 3, baseCost: 3, costMultiplier: 1.6,
    apply(s, l) { s.offlineBonus = 1 + 0.25 * l; },
  },
  abyss_shield: {
    id: "abyss_shield", branch: "abyss", tier: 4, requires: "abyss_offline",
    labelKey: "talent_abyss_shield", descKey: "talent_abyss_shield_desc",
    icon: "🛡️", maxLevel: 3, baseCost: 4, costMultiplier: 1.7,
    apply(s, l) { s.crystalDamageReduction = Math.min(0.6, s.crystalDamageReduction + 0.04 * l); },
  },

  essence_gold: {
    id: "essence_gold", branch: "essence", tier: 1, requires: null,
    labelKey: "talent_essence_gold", descKey: "talent_essence_gold_desc",
    icon: "🪙", maxLevel: 5, baseCost: 3, costMultiplier: 1.5,
    apply(s, l) { s.goldMultiplier *= 1 + 0.10 * l; },
  },
  essence_wave: {
    id: "essence_wave", branch: "essence", tier: 2, requires: "essence_gold",
    labelKey: "talent_essence_wave", descKey: "talent_essence_wave_desc",
    icon: "🏆", maxLevel: 3, baseCost: 4, costMultiplier: 1.6,
    apply(s, l) { s.waveBonusMultiplier *= 1 + 0.10 * l; },
  },
  essence_boss: {
    id: "essence_boss", branch: "essence", tier: 3, requires: "essence_wave",
    labelKey: "talent_essence_boss", descKey: "talent_essence_boss_desc",
    icon: "👑", maxLevel: 3, baseCost: 5, costMultiplier: 1.7,
    apply(s, l) { s.bossDamageBonus *= 1 + 0.12 * l; },
  },
  essence_drop: {
    id: "essence_drop", branch: "essence", tier: 4, requires: "essence_boss",
    labelKey: "talent_essence_drop", descKey: "talent_essence_drop_desc",
    icon: "🔮", maxLevel: 2, baseCost: 6, costMultiplier: 2.0,
    apply(s, l) { s.essenceDropChance = 0.25 * l; },
  },
};

export function getTalentCost(def, level) {
  return Math.max(1, Math.floor(def.baseCost * Math.pow(def.costMultiplier, level)));
}

// ============================
// ЕЖЕДНЕВНЫЕ / КОЛЕСО
// ============================

export const DAILY_REWARDS = [
  { day: 1, gold: 100, souls: 20 },
  { day: 2, gold: 200, souls: 40 },
  { day: 3, gold: 350, souls: 70 },
  { day: 4, gold: 500, souls: 100 },
  { day: 5, gold: 700, souls: 150 },
  { day: 6, gold: 1000, souls: 220 },
  { day: 7, gold: 1500, souls: 350, darkCrystals: 2 },
];
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const DAILY_STREAK_LIMIT_MS = 48 * 60 * 60 * 1000;

export const WHEEL_SECTORS = [
  { id: "gold_s", label: "50🪙", color: 0xf9ca24, gold: 50, weight: 22 },
  { id: "souls_s", label: "10💀", color: 0x57ffb8, souls: 10, weight: 22 },
  { id: "gold_m", label: "150🪙", color: 0xff9933, gold: 150, weight: 15 },
  { id: "souls_m", label: "30💀", color: 0x22ff55, souls: 30, weight: 15 },
  { id: "heal", label: "+5 HP", color: 0x00fff5, crystalHP: 5, weight: 10 },
  { id: "gold_l", label: "400🪙", color: 0xff5500, gold: 400, weight: 8 },
  { id: "souls_l", label: "80💀", color: 0x00ffaa, souls: 80, weight: 6 },
  { id: "jackpot", label: "🎁 ДЖЕКПОТ", color: 0xff00ff, gold: 1000, souls: 200, crystalHP: 10, darkCrystals: 1, weight: 2 },
];
export const WHEEL_FREE_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Offline income is deliberately capped, so changing the device clock cannot create unbounded rewards.
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000;
export function getOfflineIncome(save, elapsedMs) {
  const minutes = Math.floor(Math.max(0, Math.min(elapsedMs, OFFLINE_MAX_MS)) / 60000);
  const pieces = Array.isArray(save?.board) ? save.board.length : 0;
  if (!minutes || !pieces) return { gold: 0, souls: 0, minutes };
  const bonus = save.offlineBonus ?? 1;
  return { gold: Math.floor(minutes * pieces * 0.5 * bonus), souls: Math.floor(minutes * pieces * 0.2 * bonus), minutes };
}

// ============================
// ЗАДАНИЯ (DAILY / WEEKLY)
// ============================

export const QUEST_KIND_META = {
  kills:   { icon: "🗡️", labelKey: "quest_kind_kills" },
  merges:  { icon: "🔀", labelKey: "quest_kind_merges" },
  waves:   { icon: "⚔️", labelKey: "quest_kind_waves" },
  bosses:  { icon: "👑", labelKey: "quest_kind_bosses" },
};

// Цели и награды живут только в коде — сохранение хранит лишь baseline и факт получения награды.
export const QUEST_POOLS = {
  daily: [
    { id: "d_kills",  kind: "kills",  stat: "totalKills",      goals: [15, 25, 40],   rewards: [{ gold: 150 }, { gold: 260 }, { souls: 90 }] },
    { id: "d_merges", kind: "merges", stat: "totalMerges",     goals: [5, 10, 15],    rewards: [{ gold: 120 }, { souls: 60 }, { souls: 100 }] },
    { id: "d_waves",  kind: "waves",  stat: "wavesCompleted",  goals: [3, 5, 8],      rewards: [{ gold: 200 }, { souls: 80 }, { gold: 350 }] },
    { id: "d_boss",   kind: "bosses", stat: "bossKills",       goals: [1, 2, 3],      rewards: [{ souls: 60 }, { souls: 110 }, { essence: 1 }] },
  ],
  weekly: [
    { id: "w_kills",  kind: "kills",  stat: "totalKills",     goals: [150, 250, 400],  rewards: [{ gold: 900 }, { souls: 350 }, { darkCrystals: 1 }] },
    { id: "w_merges", kind: "merges", stat: "totalMerges",    goals: [40, 70, 110],    rewards: [{ gold: 700 }, { souls: 300 }, { essence: 2 }] },
    { id: "w_waves",  kind: "waves",  stat: "wavesCompleted", goals: [20, 35, 50],     rewards: [{ gold: 1200 }, { souls: 450 }, { essence: 3 }] },
    { id: "w_boss",   kind: "bosses", stat: "bossKills",      goals: [5, 10, 15],      rewards: [{ souls: 400 }, { essence: 2 }, { darkCrystals: 2 }] },
  ],
};

export const QUESTS_PER_PERIOD = 3;

/** Детерминированный ГПСЧ (mulberry32) — одинаковые задания у всех игроков за период. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Ключ суточного периода (UTC). */
export function dailyPeriodKey(now = Date.now()) {
  const d = new Date(now);
  return `d${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
/** Ключ недельного периода (понедельник UTC). */
export function weeklyPeriodKey(now = Date.now()) {
  const d = new Date(now);
  const weekday = (d.getUTCDay() + 6) % 7; // 0 = понедельник
  d.setUTCDate(d.getUTCDate() - weekday);
  return `w${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
export function questPeriodKey(kind, now = Date.now()) {
  return kind === "weekly" ? weeklyPeriodKey(now) : dailyPeriodKey(now);
}

/** Выбор 3 заданий из пула детерминированно по ключу периода. */
export function generateQuests(kind, periodKey) {
  const pool = QUEST_POOLS[kind] || [];
  if (!pool.length) return [];
  const rng = mulberry32(hashSeed(`${kind}:${periodKey}`));
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const chosen = idx.slice(0, Math.min(QUESTS_PER_PERIOD, idx.length)).sort((a, b) => a - b);
  return chosen.map((i) => {
    const def = pool[i];
    const tier = Math.floor(rng() * def.goals.length);
    return { id: def.id, kind: def.kind, stat: def.stat, goal: def.goals[tier], reward: def.rewards[tier] };
  });
}

/** Текст награды для UI. */
export function rewardText(reward) {
  if (!reward) return "";
  const parts = [];
  if (reward.gold) parts.push(`+${reward.gold}🪙`);
  if (reward.souls) parts.push(`+${reward.souls}💀`);
  if (reward.darkCrystals) parts.push(`+${reward.darkCrystals}💎`);
  if (reward.essence) parts.push(`+${reward.essence}🔮`);
  return parts.join("  ");
}

// ============================
// РЕЖИМ «БЕЗДНА» (ENDLESS)
// ============================

export const ENDLESS = {
  unlockMaxWave: 30,       // открывается после 30-й волны кампании
  startGold: 300,          // локальное золото забега
  waveDelayMs: 3500,       // пауза между волнами
  bossEveryWaves: 5,       // босс каждую 5-ю волну
  essenceEveryWaves: 5,    // 🔮 за каждую 5-ю волну
  bonusGoldEveryWaves: 10, // пополнение золота забега
  bonusGold: 250,
  hpGrowth: 0.07,          // +7% HP врага за волну
  speedGrowth: 0.012,      // +1.2% скорости за волну (кап +60%)
  speedCap: 0.6,
  killGoldFactor: 0.5,     // золото за убийства — только в золото забега
  endSoulsPerWave: 12,     // финальная награда душами за волну
};

export function getEndlessBossType(wave) {
  const bosses = ["paladin", "archmage", "king"];
  return HERO_TYPES[bosses[Math.floor((wave - 1) / ENDLESS.bossEveryWaves) % bosses.length]] || null;
}

// ============================
// ДОСТИЖЕНИЯ
// ============================

export const ACHIEVEMENTS = [
  { id: "wave_5", labelKey: "ach_wave_5", descKey: "ach_wave_5_desc", category: "waves", icon: "⚔️", stat: "maxWave", goal: 5, reward: { gold: 100, souls: 20 } },
  { id: "wave_10", labelKey: "ach_wave_10", descKey: "ach_wave_10_desc", category: "waves", icon: "⚔️", stat: "maxWave", goal: 10, reward: { gold: 250, souls: 50 } },
  { id: "wave_25", labelKey: "ach_wave_25", descKey: "ach_wave_25_desc", category: "waves", icon: "⚔️", stat: "maxWave", goal: 25, reward: { gold: 700, souls: 150 } },
  { id: "wave_50", labelKey: "ach_wave_50", descKey: "ach_wave_50_desc", category: "waves", icon: "⚔️", stat: "maxWave", goal: 50, reward: { gold: 2000, souls: 400 } },
  { id: "wave_100", labelKey: "ach_wave_100", descKey: "ach_wave_100_desc", category: "waves", icon: "👑", stat: "maxWave", goal: 100, reward: { gold: 10000, souls: 1500 } },
  { id: "kills_50", labelKey: "ach_kills_50", descKey: "ach_kills_50_desc", category: "kills", icon: "🗡️", stat: "totalKills", goal: 50, reward: { gold: 100, souls: 30 } },
  { id: "kills_200", labelKey: "ach_kills_200", descKey: "ach_kills_200_desc", category: "kills", icon: "🗡️", stat: "totalKills", goal: 200, reward: { gold: 300, souls: 80 } },
  { id: "kills_1000", labelKey: "ach_kills_1000", descKey: "ach_kills_1000_desc", category: "kills", icon: "🗡️", stat: "totalKills", goal: 1000, reward: { gold: 1500, souls: 300 } },
  { id: "kills_5000", labelKey: "ach_kills_5000", descKey: "ach_kills_5000_desc", category: "kills", icon: "☠️", stat: "totalKills", goal: 5000, reward: { gold: 5000, souls: 1000 } },
  { id: "boss_1", labelKey: "ach_boss_1", descKey: "ach_boss_1_desc", category: "bosses", icon: "👑", stat: "bossKills", goal: 1, reward: { gold: 200, souls: 60 } },
  { id: "boss_5", labelKey: "ach_boss_5", descKey: "ach_boss_5_desc", category: "bosses", icon: "👑", stat: "bossKills", goal: 5, reward: { gold: 800, souls: 200 } },
  { id: "boss_25", labelKey: "ach_boss_25", descKey: "ach_boss_25_desc", category: "bosses", icon: "👑", stat: "bossKills", goal: 25, reward: { gold: 3000, souls: 700 } },
  { id: "upgr_5", labelKey: "ach_upgr_5", descKey: "ach_upgr_5_desc", category: "upgrades", icon: "🔧", stat: "upgradesBought", goal: 5, reward: { gold: 200, souls: 50 } },
  { id: "upgr_20", labelKey: "ach_upgr_20", descKey: "ach_upgr_20_desc", category: "upgrades", icon: "🔧", stat: "upgradesBought", goal: 20, reward: { gold: 800, souls: 200 } },
  { id: "upgr_50", labelKey: "ach_upgr_50", descKey: "ach_upgr_50_desc", category: "upgrades", icon: "🔧", stat: "upgradesBought", goal: 50, reward: { gold: 3000, souls: 700 } },
  { id: "merge_10", labelKey: "ach_merge_10", descKey: "ach_merge_10_desc", category: "special", icon: "🔀", stat: "totalMerges", goal: 10, reward: { gold: 150, souls: 40 } },
  { id: "merge_100", labelKey: "ach_merge_100", descKey: "ach_merge_100_desc", category: "special", icon: "🔀", stat: "totalMerges", goal: 100, reward: { gold: 800, souls: 200 } },
  { id: "merge_max", labelKey: "ach_merge_max", descKey: "ach_merge_max_desc", category: "special", icon: "⭐", stat: "maxLevelMerge", goal: 1, reward: { gold: 500, souls: 100 } },
  { id: "daily_3", labelKey: "ach_daily_3", descKey: "ach_daily_3_desc", category: "special", icon: "📅", stat: "dailyStreak", goal: 3, reward: { gold: 200, souls: 50 } },
  { id: "daily_7", labelKey: "ach_daily_7", descKey: "ach_daily_7_desc", category: "special", icon: "📅", stat: "dailyStreak", goal: 7, reward: { gold: 1000, souls: 250 } },
  { id: "daily_30", labelKey: "ach_daily_30", descKey: "ach_daily_30_desc", category: "special", icon: "📅", stat: "dailyStreak", goal: 30, reward: { gold: 5000, souls: 1200 } },
  { id: "wheel_10", labelKey: "ach_wheel_10", descKey: "ach_wheel_10_desc", category: "special", icon: "🎡", stat: "wheelTotalSpins", goal: 10, reward: { gold: 300, souls: 70 } },
  { id: "wheel_50", labelKey: "ach_wheel_50", descKey: "ach_wheel_50_desc", category: "special", icon: "🎡", stat: "wheelTotalSpins", goal: 50, reward: { gold: 1200, souls: 300 } },
  { id: "gold_1k", labelKey: "ach_gold_1k", descKey: "ach_gold_1k_desc", category: "special", icon: "💰", stat: "gold", goal: 1000, reward: { gold: 100, souls: 30 } },
  { id: "gold_10k", labelKey: "ach_gold_10k", descKey: "ach_gold_10k_desc", category: "special", icon: "💰", stat: "gold", goal: 10000, reward: { gold: 500, souls: 150 } },
  { id: "souls_1k", labelKey: "ach_souls_1k", descKey: "ach_souls_1k_desc", category: "special", icon: "💀", stat: "souls", goal: 1000, reward: { gold: 500, souls: 200 } },

  // === МЕТА-ПРОГРЕСС (квесты, валюты, таланты, бестиарий, бездна) ===
  { id: "quest_d_1", labelKey: "ach_quest_d_1", descKey: "ach_quest_d_1_desc", category: "special", icon: "📜", stat: "dailyQuestsCompleted", goal: 1, reward: { gold: 150, souls: 50 } },
  { id: "quest_d_15", labelKey: "ach_quest_d_15", descKey: "ach_quest_d_15_desc", category: "special", icon: "📜", stat: "dailyQuestsCompleted", goal: 15, reward: { gold: 1200, souls: 300, darkCrystals: 1 } },
  { id: "quest_w_1", labelKey: "ach_quest_w_1", descKey: "ach_quest_w_1_desc", category: "special", icon: "🗓️", stat: "weeklyQuestsCompleted", goal: 1, reward: { souls: 300, essence: 2 } },
  { id: "quest_w_5", labelKey: "ach_quest_w_5", descKey: "ach_quest_w_5_desc", category: "special", icon: "🗓️", stat: "weeklyQuestsCompleted", goal: 5, reward: { gold: 3000, darkCrystals: 3 } },
  { id: "crystal_1", labelKey: "ach_crystal_1", descKey: "ach_crystal_1_desc", category: "special", icon: "💎", stat: "darkCrystalsTotal", goal: 1, reward: { gold: 300 } },
  { id: "crystal_10", labelKey: "ach_crystal_10", descKey: "ach_crystal_10_desc", category: "special", icon: "💎", stat: "darkCrystalsTotal", goal: 10, reward: { gold: 2500, souls: 500 } },
  { id: "essence_10", labelKey: "ach_essence_10", descKey: "ach_essence_10_desc", category: "special", icon: "🔮", stat: "essenceTotal", goal: 10, reward: { gold: 800, souls: 250 } },
  { id: "essence_50", labelKey: "ach_essence_50", descKey: "ach_essence_50_desc", category: "special", icon: "🔮", stat: "essenceTotal", goal: 50, reward: { darkCrystals: 3 } },
  { id: "talent_1", labelKey: "ach_talent_1", descKey: "ach_talent_1_desc", category: "upgrades", icon: "🌌", stat: "talentsBought", goal: 1, reward: { gold: 200, souls: 80 } },
  { id: "talent_10", labelKey: "ach_talent_10", descKey: "ach_talent_10_desc", category: "upgrades", icon: "🌌", stat: "talentsBought", goal: 10, reward: { souls: 600, essence: 2 } },
  { id: "talent_25", labelKey: "ach_talent_25", descKey: "ach_talent_25_desc", category: "upgrades", icon: "🌌", stat: "talentsBought", goal: 25, reward: { darkCrystals: 2, essence: 3 } },
  { id: "bestiary_half", labelKey: "ach_bestiary_half", descKey: "ach_bestiary_half_desc", category: "special", icon: "📖", stat: "discoveredUnits", goal: 8, reward: { gold: 400, souls: 120 } },
  { id: "bestiary_units", labelKey: "ach_bestiary_units", descKey: "ach_bestiary_units_desc", category: "special", icon: "📖", stat: "discoveredUnits", goal: 15, reward: { souls: 500, darkCrystals: 1 } },
  { id: "bestiary_heroes", labelKey: "ach_bestiary_heroes", descKey: "ach_bestiary_heroes_desc", category: "special", icon: "📖", stat: "discoveredHeroes", goal: 10, reward: { souls: 400, essence: 2 } },
  { id: "endless_10", labelKey: "ach_endless_10", descKey: "ach_endless_10_desc", category: "waves", icon: "♾️", stat: "endlessMaxWave", goal: 10, reward: { souls: 400, essence: 1 } },
  { id: "endless_25", labelKey: "ach_endless_25", descKey: "ach_endless_25_desc", category: "waves", icon: "♾️", stat: "endlessMaxWave", goal: 25, reward: { souls: 1500, essence: 3 } },
  { id: "endless_50", labelKey: "ach_endless_50", descKey: "ach_endless_50_desc", category: "waves", icon: "♾️", stat: "endlessMaxWave", goal: 50, reward: { darkCrystals: 5, essence: 5 } },

  // === РАСШИРЕННЫЕ ЦЕЛИ ===
  { id: "wave_150", labelKey: "ach_wave_150", descKey: "ach_wave_150_desc", category: "waves", icon: "⚔️", stat: "maxWave", goal: 150, reward: { gold: 25000, souls: 4000 } },
  { id: "wave_200", labelKey: "ach_wave_200", descKey: "ach_wave_200_desc", category: "waves", icon: "👑", stat: "maxWave", goal: 200, reward: { gold: 60000, souls: 8000, darkCrystals: 2 } },
  { id: "kills_10000", labelKey: "ach_kills_10000", descKey: "ach_kills_10000_desc", category: "kills", icon: "🗡️", stat: "totalKills", goal: 10000, reward: { gold: 12000, souls: 2500 } },
  { id: "kills_25000", labelKey: "ach_kills_25000", descKey: "ach_kills_25000_desc", category: "kills", icon: "☠️", stat: "totalKills", goal: 25000, reward: { darkCrystals: 3, essence: 3 } },
  { id: "boss_100", labelKey: "ach_boss_100", descKey: "ach_boss_100_desc", category: "bosses", icon: "👑", stat: "bossKills", goal: 100, reward: { gold: 10000, souls: 2500, essence: 2 } },
  { id: "merge_500", labelKey: "ach_merge_500", descKey: "ach_merge_500_desc", category: "special", icon: "🔀", stat: "totalMerges", goal: 500, reward: { gold: 4000, souls: 900 } },
  { id: "merge_2000", labelKey: "ach_merge_2000", descKey: "ach_merge_2000_desc", category: "special", icon: "🔀", stat: "totalMerges", goal: 2000, reward: { darkCrystals: 2, essence: 2 } },
  { id: "daily_100", labelKey: "ach_daily_100", descKey: "ach_daily_100_desc", category: "special", icon: "📅", stat: "dailyStreak", goal: 100, reward: { darkCrystals: 3 } },
  { id: "wheel_150", labelKey: "ach_wheel_150", descKey: "ach_wheel_150_desc", category: "special", icon: "🎡", stat: "wheelTotalSpins", goal: 150, reward: { souls: 2000, essence: 2 } },
  { id: "gold_100k", labelKey: "ach_gold_100k", descKey: "ach_gold_100k_desc", category: "special", icon: "💰", stat: "gold", goal: 100000, reward: { souls: 3000 } },
  { id: "souls_10k", labelKey: "ach_souls_10k", descKey: "ach_souls_10k_desc", category: "special", icon: "💀", stat: "souls", goal: 10000, reward: { darkCrystals: 2 } },
];

export const ACHIEVEMENT_CATEGORIES = {
  waves: { labelKey: "ach_category_waves", icon: "⚔️" },
  kills: { labelKey: "ach_category_kills", icon: "🗡️" },
  bosses: { labelKey: "ach_category_bosses", icon: "👑" },
  upgrades: { labelKey: "ach_category_upgrades", icon: "🔧" },
  special: { labelKey: "ach_category_special", icon: "⭐" },
};

// ============================
// ФУНКЦИИ
// ============================

// Верхняя граница врагов на волну — защита от деградации FPS на больших волнах (аудит №21).
export function getWaveEnemyCount(w) { return Math.min(64, 4 + Math.floor(w * 1.5)); }
export function getBaseHeroHP(w) { return 40 + w * 15; }
export function getBaseHeroSpeed(w) { return 34 + Math.min(w * 2, 60); }

/** Награда за волну с учётом улучшения wave_bonus */
export function getWaveBonus(w, save) {
  const mult = save?.waveBonusMultiplier ?? 1;
  return {
    gold: Math.floor((20 + w * 10) * mult),
    souls: Math.floor((10 + w * 5) * mult),
  };
}

export function pickHeroType(wave) {
  const pool = Object.values(HERO_TYPES).filter((h) => !h.isBoss && wave >= h.minWave);
  const total = pool.reduce((s, h) => s + h.weight, 0);
  let roll = Math.random() * total;
  for (const h of pool) { roll -= h.weight; if (roll <= 0) return h; }
  return pool[pool.length - 1];
}

export function getBossForWave(wave) {
  const bosses = Object.values(HERO_TYPES).filter((h) => h.isBoss && wave >= h.minWave && wave % h.bossInterval === 0).sort((a, b) => b.minWave - a.minWave);
  return bosses[0] || null;
}

export function getUpgradeCost(def, level) {
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, level));
}

export function getToolCost(toolDef, save) {
  return Math.max(1, Math.floor(toolDef.cost * (save.costDiscount ?? 1)));
}

/**
 * Расчёт урона с учётом всех бонусов, критов и merge_power.
 * isBoss — увеличивает урон по боссу.
 * weaknessTool — инструмент-слабость цели: +BOSS_WEAKNESS_BONUS урона.
 * Возвращает { damage, isCrit }.
 */
export function computeDamage(toolDef, level, save, isBossTarget = false, weaknessTool = null) {
  const kindBonus = toolDef.kind === "trap"
    ? (save.trapDamageBonus ?? 1)
    : (save.monsterDamageBonus ?? 1);

  const mergeBonus = save.mergeLevelBonus ?? 1;
  const bossBonus = isBossTarget ? (save.bossDamageBonus ?? 1) : 1;
  const weakBonus = isBossTarget && weaknessTool && toolDef.id === weaknessTool ? 1 + BOSS_WEAKNESS_BONUS : 1;

  let dmg = toolDef.damage * level * kindBonus * mergeBonus * bossBonus * weakBonus;

  // Крит
  const critChance = save.critChance ?? 0;
  const isCrit = Math.random() < critChance;
  if (isCrit) {
    const critMult = save.critMultiplier ?? 2;
    dmg *= critMult;
  }

  return { damage: Math.floor(dmg), isCrit };
}

// Простой алиас для обратной совместимости
export function getMergeLevelDamage(toolDef, level, save) {
  return computeDamage(toolDef, level, save, false).damage;
}

/** Модифицированный кулдаун ловушки */
export function getTrapCooldown(toolDef, save) {
  return Math.floor(toolDef.cooldown * (save.trapSpeedBonus ?? 1));
}

/** Модифицированный кулдаун монстра */
export function getMonsterCooldown(toolDef, save) {
  return Math.floor(toolDef.cooldown * (save.monsterSpeedBonus ?? 1));
}

/** Модифицированная дальность ловушки/монстра */
export function getToolRange(toolDef, save) {
  const bonus = toolDef.kind === "trap"
    ? (save.trapRangeBonus ?? 1)
    : (save.monsterRangeBonus ?? 1);
  return (toolDef.range || 2) * bonus;
}

export function isToolUnlocked(toolDef, wave) {
  return !toolDef.unlockWave || wave >= toolDef.unlockWave;
}

export function getHeroReward(heroTypeDef, save) {
  return {
    gold: Math.floor(heroTypeDef.goldReward * (save.goldMultiplier ?? 1)),
    souls: Math.floor(heroTypeDef.soulReward * (save.soulMultiplier ?? 1)),
  };
}

export function getCurrentDailyDay(save) { return Math.min(save.dailyStreak || 0, DAILY_REWARDS.length); }
export function getNextDailyReward(save) { return DAILY_REWARDS[(save.dailyStreak || 0) % DAILY_REWARDS.length]; }
export function canClaimDaily(save, now = Date.now()) { return now - (save.dailyLastClaimAt || 0) >= DAILY_INTERVAL_MS; }
export function shouldResetStreak(save, now = Date.now()) { const last = save.dailyLastClaimAt || 0; return last > 0 && now - last > DAILY_STREAK_LIMIT_MS; }
export function timeUntilNextDaily(save, now = Date.now()) { return Math.max(0, DAILY_INTERVAL_MS - (now - (save.dailyLastClaimAt || 0))); }

export function canSpinWheelFree(save, now = Date.now()) { return now - (save.wheelLastFreeSpinAt || 0) >= WHEEL_FREE_INTERVAL_MS; }
export function timeUntilNextFreeSpin(save, now = Date.now()) { return Math.max(0, WHEEL_FREE_INTERVAL_MS - (now - (save.wheelLastFreeSpinAt || 0))); }

export function pickWheelSector() {
  const total = WHEEL_SECTORS.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < WHEEL_SECTORS.length; i++) {
    roll -= WHEEL_SECTORS[i].weight;
    if (roll <= 0) return { sector: WHEEL_SECTORS[i], index: i };
  }
  return { sector: WHEEL_SECTORS[WHEEL_SECTORS.length - 1], index: WHEEL_SECTORS.length - 1 };
}

export function formatTime(ms) {
  if (ms <= 0) return t("time_ready");
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return t("time_h", h, m);
  if (m > 0) return t("time_m", m, sec);
  return t("time_s", s);
}

export function getStatValue(save, statKey) {
  if (save.stats && save.stats[statKey] !== undefined) return save.stats[statKey];
  if (save[statKey] !== undefined) return save[statKey];
  return 0;
}

export function toolLabel(def) { return def.labelKey ? t(def.labelKey) : def.label; }
export function toolDesc(def) { return def.descKey ? t(def.descKey) : def.description; }
export function heroLabel(def) { return def.labelKey ? t(def.labelKey) : def.label; }
export function achLabel(def) { return def.labelKey ? t(def.labelKey) : def.label; }
export function achDesc(def) { return def.descKey ? t(def.descKey) : def.description; }
export function upgrLabel(def) { return def.labelKey ? t(def.labelKey) : def.label; }
export function upgrDesc(def) { return def.descKey ? t(def.descKey) : def.description; }