import { audio } from "./audio.js";
import { t } from "./i18n.js";
import { achLabel } from "./config.js";

export function showAchievementToast(scene, ach) {
  const D = 10000;
  const w = 340, h = 78;
  const startY = -50, targetY = 100;

  const container = scene.add.container(270, startY).setDepth(D);
  const bg = scene.add.rectangle(0, 0, w, h, 0x1a3a1a).setStrokeStyle(3, 0xffd700);
  const glow = scene.add.rectangle(0, 0, w + 4, h + 4, 0xffd700, 0.25);

  const icon = scene.add.circle(-w / 2 + 30, 0, 22, 0x2b5c3c).setStrokeStyle(2, 0xffd700);
  const iconText = scene.add.text(-w / 2 + 30, 0, ach.icon, {
    fontFamily: "Arial", fontSize: "22px",
  }).setOrigin(0.5);

  const title = scene.add.text(-w / 2 + 60, -18, t("ach_popup_title"), {
    fontFamily: "Arial", fontSize: "12px", color: "#ffd700", fontStyle: "bold",
  }).setOrigin(0, 0.5);

  // ← локализованное имя достижения
  const name = scene.add.text(-w / 2 + 60, -2, achLabel(ach), {
    fontFamily: "Arial", fontSize: "15px", color: "#ffffff", fontStyle: "bold",
  }).setOrigin(0, 0.5);

  const reward = ach.reward
    ? [ach.reward.gold ? `+${ach.reward.gold}🪙` : null, ach.reward.souls ? `+${ach.reward.souls}💀` : null]
        .filter(Boolean).join("  ")
    : "";

  const rewardText = scene.add.text(-w / 2 + 60, 18, reward, {
    fontFamily: "Arial", fontSize: "12px", color: "#7effa7", fontStyle: "bold",
  }).setOrigin(0, 0.5);

  container.add([glow, bg, icon, iconText, title, name, rewardText]);

  scene.tweens.add({ targets: container, y: targetY, duration: 400, ease: "Back.easeOut" });
  scene.tweens.add({ targets: glow, alpha: 0.05, yoyo: true, repeat: 3, duration: 300 });

  scene.time.delayedCall(3500, () => {
    scene.tweens.add({
      targets: container, y: startY, alpha: 0,
      duration: 400, ease: "Back.easeIn",
      onComplete: () => container.destroy(true),
    });
  });

  audio.levelUp();
}