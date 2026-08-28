// ============================================================
// Аудио-менеджер с раздельной громкостью для SFX и музыки
// ============================================================

class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;

    // Настройки
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.sfxVolume = 0.8;   // 0..1
    this.musicVolume = 0.4; // 0..1

    // Ноды громкости
    this.sfxGain = null;
    this.musicGain = null;

    // Троттлинг звуков
    this.lastPlayTimes = Object.create(null);
    this.minInterval = 30;

    // Музыка
    this._musicPlaying = false;
    this._musicNodes = [];
    this._musicTimer = null;
    this._focusSuspended = false;
    this._resumeMusic = false;
  }

  init() {
    if (this.initialized) { this.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
      this._applyGains();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio не поддерживается:", e);
    }
  }

  resume() { if (this.ctx?.state === "suspended") return this.ctx.resume().catch(() => {}); return Promise.resolve(); }
  ensure() { if (!this.initialized) this.init(); else this.resume(); }
  // Must be called directly from a user gesture on browsers with autoplay restrictions.
  unlock() { this.ensure(); return this.resume(); }

  _applyGains() {
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
    if (this.musicGain) this.musicGain.gain.value = this.musicEnabled ? this.musicVolume : 0;
  }

  // === API настроек ===
  setSfxEnabled(v) { this.sfxEnabled = !!v; this._applyGains(); }
  setMusicEnabled(v) {
    this.musicEnabled = !!v;
    this._applyGains();
    if (!v) this.stopMusic();
    else if (!this._musicPlaying) this.startMusic();
  }
  setSfxVolume(v) { this.sfxVolume = Math.max(0, Math.min(1, v)); this._applyGains(); }
  setMusicVolume(v) { this.musicVolume = Math.max(0, Math.min(1, v)); this._applyGains(); }

  applySettings(settings) {
    if (!settings) return;
    this.sfxEnabled = settings.sfx !== false;
    this.musicEnabled = settings.music !== false;
    if (typeof settings.sfxVolume === "number") this.sfxVolume = settings.sfxVolume;
    if (typeof settings.musicVolume === "number") this.musicVolume = settings.musicVolume;
    this._applyGains();
  }

  /**
   * П. 1.3 требований Яндекс Игр: при потере фокуса звук должен остановиться.
   * suspendAll глушит AudioContext и рвёт процедурный цикл музыки.
   */
  suspendAll() {
    if (this._focusSuspended) return;
    this._focusSuspended = true;
    this._resumeMusic = this._musicPlaying;
    this.stopMusic();
    if (this.ctx?.state === "running") this.ctx.suspend().catch(() => {});
  }

  resumeAll() {
    if (!this._focusSuspended) return;
    this._focusSuspended = false;
    const shouldMusic = this._resumeMusic;
    this._resumeMusic = false;
    this.resume();
    if (shouldMusic && this.musicEnabled) this.startMusic();
  }

  _canPlay(key) {
    const now = performance.now();
    const last = this.lastPlayTimes[key] || 0;
    if (now - last < this.minInterval) return false;
    this.lastPlayTimes[key] = now;
    return true;
  }

  // === SFX ===
  _tone(freq, duration, type = "square", volume = 0.15) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  _noise(duration, volume = 0.08) {
    if (!this.ctx) return;
    const size = Math.min(this.ctx.sampleRate * duration, 8192);
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start();
  }

  _seq(notes, interval, type = "square", volume = 0.12) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(volume, start + i * interval);
      gain.gain.exponentialRampToValueAtTime(0.001, start + i * interval + interval * 0.9);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start + i * interval);
      osc.stop(start + i * interval + interval);
    }
  }

  click() { if (this._canPlay("click")) this._tone(800, 0.06, "square", 0.08); }
  place() { if (this._canPlay("place")) this._seq([400, 600], 0.06, "square", 0.12); }
  erase() { if (this._canPlay("erase")) this._seq([500, 300], 0.06, "square", 0.1); }
  merge() { this._seq([400, 600, 800, 1200], 0.08, "sine", 0.15); }
  mergeFail() { if (this._canPlay("mf")) this._seq([300, 200], 0.08, "square", 0.1); }
  trapHit() { if (this._canPlay("th")) { this._noise(0.06, 0.12); this._tone(200, 0.08, "sawtooth", 0.08); } }
  monsterAttack() { if (this._canPlay("ma")) { this._tone(300, 0.1, "sawtooth", 0.1); this._tone(250, 0.08, "square", 0.06); } }
  heroDeath() { if (this._canPlay("hd")) { this._seq([600, 400, 200], 0.06, "square", 0.12); this._noise(0.12, 0.06); } }
  heroLeak() { this._seq([400, 200, 100], 0.1, "sawtooth", 0.15); }
  waveStart() { this._seq([300, 400, 500, 600], 0.1, "square", 0.12); }
  waveComplete() { this._seq([523, 659, 784, 1047], 0.12, "sine", 0.15); }
  gameOver() { this._seq([400, 350, 300, 200, 150], 0.15, "sawtooth", 0.12); }
  purchase() { this._seq([600, 800, 1000], 0.07, "sine", 0.12); }
  error() { if (this._canPlay("err")) this._seq([300, 200], 0.1, "square", 0.12); }
  coinCollect() { if (this._canPlay("cc")) this._tone(1200, 0.08, "sine", 0.1); }
  soulCollect() { if (this._canPlay("sc")) this._tone(800, 0.12, "sine", 0.08); }
  crystalHeal() { this._seq([600, 900], 0.1, "sine", 0.1); }
  buttonHover() { if (this._canPlay("hv")) this._tone(1000, 0.03, "sine", 0.04); }
  selectTool() { if (this._canPlay("st")) this._tone(700, 0.05, "square", 0.06); }
  levelUp() { this._seq([523, 659, 784, 1047, 1319], 0.1, "sine", 0.14); }

  // === МУЗЫКА (процедурный ambient loop) ===
  startMusic() {
    if (!this.ctx || !this.musicEnabled || this._musicPlaying) return;
    this._musicPlaying = true;
    this._scheduleMusicLoop();
  }

  stopMusic() {
    this._musicPlaying = false;
    if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
    // Останавливаем текущие ноды
    for (const n of this._musicNodes) {
      try { n.stop?.(); n.disconnect?.(); } catch (e) {}
    }
    this._musicNodes = [];
  }

  _scheduleMusicLoop() {
    if (!this._musicPlaying) return;
    // Минорная мелодия — атмосферная
    // ноты (Гц): A3, C4, E4, G4, A4, C5
    const notes = [220, 262, 330, 392, 440, 523];
    const pattern = [
      [0, 2, 4], [1, 3, 5], [0, 3, 4],
      [2, 4, 5], [1, 2, 4], [0, 2, 3],
    ];

    const now = this.ctx.currentTime;
    const beat = 1.2; // длительность каждой ноты
    const loopLen = pattern.length * beat;

    for (let i = 0; i < pattern.length; i++) {
      const chord = pattern[i];
      for (const idx of chord) {
        const freq = notes[idx];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * beat);
        gain.gain.linearRampToValueAtTime(0.06, now + i * beat + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + i * beat + beat * 0.9);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
        osc.start(now + i * beat);
        osc.stop(now + i * beat + beat);
        this._musicNodes.push(osc);
      }
    }

    // Планируем следующую итерацию
    this._musicTimer = setTimeout(() => {
      // All oscillators from this phrase have ended and disconnected via onended.
      this._musicNodes.length = 0;
      this._scheduleMusicLoop();
    }, loopLen * 1000);
  }
}

export const audio = new AudioManager();