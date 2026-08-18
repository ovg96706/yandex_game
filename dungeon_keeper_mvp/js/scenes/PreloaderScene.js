import { SDK } from "../sdk.js";

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super("PreloaderScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#161625");

    this.add
      .text(270, 380, "Загрузка подземелья", {
        fontFamily: "Arial",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const bg = this.add.rectangle(110, 460, 320, 20, 0x0c0c16).setOrigin(0, 0.5);
    bg.setStrokeStyle(2, 0x00fff5);

    const fill = this.add.rectangle(110, 460, 4, 20, 0x57ffb8).setOrigin(0, 0.5);

    this.tweens.add({
      targets: fill,
      displayWidth: 320,
      duration: 700,
      onComplete: () => {
        SDK.ready();
        this.scene.start("MenuScene");
      },
    });
  }
}