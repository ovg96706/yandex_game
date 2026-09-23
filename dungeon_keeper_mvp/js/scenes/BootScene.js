import { SDK } from "../sdk.js";
import { saveManager } from "../saveManager.js";
import { audio } from "../audio.js";
import { i18n, t } from "../i18n.js";

/**
 * Первая сцена: инициализация SDK и автоопределение языка (п. 2.14).
 *
 * Порядок важен для модерации:
 *   1. YaGames.init()  → сразу читаем environment.i18n.lang и включаем локаль
 *      (индикатор 文 на debug-панели должен стать зелёным ещё на экране загрузки);
 *   2. только потом грузим сейв — если игрок когда-то вручную выбрал язык
 *      в настройках, его выбор перекрывает язык платформы (документация это допускает);
 *   3. LoadingAPI.ready() вызывается позже, в PreloaderScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }

  create() {
    this.cameras.main.setBackgroundColor("#1a1a2e");

    // До ответа SDK язык неизвестен — показываем локаль по умолчанию,
    // а как только платформа сообщит язык, эти же объекты перерисуем (см. applyLocale).
    this.statusText = this.add.text(270, 420, t("boot_init"), {
      fontFamily: "Arial", fontSize: "32px", color: "#ffffff",
    }).setOrigin(0.5);

    this.titleText = this.add.text(270, 465, t("boot_title"), {
      fontFamily: "Arial", fontSize: "20px", color: "#9fa8da",
    }).setOrigin(0.5);

    // Инит аудио по первому клику
    this.input.once("pointerdown", () => audio.unlock());

    this.bootPromise = this.initApp();
  }

  /** Перерисовать тексты экрана загрузки на текущем языке. */
  applyLocale() {
    try {
      this.statusText?.setText(t("boot_init"));
      this.titleText?.setText(t("boot_title"));
    } catch (e) { /* сцена могла быть уже остановлена */ }
  }

  async initApp() {
    // Любая ошибка инициализации не должна оставлять игрока на чёрном экране:
    // играем в локальном режиме (сейв — localStorage, язык — браузер).
    try {
      await SDK.init();
    } catch (e) {
      console.warn("SDK.init failed, continuing offline:", e);
    }

    try {
      // Шаг 1 — язык платформы (environment.i18n.lang) применяем немедленно,
      // не дожидаясь облачного сейва: это и есть «автоопределение на старте».
      const platformLang = SDK.getLanguage();
      i18n.init(platformLang);
      this.applyLocale();

      // Шаг 2 — сейв. Явный выбор игрока в настройках имеет приоритет над платформой.
      await saveManager.load();
      const savedLang = saveManager.data.settings?.language;
      if (savedLang && savedLang !== i18n.getLanguage()) {
        i18n.setLanguage(savedLang, false);
        this.applyLocale();
      }

      // Применить аудио настройки
      audio.applySettings(saveManager.data.settings);
    } catch (e) {
      console.error("Boot failed, starting with defaults:", e);
      try { i18n.init(null); } catch (e2) {}
    }

    this.scene.start("PreloaderScene");
  }
}
