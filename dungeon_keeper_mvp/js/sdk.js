import { SAVE_KEY, LEADERBOARD_NAME } from "./config.js";

class YandexSDKWrapper {
  constructor() {
    this.ysdk = null;
    this.player = null;
    this.leaderboards = null;
    this.inited = false;
  }

  async init() {
    if (this.inited) return;
    this.inited = true;
    try {
      if (!window.YaGames) { console.warn("YaGames SDK не найден"); return; }
      this.ysdk = await window.YaGames.init();

      try { this.player = await this.ysdk.getPlayer({ scopes: false }); }
      catch (e) { console.warn("Игрок не авторизован"); }

      try { this.leaderboards = await this.ysdk.getLeaderboards(); }
      catch (e) { console.warn("Leaderboards недоступны:", e); }

      console.log("Yandex SDK инициализирован");
    } catch (e) {
      console.warn("Ошибка Yandex SDK:", e);
    }
  }

  ready() {
    try { this.ysdk?.features?.LoadingAPI?.ready(); }
    catch (e) { console.warn("LoadingAPI error:", e); }
  }

  async loadData() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) {}
    if (this.player) {
      try {
        const cloud = await this.player.getData();
        if (cloud?.[SAVE_KEY]) return JSON.parse(cloud[SAVE_KEY]);
      } catch (e) { console.warn("Cloud load error:", e); }
    }
    return local;
  }

  async saveData(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
    if (this.player) {
      try { await this.player.setData({ [SAVE_KEY]: JSON.stringify(data) }); }
      catch (e) { console.warn("Cloud save error:", e); }
    }
  }

  async showRewarded() {
    if (!this.ysdk?.adv) { console.log("Rewarded mock"); return { rewarded: true, mock: true }; }
    return new Promise((resolve) => {
      let rewarded = false;
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => {},
          onRewarded: () => { rewarded = true; },
          onClose: () => resolve({ rewarded }),
          onError: (e) => { console.warn(e); resolve({ rewarded: false, error: e }); },
        },
      });
    });
  }

  async showFullscreen() {
    if (!this.ysdk?.adv) { console.log("Fullscreen mock"); return { shown: false, mock: true }; }
    return new Promise((resolve) => {
      let opened = false;
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => { opened = true; },
          onClose: () => resolve({ shown: opened }),
          onError: (e) => resolve({ shown: false, error: e }),
          onOffline: () => resolve({ shown: false, offline: true }),
        },
      });
    });
  }

  getLanguage() { return this.ysdk?.environment?.i18n?.lang || "ru"; }
  isYandex() { return !!this.ysdk; }

  // ============================
  // ЛИДЕРБОРД
  // ============================

  /**
   * Отправить свой результат.
   */
  async submitScore(name, score) {
    if (this.leaderboards) {
      try {
        await this.leaderboards.setLeaderboardScore(name, score);
        return { ok: true };
      } catch (e) {
        console.warn("Leaderboard submit error:", e);
      }
    }
    // Локальный fallback
    return this._submitLocal(name, score);
  }

  /**
   * Получить топ и своё место.
   * Возвращает: { entries: [...], player: {rank, score, name, avatar} | null }
   */
  async getLeaderboard(name, topSize = 10) {
    if (this.leaderboards) {
      try {
        const result = await this.leaderboards.getLeaderboardEntries(name, {
          quantityTop: topSize,
          includeUser: true,
          quantityAround: 0,
        });

        const entries = (result.entries || []).map(e => ({
          rank: e.rank,
          score: e.score,
          name: e.player?.publicName || "Игрок",
          avatar: e.player?.getAvatarSrc?.("small") || null,
          uniqueID: e.player?.uniqueID,
        }));

        let playerRow = null;
        if (result.userRank && result.userRank > 0) {
          // Ищем игрока в общем списке
          const me = entries.find(e => e.rank === result.userRank);
          if (me) playerRow = me;
          else {
            // Игрок не в топе — можно запросить отдельно
            try {
              const my = await this.leaderboards.getLeaderboardPlayerEntry(name);
              playerRow = {
                rank: my.rank,
                score: my.score,
                name: my.player?.publicName || "Ты",
                avatar: my.player?.getAvatarSrc?.("small") || null,
              };
            } catch (e) {}
          }
        }

        return { entries, player: playerRow, source: "yandex" };
      } catch (e) {
        console.warn("Leaderboard get error:", e);
      }
    }
    return this._getLocal(name, topSize);
  }

  // ============================
  // ЛОКАЛЬНЫЙ FALLBACK
  // ============================

  _submitLocal(name, score) {
    const key = `dk_lb_${name}`;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
    // Гость с уникальным ID (сохраняем между сессиями)
    let myId = localStorage.getItem("dk_guest_id");
    if (!myId) {
      myId = "guest_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("dk_guest_id", myId);
    }
    let myName = localStorage.getItem("dk_guest_name");
    if (!myName) {
      myName = "Хранитель " + Math.floor(Math.random() * 9999);
      localStorage.setItem("dk_guest_name", myName);
    }

    const existing = list.findIndex(e => e.uniqueID === myId);
    if (existing >= 0) {
      if (score > list[existing].score) list[existing].score = score;
    } else {
      list.push({ uniqueID: myId, name: myName, score });
    }

    // Добавим фейковых игроков для наполнения (только первый раз)
    if (list.length < 8) {
      const fakeNames = ["Warlord", "Necromage", "Shadow", "Mystic", "Reaper", "Phantom", "Titan", "Frost"];
      for (const n of fakeNames) {
        if (!list.find(e => e.name === n)) {
          list.push({
            uniqueID: "bot_" + n,
            name: n,
            score: Math.max(1, score - Math.floor(Math.random() * 15) - 1)
          });
        }
        if (list.length >= 12) break;
      }
    }

    localStorage.setItem(key, JSON.stringify(list));
    return { ok: true, local: true };
  }

  _getLocal(name, topSize) {
    const key = `dk_lb_${name}`;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}

    list.sort((a, b) => b.score - a.score);

    const myId = localStorage.getItem("dk_guest_id");
    const entries = list.slice(0, topSize).map((e, i) => ({
      rank: i + 1,
      score: e.score,
      name: e.name,
      avatar: null,
      uniqueID: e.uniqueID,
    }));

    let player = null;
    const myIndex = list.findIndex(e => e.uniqueID === myId);
    if (myIndex >= 0) {
      player = {
        rank: myIndex + 1,
        score: list[myIndex].score,
        name: list[myIndex].name,
        avatar: null,
      };
    }
    return { entries, player, source: "local" };
  }
}

export const SDK = new YandexSDKWrapper();