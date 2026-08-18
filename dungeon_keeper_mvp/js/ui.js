import { audio } from "./audio.js";

export function createButton(scene, x, y, w, h, label, onClick, options = {}) {
  const color = options.color ?? 0x3f3f74;
  const hoverColor = options.hoverColor ?? 0x5858b8;
  const stroke = options.stroke ?? 0x00fff5;
  const textSize = options.textSize ?? "22px";
  const depth = options.depth ?? 0;

  const bg = scene.add.rectangle(x, y, w, h, color)
    .setStrokeStyle(2, stroke)
    .setInteractive({ useHandCursor: true })
    .setDepth(depth);

  const txt = scene.add.text(x, y, label, {
    fontFamily: "Arial", fontSize: textSize, color: "#ffffff",
    align: "center", wordWrap: { width: w - 14 },
  }).setOrigin(0.5).setDepth(depth + 1);

  bg.on("pointerover", () => bg.setFillStyle(hoverColor));
  bg.on("pointerout", () => bg.setFillStyle(color));
  bg.on("pointerdown", () => {
    audio.click();
    scene.tweens.add({ targets: [bg, txt], scaleX: 0.95, scaleY: 0.95, yoyo: true, duration: 50 });
    onClick?.();
  });

  return {
    bg, txt,
    setLabel(v) { txt.setText(v); },
    setVisible(v) { bg.setVisible(v); txt.setVisible(v); },
    setSelected(v) { bg.setStrokeStyle(v ? 3 : 2, v ? 0x57ffb8 : stroke); },
    destroy() { bg.destroy(); txt.destroy(); },
  };
}

/**
 * Всплывающий текст. Использует пул сцены, если он есть.
 */
export function floatText(scene, x, y, text, color = "#ffffff", fontSize = 20) {
  const pool = scene.textPool;
  let t;
  if (pool) {
    t = pool.get();
    t.setPosition(x, y).setText(text).setColor(color).setFontSize(fontSize);
  } else {
    t = scene.add.text(x, y, text, {
      fontFamily: "Arial", fontSize: `${fontSize}px`, color,
      fontStyle: "bold", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9999);
  }

  scene.tweens.add({
    targets: t,
    y: y - 30,
    alpha: 0,
    duration: 700,
    onComplete: () => pool ? pool.release(t) : t.destroy(),
  });
}