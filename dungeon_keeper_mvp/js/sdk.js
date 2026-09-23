import { SAVE_KEY } from "./config.js";

class YandexSDKWrapper {
  constructor() {
    this.ysdk = null;
    this.player = null;
    this.leaderboards = null;
    // Код языка платформы (ISO 639-1), прочитанный из environment.i18n.lang сразу после init (п. 2.14).
    this.lang = null;
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

        // п. 2.14: язык читаем СРАЗУ после YaGames.init() — до getPlayer/getLeaderboards/облака,
        // которые могут занимать секунды. Обращение к environment.i18n.lang и есть то, что
        // debug-панель засчитывает как «I18N is used», поэтому оно должно быть безусловным.
        this.lang = this._readPlatformLanguage();

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
        this.ysdk = null; this.player = null; this.leaderboards = null; this.lang = null;
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

  _readPlatformLanguage() {
    try {
      const lang = this.ysdk?.environment?.i18n?.lang;
      return typeof lang === "string" && lang ? lang : null;
    } catch (e) {
      console.warn("environment.i18n.lang недоступен:", e);
      return null;
    }
  }

  /**
   * Язык пользователя (п. 2.14). Приоритет:
   *   1) environment.i18n.lang платформы (прочитан при init);
   *   2) язык браузера — только вне Яндекс Игр (локальный запуск / SDK не поднялся);
   *   3) "ru".
   * Приведение к встроенным локалям (ru/en/tr + резервный набор) делает i18n.resolveLanguage().
   */
  getLanguage() {
    if (this.lang) return this.lang;
    const live = this._readPlatformLanguage();
    if (live) { this.lang = live; return live; }
    if (typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language) {
      return navigator.language;
    }
    return "ru";
  }

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
    const guestNo = this._guestNumber();

    const existing = list.findIndex(e => e.uniqueID === myId);
    if (existing >= 0) {
      if (score > list[existing].score) list[existing].score = score;
      list[existing].guestNo = guestNo;
      delete list[existing].name; // старые записи хранили готовую строку на русском
    } else {
      list.push({ uniqueID: myId, guestNo, score });
    }

    localStorage.setItem(key, JSON.stringify(list));
    return { ok: true, local: true };
  }

  /**
   * Номер гостя для локальной таблицы. Храним только число — сама подпись
   * («Хранитель 1234» / «Keeper 1234» / «Bekçi 1234») собирается через i18n при отрисовке,
   * иначе в EN/TR-интерфейсе всплывал бы русский текст (п. 2.14 / 8.2.3).
   */
  _guestNumber() {
    let no = parseInt(localStorage.getItem("dk_guest_no") || "", 10);
    if (!Number.isFinite(no)) {
      // Миграция: у старых игроков номер зашит в строку dk_guest_name.
      const legacy = /(\d+)\s*$/.exec(localStorage.getItem("dk_guest_name") || "");
      no = legacy ? parseInt(legacy[1], 10) : Math.floor(Math.random() * 9999);
      localStorage.setItem("dk_guest_no", String(no));
    }
    return no;
  }

  _getLocal(name, topSize) {
    const key = `dk_lb_${name}`;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}

    list.sort((a, b) => b.score - a.score);

    const myId = localStorage.getItem("dk_guest_id");
    // name отдаём только для записей платформы; локальный гость — guestNo,
    // подпись локализует сцена (t("lb_guest_name", guestNo)).
    const guestNoOf = (e) => {
      if (Number.isFinite(e.guestNo)) return e.guestNo;
      const legacy = /(\d+)\s*$/.exec(e.name || ""); // старый формат: «Хранитель 1234»
      return legacy ? parseInt(legacy[1], 10) : null;
    };
    const entries = list.slice(0, topSize).map((e, i) => ({
      rank: i + 1,
      score: e.score,
      name: null,
      guestNo: guestNoOf(e),
      avatar: null,
      uniqueID: e.uniqueID,
    }));

    let player = null;
    const myIndex = list.findIndex(e => e.uniqueID === myId);
    if (myIndex >= 0) {
      player = {
        rank: myIndex + 1,
        score: list[myIndex].score,
        name: null,
        guestNo: guestNoOf(list[myIndex]),
        avatar: null,
      };
    }
    return { entries, player, source: "local" };
  }
}

export const SDK = new YandexSDKWrapper();