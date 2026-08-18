import {
  GAME_CONFIG, TOOL_DEFS, HERO_TYPES, MAX_MERGE_LEVEL,
  getWaveEnemyCount, getBaseHeroHP, getBaseHeroSpeed, getWaveBonus,
  getToolCost, isToolUnlocked, pickHeroType, getBossForWave, getHeroReward,
  toolLabel, toolDesc, heroLabel,
  computeDamage, getTrapCooldown, getMonsterCooldown, getToolRange,
} from "../config.js";
import { saveManager } from "../saveManager.js";
import { adManager } from "../adManager.js";
import { createButton, floatText } from "../ui.js";
import { audio } from "../audio.js";
import {
  drawPiece, drawHeroByType,
  spawnDeathParticles, spawnMergeEffect, spawnPlaceEffect, spawnBossWarning,
  spawnLightningChain, spawnPoisonCloud, spawnTeleportEffect,
  spawnBlackholeEffect, spawnDragonBreath, spawnNecromancerAura,
} from "../graphics.js";
import { TextPool, CirclePool, distSq } from "../utils.js";
import { achievements } from "../achievements.js";
import { showAchievementToast } from "../achievementToast.js";
import { t } from "../i18n.js";

export class GameScene extends Phaser.Scene {
  constructor() { super("GameScene"); }

  create() {
    audio.ensure();

    this.textPool = new TextPool(this, 40);
    this.circlePool = new CirclePool(this, 80);

    this.adPaused = false;
    this.waveInProgress = false;
    this.gameOverState = false;
    this.pendingReward = null;
    this.popupObjects = [];
    this.heroes = [];
    this.gridItems = new Map();
    this.selectedTool = "spikes";
    this.dragItem = null;
    this.dragOriginCell = null;
    this.dragGraphic = null;
    this.toolPage = 0;
    this.toolsPerPage = 4;
    this.bossSpawned = false;
    this.bossType = null;
    this.waveGoldEarned = 0;
    this.waveSoulsEarned = 0;
    this.waveKills = 0;
    this.crystalHP = saveManager.data.crystalHP || saveManager.data.maxCrystalHP;

    // Флаг второго шанса и autoHeal-таймер
    this._usedSecondChanceThisRun = false;
    this._autoHealTimer = 0;

    this._precomputeGrid();
    this.heroesByCol = Array.from({ length: GAME_CONFIG.grid.cols }, () => []);
    this._uiCache = { wave: -1, gold: -1, souls: -1, hp: -1, maxHp: -1 };

    this._achUnlockHandler = (ach) => showAchievementToast(this, ach);
    achievements.onUnlock(this._achUnlockHandler);

    this.createBackground();
    this.createTopUI();
    this.drawGrid();
    this.createCrystal();
    this.createBottomUI();
    this.restoreBoard();
    this.refreshUI(true);

    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);

