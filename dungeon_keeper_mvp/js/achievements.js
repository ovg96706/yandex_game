import { ACHIEVEMENTS, getStatValue } from "./config.js";
import { saveManager } from "./saveManager.js";
import { audio } from "./audio.js";

class AchievementManager {
  constructor() {
    this.onUnlockCallbacks = [];
  }

  isUnlocked(id) {
    return !!saveManager.data.achievements?.[id];
  }

  getProgress(ach) {
    const cur = getStatValue(saveManager.data, ach.stat);
    return {
      current: cur,
      goal: ach.goal,
      percent: Math.min(1, cur / ach.goal),
      completed: cur >= ach.goal,
    };
  }

  onUnlock(cb) { this.onUnlockCallbacks.push(cb); }

  /**
   * Проверить все достижения, выдать награды за новые.
   * Возвращает массив выданных.
   */
  checkAll() {
    if (!saveManager.data.achievements) saveManager.data.achievements = {};
    const unlocked = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.isUnlocked(ach.id)) continue;
      const cur = getStatValue(saveManager.data, ach.stat);
      if (cur >= ach.goal) {
        saveManager.data.achievements[ach.id] = {
          unlockedAt: Date.now(),
        };
        if (ach.reward) saveManager.grantReward(ach.reward);
        unlocked.push(ach);
      }
    }
    if (unlocked.length > 0) {
      saveManager.saveThrottled();
      for (const ach of unlocked) {
        for (const cb of this.onUnlockCallbacks) cb(ach);
      }
      audio.levelUp();
    }
    return unlocked;
  }
}

export const achievements = new AchievementManager();