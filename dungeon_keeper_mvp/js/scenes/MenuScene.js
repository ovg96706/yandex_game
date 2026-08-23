import { saveManager } from "../saveManager.js";
import { SDK } from "../sdk.js";
import { createButton } from "../ui.js";
import { canClaimDaily, canSpinWheelFree, shouldResetStreak, ACHIEVEMENTS, getOfflineIncome, ENDLESS, getChapterForWave } from "../config.js";
import { achievements } from "../achievements.js";
import { questsReadyCount, ensureQuests } from "../quests.js";
import { audio } from "../audio.js";
import { t } from "../i18n.js";

export class MenuScene extends Phaser.Scene {
  constructor() { super("MenuScene"); }

  create() {
    this.cameras.main.setBackgroundColor("#111122");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    for (let i = 0; i < 20; i++) {
      this.add.circle(Phaser.Math.Between(30, 510), Phaser.Math.Between(40, 920), Phaser.Math.Between(2, 5), 0x2d3f6b, 0.5);
    }

    ensureQuests();

    if (shouldResetStreak(saveManager.data)) {
      saveManager.data.dailyStreak = 0;
      saveManager.save();
    }

    // Offline income is granted once on returning to the menu, then immediately timestamped.
    const offline = getOfflineIncome(saveManager.data, Date.now() - (saveManager.data.offlineLastAt || Date.now()));
    if (offline.gold || offline.souls) {
      saveManager.data.gold += offline.gold;
      saveManager.data.souls += offline.souls;
      saveManager.save();
      this.time.delayedCall(250, () => this._showOfflineReward(offline));
    } else {
      saveManager.data.offlineLastAt = Date.now();
      saveManager.saveThrottled();
    }

    // Запуск музыки (если включена)
    audio.ensure();
    audio.startMusic();

    // Кристалл-декор
    const crystal = this.add.rectangle(270, 152, 44, 44, 0x00fff5).setAngle(45).setAlpha(0.85);
    this.tweens.add({ targets: crystal, scaleX: 1.08, scaleY: 1.08, alpha: 1, yoyo: true, repeat: -1, duration: 1200, ease: "Sine.easeInOut" });

    // Заголовок
    this.add.text(270, 66, t("menu_title"), {
      fontFamily: "Arial", fontSize: "28px", color: "#ffffff", align: "center", fontStyle: "bold",
    }).setOrigin(0.5);

    // Подзаголовок
    this.add.text(270, 200, t("menu_subtitle"), {
      fontFamily: "Arial", fontSize: "13px", color: "#b8c1ec", align: "center",
      wordWrap: { width: 500 },
    }).setOrigin(0.5);

    // Статистика
    const d = saveManager.data;
    const chapter = getChapterForWave(d.wave);
    this.add.text(270, 244, [
      `📜 ${t(chapter.titleKey)}`,
      `${t("menu_wave")}: ${d.wave}   ${t("menu_maxWave")}: ${d.stats?.maxWave || 0}`,
      `🪙 ${d.gold}   💀 ${d.souls}   💎 ${d.darkCrystals}   🔮 ${d.essence}`,
      `${t("menu_hp")}: ${d.crystalHP}/${d.maxCrystalHP}`,
    ].join("\n"), { fontFamily: "Arial", fontSize: "13px", color: "#ffffff", align: "center", lineSpacing: 4 }).setOrigin(0.5);

    // Иконка настроек (правый верхний угол)
    createButton(this, 495, 35, 50, 44, "⚙️", () => {
      this.scene.start("SettingsScene", { returnTo: "MenuScene" });
    }, { textSize: "22px", color: 0x333355, hoverColor: 0x555588, stroke: 0x8899cc });

    // Кнопки
    const btnW = 260;
    let btnY = 340;
    const step = () => { const y = btnY; btnY += 47; return y; };

    createButton(this, 270, step(), btnW, 42, t("menu_play"), () => this.scene.start("GameScene"), { textSize: "17px" });

    const dailyReady = canClaimDaily(saveManager.data);
    const dailyBtn = createButton(this, 270, step(), btnW, 42, t("menu_daily") + (dailyReady ? "  •" : ""),
      () => this.scene.start("DailyScene", { returnTo: "MenuScene" }),
      dailyReady
        ? { color: 0x3b5c2d, hoverColor: 0x5a8040, stroke: 0x88ffaa, textSize: "14px" }
        : { color: 0x2d3b5c, hoverColor: 0x405a80, stroke: 0x7799cc, textSize: "14px" });
    if (dailyReady) this._badge(dailyBtn.bg.x + 100, dailyBtn.bg.y - 14);

    const wheelReady = canSpinWheelFree(saveManager.data);
    const wheelBtn = createButton(this, 270, step(), btnW, 42, t("menu_wheel") + (wheelReady ? "  •" : ""),
      () => this.scene.start("WheelScene", { returnTo: "MenuScene" }),
      wheelReady
        ? { color: 0x5c3b2d, hoverColor: 0x805540, stroke: 0xffaa88, textSize: "14px" }
        : { color: 0x2d3b5c, hoverColor: 0x405a80, stroke: 0x7799cc, textSize: "14px" });
    if (wheelReady) this._badge(wheelBtn.bg.x + 100, wheelBtn.bg.y - 14);

    const questReady = questsReadyCount();
    const questBtn = createButton(this, 270, step(), btnW, 42, t("menu_quests") + (questReady > 0 ? ` (${questReady})` : ""),
      () => this.scene.start("QuestsScene", { returnTo: "MenuScene" }),
      questReady > 0
        ? { color: 0x5c4a2d, hoverColor: 0x806a40, stroke: 0xffdd88, textSize: "14px" }
        : { color: 0x2d3b5c, hoverColor: 0x405a80, stroke: 0x7799cc, textSize: "14px" });
    if (questReady > 0) this._badge(questBtn.bg.x + 100, questBtn.bg.y - 14);

    createButton(this, 165, btnY, 125, 42, t("menu_talents"),
      () => this.scene.start("TalentsScene", { returnTo: "MenuScene" }),
      { color: 0x3b2d5e, hoverColor: 0x5a40a0, stroke: 0xb388ff, textSize: "13px" });
    createButton(this, 375, btnY, 125, 42, t("menu_bestiary"),
      () => this.scene.start("BestiaryScene", { returnTo: "MenuScene" }),
      { color: 0x1f4444, hoverColor: 0x2d6666, stroke: 0x66dddd, textSize: "13px" });
    btnY += 47;

    const readyCount = ACHIEVEMENTS.filter(a => !achievements.isUnlocked(a.id) && achievements.getProgress(a).completed).length;
    const achBtn = createButton(this, 270, step(), btnW, 42, t("menu_achievements") + (readyCount > 0 ? "  •" : ""),
      () => this.scene.start("AchievementsScene", { returnTo: "MenuScene" }),
      { color: 0x3b3b6b, hoverColor: 0x5c5cae, stroke: 0xccccff, textSize: "14px" });
    if (readyCount > 0) this._badge(achBtn.bg.x + 100, achBtn.bg.y - 14);

    // ♾ Бездна — открывается после волны 30 кампании.
    const endlessUnlocked = (d.stats?.maxWave || 0) >= ENDLESS.unlockMaxWave;
    createButton(this, 270, step(), btnW, 42,
      endlessUnlocked ? t("menu_endless") : t("menu_endless_locked", ENDLESS.unlockMaxWave),
      () => { if (endlessUnlocked) this.scene.start("EndlessScene", { mode: "endless" }); else audio.error(); },
      endlessUnlocked
        ? { color: 0x442d5c, hoverColor: 0x604080, stroke: 0xcc88ff, textSize: "14px" }
        : { color: 0x26263a, hoverColor: 0x26263a, stroke: 0x444460, textSize: "13px" });

    createButton(this, 270, step(), btnW, 42, t("menu_leaderboard"),
      () => this.scene.start("LeaderboardScene", { returnTo: "MenuScene" }),
      { color: 0x2d5c5c, hoverColor: 0x408080, stroke: 0x88eecc, textSize: "14px" });

    createButton(this, 270, step(), btnW, 42, t("menu_shop"),
      () => this.scene.start("ShopScene"),
      { color: 0x3b2d5e, hoverColor: 0x5a40a0, stroke: 0xb388ff, textSize: "14px" });

    createButton(this, 270, step(), btnW, 36, t("menu_reset"), async () => {
      if (!confirm(t("menu_confirm_reset"))) return;
      await saveManager.reset();
      this.scene.restart();
    }, { color: 0x444466, hoverColor: 0x606088, stroke: 0x9999cc, textSize: "12px" });

    createButton(this, 270, step(), btnW, 30, t("menu_hardReset"), async () => {
      if (!confirm(t("menu_confirm_hardReset"))) return;
      await saveManager.hardReset();
      // Сброс настроек должен сразу применяться к живому AudioManager (аудит №24).
      audio.applySettings(saveManager.data.settings);
      this.scene.restart();
    }, { color: 0x5c2b2b, hoverColor: 0x7d3939, stroke: 0xff8a8a, textSize: "11px" });

    // Инфо
    this.add.text(270, 925,
      `${SDK.isYandex() ? t("menu_sdk_yandex") : t("menu_sdk_local")}`, {
        fontFamily: "Arial", fontSize: "11px", color: "#6b7b9e", align: "center",
      }).setOrigin(0.5);
  }

