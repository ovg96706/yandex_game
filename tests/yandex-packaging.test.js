import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLanguage } from "../dungeon_keeper_mvp/js/i18n.js";
import { audio } from "../dungeon_keeper_mvp/js/audio.js";
import { SDK } from "../dungeon_keeper_mvp/js/sdk.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const game = join(root, "dungeon_keeper_mvp");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

test("game archive files have no spaces or cyrillic in paths", () => {
  for (const full of walk(game)) {
    const rel = relative(game, full);
    assert.equal(/\s/.test(rel), false, rel);
    assert.equal(/[А-Яа-яЁё]/.test(rel), false, rel);
  }
});

test("Phaser is vendored and index.html does not use a CDN engine", () => {
  const html = readFileSync(join(game, "index.html"), "utf8");
  assert.match(html, /src="\.\/vendor\/phaser\.min\.js"/);
  assert.doesNotMatch(html, /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/i);
  assert.equal(existsSync(join(game, "vendor", "phaser.min.js")), true);
  const phaser = readFileSync(join(game, "vendor", "phaser.min.js"), "utf8");
  assert.match(phaser, /Phaser/);
  assert.ok(phaser.length > 500_000);
});

test("Yandex SDK is referenced as /sdk.js and is not shipped in the game folder", () => {
  const html = readFileSync(join(game, "index.html"), "utf8");
  assert.match(html, /src="\/sdk\.js"/);
  assert.doesNotMatch(html, /yandex\.ru\/games\/sdk/i);
  assert.equal(existsSync(join(game, "sdk.js")), false);
});

test("resolveLanguage maps Yandex catalog locales to built-in dictionaries", () => {
  assert.equal(resolveLanguage("ru"), "ru");
  assert.equal(resolveLanguage("kk"), "ru");
  assert.equal(resolveLanguage("be-BY"), "ru");
  assert.equal(resolveLanguage("uk"), "ru");
  assert.equal(resolveLanguage("uz"), "ru");
  assert.equal(resolveLanguage("tr"), "tr");
  assert.equal(resolveLanguage("en-US"), "en");
  assert.equal(resolveLanguage("de"), "en");
  assert.equal(resolveLanguage(""), "ru");
});

test("audio suspends on focus loss and resumes once", () => {
  audio._focusSuspended = false;
  audio._musicPlaying = true;
  audio._resumeMusic = false;
  audio.suspendAll();
  audio.suspendAll();
  assert.equal(audio._focusSuspended, true);
  assert.equal(audio._resumeMusic, true);
  assert.equal(audio._musicPlaying, false);
  audio.musicEnabled = false;
  audio.resumeAll();
  audio.resumeAll();
  assert.equal(audio._focusSuspended, false);
});

test("platform pause/resume listeners fire from SDK events", () => {
  const hits = [];
  const off = SDK.onPlatform("pause", () => hits.push("p"));
  SDK.onPlatform("resume", () => hits.push("r"));
  SDK.emitPlatform("pause");
  SDK.emitPlatform("resume");
  off();
  SDK.emitPlatform("pause");
  assert.deepEqual(hits, ["p", "r"]);
});
