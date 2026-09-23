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

/** Все сцены игры. Ключ каждой обязан быть уникальным — иначе Phaser
 *  бросает «Cannot add a Scene with duplicate key» ещё до старта, и игрок
 *  видит чёрный экран (см. tests/scene-keys.test.js). */
const SCENES = [
  BootScene, PreloaderScene, MenuScene,
  ShopScene, GameScene, EndlessScene,
  DailyScene, WheelScene, QuestsScene,
  TalentsScene, BestiaryScene,
  AchievementsScene, LeaderboardScene,
  SettingsScene,
];

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

/**
 * Чёрный экран не должен быть «тихим»: любую ошибку запуска показываем игроку
 * и пишем в консоль (нужно и для отладки, и для модерации Яндекс Игр).
 */
function showFatalError(err) {
  console.error("Game boot failed:", err);
  try {
    const box = document.getElementById("boot-error");
    if (!box) return;
    box.textContent = `${box.textContent} (${err?.message || err})`;
    box.style.display = "block";
  } catch (e) { /* DOM недоступен — остаётся консоль */ }
}

function startGame() {
  if (typeof Phaser === "undefined") return null;

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
    scene: SCENES,
  });

  bindAudioUnlock();
  bindFocusAudio(game);
  window.game = game;
  return game;
}

// Модуль выполняется как defer — до DOMContentLoaded, но страховка от «load уже
// прошёл» убирает сценарий, при котором игра не стартует вообще (чёрный экран).
if (document.readyState === "complete") {
  try { startGame(); } catch (e) { showFatalError(e); }
} else {
  window.addEventListener("load", () => {
    try { startGame(); } catch (e) { showFatalError(e); }
  });
}
