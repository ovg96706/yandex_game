import test from "node:test";
import assert from "node:assert/strict";
import {
  TOOL_DEFS, HERO_TYPES, CHAPTERS,
  getMonsterMaxHP, getHeroAttackDamage, getToolFootprint, getToolSize,
  isFootprintInBounds, validateBoard, getChapterForWave,
} from "../dungeon_keeper_mvp/js/config.js";
import { validateSave, SAVE_VERSION } from "../dungeon_keeper_mvp/js/saveManager.js";

test("monsters have HP that scales with merge level", () => {
  assert.equal(getMonsterMaxHP(TOOL_DEFS.slime, 1), 90);
  assert.equal(getMonsterMaxHP(TOOL_DEFS.slime, 3), 270);
  assert.equal(getMonsterMaxHP(TOOL_DEFS.dragon, 5), 1600);
  // запасное значение, если поле monsterHP не задано
  assert.equal(getMonsterMaxHP({ kind: "monster" }, 2), 160);
});

test("hero attack damage grows with wave; healer never attacks; bosses hit harder", () => {
  assert.equal(getHeroAttackDamage(HERO_TYPES.healer, 50), 0);
  assert.ok(getHeroAttackDamage(HERO_TYPES.warrior, 20) > getHeroAttackDamage(HERO_TYPES.warrior, 1));
  assert.ok(getHeroAttackDamage(HERO_TYPES.king, 30) > getHeroAttackDamage(HERO_TYPES.peasant, 30));
  assert.ok(getHeroAttackDamage(HERO_TYPES.peasant, 1) >= 1);
});

test("dragon footprint covers a 2x2 block anchored at top-left", () => {
  assert.equal(getToolSize(TOOL_DEFS.dragon), 2);
  assert.equal(getToolSize(TOOL_DEFS.spikes), 1);
  assert.deepEqual(getToolFootprint(TOOL_DEFS.dragon, 2, 1), [
    { row: 2, col: 1 }, { row: 2, col: 2 },
    { row: 3, col: 1 }, { row: 3, col: 2 },
  ]);
  assert.deepEqual(getToolFootprint(TOOL_DEFS.spikes, 0, 0), [{ row: 0, col: 0 }]);
});

test("footprint bounds: dragon fits only fully inside the grid", () => {
  assert.ok(isFootprintInBounds(TOOL_DEFS.dragon, 6, 3));  // максимальный якорь
  assert.ok(!isFootprintInBounds(TOOL_DEFS.dragon, 7, 0)); // выходит за низ
  assert.ok(!isFootprintInBounds(TOOL_DEFS.dragon, 0, 4)); // выходит за правый край
  assert.ok(!isFootprintInBounds(TOOL_DEFS.dragon, -1, 0));
  assert.ok(!isFootprintInBounds(TOOL_DEFS.dragon, 0, 0.5)); // нецелые координаты
});

test("board validation: trap+monster combo allowed, same-kind overlaps rejected", () => {
  const board = validateBoard([
    { row: 0, col: 0, type: "spikes", level: 1 },
    { row: 0, col: 0, type: "slime", level: 2 },      // комбо — легально
    { row: 0, col: 0, type: "fire_tile", level: 1 },  // вторая ловушка — отброшена
    { row: 1, col: 1, type: "dragon", level: 1 },     // занимает (1,1),(1,2),(2,1),(2,2)
    { row: 1, col: 2, type: "skeleton", level: 1 },   // пересекается с драконом — отброшена
    { row: 7, col: 4, type: "dragon", level: 1 },     // не помещается — отброшена
    { row: 1, col: 2, type: "poison", level: 1 },     // ловушка под клеткой дракона — легально (свой слот)
  ]);
  const keys = board.map((b) => `${b.row}_${b.col}_${b.type}`).sort();
  assert.deepEqual(keys, ["0_0_slime", "0_0_spikes", "1_1_dragon", "1_2_poison"].sort());
  // kind всегда выводится из definиции, а не из ненадёжных данных
  assert.equal(board.find((b) => b.type === "poison").kind, "trap");
});

test("chapter lookup maps waves to campaign chapters", () => {
  assert.equal(getChapterForWave(1).id, "ch1");
  assert.equal(getChapterForWave(10).id, "ch1");
  assert.equal(getChapterForWave(11).id, "ch2");
  assert.equal(getChapterForWave(25).id, "ch2");
  assert.equal(getChapterForWave(26).id, "ch3");
  assert.equal(getChapterForWave(50).id, "ch3");
  assert.equal(getChapterForWave(51).id, "ch4");
  assert.equal(getChapterForWave(75).id, "ch4");
  assert.equal(getChapterForWave(76).id, "ch5");
  assert.equal(getChapterForWave(500).id, "ch5");
});

test("save v10 validates seenChapters and drops unknown/duplicate ids", () => {
  const save = validateSave({ version: 1, seenChapters: ["ch1", "ch3", "ch1", "fake", 42, null] });
  assert.equal(save.version, SAVE_VERSION);
  assert.deepEqual(save.seenChapters, ["ch1", "ch3"]);
});

test("save v10 keeps a dragon only when its 2x2 footprint fits on the board", () => {
  const ok = validateSave({ board: [{ row: 4, col: 2, type: "dragon", level: 1 }] });
  assert.equal(ok.board.length, 1);
  assert.equal(ok.board[0].type, "dragon");
  const bad = validateSave({ board: [{ row: 7, col: 4, type: "dragon", level: 1 }] });
  assert.equal(bad.board.length, 0);
});

test("all chapter ids referenced by CHAPTERS are unique and ordered by startWave", () => {
  const ids = new Set();
  let prev = 0;
  for (const ch of CHAPTERS) {
    assert.ok(!ids.has(ch.id), `duplicate chapter id ${ch.id}`);
    ids.add(ch.id);
    assert.ok(ch.startWave > prev, "chapters must be sorted by startWave");
    prev = ch.startWave;
    assert.ok(ch.titleKey && ch.storyKey, "chapter must localize title and story");
  }
});
