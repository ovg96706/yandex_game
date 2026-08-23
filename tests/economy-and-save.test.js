import test from "node:test";
import assert from "node:assert/strict";
import { getOfflineIncome, getToolCost, TOOL_DEFS } from "../dungeon_keeper_mvp/js/config.js";
import { validateSave, SAVE_VERSION } from "../dungeon_keeper_mvp/js/saveManager.js";

test("offline income is capped and depends on placed defenses", () => {
  const save = { board: [{}, {}, {}] };
  const eightHours = 8 * 60 * 60 * 1000;
  assert.deepEqual(getOfflineIncome(save, eightHours), { gold: 720, souls: 288, minutes: 480 });
  assert.deepEqual(getOfflineIncome(save, eightHours * 3), { gold: 720, souls: 288, minutes: 480 });
  assert.equal(getOfflineIncome({ board: [] }, eightHours).gold, 0);
});

test("tool price never drops below one gold", () => {
  assert.equal(getToolCost(TOOL_DEFS.spikes, { costDiscount: 0 }), 1);
});

test("save validation rejects invalid board cells and clamps untrusted values", () => {
  const save = validateSave({
    version: 1, wave: -50, gold: 9e99, souls: -10,
    upgrades: { crit_chance: 999 },
    board: [
      { row: 0, col: 0, type: "spikes", level: 99 },
      { row: 0, col: 0, type: "slime", level: 1 },
      { row: 0, col: 0, type: "fire_tile", level: 1 }, // вторая ловушка в клетке — отбрасывается
      { row: 8, col: 1, type: "spikes", level: 1 },     // вне сетки
      { row: 1, col: 1, type: "not-real", level: 1 },   // неизвестный тип
    ],
  });
  assert.equal(save.version, SAVE_VERSION);
  assert.equal(save.wave, 1);
  assert.equal(save.souls, 0);
  assert.equal(save.upgrades.crit_chance, 20);
  // Комбо «ловушка + монстр» в одной клетке теперь легально (save v10).
  assert.equal(save.board.length, 2);
  assert.equal(save.board[0].level, 5); // уровень зажат до MAX_MERGE_LEVEL
  const kinds = save.board.map((b) => b.kind).sort();
  assert.deepEqual(kinds, ["monster", "trap"]);
});
