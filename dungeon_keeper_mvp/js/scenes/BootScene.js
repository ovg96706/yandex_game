import { SDK } from "../sdk.js";
import { saveManager } from "../saveManager.js";
import { audio } from "../audio.js";
import { i18n } from "../i18n.js";

export class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }

  create() {
    this.cameras.main.setBackgroundColor("#1a1a2e");

    this.add.text(270, 420, "Инициализация...", {
      fontFamily: "Arial", fontSize: "32px", color: "#ffffff",
    }).setOrigin(0.5);

    this.add.text(270, 465, "Хранитель Подземелья", {
      fontFamily: "Arial", fontSize: "20px", color: "#9fa8da",
    }).setOrigin(0.5);

    // Инит аудио по первому клику
    this.input.once("pointerdown", () => audio.unlock());

    this.initApp();
  }

  async initApp() {
    await SDK.init();
    await saveManager.load();

    // Язык: сохранённый или из SDK
    const savedLang = saveManager.data.settings?.language;
    const sdkLang = SDK.getLanguage();
    const lang = savedLang || sdkLang || "ru";
    i18n.init(lang);

    // Применить аудио настройки
    audio.applySettings(saveManager.data.settings);

    this.scene.start("PreloaderScene");
  }
}