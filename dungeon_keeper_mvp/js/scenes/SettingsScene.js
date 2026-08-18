import { saveManager } from "../saveManager.js";
import { audio } from "../audio.js";
import { i18n, t, SUPPORTED_LANGUAGES } from "../i18n.js";
import { createButton } from "../ui.js";

export class SettingsScene extends Phaser.Scene {
  constructor() { super("SettingsScene"); }

  init(data) { this.returnTo = data?.returnTo || "MenuScene"; }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#151528");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    // Заголовок
    this.add.text(270, 55, t("settings_title"), {
      fontFamily: "Arial", fontSize: "28px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    // === Звук ===
    let y = 130;

    this._createToggle(
      270, y,
      t("settings_sound"),
      () => saveManager.data.settings.sfx,
      (v) => {
        saveManager.data.settings.sfx = v;
        audio.setSfxEnabled(v);
        saveManager.saveThrottled();
        if (v) audio.click();
      }
    );
    y += 55;

    // Громкость звуков
    this._createSlider(
      270, y,
      t("settings_volume_sfx"),
      () => saveManager.data.settings.sfxVolume ?? 0.8,
      (v) => {
        saveManager.data.settings.sfxVolume = v;
        audio.setSfxVolume(v);
        saveManager.saveThrottled();
      },
      () => audio.click() // превью
    );
    y += 90;

    // === Музыка ===
    this._createToggle(
      270, y,
      t("settings_music"),
      () => saveManager.data.settings.music,
      (v) => {
        saveManager.data.settings.music = v;
        audio.setMusicEnabled(v);
        saveManager.saveThrottled();
      }
    );
    y += 55;

    // Громкость музыки
    this._createSlider(
      270, y,
      t("settings_volume_music"),
      () => saveManager.data.settings.musicVolume ?? 0.4,
      (v) => {
        saveManager.data.settings.musicVolume = v;
        audio.setMusicVolume(v);
        saveManager.saveThrottled();
      }
    );
    y += 100;

    // === Язык ===
    this.add.text(270, y, t("settings_language"), {
      fontFamily: "Arial", fontSize: "18px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    y += 40;

    this._createLanguageButtons(270, y);

    // Подсказка
    this.add.text(270, 820, t("settings_note"), {
      fontFamily: "Arial", fontSize: "12px", color: "#667799", align: "center",
    }).setOrigin(0.5);

    // Назад
    createButton(this, 270, 890, 260, 54, t("settings_back"), () => {
      this.scene.start(this.returnTo);
    }, { textSize: "18px" });
  }

  // ================================
  // ТУМБЛЕР ВКЛ/ВЫКЛ
  // ================================
  _createToggle(x, y, label, getVal, setVal) {
    // Подпись
    this.add.text(x - 240, y, label, {
      fontFamily: "Arial", fontSize: "16px", color: "#dceeff",
    }).setOrigin(0, 0.5);

    // Фон переключателя
    const trackW = 90, trackH = 34;
    const trackX = x + 200;
    const trackBg = this.add.rectangle(trackX, y, trackW, trackH, 0x333355)
      .setStrokeStyle(2, 0x555577)
      .setInteractive({ useHandCursor: true });

    // Ползунок
    const knobR = 14;
    const knob = this.add.circle(0, y, knobR, 0xffffff);

    // Текст ON/OFF
    const stateText = this.add.text(trackX, y - 1, "", {
      fontFamily: "Arial", fontSize: "11px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    const update = () => {
      const on = getVal();
      trackBg.setFillStyle(on ? 0x2b5c3c : 0x5c2b2b);
      trackBg.setStrokeStyle(2, on ? 0x7effa7 : 0xff8a8a);
      const knobX = on ? trackX + trackW / 2 - knobR - 4 : trackX - trackW / 2 + knobR + 4;
      knob.setX(knobX);
      knob.setFillStyle(on ? 0x7effa7 : 0xff8a8a);
      stateText.setText(on ? t("settings_on") : t("settings_off"));
      // сдвигаем текст в противоположную сторону от ползунка
      stateText.setX(on ? trackX - 12 : trackX + 12);
    };

    trackBg.on("pointerdown", () => {
      const newVal = !getVal();
      setVal(newVal);
      // Плавная анимация ползунка
      const targetX = newVal ? trackX + trackW / 2 - knobR - 4 : trackX - trackW / 2 + knobR + 4;
      this.tweens.add({ targets: knob, x: targetX, duration: 150, ease: "Cubic.easeOut" });
      trackBg.setFillStyle(newVal ? 0x2b5c3c : 0x5c2b2b);
      trackBg.setStrokeStyle(2, newVal ? 0x7effa7 : 0xff8a8a);
      knob.setFillStyle(newVal ? 0x7effa7 : 0xff8a8a);
      stateText.setText(newVal ? t("settings_on") : t("settings_off"));
      stateText.setX(newVal ? trackX - 12 : trackX + 12);
    });

    update();
  }

  // ================================
  // СЛАЙДЕР ГРОМКОСТИ
  // ================================
  _createSlider(x, y, label, getVal, setVal, onPreview) {
    // Подпись
    const labelText = this.add.text(x - 240, y, label, {
      fontFamily: "Arial", fontSize: "14px", color: "#dceeff",
    }).setOrigin(0, 0.5);

    // Значение
    const valText = this.add.text(x + 240, y, "", {
      fontFamily: "Arial", fontSize: "14px", color: "#ffd700", fontStyle: "bold",
    }).setOrigin(1, 0.5);

    // Трек
    y += 26;
    const trackW = 460, trackH = 8;
    const trackX = x, trackY = y;
    const trackBg = this.add.rectangle(trackX, trackY, trackW, trackH, 0x1a1a2e).setStrokeStyle(1, 0x444466);
    const fill = this.add.rectangle(trackX - trackW / 2, trackY, 0, trackH, 0x57ffb8).setOrigin(0, 0.5);

    // Ручка
    const knob = this.add.circle(0, trackY, 12, 0xffffff).setStrokeStyle(2, 0x57ffb8);

    // Интерактивная зона (шире трека)
    const hitArea = this.add.rectangle(trackX, trackY, trackW + 40, 36, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    const applyValue = (v, preview = false) => {
      v = Phaser.Math.Clamp(v, 0, 1);
      setVal(v);
      const knobX = trackX - trackW / 2 + trackW * v;
      knob.setX(knobX);
      fill.width = trackW * v;
      valText.setText(`${Math.round(v * 100)}%`);
      if (preview && onPreview) onPreview();
    };

    const startVal = getVal();
    applyValue(startVal, false);

    let dragging = false;
    hitArea.on("pointerdown", (p) => {
      dragging = true;
      const rel = (p.x - (trackX - trackW / 2)) / trackW;
      applyValue(rel, true);
    });
    this.input.on("pointermove", (p) => {
      if (!dragging) return;
      const rel = (p.x - (trackX - trackW / 2)) / trackW;
      applyValue(rel);
    });
    this.input.on("pointerup", () => {
      if (dragging) {
        dragging = false;
        if (onPreview) onPreview(); // финальный "тик"
      }
    });
  }

  // ================================
  // ВЫБОР ЯЗЫКА
  // ================================
  _createLanguageButtons(cx, y) {
    const w = 130, gap = 12;
    const totalW = SUPPORTED_LANGUAGES.length * w + (SUPPORTED_LANGUAGES.length - 1) * gap;
    const startX = cx - totalW / 2 + w / 2;

    this._langButtons = [];

    for (let i = 0; i < SUPPORTED_LANGUAGES.length; i++) {
      const lang = SUPPORTED_LANGUAGES[i];
      const x = startX + i * (w + gap);
      const btn = createButton(this, x, y, w, 56,
        `${lang.flag}\n${lang.label}`,
        () => this._selectLanguage(lang.id),
        { textSize: "13px" }
      );
      this._langButtons.push({ id: lang.id, btn });
    }

    this._updateLangSelection();
  }

  _updateLangSelection() {
    for (const e of this._langButtons) {
      e.btn.setSelected(e.id === i18n.getLanguage());
    }
  }

  _selectLanguage(langId) {
    saveManager.data.settings.language = langId;
    i18n.setLanguage(langId);
    audio.click();
    saveManager.save();
    // Перезапуск сцены для применения перевода
    this.scene.restart({ returnTo: this.returnTo });
  }

  pauseForAd() {}
  resumeAfterAd() {}
}