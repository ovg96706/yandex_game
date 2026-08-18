import { audio } from "../audio.js";
import { createButton } from "../ui.js";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, achLabel, achDesc } from "../config.js";
import { achievements } from "../achievements.js";
import { t } from "../i18n.js";

export class AchievementsScene extends Phaser.Scene {
  constructor() { super("AchievementsScene"); }
  init(data) { this.returnTo = data?.returnTo || "MenuScene"; }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#151528");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    // Заголовок
    this.add.text(270, 40, t("ach_title"), {
      fontFamily: "Arial", fontSize: "26px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    const total = ACHIEVEMENTS.length;
    const completed = ACHIEVEMENTS.filter(a => achievements.isUnlocked(a.id)).length;
    this.add.text(270, 72, t("ach_progress", completed, total), {
      fontFamily: "Arial", fontSize: "15px", color: "#57ffb8", fontStyle: "bold",
    }).setOrigin(0.5);

    // === КАТЕГОРИИ ===
    this.currentCategory = "all";
    this.categoryBtns = {};
    this.createCategoryTabs();

    // === VIEWPORT ГРАНИЦЫ ===
    // Начинается ниже категорий, заканчивается выше кнопки "Назад"
    this.viewportTop = 155;      // сразу под категориями
    this.viewportBottom = 875;   // над кнопкой "Назад"
    this.viewportHeight = this.viewportBottom - this.viewportTop;
    this.viewportCenter = (this.viewportTop + this.viewportBottom) / 2;

    // Видимая рамка viewport'а (декоративная, показывает границу скролла)
    const viewportBg = this.add.rectangle(
      270,
      this.viewportCenter,
      510,
      this.viewportHeight,
      0x111122,
      0.3
    ).setStrokeStyle(1, 0x333355, 0.5);

    // === КОНТЕЙНЕР ДЛЯ КАРТОЧЕК ===
    this.listContainer = this.add.container(0, 0);
    this.scrollOffset = 0;
    this.contentHeight = 0;

    // === MASK (обрезает всё вне viewport'а) ===
    this._createMask();

    // === ПОСТРОЕНИЕ СПИСКА ===
    this.buildList();

    // === СКРОЛЛ ===
    this._setupScrolling();

    // === КНОПКА НАЗАД ===
    createButton(this, 270, 910, 200, 46, t("common_back"),
      () => this.scene.start(this.returnTo),
      { textSize: "18px" });

    // === ИНДИКАТОР СКРОЛЛА (справа) ===
    this._createScrollIndicator();
  }

  // ============================
  // MASK — обрезает область скролла
  // ============================

  _createMask() {
    // Создаём графику-маску (не видна, только для обрезки)
    const maskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(
      15,                    // левый край с небольшим отступом
      this.viewportTop,      // верхняя граница
      510,                   // ширина
      this.viewportHeight    // высота видимой области
    );

    const mask = maskGraphics.createGeometryMask();
    this.listContainer.setMask(mask);
    this._maskGraphics = maskGraphics;
  }

  // ============================
  // КАТЕГОРИИ
  // ============================

  createCategoryTabs() {
    const cats = [
      { id: "all", labelKey: "ach_category_all", icon: "★" },
      ...Object.entries(ACHIEVEMENT_CATEGORIES).map(([id, c]) => ({ id, ...c })),
    ];

    const w = 82, gap = 4;
    const total = cats.length * (w + gap) - gap;
    const startX = 270 - total / 2 + w / 2;

    for (let i = 0; i < cats.length; i++) {
      const c = cats[i];
      const x = startX + i * (w + gap);
      const label = c.labelKey ? t(c.labelKey) : c.label;
      const btn = createButton(this, x, 115, w, 34, `${c.icon} ${label}`, () => {
        this.currentCategory = c.id;
        this.buildList();
        for (const [id, b] of Object.entries(this.categoryBtns)) {
          b.setSelected(id === c.id);
        }
      }, { textSize: "12px" });
      this.categoryBtns[c.id] = btn;
    }
    this.categoryBtns["all"].setSelected(true);
  }

  // ============================
  // ПОСТРОЕНИЕ СПИСКА
  // ============================

  buildList() {
    this.listContainer.removeAll(true);
    this.scrollOffset = 0;

    const list = this.currentCategory === "all"
      ? [...ACHIEVEMENTS]
      : ACHIEVEMENTS.filter(a => a.category === this.currentCategory);

    list.sort((a, b) => {
      const ua = achievements.isUnlocked(a.id);
      const ub = achievements.isUnlocked(b.id);
      if (ua !== ub) return ua ? 1 : -1;
      return achievements.getProgress(b).percent - achievements.getProgress(a).percent;
    });

    const cardH = 78, gap = 8;
    let y = this.viewportTop + 8; // небольшой отступ сверху
    for (const ach of list) {
      this.listContainer.add(this._buildCard(ach, y));
      y += cardH + gap;
    }
    this.contentHeight = y - this.viewportTop + 8; // +отступ снизу
    this._applyScroll();
    this._updateScrollIndicator();
  }

  _buildCard(ach, y) {
    const cx = 270, w = 490, h = 78;
    const unlocked = achievements.isUnlocked(ach.id);
    const prog = achievements.getProgress(ach);
    const container = this.add.container(cx, y + h / 2);

    const bgColor = unlocked ? 0x1e4028 : 0x24244a;
    const borderColor = unlocked ? 0x57ffb8 : 0x444466;
    const bg = this.add.rectangle(0, 0, w, h, bgColor).setStrokeStyle(2, borderColor);
    container.add(bg);

    const iconBg = this.add.circle(-w / 2 + 30, 0, 24, unlocked ? 0x2b5c3c : 0x1a1a2e).setStrokeStyle(2, borderColor);
    const icon = this.add.text(-w / 2 + 30, 0, ach.icon, { fontFamily: "Arial", fontSize: "22px" }).setOrigin(0.5);
    container.add([iconBg, icon]);

    const title = this.add.text(-w / 2 + 65, -22, achLabel(ach), {
      fontFamily: "Arial", fontSize: "15px", color: unlocked ? "#ffffff" : "#dceeff", fontStyle: "bold",
    }).setOrigin(0, 0.5);
    container.add(title);

    const desc = this.add.text(-w / 2 + 65, -6, achDesc(ach), {
      fontFamily: "Arial", fontSize: "12px", color: "#aabbcc",
    }).setOrigin(0, 0.5);
    container.add(desc);

    const barW = 220, barH = 6;
    const barX = -w / 2 + 65, barY = 16;
    const barBg = this.add.rectangle(barX, barY, barW, barH, 0x111122).setOrigin(0, 0.5);
    const fillW = Math.max(2, prog.percent * barW);
    const barFill = this.add.rectangle(barX, barY, fillW, barH, unlocked ? 0xffd700 : 0x57ffb8).setOrigin(0, 0.5);
    container.add([barBg, barFill]);

    const progText = this.add.text(barX + barW + 8, barY,
      `${Math.min(prog.current, prog.goal)}/${prog.goal}`, {
      fontFamily: "Arial", fontSize: "11px", color: "#aabbcc",
    }).setOrigin(0, 0.5);
    container.add(progText);

    if (ach.reward) {
      const rewardText = [
        ach.reward.gold ? `+${ach.reward.gold}🪙` : null,
        ach.reward.souls ? `+${ach.reward.souls}💀` : null,
      ].filter(Boolean).join(" ");
      const r = this.add.text(w / 2 - 12, -18, rewardText, {
        fontFamily: "Arial", fontSize: "12px", color: unlocked ? "#7effa7" : "#ffd700", fontStyle: "bold",
      }).setOrigin(1, 0.5);
      container.add(r);
    }

    if (unlocked) {
      const check = this.add.text(w / 2 - 15, 15, t("ach_unlocked_label"), {
        fontFamily: "Arial", fontSize: "11px", color: "#57ffb8", fontStyle: "bold",
      }).setOrigin(1, 0.5);
      container.add(check);
    }

    return container;
  }

  // ============================
  // СКРОЛЛ (только внутри viewport'а)
  // ============================

  _setupScrolling() {
    // Колесо мыши — работает только когда курсор над viewport'ом
    this.input.on("wheel", (pointer, _, __, dy) => {
      if (this._isInViewport(pointer.x, pointer.y)) {
        this.setScroll(this.scrollOffset + dy * 0.5);
      }
    });

    // Drag — начинается только внутри viewport'а
    this.input.on("pointerdown", (p) => {
      if (this._isInViewport(p.x, p.y)) {
        this._dragStartY = p.y;
        this._scrollStart = this.scrollOffset;
        this._isDragging = true;
      }
    });

    this.input.on("pointermove", (p) => {
      if (!this._isDragging) return;
      if (p.isDown) {
        this.setScroll(this._scrollStart + (this._dragStartY - p.y));
      }
    });

    this.input.on("pointerup", () => {
      this._isDragging = false;
      this._dragStartY = null;
    });
  }

  _isInViewport(x, y) {
    return x >= 15 && x <= 525 && y >= this.viewportTop && y <= this.viewportBottom;
  }

  setScroll(v) {
    const maxScroll = Math.max(0, this.contentHeight - this.viewportHeight);
    this.scrollOffset = Phaser.Math.Clamp(v, 0, maxScroll);
    this._applyScroll();
    this._updateScrollIndicator();
  }

  _applyScroll() {
    this.listContainer.y = -this.scrollOffset;
    // Больше НЕ нужно скрывать карточки вручную — mask сам обрежет
  }

  // ============================
  // ИНДИКАТОР ПРОКРУТКИ
  // ============================

  _createScrollIndicator() {
    const barX = 528;
    const barY = this.viewportTop;
    const barHeight = this.viewportHeight;

    // Фон трека
    this.scrollTrackBg = this.add.rectangle(
      barX, this.viewportCenter,
      4, barHeight,
      0x1a1a2e
    ).setStrokeStyle(1, 0x333355);

    // Ползунок
    this.scrollThumb = this.add.rectangle(
      barX, barY,
      4, 40,
      0x57ffb8
    ).setOrigin(0.5, 0);

    this._updateScrollIndicator();
  }

  _updateScrollIndicator() {
    if (!this.scrollThumb) return;

    const maxScroll = Math.max(0, this.contentHeight - this.viewportHeight);

    if (maxScroll <= 0) {
      // Скрыть индикатор если нечего скроллить
      this.scrollThumb.setVisible(false);
      this.scrollTrackBg.setVisible(false);
      return;
    }
    this.scrollThumb.setVisible(true);
    this.scrollTrackBg.setVisible(true);

    // Размер ползунка пропорционален видимой области
    const thumbHeight = Math.max(
      30,
      this.viewportHeight * (this.viewportHeight / this.contentHeight)
    );
    this.scrollThumb.height = thumbHeight;

    // Позиция ползунка
    const scrollPercent = this.scrollOffset / maxScroll;
    const availableSpace = this.viewportHeight - thumbHeight;
    this.scrollThumb.y = this.viewportTop + scrollPercent * availableSpace;
  }

  pauseForAd() {}
  resumeAfterAd() {}
}