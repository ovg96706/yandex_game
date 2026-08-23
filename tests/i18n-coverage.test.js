import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { i18n } from "../dungeon_keeper_mvp/js/i18n.js";
import {
  ACHIEVEMENTS, TOOL_DEFS, HERO_TYPES, TALENTS, TALENT_BRANCHES,
  QUEST_KIND_META, SHOP_UPGRADES, UPGRADE_CATEGORIES, ACHIEVEMENT_CATEGORIES,
  CHAPTERS,
} from "../dungeon_keeper_mvp/js/config.js";

const gameDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dungeon_keeper_mvp", "js");

// Все статические вызовы t("ключ") по коду игры.
function collectStaticKeys() {
  const keys = new Set();
  const dirs = [gameDir, join(gameDir, "scenes")];
  for (const dir of dirs) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".js") || name === "i18n.js") continue;
      const src = readFileSync(join(dir, name), "utf8");
      for (const m of src.matchAll(/\bt\(\s*["']([^"']+)["']/g)) keys.add(m[1]);
    }
  }
  return keys;
}

// Ключи, на которые ссылаются конфиги через labelKey/descKey.
function collectConfigKeys() {
  const keys = new Set();
  const add = (k) => { if (k) keys.add(k); };
  for (const a of ACHIEVEMENTS) { add(a.labelKey); add(a.descKey); }
  for (const d of Object.values(TOOL_DEFS)) { add(d.labelKey); add(d.descKey); }
  for (const h of Object.values(HERO_TYPES)) {
    add(h.labelKey);
    add(`hero_${h.id}_desc`);
  }
  for (const d of Object.values(TALENTS)) { add(d.labelKey); add(d.descKey); }
  for (const b of Object.values(TALENT_BRANCHES)) add(b.labelKey);
  for (const k of Object.values(QUEST_KIND_META)) add(k.labelKey);
  for (const d of Object.values(SHOP_UPGRADES)) { add(d.labelKey); add(d.descKey); }
  for (const c of Object.values(UPGRADE_CATEGORIES)) add(c.labelKey);
  for (const c of Object.values(ACHIEVEMENT_CATEGORIES)) add(c.labelKey);
  for (const c of CHAPTERS) { add(c.titleKey); add(c.storyKey); }
  return keys;
}

test("every statically used i18n key exists in ru, en and tr", () => {
  const staticKeys = collectStaticKeys();
  const configKeys = collectConfigKeys();
  const all = new Set([...staticKeys, ...configKeys]);
  assert.ok(all.size > 100, `suspiciously few keys: ${all.size}`);
  for (const lang of ["ru", "en", "tr"]) {
    const dict = i18n.locales[lang];
    const missing = [...all].filter((k) => dict[k] === undefined);
    assert.deepEqual(missing, [], `missing ${lang} keys`);
  }
});

test("quest period keys differ between daily and weekly scopes", async () => {
  const { dailyPeriodKey, weeklyPeriodKey } = await import("../dungeon_keeper_mvp/js/config.js");
  const now = Date.UTC(2026, 7, 20);
  assert.notEqual(dailyPeriodKey(now), weeklyPeriodKey(now));
});
