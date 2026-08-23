import { saveManager } from "../saveManager.js";
import { audio } from "../audio.js";
import { createButton, floatText } from "../ui.js";
import {
  QUEST_KIND_META, rewardText, formatTime,
  dailyPeriodKey, weeklyPeriodKey,
} from "../config.js";
import { getQuests, claimQuest, questsReadyCount, exchangeCurrency, EXCHANGE_DEFS } from "../quests.js";
import { achievements } from "../achievements.js";
import { t } from "../i18n.js";

/** Сколько осталось до конца периода (мс). */
function timeLeftPeriod(kind, now = Date.now()) {
  const d = new Date(now);
  if (kind === "weekly") {
    const weekday = (d.getUTCDay() + 6) % 7; // 0 = понедельник
    const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - weekday + 7);
    return end - now;
  }
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return end - now;
}

export class QuestsScene extends Phaser.Scene {
  constructor() { super("QuestsScene"); }

  init(data) { this.returnTo = data?.returnTo || "MenuScene"; this.tab = "daily"; }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#151528");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    this.add.text(270, 40, t("quests_title"), { fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);

    this.currencyText = this.add.text(270, 72, "", { fontFamily: "Arial", fontSize: "14px", color: "#cdd6ff" }).setOrigin(0.5);
    this.refreshCurrency();

    // Табы
    const tabY = 106;
    this.dailyTab = createButton(this, 165, tabY, 150, 36, t("quests_daily"), () => { this.tab = "daily"; this.redraw(); }, { textSize: "14px" });
    this.weeklyTab = createButton(this, 375, tabY, 150, 36, t("quests_weekly"), () => { this.tab = "weekly"; this.redraw(); }, { textSize: "14px" });

    this.cardLayer = this.add.container(0, 0);
    this.redraw();

    this._createExchange();

    createButton(this, 270, 900, 200, 46, t("common_back"), () => this.scene.start(this.returnTo), { textSize: "17px" });

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this._tick() });
    this._tick();
  }

  refreshCurrency() {
    const d = saveManager.data;
    this.currencyText?.setText(`💀 ${d.souls}   💎 ${d.darkCrystals}   🔮 ${d.essence}`);
  }

  _tick() {
    if (this.timerText?.scene) {
      const kind = this.tab;
      this.timerText.setText(t("quests_refreshes", formatTime(timeLeftPeriod(kind))));
    }
  }

  redraw() {
    this.cardLayer.removeAll(true);
    this.dailyTab.setSelected(this.tab === "daily");
    this.weeklyTab.setSelected(this.tab === "weekly");

    const quests = getQuests(this.tab);
    this.timerText = this.add.text(270, 136, "", { fontFamily: "Arial", fontSize: "12px", color: "#8899bb" }).setOrigin(0.5);
    this.cardLayer.add(this.timerText);
    this._tick();

    const y0 = 196;
    quests.forEach((q, i) => {
      const y = y0 + i * 118;
      const meta = QUEST_KIND_META[q.kind] || { icon: "❓", labelKey: "quest_kind_kills" };
      const panel = this.add.rectangle(270, y, 500, 104, q.claimed ? 0x14251a : 0x232344).setStrokeStyle(2, q.ready && !q.claimed ? 0xffd700 : 0x3b4d7d);
      const title = this.add.text(60, y - 30, `${meta.icon} ${t(meta.labelKey)}`, { fontFamily: "Arial", fontSize: "16px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 0.5);
      const reward = this.add.text(60, y - 6, rewardText(q.reward), { fontFamily: "Arial", fontSize: "14px", color: "#ffd700" }).setOrigin(0, 0.5);
      const prog = this.add.text(60, y + 18, t("quest_progress", Math.min(q.current, q.goal), q.goal), { fontFamily: "Arial", fontSize: "14px", color: q.ready ? "#7effa7" : "#aabbcc" }).setOrigin(0, 0.5);

      const barBg = this.add.rectangle(60, y + 40, 220, 8, 0x111122);
      const barFill = this.add.rectangle(60 - 110, y + 40, Math.max(4, 220 * q.progress), 8, q.ready ? 0x57ffb8 : 0x00aaff).setOrigin(0, 0.5);

      this.cardLayer.add([panel, title, reward, prog, barBg, barFill]);

      if (q.claimed) {
        const done = this.add.text(470, y, "✓", { fontFamily: "Arial", fontSize: "26px", color: "#66cc66", fontStyle: "bold" }).setOrigin(0.5);
        this.cardLayer.add(done);
      } else if (q.ready) {
        const btn = createButton(this, 430, y, 110, 46, t("quests_claim"), () => this._claim(q.id), { color: 0x285c3b, hoverColor: 0x31804f, stroke: 0x7effa7, textSize: "14px" });
        this.cardLayer.add([btn.bg, btn.txt]);
      } else {
        const locked = this.add.text(430, y, "⏳", { fontFamily: "Arial", fontSize: "24px" }).setOrigin(0.5);
        this.cardLayer.add(locked);
      }
    });
  }

  _claim(questId) {
    const reward = claimQuest(this.tab, questId);
    if (!reward) { audio.error(); return; }
    audio.purchase();
    floatText(this, 270, 300, rewardText(reward), "#ffff00", 20);
    achievements.checkAll();
    this.refreshCurrency();
    this.redraw();
  }

  _createExchange() {
    const y = 620;
    this.add.text(270, y - 26, t("quests_exchange"), { fontFamily: "Arial", fontSize: "14px", color: "#8899bb" }).setOrigin(0.5);
    EXCHANGE_DEFS.forEach((def, i) => {
      const x = i === 0 ? 165 : 375;
      createButton(this, x, y + 8, 190, 46, t(def.labelKey), () => {
        if (!exchangeCurrency(def.id)) { audio.error(); floatText(this, x, y - 6, t("quests_no_currency"), "#ff8f8f", 14); return; }
        audio.coinCollect();
        floatText(this, x, y - 6, t(def.labelKey), "#7effa7", 15);
        this.refreshCurrency();
      }, { color: 0x3b3b6b, hoverColor: 0x5c5cae, stroke: 0xccccff, textSize: "14px" });
    });
  }

  pauseForAd() {}
  resumeAfterAd() {}
}
