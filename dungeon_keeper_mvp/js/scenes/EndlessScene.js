import { GameScene } from "./GameScene.js";

/**
 * Режим «Бездна» (endless): отдельный забег с локальными волной/золотом.
 * Доска кампании не загружается и не сохраняется, награда выдаётся в конце забега,
 * поэтому прерывание забега не даёт экономического эксплойта.
 */
export class EndlessScene extends GameScene {
  // Ключ доходит до Phaser.Scene только потому, что конструктор GameScene принимает
  // параметр (constructor(key = "GameScene")). С конструктором без параметров
  // super("EndlessScene") терялся бы, обе сцены получали ключ "GameScene", и Phaser
  // прерывал загрузку с "Cannot add a Scene with duplicate key" → чёрный экран.
  constructor() { super("EndlessScene"); }

  init(data) { super.init({ ...(data || {}), mode: "endless" }); }
}
