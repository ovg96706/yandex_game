import { SAVE_KEY } from "./config.js";

class YandexSDKWrapper {
  constructor() {
    this.ysdk = null;
    this.player = null;
    this.leaderboards = null;
    // "idle" | "initializing" | "ready" | "failed" — после сбоя инициализацию можно повторить.
    this.status = "idle";
    this._initPromise = null;
    this._gameplayActive = false;
    this._eventsBound = false;
    this._platformListeners = { pause: [], resume: [] };
  }

  get inited() { return this.status === "ready"; }

  /**
   * Инициализация SDK. При ошибке состояние возвращается в "failed",
   * поэтому следующий вызов init() пробует ещё раз (аудит №8).
   */
  async init() {
    if (this.status === "ready") return true;
    if (this._initPromise) return this._initPromise;
    this.status = "initializing";
    this._initPromise = (async () => {
      try {
        if (!window.YaGames) { console.warn("YaGames SDK не найден"); this.status = "failed"; return false; }
        this.ysdk = await window.YaGames.init();

        try { this.player = await this.ysdk.getPlayer({ scopes: false }); }
        catch (e) { console.warn("Игрок не авторизован"); }

        try { this.leaderboards = await this.ysdk.getLeaderboards(); }
        catch (e) { console.warn("Leaderboards недоступны:", e); }

        this.status = "ready";
        this._bindPlatformEvents();
        console.log("Yandex SDK инициализирован");
        return true;
      } catch (e) {
        console.warn("Ошибка Yandex SDK:", e);
        this.ysdk = null; this.player = null; this.leaderboards = null;
        this.status = "failed";
        return false;
      } finally {
        this._initPromise = null;
      }
    })();
    return this._initPromise;
  }

  // ============================
  // LIFECYCLE (GameplayAPI)
  // Платформа должна знать, когда идёт активный геймплей: во время рекламы,
  // паузы и сворачивания вкладки его нужно останавливать (аудит №10).
  // ============================

  gameplayStart() {
    if (this._gameplayActive) return;
    this._gameplayActive = true;
    try { this.ysdk?.features?.GameplayAPI?.start?.(); }
    catch (e) { console.warn("GameplayAPI.start error:", e); }
  }

  gameplayStop() {
    if (!this._gameplayActive) return;
    this._gameplayActive = false;
    try { this.ysdk?.features?.GameplayAPI?.stop?.(); }
    catch (e) { console.warn("GameplayAPI.stop error:", e); }
  }

  get gameplayActive() { return this._gameplayActive; }

  /**
   * Платформенные события паузы (реклама, сворачивание, game_api_pause).
   * Подписчики — аудио и игровой цикл, см. main.js.
   */
  onPlatform(event, cb) {
    if (!this._platformListeners) this._platformListeners = { pause: [], resume: [] };
    if (this._platformListeners[event]) this._platformListeners[event].push(cb);
    return () => {
      const list = this._platformListeners?.[event];
      if (!list) return;
      const i = list.indexOf(cb);
      if (i !== -1) list.splice(i, 1);
    };
  }

  emitPlatform(event) {
    const list = this._platformListeners?.[event];
    if (!list) return;
    for (const cb of list) {
      try { cb(); } catch (e) { console.warn("platform listener error:", e); }
    }
  }

  _bindPlatformEvents() {
    if (this._eventsBound || !this.ysdk?.on) return;
    this._eventsBound = true;
    try {
      this.ysdk.on("game_api_pause", () => this.emitPlatform("pause"));
      this.ysdk.on("game_api_resume", () => this.emitPlatform("resume"));
    } catch (e) {
      console.warn("ysdk.on bind error:", e);
    }
  }

  ready() {
    try { this.ysdk?.features?.LoadingAPI?.ready(); }
    catch (e) { console.warn("LoadingAPI error:", e); }
  }

  async loadDataCandidates() {
    let local = null, cloudData = null;
    try { local = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { console.warn("Local save parse error", e); }
    if (this.player) {
      try { const cloud = await this.player.getData(); cloudData = cloud?.[SAVE_KEY] ? JSON.parse(cloud[SAVE_KEY]) : null; }
      catch (e) { console.warn("Cloud load error:", e); }
    }
    return { local, cloud: cloudData };
  }

  async loadData() { const { local, cloud } = await this.loadDataCandidates(); return cloud || local; }

  async saveData(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.warn("Local save error", e); }
    if (this.player) {
      try { await this.player.setData({ [SAVE_KEY]: JSON.stringify(data) }); }
      catch (e) { console.warn("Cloud save error:", e); }
    }
  }

  async showRewarded() {
    if (!this.ysdk?.adv) return { rewarded: false, unavailable: true };
    return new Promise((resolve) => {
      let rewarded = false, settled = false;
      const finish = (result) => { if (!settled) { settled = true; clearTimeout(timeout); resolve(result); } };
      const timeout = setTimeout(() => finish({ rewarded: false, timeout: true }), 45000);
      try {
        this.ysdk.adv.showRewardedVideo({ callbacks: {
          onRewarded: () => { rewarded = true; }, onClose: () => finish({ rewarded }),
          onError: (e) => { console.warn(e); finish({ rewarded: false, error: e }); },
        }});
      } catch (e) { finish({ rewarded: false, error: e }); }
    });
  }

  async showFullscreen() {
    if (!this.ysdk?.adv) return { shown: false, unavailable: true };
    return new Promise((resolve) => {
      let opened = false, settled = false;
      const finish = (result) => { if (!settled) { settled = true; clearTimeout(timeout); resolve(result); } };
      const timeout = setTimeout(() => finish({ shown: false, timeout: true }), 45000);
      try {
        this.ysdk.adv.showFullscreenAdv({ callbacks: {
          onOpen: () => { opened = true; }, onClose: () => finish({ shown: opened }),
          onError: (e) => finish({ shown: false, error: e }), onOffline: () => finish({ shown: false, offline: true }),
        }});
      } catch (e) { finish({ shown: false, error: e }); }
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
    // Результат целиком считается на клиенте, поэтому в глобальную таблицу он не отправляется:
    // без серверной верификации любой игрок может выставить себе любое значение (аудит №3, №6).
    return this._submitLocal(name, score);
  }

  /**
   * Получить топ и своё место (локальная таблица).
   * Возвращает: { entries: [...], player: {rank, score, name, avatar} | null }
   */
  async getLeaderboard(name, topSize = 10) {
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