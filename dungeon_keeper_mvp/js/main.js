import { GAME_CONFIG } from "./config.js";
import { BootScene } from "./scenes/BootScene.js";
import { PreloaderScene } from "./scenes/PreloaderScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { ShopScene } from "./scenes/ShopScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { DailyScene } from "./scenes/DailyScene.js";
import { WheelScene } from "./scenes/WheelScene.js";
import { AchievementsScene } from "./scenes/AchievementsScene.js";
import { LeaderboardScene } from "./scenes/LeaderboardScene.js";
import { SettingsScene } from "./scenes/SettingsScene.js";

window.addEventListener("load", () => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_CONFIG.width,
    height: GAME_CONFIG.height,
    backgroundColor: GAME_CONFIG.backgroundColor,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
      BootScene, PreloaderScene, MenuScene,
      ShopScene, GameScene,
      DailyScene, WheelScene,
      AchievementsScene, LeaderboardScene,
      SettingsScene,
    ],
  });
});