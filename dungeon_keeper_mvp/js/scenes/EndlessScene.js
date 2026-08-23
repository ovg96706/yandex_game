import { GameScene } from "./GameScene.js";

/**
 * Режим «Бездна» (endless): отдельный забег с локальными волной/золотом.
 * Доска кампании не загружается и не сохраняется, награда выдаётся в конце забега,
 * поэтому прерывание забега не даёт экономического эксплойта.
 */
export class EndlessScene extends GameScene {
  constructor() { super("EndlessScene"); }

  init(data) { super.init({ ...(data || {}), mode: "endless" }); }
}
