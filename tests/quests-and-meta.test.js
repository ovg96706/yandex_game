import test from "node:test";
import assert from "node:assert/strict";
import { saveManager, validateSave, SAVE_VERSION } from "../dungeon_keeper_mvp/js/saveManager.js";
import {
  generateQuests, dailyPeriodKey, weeklyPeriodKey, getWaveEnemyCount,
  computeDamage, getEndlessBossType, TOOL_DEFS, HERO_TYPES, ACHIEVEMENTS,
} from "../dungeon_keeper_mvp/js/config.js";
import { getQuests, claimQuest, exchangeCurrency } from "../dungeon_keeper_mvp/js/quests.js";

const NOW = Date.UTC(2026, 7, 20, 12, 0, 0); // фиксированный момент для детерминизма

function freshSave() {
  const s = validateSave({});
  s.quests = { daily: { key: "", baseline: {}, claimed: {} }, weekly: { key: "", baseline: {}, claimed: {} } };
  return s;
}

test("save version 9 keeps premium currencies, quests and bestiary within safe bounds", () => {
  const s = validateSave({
    version: 8, darkCrystals: -5, essence: 1e12,
    talents: { shadow_power: 99, abyss_hp: 2, unknown_talent: 5 },
    quests: { daily: { key: "hack", baseline: { d_kills: -100, w_kills: 5 }, claimed: { d_kills: true, unknown: true } } },
    discovered: { units: { spikes: true, fake_unit: true }, heroes: { peasant: "yes", ghost: true } },
  });
  assert.equal(s.darkCrystals, 0);
  assert.equal(s.essence, 1_000_000_000);
  assert.equal(s.talents.shadow_power, 5); // clamp по maxLevel
  assert.equal(s.talents.abyss_hp, 2);
  assert.equal(s.talents.unknown_talent, undefined);
  assert.equal(s.quests.daily.baseline.d_kills, 0); // отрицательный baseline отброшен
  assert.equal(s.quests.daily.claimed.unknown, undefined); // неизвестный квест отброшен
  assert.equal(s.discovered.units.spikes, true);
  assert.equal(s.discovered.units.fake_unit, undefined);
  assert.equal(s.discovered.heroes.ghost, undefined);
  assert.equal(SAVE_VERSION, 9);
});

test("quests are deterministic per period and never trust save for goals/rewards", () => {
  const key = dailyPeriodKey(NOW);
  const a = generateQuests("daily", key);
  const b = generateQuests("daily", key);
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  // соседние сутки дают другой набор (с высокой вероятностью другая цель/состав)
  assert.equal(typeof a[0].goal, "number");
  assert.ok(a[0].reward && Object.keys(a[0].reward).length > 0);
  // weekly ключ — понедельник UTC
  assert.equal(weeklyPeriodKey(Date.UTC(2026, 7, 20)), weeklyPeriodKey(Date.UTC(2026, 7, 21))); // чт→пт одной недели
  assert.notEqual(weeklyPeriodKey(Date.UTC(2026, 7, 20)), weeklyPeriodKey(Date.UTC(2026, 7, 24))); // чт→пн след. недели
});

test("quest progress uses baseline and reward can be claimed exactly once", () => {
  saveManager.data = freshSave();
  const quests = getQuests("daily", NOW);
  const q = quests[0];
  // прогресс от baseline: достижений «задним числом» нет
  saveManager.data.stats[q.stat] = q.baseline + q.goal - 1;
  let list = getQuests("daily", NOW);
  assert.equal(list[0].ready, false);
  assert.equal(claimQuest("daily", q.id, NOW), null);

  saveManager.data.stats[q.stat] = q.baseline + q.goal;
  list = getQuests("daily", NOW);
  assert.equal(list[0].ready, true);

  const before = saveManager.data.gold + saveManager.data.souls + saveManager.data.darkCrystals + saveManager.data.essence;
  const reward = claimQuest("daily", q.id, NOW);
  assert.ok(reward);
  const after = saveManager.data.gold + saveManager.data.souls + saveManager.data.darkCrystals + saveManager.data.essence;
  assert.ok(after > before);
  assert.equal(saveManager.data.stats.dailyQuestsCompleted, 1);

  // повторно нельзя
  assert.equal(claimQuest("daily", q.id, NOW), null);
  assert.equal(saveManager.data.stats.dailyQuestsCompleted, 1);
});

