import { saveManager } from "../saveManager.js";
import { SHOP_UPGRADES, UPGRADE_CATEGORIES, getUpgradeCost, upgrLabel, upgrDesc } from "../config.js";
import { createButton, floatText } from "../ui.js";
import { audio } from "../audio.js";
import { t } from "../i18n.js";

export class ShopScene extends Phaser.Scene {
  constructor() { super("ShopScene"); }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#151528");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    // Декор
    for (let i = 0; i < 10; i++) {
      this.add.circle(
        Phaser.Math.Between(30, 510),
        Phaser.Math.Between(160, 830),
        Phaser.Math.Between(1, 3), 0x2d3f6b, 0.4
      );
    }

    // Заголовок
    this.add.text(270, 35, t("shop_title"), {
      fontFamily: "Arial", fontSize: "22px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    // Валюта
    this.soulsText = this.add.text(270, 68, "", {
      fontFamily: "Arial", fontSize: "20px", color: "#57ffb8",
    }).setOrigin(0.5);
    this.refreshSouls();

    // === КАТЕГОРИИ ===
    this.currentCategory = "crystal";
    this.categoryBtns = {};
    this._createCategoryTabs();

    // === VIEWPORT ===
    this.viewportTop = 150;
    this.viewportBottom = 875;
    this.viewportHeight = this.viewportBottom - this.viewportTop;

    // Подложка viewport'а
    this.add.rectangle(
      270, (this.viewportTop + this.viewportBottom) / 2,
      510, this.viewportHeight, 0x111122, 0.3
    ).setStrokeStyle(1, 0x333355, 0.5);

    // === КОНТЕЙНЕР + MASK ===
    this.cardContainer = this.add.container(0, 0);
    this.scrollOffset = 0;
    this.contentHeight = 0;
    this._createMask();

    this.createUpgradeList();
    this._setupScrolling();
    this._createScrollIndicator();

    // Назад
    createButton(this, 270, 910, 200, 46, t("shop_back"),
      () => this.scene.start("MenuScene"),
      { textSize: "18px", depth: 100 });
  }

  // === MASK ===
  _createMask() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff);
    g.fillRect(15, this.viewportTop, 510, this.viewportHeight);
    this.cardContainer.setMask(g.createGeometryMask());
  }

  // === КАТЕГОРИИ ===
  _createCategoryTabs() {
    const cats = Object.entries(UPGRADE_CATEGORIES).map(([id, c]) => ({ id, ...c }));
    const w = 96, gap = 4;
    const total = cats.length * (w + gap) - gap;
    const startX = 270 - total / 2 + w / 2;

    for (let i = 0; i < cats.length; i++) {
      const c = cats[i];
      const x = startX + i * (w + gap);
      const label = t(c.labelKey);
      const btn = createButton(this, x, 110, w, 36, `${c.icon}\n${label}`, () => {
        this.currentCategory = c.id;
        for (const [id, b] of Object.entries(this.categoryBtns)) b.setSelected(id === c.id);
        this.createUpgradeList();
      }, { textSize: "11px" });
      this.categoryBtns[c.id] = btn;
    }
    this.categoryBtns[this.currentCategory].setSelected(true);
  }

  // === СПИСОК УЛУЧШЕНИЙ ===
  createUpgradeList() {
    this.cardContainer.removeAll(true);
    this.scrollOffset = 0;

    const list = Object.values(SHOP_UPGRADES).filter(u => u.category === this.currentCategory);

    const startY = this.viewportTop + 8;
    const cardH = 82, gap = 6;
    let y = startY;

    for (const def of list) {
      this._buildCard(def, y);
      y += cardH + gap;
    }

    this.contentHeight = y - this.viewportTop + 8;
    this._applyScroll();
    this._updateScrollIndicator();
  }

  _buildCard(def, y) {
    const cx = 270, w = 490, h = 82;
    const level = saveManager.getUpgradeLevel(def.id);
    const maxed = level >= def.maxLevel;
    const cost = maxed ? 0 : getUpgradeCost(def, level);
    const canBuy = saveManager.canBuyUpgrade(def.id);
    const cardY = y + h / 2;

    const bgColor = canBuy ? 0x24244a : 0x1e1e38;
    const borderColor = maxed ? 0xffd700 : canBuy ? 0x57ffb8 : 0x444466;

    const bg = this.add.rectangle(cx, cardY, w, h, bgColor).setStrokeStyle(2, borderColor);
    this.cardContainer.add(bg);

    // Иконка
    const iconBg = this.add.circle(cx - w / 2 + 32, cardY, 22, 0x1a1a2e).setStrokeStyle(2, borderColor);
    const icon = this.add.text(cx - w / 2 + 32, cardY, def.icon, {
      fontFamily: "Arial", fontSize: "24px",
    }).setOrigin(0.5);
    this.cardContainer.add([iconBg, icon]);

    // Название
    const title = this.add.text(cx - w / 2 + 65, cardY - 20, upgrLabel(def), {
      fontFamily: "Arial", fontSize: "15px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0, 0.5);
    this.cardContainer.add(title);

    // Уровень
    const levelText = this.add.text(cx - w / 2 + 65, cardY - 5, t("shop_level", level, def.maxLevel), {
      fontFamily: "Arial", fontSize: "11px", color: "#88ffcc", fontStyle: "bold",
    }).setOrigin(0, 0.5);
    this.cardContainer.add(levelText);

    // Описание
    const desc = this.add.text(cx - w / 2 + 65, cardY + 10, upgrDesc(def), {
      fontFamily: "Arial", fontSize: "11px", color: "#aabbcc",
      wordWrap: { width: 260 },
    }).setOrigin(0, 0.5);
    this.cardContainer.add(desc);

    // Прогресс-бар
    const barW = 260, barH = 4;
    const barX = cx - w / 2 + 65, barY = cardY + 26;
    const barBg = this.add.rectangle(barX, barY, barW, barH, 0x111122).setOrigin(0, 0.5);
    const fillW = Math.max(2, (level / def.maxLevel) * barW);
    const barFill = this.add.rectangle(barX, barY, fillW, barH, maxed ? 0xffd700 : 0x57ffb8).setOrigin(0, 0.5);
    this.cardContainer.add([barBg, barFill]);

    // Кнопка
    const btnLabel = maxed ? t("shop_max") : `${cost}💀`;
    const btnColor = maxed ? 0x555533 : canBuy ? 0x2b5c3c : 0x442b2b;
    const btnHover = maxed ? 0x555533 : canBuy ? 0x3a7a50 : 0x553535;
    const btnStroke = maxed ? 0xffd700 : canBuy ? 0x7effa7 : 0x885555;

    const btn = createButton(this, cx + w / 2 - 55, cardY, 88, 44, btnLabel, () => {
      if (maxed) return;
      if (!canBuy) {
        audio.error();
        floatText(this, cx + w / 2 - 55, cardY - 32, t("shop_not_enough_souls"), "#ff8f8f", 14);
        return;
      }
      const ok = saveManager.buyUpgrade(def.id);
      if (ok) {
        audio.purchase();
        floatText(this, cx + w / 2 - 55, cardY - 32, t("shop_improved"), "#7effa7", 16);
        saveManager.save();
        this.refreshSouls();
        this.time.delayedCall(200, () => this.createUpgradeList());
      }
    }, { color: btnColor, hoverColor: btnHover, stroke: btnStroke, textSize: "14px", depth: 5 });
    this.cardContainer.add([btn.bg, btn.txt]);
  }

  refreshSouls() {
    this.soulsText.setText(t("shop_souls", saveManager.data.souls));
  }

  // === СКРОЛЛ ===
  _setupScrolling() {
    this.input.on("wheel", (p, _, __, dy) => {
      if (this._isInViewport(p.x, p.y)) this.setScroll(this.scrollOffset + dy * 0.5);
    });
    this.input.on("pointerdown", (p) => {
      if (this._isInViewport(p.x, p.y)) {
        this._dragStartY = p.y;
        this._scrollStart = this.scrollOffset;
        this._isDragging = true;
      }
    });
    this.input.on("pointermove", (p) => {
      if (this._isDragging && p.isDown) {
        this.setScroll(this._scrollStart + (this._dragStartY - p.y));
      }
    });
    this.input.on("pointerup", () => { this._isDragging = false; });
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
    this.cardContainer.y = -this.scrollOffset;
  }

  _createScrollIndicator() {
    const barX = 528;
    this.scrollTrackBg = this.add.rectangle(
      barX, (this.viewportTop + this.viewportBottom) / 2,
      4, this.viewportHeight, 0x1a1a2e
    ).setStrokeStyle(1, 0x333355);

    this.scrollThumb = this.add.rectangle(barX, this.viewportTop, 4, 40, 0x57ffb8).setOrigin(0.5, 0);
    this._updateScrollIndicator();
  }

  _updateScrollIndicator() {
    if (!this.scrollThumb) return;
    const maxScroll = Math.max(0, this.contentHeight - this.viewportHeight);
    if (maxScroll <= 0) {
      this.scrollThumb.setVisible(false);
      this.scrollTrackBg.setVisible(false);
      return;
    }
    this.scrollThumb.setVisible(true);
    this.scrollTrackBg.setVisible(true);
    const thumbH = Math.max(30, this.viewportHeight * (this.viewportHeight / this.contentHeight));
    this.scrollThumb.height = thumbH;
    const scrollPercent = this.scrollOffset / maxScroll;
    this.scrollThumb.y = this.viewportTop + scrollPercent * (this.viewportHeight - thumbH);
  }
}