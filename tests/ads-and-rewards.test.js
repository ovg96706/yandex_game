import test from "node:test";
import assert from "node:assert/strict";
import { SDK } from "../dungeon_keeper_mvp/js/sdk.js";
import { adManager } from "../dungeon_keeper_mvp/js/adManager.js";

test("missing production ad SDK never grants a rewarded-video reward", async () => {
  const oldSdk = SDK.ysdk;
  SDK.ysdk = null;
  const result = await SDK.showRewarded();
  assert.deepEqual(result, { rewarded: false, unavailable: true });
  SDK.ysdk = oldSdk;
});

test("ad manager always resumes the scene after an unavailable ad", async () => {
  const oldSdk = SDK.ysdk;
  SDK.ysdk = null;
  let paused = 0, resumed = 0;
  const result = await adManager.showRewarded({ pauseForAd() { paused++; }, resumeAfterAd() { resumed++; } });
  assert.equal(result.rewarded, false);
  assert.equal(paused, 1);
  assert.equal(resumed, 1);
  SDK.ysdk = oldSdk;
});

test("SDK init can be retried after a transient failure", async () => {
  const oldSdk = SDK.ysdk, oldStatus = SDK.status, oldWindow = globalThis.window;
  SDK.ysdk = null; SDK.status = "idle"; SDK._initPromise = null;

  globalThis.window = { YaGames: { init: async () => { throw new Error("network down"); } } };
  assert.equal(await SDK.init(), false);
  assert.equal(SDK.status, "failed");
  assert.equal(SDK.inited, false, "a failed init must not latch the wrapper");

  // Вторая попытка (сеть вернулась) должна реально пройти, а не выйти по флагу.
  globalThis.window = { YaGames: { init: async () => ({ features: {}, getPlayer: async () => null, getLeaderboards: async () => null }) } };
  assert.equal(await SDK.init(), true);
  assert.equal(SDK.status, "ready");

  SDK.ysdk = oldSdk; SDK.status = oldStatus; SDK._initPromise = null; globalThis.window = oldWindow;
});

test("gameplay lifecycle is reported to the platform exactly once per state change", async () => {
  const oldSdk = SDK.ysdk;
  const calls = [];
  SDK.ysdk = { features: { GameplayAPI: { start: () => calls.push("start"), stop: () => calls.push("stop") } } };
  SDK._gameplayActive = false;

  SDK.gameplayStart(); SDK.gameplayStart();
  assert.deepEqual(calls, ["start"], "start must not be re-sent while gameplay is active");
  assert.equal(SDK.gameplayActive, true);
  SDK.gameplayStop(); SDK.gameplayStop();
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal(SDK.gameplayActive, false);

  SDK.ysdk = oldSdk;
});

test("leaderboard submission stays local while scores are client-side", async () => {
  const oldSdk = SDK.ysdk, oldBoards = SDK.leaderboards;
  let platformCalls = 0;
  SDK.ysdk = {}; SDK.leaderboards = { setLeaderboardScore: async () => { platformCalls++; } };
  const store = new Map();
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };

  const res = await SDK.submitScore("maxWave", 999999);
  assert.equal(res.local, true);
  assert.equal(platformCalls, 0, "unverified client score must never reach the platform board");
  const board = await SDK.getLeaderboard("maxWave", 10);
  assert.equal(board.source, "local");

  globalThis.localStorage = oldStorage;
  SDK.ysdk = oldSdk; SDK.leaderboards = oldBoards;
});