    this._visHandler = () => { if (document.hidden) this.persistProgress(); };
    document.addEventListener("visibilitychange", this._visHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("visibilitychange", this._visHandler);
      this.input.off("pointerdown", this.onPointerDown, this);
      this.input.off("pointermove", this.onPointerMove, this);
      this.input.off("pointerup", this.onPointerUp, this);
      this.textPool?.destroyAll();
      this.circlePool?.destroyAll();
      const idx = achievements.onUnlockCallbacks.indexOf(this._achUnlockHandler);
      if (idx !== -1) achievements.onUnlockCallbacks.splice(idx, 1);
      this.persistProgress();
    });
  }

  _precomputeGrid() {
    const g = GAME_CONFIG.grid;
    this._cellCenters = [];
    for (let r = 0; r < g.rows; r++) {
      const row = [];
      for (let c = 0; c < g.cols; c++) {
        row.push({ x: g.offsetX + c * g.cell + g.cell / 2, y: g.offsetY + r * g.cell + g.cell / 2 });
      }
      this._cellCenters.push(row);
    }
    this._gridBounds = {
      x1: g.offsetX, x2: g.offsetX + g.cols * g.cell,
      y1: g.offsetY, y2: g.offsetY + g.rows * g.cell,
      bottomY: g.offsetY + g.rows * g.cell + 10,
    };
  }

  cellCenter(row, col) { return this._cellCenters[row][col]; }

  createBackground() {
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);
    const g = GAME_CONFIG.grid;
    const w = g.cols * g.cell, h = g.rows * g.cell;
    this.add.rectangle(g.offsetX + w / 2, g.offsetY + h / 2, w + 10, h + 10, 0x10101a).setStrokeStyle(2, 0x00fff5, 0.6);
    for (let c = 0; c < g.cols; c++) {
      const ax = this._cellCenters[0][c].x;
      const arrow = this.add.text(ax, g.offsetY - 12, "▼", { fontFamily: "Arial", fontSize: "14px", color: "#ff6b6b" }).setOrigin(0.5);
      this.tweens.add({ targets: arrow, y: g.offsetY - 6, yoyo: true, repeat: -1, duration: 600, ease: "Sine.easeInOut" });
    }
  }

  drawGrid() {
    const g = this.add.graphics(), grid = GAME_CONFIG.grid;
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
      const x = grid.offsetX + c * grid.cell, y = grid.offsetY + r * grid.cell;
      g.fillStyle((r + c) % 2 === 0 ? 0x23233a : 0x2a2a44, 1);
      g.fillRect(x, y, grid.cell, grid.cell);
      g.lineStyle(1, 0x3b4d7d, 0.5);
      g.strokeRect(x, y, grid.cell, grid.cell);
    }
  }

  createCrystal() {
    const cy = this._gridBounds.bottomY + 12;
    this.crystalY = cy;
    this.add.circle(270, cy, 18, 0x00fff5, 0.12);
    const cg = this.add.graphics();
    cg.fillStyle(0x00fff5, 0.9); cg.fillTriangle(0, -14, 12, 0, 0, 14);
    cg.fillStyle(0x00cccc, 0.9); cg.fillTriangle(0, -14, -12, 0, 0, 14);
    cg.fillStyle(0xffffff, 0.4); cg.fillTriangle(-2, -8, 3, -2, 0, -2);
    cg.setPosition(270, cy);
  }

  createTopUI() {
    createButton(this, 50, 26, 75, 34, t("game_menu"), async () => {
      await this.persistProgress(); this.scene.start("MenuScene");
    }, { textSize: "14px" });
    createButton(this, 140, 26, 85, 34, t("game_shop"), async () => {
      await this.persistProgress(); this.scene.start("ShopScene");
    }, { textSize: "13px", color: 0x3b2d5e, hoverColor: 0x5a40a0, stroke: 0xb388ff });
    this.waveText = this.add.text(240, 12, "", { fontFamily: "Arial", fontSize: "18px", color: "#ffffff", fontStyle: "bold" });
    this.goldText = this.add.text(240, 34, "", { fontFamily: "Arial", fontSize: "16px", color: "#ffd700" });
    this.soulsText = this.add.text(370, 34, "", { fontFamily: "Arial", fontSize: "16px", color: "#57ffb8" });
    this.hpText = this.add.text(240, 54, "", { fontFamily: "Arial", fontSize: "16px", color: "#7efcff" });
    this.hpBarBg = this.add.rectangle(270, 76, 280, 8, 0x111122).setStrokeStyle(1, 0x3b4d7d);
    this.hpBarFill = this.add.rectangle(270 - 140, 76, 280, 8, 0x00fff5).setOrigin(0, 0.5);
  }

  createBottomUI() {
    this.helpText = this.add.text(270, 740, "", { fontFamily: "Arial", fontSize: "16px", color: "#d7defa", align: "center" }).setOrigin(0.5);
    this.mergeHint = this.add.text(270, 760, t("game_merge_hint"), { fontFamily: "Arial", fontSize: "11px", color: "#556688", align: "center" }).setOrigin(0.5);
    this.toolInfoText = this.add.text(270, 778, "", { fontFamily: "Arial", fontSize: "11px", color: "#8899bb", align: "center", wordWrap: { width: 460 } }).setOrigin(0.5);
    this.toolbarY = 825;
    this.toolbarBtns = [];
    this.rebuildToolbar();
    this.eraseBtn = createButton(this, 500, this.toolbarY, 44, 44, "❌", () => this.selectTool("erase"),
      { textSize: "16px", color: 0x5c2b2b, hoverColor: 0x7d3939, stroke: 0xff8a8a });
    this.startWaveButton = createButton(this, 270, 875, 300, 40, t("game_start_wave"), () => this.startWave(),
      { color: 0x285c3b, hoverColor: 0x31804f, stroke: 0x7effa7, textSize: "18px" });
    this.selectTool("spikes");
    this.helpText.setText(t("game_place_defense"));
  }

  rebuildToolbar() {
    for (const e of this.toolbarBtns) e.btn.destroy();
    this.toolbarBtns = [];
    if (this._arrowL) { this._arrowL.destroy(); this._arrowL = null; }
    if (this._arrowR) { this._arrowR.destroy(); this._arrowR = null; }
    const wave = saveManager.data.wave;
    const unlocked = Object.values(TOOL_DEFS).filter(t => isToolUnlocked(t, wave));
    const pp = this.toolsPerPage, tp = Math.ceil(unlocked.length / pp);
    this.toolPage = Math.max(0, Math.min(this.toolPage, tp - 1));
    const visible = unlocked.slice(this.toolPage * pp, this.toolPage * pp + pp);
    const btnW = 70, gap = 6;
    const areaW = pp * (btnW + gap) - gap;
    const areaStartX = 230 - areaW / 2 + btnW / 2;
    for (let i = 0; i < visible.length; i++) {
      const def = visible[i];
      const x = areaStartX + i * (btnW + gap);
      const cost = getToolCost(def, saveManager.data);
      const btn = createButton(this, x, this.toolbarY, btnW, 44, `${def.icon}\n${cost}🪙`, () => this.selectTool(def.id), { textSize: "12px" });
      this.toolbarBtns.push({ id: def.id, btn });
    }
    if (tp > 1) {
      const aW = 24;
      if (this.toolPage > 0) this._arrowL = createButton(this, areaStartX - btnW / 2 - aW / 2 - 4, this.toolbarY, aW, 44, "◀",
        () => { this.toolPage--; this.rebuildToolbar(); this.selectTool(this.selectedTool); },
        { textSize: "14px", color: 0x333355, hoverColor: 0x555588, stroke: 0x7799cc });
      if (this.toolPage < tp - 1) this._arrowR = createButton(this, areaStartX + (pp - 1) * (btnW + gap) + btnW / 2 + aW / 2 + 4, this.toolbarY, aW, 44, "▶",
        () => { this.toolPage++; this.rebuildToolbar(); this.selectTool(this.selectedTool); },
        { textSize: "14px", color: 0x333355, hoverColor: 0x555588, stroke: 0x7799cc });
    }
  }

  selectTool(tool) {
    this.selectedTool = tool;
    for (const e of this.toolbarBtns) e.btn.setSelected(e.id === tool);
    this.eraseBtn?.setSelected(tool === "erase");
    audio.selectTool();
    if (tool === "erase") this.toolInfoText.setText(t("game_erase_hint"));
    else {
      const def = TOOL_DEFS[tool];
      if (def) {
        const cost = getToolCost(def, saveManager.data);
        const dmg = computeDamage(def, 1, saveManager.data, false).damage;
        this.toolInfoText.setText(t("game_tool_info", toolLabel(def), toolDesc(def), cost, dmg));
      }
    }
  }

  restoreBoard() { for (const i of saveManager.data.board) this.spawnBoardPiece(i, false); }

  spawnBoardPiece(data, withEffect = true) {
    const def = TOOL_DEFS[data.type]; if (!def) return;
    const pos = this.cellCenter(data.row, data.col);
    const lvl = Math.min(data.level || 1, MAX_MERGE_LEVEL);
    const graphic = drawPiece(this, data.type, def.kind, lvl);
    const children = [graphic];
    let lvlLabel = null;
    if (lvl > 1) {
      lvlLabel = this.add.text(16, 14, `${lvl}`, { fontFamily: "Arial", fontSize: "12px", color: "#ffffff", fontStyle: "bold", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5);
      children.push(lvlLabel);
    }
    const container = this.add.container(pos.x, pos.y, children).setSize(GAME_CONFIG.grid.cell, GAME_CONFIG.grid.cell);
    const piece = { row: data.row, col: data.col, kind: def.kind, type: data.type, level: lvl, cooldown: 0, buffTimer: 0, _buffMult: 1, container, graphic, lvlLabel };
    this.gridItems.set(this.cellKey(data.row, data.col), piece);
    if (withEffect) spawnPlaceEffect(this, pos.x, pos.y, def.kind === "trap" ? 0xffaa00 : 0x57ffb8);
  }

  removePiece(key) {
    const p = this.gridItems.get(key); if (!p) return;
    p.container.destroy(true);
    this.gridItems.delete(key);
  }

  onPointerDown(pointer) {
    if (this.popupObjects.length > 0) return;
    if (!this.isInsideGrid(pointer.x, pointer.y)) return;
    const { row, col } = this.pointerToCell(pointer.x, pointer.y);
    const key = this.cellKey(row, col);
    const existing = this.gridItems.get(key);
    if (this.selectedTool === "erase") { if (existing) this.eraseAtCell(key, existing, pointer); return; }
    if (existing && !this.waveInProgress) { this.startDrag(existing, key); return; }
    if (!existing && !this.waveInProgress) this.placeNewPiece(row, col, pointer);
  }

  onPointerMove(pointer) { if (this.dragItem && this.dragGraphic) this.dragGraphic.setPosition(pointer.x, pointer.y); }

  onPointerUp(pointer) {
    if (!this.dragItem) return;
    const item = this.dragItem, originKey = this.dragOriginCell;
    if (this.dragGraphic) { this.dragGraphic.destroy(true); this.dragGraphic = null; }
    item.container.setAlpha(1);
    this.dragItem = null; this.dragOriginCell = null;
    if (!this.isInsideGrid(pointer.x, pointer.y)) return;
    const { row, col } = this.pointerToCell(pointer.x, pointer.y);
    const targetKey = this.cellKey(row, col);
    if (targetKey === originKey) return;
    const tp = this.gridItems.get(targetKey);
    if (tp) this.tryMerge(item, originKey, tp, targetKey, pointer);
    else this.movePiece(item, originKey, row, col, targetKey);
    this.refreshUI();
    saveManager.saveThrottled();
  }

  startDrag(piece, key) {
    this.dragItem = piece; this.dragOriginCell = key;
    piece.container.setAlpha(0.35);
    const def = TOOL_DEFS[piece.type];
    const c = def.mergeColors?.[piece.level - 1] || def.color;
    this.dragGraphic = (def.kind === "trap"
      ? this.add.rectangle(piece.container.x, piece.container.y, 28, 28, c, 0.6).setStrokeStyle(2, 0xffffff)
      : this.add.circle(piece.container.x, piece.container.y, 16, c, 0.6)).setDepth(5000);
  }

  tryMerge(source, sKey, target, tKey, pointer) {
    if (source.type === target.type && source.level === target.level && source.level < MAX_MERGE_LEVEL) {
      const nl = source.level + 1;
      this.removePiece(sKey); this.removePiece(tKey);
      const [r, c] = tKey.split("_").map(Number);
      this.spawnBoardPiece({ row: r, col: c, kind: source.kind, type: source.type, level: nl });
      const pos = this.cellCenter(r, c);
      floatText(this, pos.x, pos.y - 25, t("game_merge_success", nl), "#ffd700", 20);
      spawnMergeEffect(this, pos.x, pos.y); audio.merge();
      const np = this.gridItems.get(tKey); if (np) this.pulsePiece(np);

      saveManager.incStat("totalMerges", 1);
      if (nl >= MAX_MERGE_LEVEL) saveManager.setStatMax("maxLevelMerge", 1);
      achievements.checkAll();
    } else {
      const msg = source.type !== target.type ? t("game_diff_types")
        : source.level !== target.level ? t("game_diff_levels") : t("game_max_level");
      floatText(this, pointer.x, pointer.y - 20, msg, "#ff8f8f", 15); audio.mergeFail();
    }
  }

  movePiece(piece, oldKey, nr, nc, newKey) {
    this.gridItems.delete(oldKey);
    piece.row = nr; piece.col = nc;
    const pos = this.cellCenter(nr, nc);
    piece.container.setPosition(pos.x, pos.y);
    this.gridItems.set(newKey, piece);
  }

  eraseAtCell(key, piece, pointer) {
    const def = TOOL_DEFS[piece.type];
    const refundPercent = saveManager.data.eraseRefundBonus ?? 0.5;
    const refund = Math.floor(getToolCost(def, saveManager.data) * refundPercent * piece.level);
    saveManager.data.gold += refund;
    this.removePiece(key);
    floatText(this, pointer.x, pointer.y - 10, `+${refund}🪙`, "#ffd700", 16);
    audio.erase();
    this.refreshUI();
    saveManager.saveThrottled();
  }

  placeNewPiece(row, col, pointer) {
    const def = TOOL_DEFS[this.selectedTool]; if (!def) return;
    if (!isToolUnlocked(def, saveManager.data.wave)) {
      floatText(this, pointer.x, pointer.y - 10, t("game_not_unlocked"), "#ff8f8f", 15); audio.error(); return;
    }
    const cost = getToolCost(def, saveManager.data);
    if (saveManager.data.gold < cost) {
      floatText(this, pointer.x, pointer.y - 10, t("game_not_enough_gold"), "#ff8f8f", 16); audio.error(); return;
    }
    saveManager.data.gold -= cost;
    this.spawnBoardPiece({ row, col, kind: def.kind, type: def.id, level: 1 });
    floatText(this, pointer.x, pointer.y - 10, `-${cost}`, "#ffd700", 16);
    audio.place();
    this.refreshUI();
    saveManager.saveThrottled();
  }

  startWave() {
    if (this.waveInProgress || this.pendingReward || this.gameOverState) return;
    // Сброс флагов на старте волны
    this._usedSecondChanceThisRun = false;
    this._autoHealTimer = 0;

    this.waveInProgress = true;
    this.spawnedCount = 0;
    this.totalToSpawn = getWaveEnemyCount(saveManager.data.wave);
    this.spawnInterval = 900;
    this.spawnTimer = 0;
    this.bossSpawned = false;
    this.bossType = getBossForWave(saveManager.data.wave);
    this.waveGoldEarned = 0; this.waveSoulsEarned = 0; this.waveKills = 0;
    const bl = this.bossType ? t("game_boss_marker", heroLabel(this.bossType)) : "";
    this.helpText.setText(t("game_wave_ongoing", saveManager.data.wave) + bl);
    this.startWaveButton.setLabel(t("game_wave_running"));
    audio.waveStart();
    if (this.bossType) this.time.delayedCall(500, () => spawnBossWarning(this));
  }

  spawnHero(forceBoss = false) {
    const wave = saveManager.data.wave;
    const bHP = getBaseHeroHP(wave), bSpd = getBaseHeroSpeed(wave);
    const td = forceBoss && this.bossType ? (this.bossSpawned = true, this.bossType) : pickHeroType(wave);
    const hp = Math.floor(bHP * td.hpMult);
    const speed = Math.floor(bSpd * td.speedMult);
    const col = Phaser.Math.Between(0, GAME_CONFIG.grid.cols - 1);
    const g = GAME_CONFIG.grid;
    const x = g.offsetX + col * g.cell + g.cell / 2, y = g.offsetY - 20;
    const graphic = drawHeroByType(this, td.id);
    const scale = td.scale || 1;
    graphic.setScale(scale);
    const hpW = td.isBoss ? 48 : 36;
    const hpBg = this.add.rectangle(0, -22 * scale, hpW, 4, 0x000000);
    const hpFill = this.add.rectangle(-hpW / 2, -22 * scale, hpW, 4, td.isBoss ? 0xff4444 : 0x57ffb8).setOrigin(0, 0.5);
    const children = [graphic, hpBg, hpFill];
    if (td.isBoss) children.push(this.add.text(0, -32 * scale, "👑", { fontFamily: "Arial", fontSize: "16px" }).setOrigin(0.5));
    const container = this.add.container(x, y, children);
    const hero = {
      col, hp, maxHp: hp, lastRenderedHp: hp,
      speed, speedMultiplier: 1, slowUntil: 0, dead: false,
      typeDef: td, isBoss: td.isBoss, shieldHits: td.shieldHits || 0,
      disableTraps: td.disableTraps || false,
      summonTimer: 0, healTimer: 0,
      poisonEndTime: 0, poisonDPS: 0, poisonTimer: 0,
      container, graphic, hpBg, hpFill, hpBarWidth: hpW,
      row: -1,
    };
    this.heroes.push(hero);
    this.heroesByCol[col].push(hero);
    if (td.isBoss) this.cameras.main.shake(200, 0.008);
  }

  spawnSummonedHero(boss) {
    const wave = saveManager.data.wave, td = HERO_TYPES.peasant;
    const hp = Math.floor(getBaseHeroHP(wave) * td.hpMult * 0.6);
    const speed = Math.floor(getBaseHeroSpeed(wave) * td.speedMult * 1.2);
    const g = GAME_CONFIG.grid;
    const col = Phaser.Math.Clamp(boss.col + Phaser.Math.Between(-1, 1), 0, g.cols - 1);
    const x = g.offsetX + col * g.cell + g.cell / 2, y = boss.container.y - 10;
    const graphic = drawHeroByType(this, "peasant");
    const hpBg = this.add.rectangle(0, -22, 36, 4, 0x000000);
    const hpFill = this.add.rectangle(-18, -22, 36, 4, 0xffaa44).setOrigin(0, 0.5);
    const container = this.add.container(x, y, [graphic, hpBg, hpFill]);
    const hero = { col, hp, maxHp: hp, lastRenderedHp: hp, speed, speedMultiplier: 1, slowUntil: 0, dead: false, typeDef: td, isBoss: false, shieldHits: 0, disableTraps: false, summonTimer: 0, healTimer: 0, poisonEndTime: 0, poisonDPS: 0, poisonTimer: 0, container, graphic, hpBg, hpFill, hpBarWidth: 36, row: -1 };
    this.heroes.push(hero);
    this.heroesByCol[col].push(hero);
    spawnPlaceEffect(this, x, y, 0xffaa44);
  }

  update(time, delta) {
    if (this.adPaused || !this.waveInProgress) return;
    this.spawnTimer += delta;
    while (this.spawnedCount < this.totalToSpawn && this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      if (this.bossType && !this.bossSpawned && this.spawnedCount >= Math.floor(this.totalToSpawn / 2)) this.spawnHero(true);
      else this.spawnHero(false);
      this.spawnedCount++;
    }
    this.updateHeroes(time, delta);
    this.processTraps(time, delta);
    this.processNecromancerBuffs(delta);
    this.processMonsters(time, delta);
    this.processBossAbilities(delta);
    this.processHealers(delta);
    this.processPoison(time, delta);
    this._processAutoHeal(delta);
    this.checkWaveEnd();
  }

  _processAutoHeal(delta) {
    const amount = saveManager.data.autoHealAmount ?? 0;
    if (amount <= 0) return;
    if (!this._autoHealTimer) this._autoHealTimer = 0;
    this._autoHealTimer += delta;
    const interval = saveManager.data.autoHealInterval ?? 15000;
    if (this._autoHealTimer >= interval) {
      this._autoHealTimer -= interval;
      if (this.crystalHP < saveManager.data.maxCrystalHP) {
        this.crystalHP = Math.min(saveManager.data.maxCrystalHP, this.crystalHP + amount);
        floatText(this, 270, this.crystalY - 20, `+${amount} HP`, "#88ff88", 16);
        audio.crystalHeal();
        this.refreshUI();
      }
    }
  }

  updateHeroes(time, delta) {
    const grid = GAME_CONFIG.grid;
    const botY = this._gridBounds.bottomY;
    const dt = delta / 1000;
    for (let i = this.heroes.length - 1; i >= 0; i--) {
      const hero = this.heroes[i];
      if (hero.dead) continue;
      const sm = hero.slowUntil > time ? hero.speedMultiplier : 1;
      hero.container.y += hero.speed * sm * dt;
      const newRow = Math.floor((hero.container.y - grid.offsetY) / grid.cell);
      if (newRow !== hero.row) hero.row = newRow;
      if (hero.hp !== hero.lastRenderedHp) {
        hero.lastRenderedHp = hero.hp;
        const r = Math.max(0, hero.hp / hero.maxHp);
        hero.hpFill.width = hero.hpBarWidth * r;
        hero.hpFill.setFillStyle(r > 0.5 ? (hero.isBoss ? 0xff4444 : 0x57ffb8) : r > 0.25 ? 0xffd166 : 0xff4757);
      }
      if (hero.container.y >= botY) this.leakHero(hero);
    }
  }

  processTraps(time, delta) {
    const cellSize = GAME_CONFIG.grid.cell;
    for (const piece of this.gridItems.values()) {
      if (piece.kind !== "trap") continue;
      piece.cooldown -= delta;
      if (piece.cooldown > 0) continue;
      const def = TOOL_DEFS[piece.type];
      const pPos = this.cellCenter(piece.row, piece.col);

      if (def.id === "blackhole") {
        const pullR2 = ((def.pullRadius || 2.5) * cellSize) ** 2;
        const closeR2 = (cellSize * 0.7) ** 2;
        let anyPulled = false;
        for (const h of this.heroes) {
          if (h.dead) continue;
          const d2 = distSq(h.container.x, h.container.y, pPos.x, pPos.y);
          if (d2 <= pullR2 && d2 > 100) {
            const angle = Math.atan2(pPos.y - h.container.y, pPos.x - h.container.x);
            h.container.x += Math.cos(angle) * 12;
            h.container.y += Math.sin(angle) * 8;
            anyPulled = true;
            if (d2 < closeR2) {
              const isBoss = h.isBoss || false;
              const { damage: aoeDmg, isCrit } = computeDamage({ damage: def.aoeDamage || 15, kind: "trap" }, piece.level, saveManager.data, isBoss);
              this.damageHero(h, aoeDmg, isCrit);
            }
          }
        }
        if (anyPulled) { spawnBlackholeEffect(this, pPos.x, pPos.y); audio.trapHit(); }
        piece.cooldown = getTrapCooldown(def, saveManager.data); this.pulsePiece(piece); continue;
      }

      if (def.id === "teleport") {
        const target = this._findHeroInCell(piece.row, piece.col);
        if (!target) continue;
        const rows = (def.teleportRows || 5) + piece.level;
        target.container.y = Math.max(GAME_CONFIG.grid.offsetY, target.container.y - rows * cellSize);
        spawnTeleportEffect(this, pPos.x, pPos.y);
        spawnTeleportEffect(this, target.container.x, target.container.y);
        floatText(this, pPos.x, pPos.y - 20, t("game_teleport"), "#cc88ff", 14);
        audio.trapHit();
        piece.cooldown = getTrapCooldown(def, saveManager.data); this.pulsePiece(piece); continue;
      }

      if (def.id === "lightning") {
        const target = this._findHeroInCell(piece.row, piece.col);
        if (!target) continue;
        const isBoss = target.isBoss || false;
        const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, isBoss);
        this.damageHero(target, dmg, isCrit);
        const chainCount = (def.chainCount || 3) + Math.floor(piece.level / 2);
        const chainR2 = ((def.chainRange || 2.5) * cellSize) ** 2;
        let lastX = target.container.x, lastY = target.container.y;
        const hit = new Set([target]);
        for (let c = 0; c < chainCount; c++) {
          let next = null, bestD2 = Infinity;
          for (const h of this.heroes) {
            if (h.dead || hit.has(h)) continue;
            const d2 = distSq(h.container.x, h.container.y, lastX, lastY);
            if (d2 <= chainR2 && d2 < bestD2) { bestD2 = d2; next = h; }
          }
          if (!next) break;
          hit.add(next);
          spawnLightningChain(this, lastX, lastY, next.container.x, next.container.y);
          this.damageHero(next, Math.floor(dmg * 0.7), isCrit);
          lastX = next.container.x; lastY = next.container.y;
        }
        spawnLightningChain(this, pPos.x, pPos.y, target.container.x, target.container.y);
        audio.trapHit();
        piece.cooldown = getTrapCooldown(def, saveManager.data); this.pulsePiece(piece); continue;
      }

      if (def.id === "poison") {
        const target = this._findHeroInCell(piece.row, piece.col);
        if (!target) continue;
        const isBoss = target.isBoss || false;
        const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, isBoss);
        this.damageHero(target, dmg, isCrit);
        target.poisonDPS = Math.floor((def.poisonDPS || 8) * piece.level * (saveManager.data.poisonBonus ?? 1));
        target.poisonEndTime = time + (def.poisonDuration || 5000);
        target.poisonTimer = 0;
        spawnPoisonCloud(this, pPos.x, pPos.y);
        audio.trapHit();
        piece.cooldown = getTrapCooldown(def, saveManager.data); this.pulsePiece(piece); continue;
      }

      const target = this._findHeroInCellIgnoreImmune(piece.row, piece.col);
      if (!target) continue;
      const isBoss = target.isBoss || false;
      const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, isBoss);
      this.damageHero(target, dmg, isCrit);
      if (def.slowFactor) {
        target.speedMultiplier = def.slowFactor;
        target.slowUntil = time + (def.slowDuration || 2000) * (saveManager.data.slowBonus ?? 1);
      }
      piece.cooldown = getTrapCooldown(def, saveManager.data);
      this.pulsePiece(piece);
      audio.trapHit();
    }
  }

  _findHeroInCell(row, col) {
    const list = this.heroesByCol[col];
    for (const h of list) if (!h.dead && h.row === row) return h;
    return null;
  }
  _findHeroInCellIgnoreImmune(row, col) {
    const list = this.heroesByCol[col];
    for (const h of list) if (!h.dead && !h.disableTraps && h.row === row) return h;
    return null;
  }

  processMonsters(time, delta) {
    const cellSize = GAME_CONFIG.grid.cell;
    for (const piece of this.gridItems.values()) {
      if (piece.kind !== "monster") continue;
      piece.cooldown -= delta;
      if (piece.cooldown > 0) continue;
      const def = TOOL_DEFS[piece.type];
      const pPos = this.cellCenter(piece.row, piece.col);
      const maxDist = getToolRange(def, saveManager.data) * cellSize;
      const maxDist2 = maxDist * maxDist;
      const buffMult = piece._buffMult || 1;

      if (def.id === "dragon") {
        const widthLimit = cellSize * (def.breathWidth || 1);
        let farthestY = pPos.y;
        const targets = [];
        for (const h of this.heroes) {
          if (h.dead) continue;
          const dx = Math.abs(h.container.x - pPos.x);
          const dy = h.container.y - pPos.y;
          if (dx <= widthLimit && dy < 0 && -dy <= maxDist) {
            targets.push(h);
            if (h.container.y < farthestY) farthestY = h.container.y;
          }
        }
        if (targets.length === 0) continue;
        // AoE: крит один раз для группы (без учёта босса)
        const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, false);
        const buffedDmg = Math.floor(dmg * buffMult);
        for (const tgt of targets) this.damageHero(tgt, buffedDmg, isCrit);
        spawnDragonBreath(this, pPos.x, pPos.y, farthestY);
        audio.monsterAttack();
        piece.cooldown = getMonsterCooldown(def, saveManager.data); this.pulsePiece(piece); continue;
      }

      if (def.id === "elemental") {
        const aoeR2 = ((def.aoeRange || 2) * cellSize) ** 2;
        const targets = [];
        for (const h of this.heroes) {
          if (h.dead) continue;
          if (distSq(h.container.x, h.container.y, pPos.x, pPos.y) <= aoeR2) targets.push(h);
        }
        if (targets.length === 0) continue;
        // AoE: крит один раз для группы
        const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, false);
        const buffedDmg = Math.floor(dmg * buffMult);
        for (const tgt of targets) this.damageHero(tgt, buffedDmg, isCrit);
        spawnDeathParticles(this, pPos.x, pPos.y, 0xff6348, 6);
        audio.monsterAttack();
        piece.cooldown = getMonsterCooldown(def, saveManager.data); this.pulsePiece(piece); continue;
      }

      let target = null, bestD2 = Infinity;
      for (const h of this.heroes) {
        if (h.dead) continue;
        const d2 = distSq(h.container.x, h.container.y, pPos.x, pPos.y);
        if (d2 <= maxDist2 && d2 < bestD2) { bestD2 = d2; target = h; }
      }
      if (!target) continue;

      // Одиночный удар — учитываем, босс ли цель
      const isBossTarget = target.isBoss;
      const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, isBossTarget);
      const buffedDmg = Math.floor(dmg * buffMult);
      this.damageHero(target, buffedDmg, isCrit);

      if (def.id === "dark_knight" && bestD2 < (cellSize * 1.2) ** 2) {
        const counterDmg = Math.floor((def.counterDamage || 20) * piece.level * (saveManager.data.monsterDamageBonus ?? 1));
        this.time.delayedCall(200, () => {
          if (!target.dead) {
            this.damageHero(target, counterDmg);
            floatText(this, target.container.x, target.container.y - 35, t("game_counter"), "#ff8844", 12);
          }
        });
      }
      piece.cooldown = getMonsterCooldown(def, saveManager.data);
      this.pulsePiece(piece);
      audio.monsterAttack();
    }
  }

  processNecromancerBuffs(delta) {
    for (const p of this.gridItems.values()) if (p.kind === "monster") p._buffMult = 1;
    const cellSize = GAME_CONFIG.grid.cell;
    for (const necro of this.gridItems.values()) {
      if (necro.type !== "necromancer") continue;
      const def = TOOL_DEFS.necromancer;
      const buffR2 = ((def.buffRadius || 2) * cellSize) ** 2;
      const buffAmt = (def.buffAmount || 0.3) * necro.level;
      const nPos = this.cellCenter(necro.row, necro.col);
      necro.buffTimer = (necro.buffTimer || 0) + delta;
      if (necro.buffTimer >= 2000) { necro.buffTimer = 0; spawnNecromancerAura(this, nPos.x, nPos.y); }
      for (const other of this.gridItems.values()) {
        if (other === necro || other.kind !== "monster") continue;
        const oPos = this.cellCenter(other.row, other.col);
        if (distSq(oPos.x, oPos.y, nPos.x, nPos.y) <= buffR2) other._buffMult = (other._buffMult || 1) + buffAmt;
      }
    }
  }

  processPoison(time, delta) {
    for (const hero of this.heroes) {
      if (hero.dead || hero.poisonEndTime <= time || !hero.poisonDPS) continue;
      hero.poisonTimer += delta;
      if (hero.poisonTimer >= 1000) {
        hero.poisonTimer -= 1000;
        hero.hp -= hero.poisonDPS;
        floatText(this, hero.container.x, hero.container.y - 25, `-${hero.poisonDPS}`, "#cc66ff", 12);
        hero.graphic.setTint(0x9b59b6);
        this.time.delayedCall(200, () => { if (!hero.dead) hero.graphic.clearTint(); });
        if (hero.hp <= 0) this.killHero(hero);
      }
    }
  }

  processBossAbilities(delta) {
    for (const hero of this.heroes) {
      if (hero.dead || !hero.isBoss || !hero.typeDef.summonInterval) continue;
      hero.summonTimer += delta;
      if (hero.summonTimer >= hero.typeDef.summonInterval) {
        hero.summonTimer = 0;
        for (let i = 0; i < (hero.typeDef.summonCount || 1); i++) this.spawnSummonedHero(hero);
        floatText(this, hero.container.x, hero.container.y - 30, t("game_reinforcement"), "#ffaa00", 14);
      }
    }
  }

  processHealers(delta) {
    for (const hero of this.heroes) {
      if (hero.dead || hero.typeDef.id !== "healer") continue;
      hero.healTimer += delta;
      if (hero.healTimer < (hero.typeDef.healInterval || 3000)) continue;
      hero.healTimer = 0;
      let target = null, bestD = Infinity;
      for (const h of this.heroes) {
        if (h.dead || h === hero || h.hp >= h.maxHp) continue;
        const d = Math.abs(h.container.y - hero.container.y) + Math.abs(h.container.x - hero.container.x);
        if (d < 200 && d < bestD) { bestD = d; target = h; }
      }
      if (!target) continue;
      const amt = Math.floor(target.maxHp * (hero.typeDef.healAmount || 0.1));
      target.hp = Math.min(target.maxHp, target.hp + amt);
      floatText(this, target.container.x, target.container.y - 25, `+${amt}`, "#88ff88", 13);
    }
  }

  damageHero(hero, amount, isCrit = false) {
    if (!hero || hero.dead) return;
    if (hero.shieldHits > 0) {
      hero.shieldHits--;
      floatText(this, hero.container.x, hero.container.y - 28, t("game_shield_block"), "#ffd700", 14);
      audio.click();
      return;
    }
    hero.hp -= amount;

    const color = isCrit ? "#ffff00" : "#ff8f8f";
    const size = isCrit ? 18 : 15;
    const prefix = isCrit ? "КРИТ! " : "";
    floatText(this,
      hero.container.x + Phaser.Math.Between(-8, 8),
      hero.container.y - 28,
      `${prefix}-${amount}`, color, size
    );

    hero.graphic.setAlpha(0.4);
    this.time.delayedCall(80, () => { if (!hero.dead) hero.graphic.setAlpha(1); });
    if (hero.hp <= 0) this.killHero(hero);
  }

  killHero(hero) {
    if (hero.dead) return;
    hero.dead = true;
    const reward = getHeroReward(hero.typeDef, saveManager.data);
    saveManager.data.gold += reward.gold;
    saveManager.data.souls += reward.souls;
    this.waveGoldEarned += reward.gold;
    this.waveSoulsEarned += reward.souls;
    this.waveKills++;

    saveManager.incStat("totalKills", 1);
    if (hero.isBoss) saveManager.incStat("bossKills", 1);

    const fs = hero.isBoss ? 18 : 13;
    floatText(this, hero.container.x - 14, hero.container.y - 10, `+${reward.gold}🪙`, hero.isBoss ? "#ffff00" : "#ffd700", fs);
    floatText(this, hero.container.x + 14, hero.container.y - 10, `+${reward.souls}💀`, hero.isBoss ? "#00ffaa" : "#57ffb8", fs);
    if (hero.isBoss) {
      spawnDeathParticles(this, hero.container.x, hero.container.y, 0xffd700, 16);
      floatText(this, hero.container.x, hero.container.y - 40, t("game_boss_defeated", heroLabel(hero.typeDef)), "#ffff00", 20);
      audio.levelUp();
    }
    else {
      spawnDeathParticles(this, hero.container.x, hero.container.y, 0xffffff, 8);
      audio.heroDeath();
    }
    this.removeHero(hero);
    this.refreshUI();

    if (this.waveKills % 5 === 0 || hero.isBoss) achievements.checkAll();
  }

  leakHero(hero) {
    if (hero.dead) return;
    hero.dead = true;
    const baseDmg = hero.isBoss ? 3 : 1;
    const reduction = saveManager.data.crystalDamageReduction ?? 0;
    const dmg = Math.max(1, Math.ceil(baseDmg * (1 - reduction)));

    this.crystalHP = Math.max(0, this.crystalHP - dmg);
    this.cameras.main.shake(hero.isBoss ? 300 : 80, hero.isBoss ? 0.015 : 0.006);
    floatText(this, 270, this.crystalY - 20, `-${dmg} HP`, "#ff4444", hero.isBoss ? 22 : 17);
    spawnDeathParticles(this, hero.container.x, hero.container.y, 0xff6666, 5);
    audio.heroLeak();
    this.removeHero(hero);
    this.refreshUI();

    if (this.crystalHP <= 0) {
      // === ВТОРОЙ ШАНС ===
      if ((saveManager.data.secondChanceCharges ?? 0) > 0 && !this._usedSecondChanceThisRun) {
        this._usedSecondChanceThisRun = true;
        saveManager.data.secondChanceCharges--;
        this.crystalHP = Math.floor(saveManager.data.maxCrystalHP * 0.5);
        floatText(this, 270, this.crystalY - 50, "ВТОРОЙ ШАНС!", "#ffff00", 24);
        audio.crystalHeal();
        this.refreshUI();
        return;
      }
      this.onGameOver();
    }
  }

  removeHero(hero) {
    hero.container.destroy(true);
    const i = this.heroes.indexOf(hero);
    if (i !== -1) this.heroes.splice(i, 1);
    const list = this.heroesByCol[hero.col];
    const j = list.indexOf(hero);
    if (j !== -1) list.splice(j, 1);
  }

  clearHeroes() {
    for (const h of this.heroes) h.container.destroy(true);
    this.heroes.length = 0;
    for (const list of this.heroesByCol) list.length = 0;
  }

  checkWaveEnd() {
    if (this.waveInProgress && this.spawnedCount >= this.totalToSpawn && this.heroes.length === 0 && !this.gameOverState) this.onWaveComplete();
  }

  onWaveComplete() {
    this.waveInProgress = false;
    this.startWaveButton.setLabel(t("game_start_wave"));
    const regen = saveManager.data.regenPerWave ?? 2;
    this.crystalHP = Math.min(saveManager.data.maxCrystalHP, this.crystalHP + regen);
    const raw = getWaveBonus(saveManager.data.wave, saveManager.data);
    this.pendingReward = {
      gold: Math.floor(raw.gold * (saveManager.data.goldMultiplier ?? 1)),
      souls: Math.floor(raw.souls * (saveManager.data.soulMultiplier ?? 1)),
      killGold: this.waveGoldEarned, killSouls: this.waveSoulsEarned, kills: this.waveKills,
    };

    saveManager.setStatMax("maxWave", saveManager.data.wave);
    achievements.checkAll();

    this.refreshUI();
    this.helpText.setText(t("game_wave_defeated"));
    this.rebuildToolbar();
    this.selectTool(this.selectedTool);
    audio.waveComplete();
    this.openWavePopup();
  }

  onGameOver() {
    if (this.gameOverState) return;
    this.waveInProgress = false; this.gameOverState = true;
    this.startWaveButton.setLabel(t("game_start_wave"));
    this.helpText.setText(t("game_crystal_destroyed"));
    audio.gameOver();
    this.openGameOverPopup();
  }

  openWavePopup() {
    this.closePopup();
    const D = 500, r = this.pendingReward;
    const overlay = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.72).setInteractive().setDepth(D);
    const panel = this.add.rectangle(270, 440, 440, 300, 0x242448).setStrokeStyle(3, 0x00fff5).setDepth(D + 1);
    const bl = this.bossType ? t("popup_wave_boss", heroLabel(this.bossType)) : "";
    const title = this.add.text(270, 340, t("popup_wave_title", saveManager.data.wave) + bl, {
      fontFamily: "Arial", fontSize: "22px", color: "#ffffff", fontStyle: "bold", align: "center"
    }).setOrigin(0.5).setDepth(D + 2);
    const body = this.add.text(270, 420, [
      t("popup_kills", r.kills),
      t("popup_for_heroes", r.killGold, r.killSouls),
      t("popup_bonus", r.gold, r.souls),
      t("popup_regen", saveManager.data.regenPerWave ?? 2),
    ].join("\n"), { fontFamily: "Arial", fontSize: "16px", color: "#dce3ff", align: "center", lineSpacing: 6 }).setOrigin(0.5).setDepth(D + 2);
    const takeBtn = createButton(this, 165, 540, 160, 50, t("popup_take"),
      async () => await this.claimWaveReward(1),
      { textSize: "16px", depth: D + 3 });
    const x2Btn = createButton(this, 375, 540, 160, 50, t("popup_x2_video"), async () => {
      const res = await adManager.showRewarded(this);
      if (res.rewarded || res.mock) await this.claimWaveReward(2);
    }, { color: 0x2b5c3c, hoverColor: 0x3a7a50, stroke: 0x7effa7, textSize: "16px", depth: D + 3 });
    this.popupObjects.push(overlay, panel, title, body, takeBtn.bg, takeBtn.txt, x2Btn.bg, x2Btn.txt);
  }

  async claimWaveReward(mult) {
    if (!this.pendingReward) return;
    saveManager.data.gold += this.pendingReward.gold * mult;
    saveManager.data.souls += this.pendingReward.souls * mult;
    saveManager.data.wave++;
    this.pendingReward = null;
    if (mult === 2) audio.coinCollect();
    this.closePopup();
    this.refreshUI();
    this.helpText.setText(t("game_prepare_next"));
    achievements.checkAll();
    await this.persistProgress();
    if (mult === 1) await adManager.showFullscreen(this);
  }

  openGameOverPopup() {
    this.closePopup();
    const D = 500;
    const overlay = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.76).setInteractive().setDepth(D);
    const panel = this.add.rectangle(270, 450, 440, 280, 0x3a1f2e).setStrokeStyle(3, 0xff8fa3).setDepth(D + 1);
    const title = this.add.text(270, 365, t("popup_game_over"), {
      fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5).setDepth(D + 2);
    const body = this.add.text(270, 430, [
      t("popup_reached_wave", saveManager.data.wave),
      t("popup_saved_souls", saveManager.data.souls),
      "",
      t("popup_reboot_hint"),
    ].join("\n"), { fontFamily: "Arial", fontSize: "15px", color: "#f1dbe4", align: "center", lineSpacing: 5 }).setOrigin(0.5).setDepth(D + 2);
    const rebootBtn = createButton(this, 165, 540, 160, 52, t("popup_reboot"), async () => {
      this.clearHeroes(); this.gameOverState = false;
      await saveManager.reset(); this.scene.restart();
    }, { textSize: "15px", depth: D + 3 });
    const reviveBtn = createButton(this, 375, 540, 160, 52, t("popup_revive"), async () => {
      const res = await adManager.showRewarded(this);
      if (res.rewarded || res.mock) {
        this.clearHeroes();
        this.crystalHP = saveManager.data.maxCrystalHP;
        this.gameOverState = false;
        this.closePopup(); this.refreshUI();
        this.helpText.setText(t("game_crystal_restored"));
        audio.crystalHeal();
        await this.persistProgress();
      }
    }, { color: 0x2b5c3c, hoverColor: 0x3a7a50, stroke: 0x7effa7, textSize: "14px", depth: D + 3 });
    this.popupObjects.push(overlay, panel, title, body, rebootBtn.bg, rebootBtn.txt, reviveBtn.bg, reviveBtn.txt);
  }

  closePopup() { for (const o of this.popupObjects) if (o?.destroy) o.destroy(); this.popupObjects = []; }

  refreshUI(force = false) {
    const d = saveManager.data;
    const c = this._uiCache;
    if (force || c.wave !== d.wave) { this.waveText.setText(t("game_wave", d.wave)); c.wave = d.wave; }
    if (force || c.gold !== d.gold) { this.goldText.setText(`🪙 ${d.gold}`); c.gold = d.gold; }
    if (force || c.souls !== d.souls) { this.soulsText.setText(`💀 ${d.souls}`); c.souls = d.souls; }
    if (force || c.hp !== this.crystalHP || c.maxHp !== d.maxCrystalHP) {
      this.hpText.setText(t("game_hp", this.crystalHP, d.maxCrystalHP));
      c.hp = this.crystalHP; c.maxHp = d.maxCrystalHP;
      const r = Math.max(0, this.crystalHP / d.maxCrystalHP);
      this.hpBarFill.width = 280 * r;
      this.hpBarFill.setFillStyle(r > 0.5 ? 0x00fff5 : r > 0.25 ? 0xffd166 : 0xff4757);
    }
  }

  pauseForAd() { this.adPaused = true; }
  resumeAfterAd() { this.adPaused = false; }

  async persistProgress() {
    saveManager.data.crystalHP = this.crystalHP;
    saveManager.data.board = [];
    for (const i of this.gridItems.values()) saveManager.data.board.push({ row: i.row, col: i.col, kind: i.kind, type: i.type, level: i.level });
    await saveManager.save();
  }

  pulsePiece(p) { this.tweens.add({ targets: p.container, scaleX: 1.15, scaleY: 1.15, yoyo: true, duration: 80 }); }
  isInsideGrid(x, y) { const b = this._gridBounds; return x >= b.x1 && x < b.x2 && y >= b.y1 && y < b.y2; }
  pointerToCell(x, y) { const g = GAME_CONFIG.grid; return { col: Phaser.Math.Clamp(((x - g.offsetX) / g.cell) | 0, 0, g.cols - 1), row: Phaser.Math.Clamp(((y - g.offsetY) / g.cell) | 0, 0, g.rows - 1) }; }
  cellKey(row, col) { return `${row}_${col}`; }
}