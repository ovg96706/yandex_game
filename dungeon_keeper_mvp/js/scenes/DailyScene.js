import { saveManager } from "../saveManager.js";
import { adManager } from "../adManager.js";
import { audio } from "../audio.js";
import { createButton, floatText } from "../ui.js";
import {
  DAILY_REWARDS, canClaimDaily, shouldResetStreak,
  timeUntilNextDaily, formatTime,
} from "../config.js";
import { t } from "../i18n.js";

export class DailyScene extends Phaser.Scene {
  constructor() { super("DailyScene"); }

  init(data) { this.returnTo = data?.returnTo || "MenuScene"; }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#151528");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    this.add.text(270, 45, t("daily_title"), {
      fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(270, 78, t("daily_subtitle"), {
      fontFamily: "Arial", fontSize: "13px", color: "#8899bb",
    }).setOrigin(0.5);

    if (shouldResetStreak(saveManager.data)) saveManager.data.dailyStreak = 0;

    this.createRewardGrid();
    this.createStatus();
    this.createClaimBtn();

    createButton(this, 270, 895, 200, 50, t("common_back"),
      () => this.scene.start(this.returnTo),
      { textSize: "18px" });

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateTimer() });
  }

  createRewardGrid() {
    const startY = 130;
    const cardW = 100, cardH = 110;
    const cols = 4, gap = 8;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = 270 - totalW / 2 + cardW / 2;

    const streak = saveManager.data.dailyStreak || 0;
    const currentIndex = streak % DAILY_REWARDS.length;

    for (let i = 0; i < DAILY_REWARDS.length; i++) {
      const reward = DAILY_REWARDS[i];
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      const isClaimed = i < currentIndex;
      const isCurrent = i === currentIndex && canClaimDaily(saveManager.data);

      let bgColor, borderColor;
      if (isClaimed) { bgColor = 0x1a3a1a; borderColor = 0x66aa66; }
      else if (isCurrent) { bgColor = 0x3a3a1a; borderColor = 0xffd700; }
      else { bgColor = 0x1e1e38; borderColor = 0x444466; }

      const bg = this.add.rectangle(x, y, cardW, cardH, bgColor).setStrokeStyle(2, borderColor);
      if (isCurrent) {
        this.tweens.add({ targets: bg, scaleX: 1.05, scaleY: 1.05, yoyo: true, repeat: -1, duration: 700 });
      }

      const dayLabel = reward.day === 7 ? t("daily_day_7") : t("daily_day", reward.day);
      this.add.text(x, y - 40, dayLabel, {
        fontFamily: "Arial", fontSize: "12px",
        color: isClaimed ? "#88bb88" : isCurrent ? "#ffff88" : "#aaaacc",
        fontStyle: "bold",
      }).setOrigin(0.5);

      const icon = reward.day === 7 ? "🎁" : "🪙";
      this.add.text(x, y - 15, icon, { fontFamily: "Arial", fontSize: "24px" }).setOrigin(0.5);

      this.add.text(x, y + 15, `${reward.gold}🪙`, {
        fontFamily: "Arial", fontSize: "12px", color: "#ffd700",
      }).setOrigin(0.5);
      this.add.text(x, y + 32, `${reward.souls}💀`, {
        fontFamily: "Arial", fontSize: "12px", color: "#57ffb8",
      }).setOrigin(0.5);

      if (isClaimed) {
        this.add.text(x + cardW / 2 - 12, y - cardH / 2 + 12, "✓", {
          fontFamily: "Arial", fontSize: "18px", color: "#00ff00", fontStyle: "bold",
        }).setOrigin(0.5);
      }
    }
  }

  createStatus() {
    this.statusText = this.add.text(270, 630, "", {
      fontFamily: "Arial", fontSize: "14px", color: "#aabbcc", align: "center",
    }).setOrigin(0.5);
    this.updateTimer();
  }

  updateTimer() {
    if (!this.statusText || !this.statusText.scene) return;
    if (canClaimDaily(saveManager.data)) {
      this.statusText.setText(t("daily_available"));
      this.statusText.setColor("#7effa7");
    } else {
      this.statusText.setText(t("daily_next_in", formatTime(timeUntilNextDaily(saveManager.data))));
      this.statusText.setColor("#aabbcc");
    }
  }

  createClaimBtn() {
    const canClaim = canClaimDaily(saveManager.data);
    const reward = DAILY_REWARDS[(saveManager.data.dailyStreak || 0) % DAILY_REWARDS.length];

    this.claimBtn = createButton(this, 165, 720, 165, 60,
      canClaim ? t("daily_take_reward", reward.gold, reward.souls) : t("daily_already_taken"),
      () => this.claim(1),
      canClaim
        ? { color: 0x285c3b, hoverColor: 0x31804f, stroke: 0x7effa7, textSize: "14px" }
        : { color: 0x333344, hoverColor: 0x333344, stroke: 0x555566, textSize: "14px" }
    );

    this.x2Btn = createButton(this, 375, 720, 165, 60,
      canClaim ? t("daily_x2_video") : t("daily_wait"),
      async () => {
        if (!canClaimDaily(saveManager.data)) return;
        const res = await adManager.showRewarded(this);
        if (res.rewarded || res.mock) await this.claim(2);
      },
      canClaim
        ? { color: 0x5a40a0, hoverColor: 0x7d5cbf, stroke: 0xb388ff, textSize: "16px" }
        : { color: 0x333344, hoverColor: 0x333344, stroke: 0x555566, textSize: "16px" }
    );
  }

  async claim(multiplier) {
    if (!canClaimDaily(saveManager.data)) { audio.error(); return; }
    const reward = DAILY_REWARDS[(saveManager.data.dailyStreak || 0) % DAILY_REWARDS.length];
    saveManager.data.gold += reward.gold * multiplier;
    saveManager.data.souls += reward.souls * multiplier;
    saveManager.data.dailyStreak = (saveManager.data.dailyStreak || 0) + 1;
    saveManager.data.dailyLastClaimAt = Date.now();
    await saveManager.save();
    audio.purchase(); audio.coinCollect();
    floatText(this, 270, 400,
      `+${reward.gold * multiplier}🪙  +${reward.souls * multiplier}💀`,
      "#ffff00", 26);
    this.time.delayedCall(800, () => this.scene.restart({ returnTo: this.returnTo }));
  }

  pauseForAd() {}
  resumeAfterAd() {}
}