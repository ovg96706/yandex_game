import { saveManager } from "../saveManager.js";
import { audio } from "../audio.js";
import { createButton, floatText } from "../ui.js";
import { TALENTS, TALENT_BRANCHES, getTalentCost } from "../config.js";
import { achievements } from "../achievements.js";
import { t } from "../i18n.js";

const BRANCH_ORDER = ["shadow", "abyss", "essence"];
const CURRENCY_LABEL = { souls: "💀", darkCrystals: "💎", essence: "🔮" };

export class TalentsScene extends Phaser.Scene {
  constructor() { super("TalentsScene"); }

  init(data) { this.returnTo = data?.returnTo || "MenuScene"; }

  create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#12121f");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    this.add.text(270, 38, t("talents_title"), { fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(270, 66, t("talents_subtitle"), { fontFamily: "Arial", fontSize: "12px", color: "#8899bb" }).setOrigin(0.5);

    this.currencyText = this.add.text(270, 92, "", { fontFamily: "Arial", fontSize: "14px", color: "#cdd6ff" }).setOrigin(0.5);

    this.cardLayer = this.add.container(0, 0);
    this.redraw();

    createButton(this, 270, 900, 200, 46, t("common_back"), () => this.scene.start(this.returnTo), { textSize: "17px" });
  }

  refreshCurrency() {
    const d = saveManager.data;
    this.currencyText?.setText(`💀 ${d.souls}   💎 ${d.darkCrystals}   🔮 ${d.essence}`);
  }

  redraw() {
    this.cardLayer.removeAll(true);
    this.refreshCurrency();

    const colW = 170, startX = 270 - colW;
    BRANCH_ORDER.forEach((branchId, ci) => {
      const branch = TALENT_BRANCHES[branchId];
      const x = startX + ci * colW;

      // Шапка ветки: название и валюта ветки живут ВНУТРИ рамки (118/136).
      // Раньше валюта рисовалась на y=158 — поверх верхнего края первой карточки,
      // и карточка (добавляется позже) перекрывала её непрозрачным фоном.
      const head = this.add.rectangle(x, 126, colW - 8, 40, 0x232344).setStrokeStyle(2, branch.color);
      const headTxt = this.add.text(x, 118, `${branch.icon} ${t(branch.labelKey)}`, { fontFamily: "Arial", fontSize: "13px", color: "#ffffff", fontStyle: "bold", align: "center" }).setOrigin(0.5);
      const currTxt = this.add.text(x, 136, "", { fontFamily: "Arial", fontSize: "12px", color: "#ffd700" }).setOrigin(0.5);
      currTxt.name = `curr_${branchId}`;
      this.cardLayer.add([head, headTxt, currTxt]);
      this._setBranchCurrency(currTxt, branch.currency);

      const talents = Object.values(TALENTS).filter((tl) => tl.branch === branchId).sort((a, b) => a.tier - b.tier);
      talents.forEach((def, ti) => {
        const y = 216 + ti * 128;
        const lvl = saveManager.getTalentLevel(def.id);
        const maxed = lvl >= def.maxLevel;
        const prevLvl = def.requires ? saveManager.getTalentLevel(def.requires) : 1;
        const lockedByReq = !maxed && prevLvl < 1;
        const cost = getTalentCost(def, lvl);
        const canBuy = !maxed && !lockedByReq && saveManager.data[branch.currency] >= cost;

        const bg = this.add.rectangle(x, y, colW - 8, 114, lockedByReq ? 0x191922 : 0x232344)
          .setStrokeStyle(2, maxed ? branch.color : lockedByReq ? 0x333340 : canBuy ? 0xffd700 : 0x3b4d7d)
          .setInteractive({ useHandCursor: true });
        const name = this.add.text(x, y - 42, `${def.icon} ${t(def.labelKey)}`, { fontFamily: "Arial", fontSize: "13px", color: lockedByReq ? "#666677" : "#ffffff", fontStyle: "bold", align: "center", wordWrap: { width: colW - 20 } }).setOrigin(0.5);
        const desc = this.add.text(x, y - 8, t(def.descKey), { fontFamily: "Arial", fontSize: "10px", color: "#99a7c9", align: "center", wordWrap: { width: colW - 20 } }).setOrigin(0.5);

        const pips = this.add.text(x, y + 22, "●".repeat(lvl) + "○".repeat(def.maxLevel - lvl), { fontFamily: "Arial", fontSize: "13px", color: branch.color }).setOrigin(0.5);

        let stateTxt;
        if (maxed) stateTxt = this.add.text(x, y + 44, t("talents_max"), { fontFamily: "Arial", fontSize: "12px", color: branch.color, fontStyle: "bold" }).setOrigin(0.5);
        else if (lockedByReq) stateTxt = this.add.text(x, y + 44, "🔒 " + t("talents_locked"), { fontFamily: "Arial", fontSize: "11px", color: "#666677" }).setOrigin(0.5);
        else stateTxt = this.add.text(x, y + 44, `${cost}${CURRENCY_LABEL[branch.currency]}`, { fontFamily: "Arial", fontSize: "13px", color: canBuy ? "#ffd700" : "#aa6666" }).setOrigin(0.5);

        bg.on("pointerdown", () => this._buy(def, x, y));
        this.cardLayer.add([bg, name, desc, pips, stateTxt]);
      });
    });
  }

  _setBranchCurrency(txt, currency) {
    txt.setText(`${CURRENCY_LABEL[currency]} ${saveManager.data[currency] ?? 0}`);
  }

  _buy(def, x, y) {
    if (!saveManager.canBuyTalent(def.id)) { audio.error(); return; }
    const branch = TALENT_BRANCHES[def.branch];
    const lvl = saveManager.getTalentLevel(def.id);
    const cost = getTalentCost(def, lvl);
    if (!saveManager.buyTalent(def.id)) { audio.error(); return; }
    audio.purchase();
    floatText(this, x, y - 30, `-${cost}${CURRENCY_LABEL[branch.currency]}`, "#ffd700", 15);
    achievements.checkAll();
    this.redraw();
  }

  pauseForAd() {}
  resumeAfterAd() {}
}