test("weekly quest can grant premium currencies and increments totals", () => {
  saveManager.data = freshSave();
  const quests = getQuests("weekly", NOW);
  const q = quests[0];
  saveManager.data.stats[q.stat] = q.baseline + q.goal;
  const reward = claimQuest("weekly", q.id, NOW);
  assert.ok(reward);
  const gained = {
    darkCrystals: saveManager.data.stats.darkCrystalsTotal,
    essence: saveManager.data.stats.essenceTotal,
  };
  assert.ok(
    gained.darkCrystals === (reward.darkCrystals || 0) &&
    gained.essence === (reward.essence || 0)
  );
  assert.equal(saveManager.data.stats.weeklyQuestsCompleted, 1);
});

test("talents require prerequisite branch order and clamp on buy", () => {
  saveManager.data = freshSave();
  // shadow_crit требует shadow_power
  assert.equal(saveManager.canBuyTalent("shadow_crit"), false);
  saveManager.data.souls = 100000;
  assert.equal(saveManager.buyTalent("shadow_power"), true);
  assert.equal(saveManager.getTalentLevel("shadow_power"), 1);
  assert.equal(saveManager.data.stats.talentsBought, 1);
  assert.equal(saveManager.canBuyTalent("shadow_crit"), true);
  // премиум-ветки требуют соответствующую валюту
  assert.equal(saveManager.canBuyTalent("abyss_hp"), false);
  saveManager.data.darkCrystals = 10;
  assert.equal(saveManager.buyTalent("abyss_hp"), true);
  assert.ok(saveManager.data.darkCrystals < 10);
});

test("boss weakness tool deals +25% damage", () => {
  const save = validateSave({});
  const def = { id: "poison", kind: "trap", damage: 100 };
  const plain = computeDamage(def, 1, { ...save, critChance: 0 }, false, "lightning");
  const weak = computeDamage(def, 1, { ...save, critChance: 0 }, true, "poison");
  const bossNoWeak = computeDamage(def, 1, { ...save, critChance: 0 }, true, "lightning");
  assert.equal(plain.damage, 100);
  assert.equal(bossNoWeak.damage, 100); // босс без совпадения слабости — без бонуса
  assert.equal(weak.damage, 125);
});

test("enemy count per wave is capped to protect FPS", () => {
  assert.ok(getWaveEnemyCount(10) > getWaveEnemyCount(5));
  assert.equal(getWaveEnemyCount(500), 64);
  assert.equal(getWaveEnemyCount(100000), 64);
});

test("endless boss rotation returns known bosses", () => {
  assert.equal(getEndlessBossType(5).id, "paladin");
  assert.equal(getEndlessBossType(10).id, "archmage");
  assert.equal(getEndlessBossType(15).id, "king");
});

test("currency exchange is one-way and requires funds", () => {
  saveManager.data = freshSave();
  assert.equal(exchangeCurrency("crystal_to_gold"), false);
  saveManager.data.darkCrystals = 1;
  assert.equal(exchangeCurrency("crystal_to_gold"), true);
  assert.equal(saveManager.data.darkCrystals, 0);
  assert.equal(saveManager.data.gold, 120 + 150);
  assert.equal(exchangeCurrency("essence_to_souls"), false);
  saveManager.data.essence = 2;
  assert.equal(exchangeCurrency("essence_to_souls"), true);
  assert.equal(saveManager.data.souls, 75);
});

test("achievements cover 50+ entries and new stats", () => {
  assert.ok(ACHIEVEMENTS.length >= 50, `expected 50+, got ${ACHIEVEMENTS.length}`);
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const need of ["quest_d_1", "talent_25", "endless_50", "bestiary_units", "wave_200"]) {
    assert.ok(ids.has(need), `missing achievement ${need}`);
  }
});

test("all bosses expose a weakness tool that exists in TOOL_DEFS", () => {
  const bosses = Object.values(HERO_TYPES).filter((h) => h.isBoss);
  assert.equal(bosses.length, 3);
  for (const boss of bosses) {
    assert.ok(boss.weaknessTool, `${boss.id} has no weaknessTool`);
    assert.ok(TOOL_DEFS[boss.weaknessTool], `${boss.id} weakness ${boss.weaknessTool} is unknown tool`);
  }
});
