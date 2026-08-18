import { SDK } from "./sdk.js";

class AdManager {
  constructor() {
    this.lastFullscreenAt = 0;
    this.minFullscreenDelay = 65000;
    this._showingRewarded = false;
    this._showingFullscreen = false;
  }

  async showRewarded(scene) {
    if (this._showingRewarded) return { skipped: true };
    this._showingRewarded = true;
    scene?.pauseForAd?.();
    let result;
    try {
      result = await SDK.showRewarded();
    } finally {
      scene?.resumeAfterAd?.();
      this._showingRewarded = false;
    }
    return result;
  }

  async showFullscreen(scene, force = false) {
    if (this._showingFullscreen) return { skipped: true };
    const now = Date.now();
    if (!force && now - this.lastFullscreenAt < this.minFullscreenDelay) {
      return { skipped: true };
    }
    this._showingFullscreen = true;
    scene?.pauseForAd?.();
    let result;
    try {
      result = await SDK.showFullscreen();
    } finally {
      scene?.resumeAfterAd?.();
      this._showingFullscreen = false;
    }
    if (result.shown || result.mock) this.lastFullscreenAt = now;
    return result;
  }
}

export const adManager = new AdManager();