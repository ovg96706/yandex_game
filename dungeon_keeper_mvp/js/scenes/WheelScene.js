import { saveManager } from "../saveManager.js";
import { adManager } from "../adManager.js";
import { audio } from "../audio.js";
import { createButton } from "../ui.js";
import {
  WHEEL_SECTORS, canSpinWheelFree, timeUntilNextFreeSpin,
  pickWheelSector, formatTime,
} from "../config.js";
import { t } from "../i18n.js";

export class WheelScene extends Phaser.Scene {
  constructor() { super("WheelScene"); }

  init(data) { this.returnTo = data?.returnTo || "MenuScene"; }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#151528");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);
    this.spinning = false;

    this.add.text(270, 45, t("wheel_title"), {
      fontFamily: "Arial", fontSize: "26px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(270, 78, t("wheel_subtitle"), {
      fontFamily: "Arial", fontSize: "13px", color: "#8899bb",
    }).setOrigin(0.5);

    this.createWheel();
    this.createPointer();
    this.createStatus();
    this.createSpinButtons();

    createButton(this, 270, 895, 200, 50, t("common_back"), () => {
      if (this.spinning) return;
      this.scene.start(this.returnTo);
    }, { textSize: "18px" });

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateTimer() });
  }

  createWheel() {
    const cx = 270, cy = 400, r = 160;
    this.wheelCenter = { x: cx, y: cy, r };

    this.add.circle(cx, cy, r + 18, 0x2a2a44).setStrokeStyle(4, 0xffd700);
    this.wheelContainer = this.add.container(cx, cy);

    const n = WHEEL_SECTORS.length;
    const arc = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const sector = WHEEL_SECTORS[i];
      const startA = i * arc - Math.PI / 2;
      const endA = startA + arc;

      const g = this.add.graphics();
      g.fillStyle(sector.color, 1);
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, startA, endA); g.closePath(); g.fillPath();
      g.lineStyle(2, 0x000000, 0.6); g.strokePath();

      const midA = (startA + endA) / 2;
      const tx = Math.cos(midA) * (r * 0.6);
      const ty = Math.sin(midA) * (r * 0.6);
      const txt = this.add.text(tx, ty, sector.label, {
        fontFamily: "Arial", fontSize: "13px", color: "#ffffff", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5);
      txt.setRotation(midA + Math.PI / 2);

      this.wheelContainer.add([g, txt]);
    }

    this.add.circle(cx, cy, 20, 0x1a1a2e).setStrokeStyle(3, 0xffd700);
    this.add.text(cx, cy, "🎡", { fontFamily: "Arial", fontSize: "22px" }).setOrigin(0.5);
  }

  createPointer() {
    const { x, y, r } = this.wheelCenter;
    const pg = this.add.graphics();
    pg.fillStyle(0xff3333, 1);
    pg.fillTriangle(x - 12, y - r - 20, x + 12, y - r - 20, x, y - r + 4);
    pg.lineStyle(2, 0xffffff, 1);
    pg.strokeTriangle(x - 12, y - r - 20, x + 12, y - r - 20, x, y - r + 4);
  }

  createStatus() {
    this.statusText = this.add.text(270, 620, "", {
      fontFamily: "Arial", fontSize: "14px", color: "#aabbcc", align: "center",
    }).setOrigin(0.5);
    this.updateTimer();
  }

  updateTimer() {
    if (!this.statusText || !this.statusText.scene) return;
    if (canSpinWheelFree(saveManager.data)) {
      this.statusText.setText(t("wheel_free_available"));
      this.statusText.setColor("#7effa7");
    } else {
      this.statusText.setText(t("wheel_next_free", formatTime(timeUntilNextFreeSpin(saveManager.data))));
      this.statusText.setColor("#aabbcc");
    }
  }

  createSpinButtons() {
    const canFree = canSpinWheelFree(saveManager.data);

    this.freeBtn = createButton(this, 165, 700, 165, 60,
      canFree ? t("wheel_free") : t("wheel_wait"),
      () => this.spin(false),
      canFree
        ? { color: 0x285c3b, hoverColor: 0x31804f, stroke: 0x7effa7, textSize: "16px" }
        : { color: 0x333344, hoverColor: 0x333344, stroke: 0x555566, textSize: "16px" });

    this.adBtn = createButton(this, 375, 700, 165, 60, t("wheel_ad_spin"),
      () => this.spin(true),
      { color: 0x5a40a0, hoverColor: 0x7d5cbf, stroke: 0xb388ff, textSize: "14px" });

    this.spinsCountText = this.add.text(270, 770,
      t("wheel_total_spins", saveManager.data.wheelTotalSpins || 0), {
      fontFamily: "Arial", fontSize: "12px", color: "#8899bb",
    }).setOrigin(0.5);
  }

  async spin(useAd) {
    if (this.spinning) return;
    if (useAd) {
      const res = await adManager.showRewarded(this);
      if (!res?.rewarded) return;
    } else {
      if (!canSpinWheelFree(saveManager.data)) { audio.error(); return; }
      saveManager.data.wheelLastFreeSpinAt = Date.now();
    }
    this.spinning = true;
    this._disableButtons();

    const { sector, index } = pickWheelSector();
    const n = WHEEL_SECTORS.length;
    const arc = 360 / n;
    const targetAngle = -(index * arc + arc / 2);
    const finalRotation = 5 * 360 + targetAngle;
    const jitter = (Math.random() - 0.5) * (arc * 0.6);

    audio.waveStart();

    this.tweens.add({
      targets: this.wheelContainer,
      angle: finalRotation + jitter,
      duration: 4500,
      ease: "Cubic.easeOut",
      onUpdate: () => this._maybeTick(),
      onComplete: () => { this.spinning = false; this.applyReward(sector); },
    });
  }

  _maybeTick() {
    const now = performance.now();
    if (!this._lastTick || now - this._lastTick > 90) {
      audio.click();
      this._lastTick = now;
    }
  }

  applyReward(sector) {
    const parts = [];
    if (sector.gold) { saveManager.data.gold += sector.gold; parts.push(`+${sector.gold}🪙`); }
    if (sector.souls) { saveManager.data.souls += sector.souls; parts.push(`+${sector.souls}💀`); }
    if (sector.crystalHP) {
      saveManager.data.crystalHP = Math.min(saveManager.data.maxCrystalHP, saveManager.data.crystalHP + sector.crystalHP);
      parts.push(`+${sector.crystalHP}❤️`);
    }
    if (sector.darkCrystals) {
      saveManager.grantReward({ darkCrystals: sector.darkCrystals });
      parts.push(`+${sector.darkCrystals}💎`);
    }
    saveManager.data.wheelTotalSpins = (saveManager.data.wheelTotalSpins || 0) + 1;
    saveManager.save();
    audio.levelUp();
    if (sector.id === "jackpot") this.cameras.main.shake(400, 0.01);
    this._showRewardPopup(sector, parts.join("  "));
  }

  _showRewardPopup(sector, text) {
    const D = 500;
    const overlay = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.7).setInteractive().setDepth(D);
    const panel = this.add.rectangle(270, 440, 400, 260, 0x242448).setStrokeStyle(3, sector.color).setDepth(D + 1);

    const title = this.add.text(270, 350,
      sector.id === "jackpot" ? t("wheel_jackpot") : t("wheel_reward"),
      { fontFamily: "Arial", fontSize: "26px", color: "#ffd700", fontStyle: "bold", stroke: "#000000", strokeThickness: 3 }
    ).setOrigin(0.5).setDepth(D + 2);

    const rewardText = this.add.text(270, 420, text, {
      fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold", align: "center",
    }).setOrigin(0.5).setDepth(D + 2);

    this.tweens.add({ targets: rewardText, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: 3, duration: 250 });

    const okBtn = createButton(this, 270, 520, 200, 50, t("common_ok"), () => {
      overlay.destroy(); panel.destroy(); title.destroy(); rewardText.destroy(); okBtn.destroy();
      this.scene.restart({ returnTo: this.returnTo });
    }, { color: 0x285c3b, hoverColor: 0x31804f, stroke: 0x7effa7, textSize: "18px", depth: D + 3 });
  }

  _disableButtons() {
    if (this.freeBtn) this.freeBtn.bg.disableInteractive();
    if (this.adBtn) this.adBtn.bg.disableInteractive();
  }

  pauseForAd() {}
  resumeAfterAd() {}
}