  _badge(x, y) {
    const badge = this.add.circle(x, y, 8, 0xff3333).setStrokeStyle(2, 0xffffff);
    this.add.text(x, y, "!", { fontFamily: "Arial", fontSize: "11px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.tweens.add({ targets: badge, scaleX: 1.3, scaleY: 1.3, yoyo: true, repeat: -1, duration: 500 });
  }

  _showOfflineReward(reward) {
    const d = 900;
    const overlay = this.add.rectangle(270, 480, 540, 960, 0x000000, .72).setInteractive().setDepth(d);
    const panel = this.add.rectangle(270, 440, 400, 230, 0x242448).setStrokeStyle(3, 0x57ffb8).setDepth(d + 1);
    const title = this.add.text(270, 365, t("offline_title"), { fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold" }).setOrigin(.5).setDepth(d + 2);
    const text = this.add.text(270, 430, t("offline_body", reward.minutes, reward.gold, reward.souls), { fontFamily: "Arial", fontSize: "18px", color: "#7effa7", align: "center" }).setOrigin(.5).setDepth(d + 2);
    const ok = createButton(this, 270, 520, 180, 48, t("common_ok"), () => { overlay.destroy(); panel.destroy(); title.destroy(); text.destroy(); ok.destroy(); }, { depth: d + 3, textSize: "16px" });
  }
}
