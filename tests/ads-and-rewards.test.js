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
