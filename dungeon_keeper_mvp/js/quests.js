import {
  generateQuests, questPeriodKey, getStatValue,
} from "./config.js";
import { saveManager } from "./saveManager.js";

const KINDS = ["daily", "weekly"];

/**
 * Синхронизирует состояние квестов с текущим периодом (сутки UTC / неделя с понедельника UTC).
 * При смене периода квесты перегенерируются детерминированно из кода,
 * а baseline статистики фиксируется заново — старые достижения задним числом не засчитываются.
 */
export function ensureQuests(now = Date.now()) {
  if (!saveManager.data.quests) saveManager.data.quests = { daily: { key: "", baseline: {}, claimed: {} }, weekly: { key: "", baseline: {}, claimed: {} } };
  for (const kind of KINDS) {
    const st = saveManager.data.quests[kind] || (saveManager.data.quests[kind] = { key: "", baseline: {}, claimed: {} });
    const key = questPeriodKey(kind, now);
    if (st.key !== key) {
      const defs = generateQuests(kind, key);
      st.key = key;
      st.baseline = {};
      st.claimed = {};
      for (const d of defs) st.baseline[d.id] = getStatValue(saveManager.data, d.stat);
    }
  }
}

/** Список квестов периода с прогрессом. Цели/награды всегда берутся из кода. */
export function getQuests(kind, now = Date.now()) {
  ensureQuests(now);
  const st = saveManager.data.quests[kind];
  const defs = generateQuests(kind, st.key);
  return defs.map((d) => {
    const baseline = Math.max(0, Math.floor(Number(st.baseline?.[d.id]) || 0));
    const current = Math.max(0, getStatValue(saveManager.data, d.stat) - baseline);
    return {
      ...d,
      baseline,
      current,
      progress: Math.min(1, current / d.goal),
      ready: current >= d.goal,
      claimed: st.claimed?.[d.id] === true,
    };
  });
}

/** Забрать награду за квест. Возвращает награду или null. */
export function claimQuest(kind, questId, now = Date.now()) {
  const list = getQuests(kind, now);
  const q = list.find((x) => x.id === questId);
  if (!q || q.claimed || !q.ready) return null;
  saveManager.data.quests[kind].claimed[questId] = true;
  saveManager.incStat(kind === "daily" ? "dailyQuestsCompleted" : "weeklyQuestsCompleted", 1);
  saveManager.grantReward(q.reward);
  saveManager.saveThrottled();
  return q.reward;
}

/** Сколько наград готово к получению (для бейджа в меню). */
export function questsReadyCount(now = Date.now()) {
  let count = 0;
  for (const kind of KINDS) {
    for (const q of getQuests(kind, now)) if (q.ready && !q.claimed) count++;
  }
  return count;
}

/** Безопасный обмен премиум-валют: 1💎 → 150🪙, 1🔮 → 75💀. */
export function exchangeCurrency(id) {
  const d = saveManager.data;
  if (id === "crystal_to_gold") {
    if ((d.darkCrystals || 0) < 1) return false;
    d.darkCrystals -= 1; d.gold += 150;
  } else if (id === "essence_to_souls") {
    if ((d.essence || 0) < 1) return false;
    d.essence -= 1; d.souls += 75;
  } else return false;
  saveManager.saveThrottled();
  return true;
}

export const EXCHANGE_DEFS = [
  { id: "crystal_to_gold", icon: "💎", labelKey: "quests_ex_crystals", requires: "darkCrystals" },
  { id: "essence_to_souls", icon: "🔮", labelKey: "quests_ex_essence", requires: "essence" },
];
