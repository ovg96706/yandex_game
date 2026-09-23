import { saveManager } from "../saveManager.js";
import { audio } from "../audio.js";
import { createButton } from "../ui.js";
import {
  TOOL_DEFS, HERO_TYPES, toolLabel, toolDesc, heroLabel, getMonsterMaxHP,
} from "../config.js";
import { t } from "../i18n.js";

const PAGE_SIZE = 9;

/** Собирает список карточек вкладки: units (ловушки+монстры) или heroes (враги). */
function collectEntries(tab, discoveredMap) {
  const source = tab === "heroes" ? HERO_TYPES : TOOL_DEFS;
  return Object.values(source).map((def) => ({
    def,
    known: discoveredMap[def.id] === true,
    icon: def.icon || "❔",
    name: tab === "heroes" ? heroLabel(def) : toolLabel(def),
    desc: tab === "heroes" ? t(`hero_${def.id}_desc`) : toolDesc(def),
    isBoss: !!def.isBoss,
    weakness: def.weaknessTool ? TOOL_DEFS[def.weaknessTool] : null,
    kind: def.kind,
    damage: def.damage,
    hpMult: def.hpMult,
    monsterHP: def.kind === "monster" ? getMonsterMaxHP(def, 1) : 0,
  }));
}

export class BestiaryScene extends Phaser.Scene {
  constructor() { super("BestiaryScene"); }

  init(data) { this.returnTo = data?.returnTo || "MenuScene"; this.tab = "units"; this.page = 0; }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#141425");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    this.add.text(270, 38, t("bestiary_title"), { fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.statusText = this.add.text(270, 70, "", { fontFamily: "Arial", fontSize: "13px", color: "#8899bb" }).setOrigin(0.5);

    this.unitsTab = createButton(this, 165, 104, 150, 36, t("bestiary_units"), () => { this.tab = "units"; this.page = 0; this.redraw(); }, { textSize: "14px" });
    this.heroesTab = createButton(this, 375, 104, 150, 36, t("bestiary_heroes"), () => { this.tab = "heroes"; this.page = 0; this.redraw(); }, { textSize: "14px" });

    this.cardLayer = this.add.container(0, 0);
    // Листалка живёт ПОД сеткой карточек (сетка кончается на y≈605): раньше стрелки
    // висели по бокам на y=500 и наезжали на крайние карточки среднего ряда.
    this.pagerY = 655;
    this.arrowL = createButton(this, 190, this.pagerY, 56, 40, "◀", () => this._page(-1), { textSize: "16px", color: 0x333355, hoverColor: 0x555588, stroke: 0x7799cc });
    this.arrowR = createButton(this, 350, this.pagerY, 56, 40, "▶", () => this._page(1), { textSize: "16px", color: 0x333355, hoverColor: 0x555588, stroke: 0x7799cc });
    this.pageText = this.add.text(270, this.pagerY, "", { fontFamily: "Arial", fontSize: "15px", color: "#cdd6ff", fontStyle: "bold" }).setOrigin(0.5);

    this.redraw();

    createButton(this, 270, 900, 200, 46, t("common_back"), () => this.scene.start(this.returnTo), { textSize: "17px" });
  }

  _page(dir) {
    const total = this._entries.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    this.page = (this.page + dir + pages) % pages;
    audio.click();
    this.redraw();
  }

  redraw() {
    this.cardLayer.removeAll(true);
    this.unitsTab.setSelected(this.tab === "units");
    this.heroesTab.setSelected(this.tab === "heroes");

    const discoveredMap = saveManager.data.discovered?.[this.tab] || {};
    this._entries = collectEntries(this.tab, discoveredMap);
    const known = this._entries.filter((e) => e.known).length;
    this.statusText.setText(t("bestiary_progress", known, this._entries.length));

    const pages = Math.max(1, Math.ceil(this._entries.length / PAGE_SIZE));
    this.page = Math.min(this.page, pages - 1);
    this.arrowL.setVisible(pages > 1);
    this.arrowR.setVisible(pages > 1);
    this.pageText.setVisible(pages > 1);
    this.pageText.setText(`${this.page + 1} / ${pages}`);

    const slice = this._entries.slice(this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE);
    const cardW = 155, cardH = 150, gap = 10;
    const startX = 270 - (3 * cardW + 2 * gap) / 2 + cardW / 2;

    slice.forEach((e, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = startX + col * (cardW + gap);
      const y = 210 + row * (cardH + gap);

      const panel = this.add.rectangle(x, y, cardW, cardH, e.known ? (e.isBoss ? 0x2e1f3a : 0x232344) : 0x1a1a26)
        .setStrokeStyle(2, e.known ? (e.isBoss ? 0xffaa44 : 0x3b6d9d) : 0x333344);

      if (!e.known) {
        const q = this.add.text(x, y - 12, "❔", { fontFamily: "Arial", fontSize: "40px", color: "#44445c" }).setOrigin(0.5);
        const hint = this.add.text(x, y + 44, t("bestiary_unknown"), { fontFamily: "Arial", fontSize: "13px", color: "#555570", fontStyle: "bold" }).setOrigin(0.5);
        this.cardLayer.add([panel, q, hint]);
        return;
      }

      const icon = this.add.text(x, y - 48, e.icon, { fontFamily: "Arial", fontSize: "26px" }).setOrigin(0.5);
      const name = this.add.text(x, y - 22, (e.isBoss ? "👑 " : "") + e.name, { fontFamily: "Arial", fontSize: "13px", color: "#ffffff", fontStyle: "bold", align: "center", wordWrap: { width: cardW - 12 } }).setOrigin(0.5);
      const desc = this.add.text(x, y + 8, e.desc, { fontFamily: "Arial", fontSize: "10px", color: "#99a7c9", align: "center", wordWrap: { width: cardW - 14 } }).setOrigin(0.5);
      const stat = this.add.text(x, y + 52,
        this.tab === "heroes"
          ? t("bestiary_hp", e.hpMult ?? 1)
          : (e.kind === "monster" ? t("bestiary_unit_stats", e.damage ?? 0, e.monsterHP ?? 0) : t("bestiary_damage", e.damage ?? 0)),
        { fontFamily: "Arial", fontSize: "11px", color: "#ffd700" }).setOrigin(0.5);
      this.cardLayer.add([panel, icon, name, desc, stat]);

      if (e.weakness) {
        const weak = this.add.text(x, y + 68, t("bestiary_weakness", toolLabel(e.weakness)), { fontFamily: "Arial", fontSize: "10px", color: "#ff8888" }).setOrigin(0.5);
        this.cardLayer.add(weak);
      }
    });
  }

  pauseForAd() {}
  resumeAfterAd() {}
}
