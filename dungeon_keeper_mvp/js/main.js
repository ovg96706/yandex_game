import { GAME_CONFIG } from "./config.js";
import { BootScene } from "./scenes/BootScene.js";
import { PreloaderScene } from "./scenes/PreloaderScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { ShopScene } from "./scenes/ShopScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { EndlessScene } from "./scenes/EndlessScene.js";
import { DailyScene } from "./scenes/DailyScene.js";
import { WheelScene } from "./scenes/WheelScene.js";
import { QuestsScene } from "./scenes/QuestsScene.js";
import { TalentsScene } from "./scenes/TalentsScene.js";
import { BestiaryScene } from "./scenes/BestiaryScene.js";
import { AchievementsScene } from "./scenes/AchievementsScene.js";
import { LeaderboardScene } from "./scenes/LeaderboardScene.js";
import { SettingsScene } from "./scenes/SettingsScene.js";
import { audio } from "./audio.js";
import { SDK } from "./sdk.js";

function bindAudioUnlock() {
  const unlock = () => { audio.unlock(); };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function bindFocusAudio(game) {
  const pause = () => {
    audio.suspendAll();
    try { game?.loop?.sleep?.(); } catch (e) {}
  };
  const resume = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    audio.resumeAll();
    try { game?.loop?.wake?.(); } catch (e) {}
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else resume();
  });
  window.addEventListener("blur", pause);
  window.addEventListener("focus", resume);
  SDK.onPlatform("pause", pause);
  SDK.onPlatform("resume", resume);
}

window.addEventListener("load", () => {
  if (typeof Phaser === "undefined") return;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_CONFIG.width,
    height: GAME_CONFIG.height,
    backgroundColor: GAME_CONFIG.backgroundColor,
    banner: false,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
      BootScene, PreloaderScene, MenuScene,
      ShopScene, GameScene, EndlessScene,
      DailyScene, WheelScene, QuestsScene,
      TalentsScene, BestiaryScene,
      AchievementsScene, LeaderboardScene,
      SettingsScene,
    ],
  });

  bindFocusAudio(game);
});
