import {
  GAME_CONFIG, TOOL_DEFS, HERO_TYPES, MAX_MERGE_LEVEL,
  getWaveEnemyCount, getBaseHeroHP, getBaseHeroSpeed, getWaveBonus,
  getToolCost, isToolUnlocked, pickHeroType, getBossForWave, getHeroReward,
  toolLabel, toolDesc, heroLabel,
  computeDamage, getTrapCooldown, getMonsterCooldown, getToolRange, getTrapReach,
  getToolFootprint, isFootprintInBounds, getMonsterMaxHP, getHeroAttackDamage,
  getBurnEffect, getBlockDuration, getReviveHP,
  getChapterForWave,
  ENDLESS, getEndlessBossType,
} from "../config.js";
import { saveManager } from "../saveManager.js";
import { SDK } from "../sdk.js";
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
  /**
   * Ключ сцены ОБЯЗАТЕЛЬНО принимается параметром: EndlessScene наследуется от
   * GameScene, а конструктор без параметров игнорирует аргумент super("EndlessScene")
   * (A.prototype.constructor вызывается без аргументов) — обе сцены получали ключ
   * "GameScene", Phaser падал с "Cannot add a Scene with duplicate key" ещё до
   * регистрации сцен, и в браузере оставался только чёрный экран.
   */
  constructor(key = "GameScene") { super(key); }

  /** mode: "story" (кампания) | "endless" (Бездна — отдельный забег). */
  init(data) { this.gameMode = data?.mode === "endless" ? "endless" : "story"; }

  get isEndless() { return this.gameMode === "endless"; }

  /** Единые точки доступа к волне и валюте: кампания — сейв, Бездна — локальный забег. */
  waveNo() { return this.isEndless ? this._endlessWave : saveManager.data.wave; }
  goldAmt() { return this.isEndless ? this._runGold : saveManager.data.gold; }
  trySpendGold(amount) {
    if (this.goldAmt() < amount) return false;
    if (this.isEndless) this._runGold -= amount; else saveManager.data.gold -= amount;
    return true;
  }
  addGold(amount) { if (this.isEndless) this._runGold += amount; else saveManager.data.gold += amount; }

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
    this.gridItems = new Map(); // "row_col" -> { trap, monster }: слоты клетки; живым остаётся один слот (1 юнит на клетку), дракон 2×2
    this.selectedTool = "spikes";
    this.dragItem = null;
    this.dragGraphic = null;
    this.toolPage = 0;
    this.toolsPerPage = 4;
    this.bossSpawned = false;
    this.bossType = null;
    this.waveGoldEarned = 0;
    this.waveSoulsEarned = 0;
    this.waveKills = 0;
    this.crystalHP = saveManager.data.crystalHP || saveManager.data.maxCrystalHP;

    // Забег «Бездна»: локальные волна/золото, доска не загружается из сейва.
    this._endlessWave = 1;
    this._runGold = ENDLESS.startGold;
    this._endlessSoulsEarned = 0;
    if (this.isEndless) this.crystalHP = saveManager.data.maxCrystalHP;

    // Флаг второго шанса и autoHeal-таймер
    this._usedSecondChanceThisRun = this.isEndless ? true : false;
    this._autoHealTimer = 0;
    this._runSnapshot = null;
    this._skipShutdownPersist = false;
    // Кладбище текущей волны: монстры, убитые героями. Некромант поднимает их обратно.
    this._graveyard = [];

    this._precomputeGrid();
    this._uiCache = { wave: -1, gold: -1, souls: -1, hp: -1, maxHp: -1 };

    this._achUnlockHandler = (ach) => showAchievementToast(this, ach);
    achievements.onUnlock(this._achUnlockHandler);

    this.createBackground();
    this.createTopUI();
    this.drawGrid();
    this.createCrystal();
    this.createBottomUI();
    if (!this.isEndless) this.restoreBoard();
    this.refreshUI(true);

    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);

    // A partially played wave is never persisted: otherwise rewards from killed enemies
    // could be kept by leaving the scene and replaying the same wave.
    // В Бездне награды начисляются только в конце забега, поэтому откатывать нечего.
    this._visHandler = () => {
      if (!document.hidden) {
        // Возврат во вкладку: геймплей продолжается, только если волна идёт и не показывается реклама.
        if (this._adInProgress) return;
        this.adPaused = false;
        if (this.waveInProgress) SDK.gameplayStart();
        return;
      }
      // Скрытая вкладка — это не игровой процесс: сообщаем платформе и ставим сцену на паузу.
      SDK.gameplayStop();
      this.adPaused = true;
      if (this.isEndless) { saveManager.saveThrottled(); return; }
      if (this.waveInProgress || this.pendingReward) this.abortWaveAndRollback();
      else this.persistProgress();
    };
    document.addEventListener("visibilitychange", this._visHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      SDK.gameplayStop();
      document.removeEventListener("visibilitychange", this._visHandler);
      this.input.off("pointerdown", this.onPointerDown, this);
      this.input.off("pointermove", this.onPointerMove, this);
      this.input.off("pointerup", this.onPointerUp, this);
      this.textPool?.destroyAll();
      this.circlePool?.destroyAll();
      const idx = achievements.onUnlockCallbacks.indexOf(this._achUnlockHandler);
      if (idx !== -1) achievements.onUnlockCallbacks.splice(idx, 1);
      if (this.isEndless) return; // в Бездне нет ни незавершённых наград кампании, ни доски для сохранения
      if (this.waveInProgress || this.pendingReward) this.abortWaveAndRollback(false);
      else if (!this._skipShutdownPersist) this.persistProgress();
    });

    // Сюжетное интро главы — один раз при первом достижении её волны.
    if (!this.isEndless) this.time.delayedCall(400, () => this._maybeShowChapterIntro());
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
      if (this.waveInProgress) { floatText(this, 270, 110, t("game_finish_wave_first"), "#ff8f8f", 15); return; }
      if (!this.isEndless) await this.persistProgress();
      saveManager.saveThrottled();
      this.scene.start("MenuScene");
    }, { textSize: "14px" });
    if (!this.isEndless) {
      createButton(this, 140, 26, 85, 34, t("game_shop"), async () => {
        if (this.waveInProgress) { floatText(this, 270, 110, t("game_finish_wave_first"), "#ff8f8f", 15); return; }
        await this.persistProgress();
        this.scene.start("ShopScene");
      }, { textSize: "13px", color: 0x3b2d5e, hoverColor: 0x5a40a0, stroke: 0xb388ff });
    }
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
    this.helpText.setText(this.isEndless ? t("endless_hint") : t("game_place_defense"));
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

  // ============================
  // ДОСКА: один юнит на клетку (ловушка ИЛИ монстр), фигуры 2×2 (дракон)
  // gridItems: key("row_col") -> { trap: piece|null, monster: piece|null }
  // Не-якорные клетки дракона ссылаются на ту же фигуру (якорь — верхний левый угол).
  // ============================

  cellEntry(row, col) { return this.gridItems.get(this.cellKey(row, col)) || null; }

  _setSlot(row, col, kind, piece) {
    const key = this.cellKey(row, col);
    let entry = this.gridItems.get(key);
    if (!entry) { entry = { trap: null, monster: null }; this.gridItems.set(key, entry); }
    entry[kind] = piece;
  }

  _clearSlot(row, col, kind, piece) {
    const key = this.cellKey(row, col);
    const entry = this.gridItems.get(key);
    if (entry && entry[kind] === piece) {
      entry[kind] = null;
      if (!entry.trap && !entry.monster) this.gridItems.delete(key);
    }
  }

  /** Все уникальные фигуры доски (дракон учитывается один раз, хотя занимает 4 клетки). */
  iterPieces() {
    const seen = new Set(), out = [];
    for (const entry of this.gridItems.values()) {
      const tp = entry.trap, mn = entry.monster;
      if (tp && !seen.has(tp)) { seen.add(tp); out.push(tp); }
      if (mn && !seen.has(mn)) { seen.add(mn); out.push(mn); }
    }
    return out;
  }

  piecesOfKind(kind) { return this.iterPieces().filter((p) => p.kind === kind); }

  /** Фигура def помещается якорем в (row, col): вся в сетке и клетки свободны.
   *  Клетка занята, если в ней стоит ЛЮБОЙ юнит (ловушка или монстр) —
   *  несколько юнитов на одной клетке быть не может. */
  isFootprintFree(def, row, col, ignore = null) {
    if (!isFootprintInBounds(def, row, col)) return false;
    for (const c of getToolFootprint(def, row, col)) {
      const entry = this.cellEntry(c.row, c.col);
      if (!entry) continue;
      for (const kind of ["trap", "monster"]) {
        const occ = entry[kind];
        if (occ && occ !== ignore) return false;
      }
    }
    return true;
  }

  /** Центр фигуры (для дракона — центр блока 2×2). */
  piecePos(piece) {
    const def = TOOL_DEFS[piece.type];
    const half = GAME_CONFIG.grid.cell * ((def.size || 1) - 1) / 2;
    const origin = this.cellCenter(piece.row, piece.col);
    return { x: origin.x + half, y: origin.y + half };
  }

  restoreBoard() { for (const i of saveManager.data.board) this.spawnBoardPiece(i, false); }

  spawnBoardPiece(data, withEffect = true) {
    const def = TOOL_DEFS[data.type]; if (!def) return;
    if (!this.isFootprintFree(def, data.row, data.col)) return; // защита от некорректного сейва
    saveManager.markDiscovered("units", data.type);
    const size = def.size || 1;
    const g = GAME_CONFIG.grid;
    const half = g.cell * (size - 1) / 2;
    const origin = this.cellCenter(data.row, data.col);
    const pos = { x: origin.x + half, y: origin.y + half };
    const lvl = Math.min(data.level || 1, MAX_MERGE_LEVEL);
    const graphic = drawPiece(this, data.type, def.kind, lvl);
    if (size > 1) graphic.setScale(size * 0.9);
    const children = [graphic];
    let lvlLabel = null;
    if (lvl > 1) {
      lvlLabel = this.add.text(16 * size, 14 * size, `${lvl}`, { fontFamily: "Arial", fontSize: "12px", color: "#ffffff", fontStyle: "bold", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5);
      children.push(lvlLabel);
    }
    // У монстров есть HP — герои могут их уничтожить. Полоска появляется после первого урона.
    let hp = 0, maxHp = 0, hpBg = null, hpFill = null;
    const hpBarW = 34 * size;
    if (def.kind === "monster") {
      maxHp = hp = getMonsterMaxHP(def, lvl);
      const barY = -20 * size - 3;
      hpBg = this.add.rectangle(0, barY, hpBarW, 4, 0x000000).setVisible(false);
      hpFill = this.add.rectangle(-hpBarW / 2, barY, hpBarW, 4, 0x57ffb8).setOrigin(0, 0.5).setVisible(false);
      children.push(hpBg, hpFill);
    }
    const container = this.add.container(pos.x, pos.y, children)
      .setSize(g.cell * size, g.cell * size)
      .setDepth(def.kind === "trap" ? 10 : 20);
    const piece = {
      row: data.row, col: data.col, kind: def.kind, type: data.type, level: lvl,
      cooldown: 0, buffTimer: 0, _buffMult: 1,
      hp, maxHp, hpBarW, hpBg, hpFill,
      container, graphic, lvlLabel,
    };
    for (const c of getToolFootprint(def, data.row, data.col)) this._setSlot(c.row, c.col, def.kind, piece);
    if (withEffect) spawnPlaceEffect(this, pos.x, pos.y, def.kind === "trap" ? 0xffaa00 : 0x57ffb8);
  }

  removePiece(piece) {
    if (!piece) return;
    const def = TOOL_DEFS[piece.type];
    for (const c of getToolFootprint(def, piece.row, piece.col)) this._clearSlot(c.row, c.col, piece.kind, piece);
    piece.container.destroy(true);
  }

  _clearBoard() { for (const p of this.iterPieces()) p.container.destroy(true); this.gridItems.clear(); }

  onPointerDown(pointer) {
    if (this.popupObjects.length > 0) return;
    if (!this.isInsideGrid(pointer.x, pointer.y)) return;
    const { row, col } = this.pointerToCell(pointer.x, pointer.y);
    const entry = this.cellEntry(row, col);
    const topPiece = entry ? (entry.monster || entry.trap) : null;
    if (this.selectedTool === "erase") {
      // Стирание одной фигуры за клик (верхний слой — монстр) и запрещено во время волны.
      if (topPiece && !this.waveInProgress) this.erasePiece(topPiece, pointer);
      return;
    }
    if (this.waveInProgress) return;
    // Уже выставленный юнит перетаскивается (ход/мёрдж) при ЛЮБОМ выбранном в панели
    // инструменте: выбор инструмента влияет только на постановку в пустую клетку.
    if (topPiece) { this.startDrag(topPiece); return; }
    const selDef = TOOL_DEFS[this.selectedTool];
    if (!selDef) return;
    this.placeNewPiece(row, col, pointer);
  }

  onPointerMove(pointer) { if (this.dragItem && this.dragGraphic) this.dragGraphic.setPosition(pointer.x, pointer.y); }

  onPointerUp(pointer) {
    if (!this.dragItem) return;
    const item = this.dragItem;
    if (this.dragGraphic) { this.dragGraphic.destroy(true); this.dragGraphic = null; }
    item.container.setAlpha(1);
    this.dragItem = null;
    if (!this.isInsideGrid(pointer.x, pointer.y)) return;
    const { row, col } = this.pointerToCell(pointer.x, pointer.y);
    if (row === item.row && col === item.col) return; // бросили на свой якорь — без изменений
    const occupant = this.cellEntry(row, col)?.[item.kind] || null;
    if (occupant && occupant !== item) this.tryMerge(item, occupant, pointer);
    else this.movePiece(item, row, col, pointer);
    this.refreshUI();
    saveManager.saveThrottled();
  }

  startDrag(piece) {
    this.dragItem = piece;
    piece.container.setAlpha(0.35);
    const def = TOOL_DEFS[piece.type];
    const c = def.mergeColors?.[piece.level - 1] || def.color;
    const size = def.size || 1;
    this.dragGraphic = (def.kind === "trap"
      ? this.add.rectangle(piece.container.x, piece.container.y, 28, 28, c, 0.6).setStrokeStyle(2, 0xffffff)
      : this.add.circle(piece.container.x, piece.container.y, 16 * size, c, 0.6)).setDepth(5000);
  }

  tryMerge(source, target, pointer) {
    if (source.type === target.type && source.level === target.level && source.level < MAX_MERGE_LEVEL) {
      const nl = source.level + 1;
      const anchorRow = target.row, anchorCol = target.col, type = source.type;
      this.removePiece(source); this.removePiece(target);
      this.spawnBoardPiece({ row: anchorRow, col: anchorCol, type, level: nl });
      const def = TOOL_DEFS[type];
      const np = this.cellEntry(anchorRow, anchorCol)?.[def.kind];
      const pos = np ? this.piecePos(np) : this.cellCenter(anchorRow, anchorCol);
      floatText(this, pos.x, pos.y - 25, t("game_merge_success", nl), "#ffd700", 20);
      spawnMergeEffect(this, pos.x, pos.y); audio.merge();
      if (np) this.pulsePiece(np);

      saveManager.incStat("totalMerges", 1);
      if (nl >= MAX_MERGE_LEVEL) saveManager.setStatMax("maxLevelMerge", 1);
      achievements.checkAll();
    } else {
      const msg = source.type !== target.type ? t("game_diff_types")
        : source.level !== target.level ? t("game_diff_levels") : t("game_max_level");
      floatText(this, pointer.x, pointer.y - 20, msg, "#ff8f8f", 15); audio.mergeFail();
    }
  }

  movePiece(piece, nr, nc, pointer) {
    const def = TOOL_DEFS[piece.type];
    if (!this.isFootprintFree(def, nr, nc, piece)) {
      floatText(this, pointer.x, pointer.y - 20, t("game_cell_taken"), "#ff8f8f", 15); audio.error();
      return;
    }
    for (const c of getToolFootprint(def, piece.row, piece.col)) this._clearSlot(c.row, c.col, piece.kind, piece);
    piece.row = nr; piece.col = nc;
    const pos = this.piecePos(piece);
    piece.container.setPosition(pos.x, pos.y);
    for (const c of getToolFootprint(def, nr, nc)) this._setSlot(c.row, c.col, piece.kind, piece);
  }

  erasePiece(piece, pointer) {
    const def = TOOL_DEFS[piece.type];
    const refundPercent = saveManager.data.eraseRefundBonus ?? 0.5;
    const refund = Math.floor(getToolCost(def, saveManager.data) * refundPercent * piece.level);
    this.addGold(refund);
    this.removePiece(piece);
    floatText(this, pointer.x, pointer.y - 10, `+${refund}🪙`, "#ffd700", 16);
    audio.erase();
    this.refreshUI();
    saveManager.saveThrottled();
  }

  placeNewPiece(row, col, pointer) {
    const def = TOOL_DEFS[this.selectedTool]; if (!def) return;
    if (!isToolUnlocked(def, this.waveNo())) {
      floatText(this, pointer.x, pointer.y - 10, t("game_not_unlocked"), "#ff8f8f", 15); audio.error(); return;
    }
    if (!this.isFootprintFree(def, row, col)) {
      floatText(this, pointer.x, pointer.y - 10, t("game_cell_taken"), "#ff8f8f", 15); audio.error(); return;
    }
    const cost = getToolCost(def, saveManager.data);
    if (!this.trySpendGold(cost)) {
      floatText(this, pointer.x, pointer.y - 10, t("game_not_enough_gold"), "#ff8f8f", 16); audio.error(); return;
    }
    this.spawnBoardPiece({ row, col, type: def.id, level: 1 });
    floatText(this, pointer.x, pointer.y - 10, `-${cost}`, "#ffd700", 16);
    audio.place();
    this.refreshUI();
    saveManager.saveThrottled();
  }

  startWave() {
    if (this.waveInProgress || this.pendingReward || this.gameOverState) return;
    // Сброс флагов на старте волны
    this._usedSecondChanceThisRun = this.isEndless;
    this._autoHealTimer = 0;

    if (!this.isEndless) this._runSnapshot = JSON.parse(JSON.stringify(saveManager.data));
    if (!this.isEndless) this._runSnapshot.crystalHP = this.crystalHP;
    this.waveInProgress = true;
    this.spawnedCount = 0;
    this.totalToSpawn = getWaveEnemyCount(this.waveNo());
    this.spawnInterval = 900;
    this.spawnTimer = 0;
    this.bossSpawned = false;
    this.bossType = this.isEndless
      ? (this.waveNo() % ENDLESS.bossEveryWaves === 0 ? getEndlessBossType(this.waveNo()) : null)
      : getBossForWave(saveManager.data.wave);
    this.waveGoldEarned = 0; this.waveSoulsEarned = 0; this.waveKills = 0;
    this._graveyard.length = 0;
    const bl = this.bossType ? t("game_boss_marker", heroLabel(this.bossType)) : "";
    this.helpText.setText(t("game_wave_ongoing", this.waveNo()) + bl);
    this.startWaveButton.setLabel(t("game_wave_running"));
    audio.waveStart();
    SDK.gameplayStart();
    if (this.bossType) this.time.delayedCall(500, () => spawnBossWarning(this, this.bossType));
  }

  spawnHero(forceBoss = false) {
    const wave = this.waveNo();
    const bHP = getBaseHeroHP(wave), bSpd = getBaseHeroSpeed(wave);
    const td = forceBoss && this.bossType ? (this.bossSpawned = true, this.bossType) : pickHeroType(wave);
    const hpScale = this.isEndless ? 1 + (wave - 1) * ENDLESS.hpGrowth : 1;
    const spScale = this.isEndless ? 1 + Math.min(ENDLESS.speedCap, (wave - 1) * ENDLESS.speedGrowth) : 1;
    const hp = Math.floor(bHP * td.hpMult * hpScale);
    const speed = Math.floor(bSpd * td.speedMult * spScale);
    saveManager.markDiscovered("heroes", td.id);
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
    const container = this.add.container(x, y, children).setDepth(30);
    const hero = {
      col, hp, maxHp: hp, lastRenderedHp: hp,
      speed, speedMultiplier: 1, slowUntil: 0, dead: false,
      typeDef: td, isBoss: td.isBoss, shieldHits: td.shieldHits || 0,
      disableTraps: td.disableTraps || false, weaknessTool: td.weaknessTool || null,
      summonTimer: 0, healTimer: 0,
      poisonEndTime: 0, poisonDPS: 0, poisonTimer: 0,
      burnEndTime: 0, burnDPS: 0, burnTimer: 0, blockedUntil: 0,
      // Бой с монстрами: герой останавливается у цели и наносит удары.
      attackCooldown: Phaser.Math.Between(150, 600), engaged: false,
      container, graphic, hpBg, hpFill, hpBarWidth: hpW,
      row: -1,
    };
    this.heroes.push(hero);
    if (td.isBoss) this.cameras.main.shake(200, 0.008);
  }

  spawnSummonedHero(boss) {
    const wave = this.waveNo(), td = HERO_TYPES.peasant;
    const hpScale = this.isEndless ? 1 + (wave - 1) * ENDLESS.hpGrowth : 1;
    const hp = Math.floor(getBaseHeroHP(wave) * td.hpMult * 0.6 * hpScale);
    const speed = Math.floor(getBaseHeroSpeed(wave) * td.speedMult * 1.2);
    saveManager.markDiscovered("heroes", td.id);
    const g = GAME_CONFIG.grid;
    const col = Phaser.Math.Clamp(boss.col + Phaser.Math.Between(-1, 1), 0, g.cols - 1);
    const x = g.offsetX + col * g.cell + g.cell / 2, y = boss.container.y - 10;
    const graphic = drawHeroByType(this, "peasant");
    const hpBg = this.add.rectangle(0, -22, 36, 4, 0x000000);
    const hpFill = this.add.rectangle(-18, -22, 36, 4, 0xffaa44).setOrigin(0, 0.5);
    const container = this.add.container(x, y, [graphic, hpBg, hpFill]).setDepth(30);
    const hero = { col, hp, maxHp: hp, lastRenderedHp: hp, speed, speedMultiplier: 1, slowUntil: 0, dead: false, typeDef: td, isBoss: false, shieldHits: 0, disableTraps: false, weaknessTool: null, summonTimer: 0, healTimer: 0, poisonEndTime: 0, poisonDPS: 0, poisonTimer: 0, burnEndTime: 0, burnDPS: 0, burnTimer: 0, blockedUntil: 0, attackCooldown: Phaser.Math.Between(150, 600), engaged: false, container, graphic, hpBg, hpFill, hpBarWidth: 36, row: -1 };
    this.heroes.push(hero);
    spawnPlaceEffect(this, x, y, 0xffaa44);
  }

  update(time, delta) {
    if (this.adPaused || !this.waveInProgress) return;
    // Защита от скачка после сворачивания вкладки: не догоняем «пропущенное» время (аудит №20).
    const dt = Math.min(delta, 100);
    this.spawnTimer += dt;
    while (this.spawnedCount < this.totalToSpawn && this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      if (this.bossType && !this.bossSpawned && this.spawnedCount >= Math.floor(this.totalToSpawn / 2)) this.spawnHero(true);
      else this.spawnHero(false);
      this.spawnedCount++;
    }
    this.processHeroAttacks(dt);
    this.updateHeroes(time, dt);
    this.processTraps(time, dt);
    this.processNecromancerBuffs(dt);
    this.processMonsters(time, dt);
    this.processBossAbilities(dt);
    this.processHeroAbilities(time, dt);
    this.processHealers(dt);
    this.processDots(time, dt);
    this.processNecromancerRevive(time, dt);
    this._processAutoHeal(dt);
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

  /** Герои атакуют монстров: цель в радиусе — герой останавливается и бьёт. */
  processHeroAttacks(delta) {
    const cellSize = GAME_CONFIG.grid.cell;
    let monsters = null; // список собирается лениво, только если есть атакующие
    for (const hero of this.heroes) {
      if (hero.dead) continue;
      hero.engaged = false;
      const atkMult = hero.typeDef.attackMult ?? 1;
      if (atkMult <= 0) continue; // целитель не сражается
      hero.attackCooldown = (hero.attackCooldown || 0) - delta;
      if (!monsters) monsters = this.piecesOfKind("monster");
      if (!monsters.length) continue;
      const rangeLim = (hero.typeDef.attackRange ?? 1.35) * cellSize;
      const r2Lim = rangeLim * rangeLim;
      let target = null, best = Infinity;
      for (const piece of monsters) {
        if (piece.hp <= 0) continue; // цель уже добита другим героем в этом кадре
        const pos = this.piecePos(piece);
        const d2 = distSq(pos.x, pos.y, hero.container.x, hero.container.y);
        if (d2 <= r2Lim && d2 < best) { best = d2; target = piece; }
      }
      if (!target) continue;
      hero.engaged = true;
      if (hero.attackCooldown > 0) continue;
      hero.attackCooldown = hero.typeDef.attackInterval ?? 1100;
      this.damageMonster(target, getHeroAttackDamage(hero.typeDef, this.waveNo()));
      hero.graphic.setTint(0xffe08a);
      this.time.delayedCall(70, () => { if (!hero.dead) hero.graphic.clearTint(); });
    }
  }

  /** Урон монстру от героя. Монстры имеют HP и могут погибнуть (дизайн-док). */
  damageMonster(piece, amount) {
    if (!piece || piece.kind !== "monster" || piece.hp <= 0) return;
    piece.hp -= amount;
    const def = TOOL_DEFS[piece.type];
    const pos = this.piecePos(piece);
    floatText(this, pos.x + Phaser.Math.Between(-6, 6), pos.y - 18 * (def.size || 1), `-${amount}`, "#ffd166", 13);
    if (piece.hpBg) {
      piece.hpBg.setVisible(true); piece.hpFill.setVisible(true);
      const r = Math.max(0, piece.hp / piece.maxHp);
      piece.hpFill.width = piece.hpBarW * r;
      piece.hpFill.setFillStyle(r > 0.5 ? 0x57ffb8 : r > 0.25 ? 0xffd166 : 0xff4757);
    }
    audio.trapHit();
    if (piece.hp <= 0) this.killMonster(piece);
  }

  /** Монстр уничтожен героями: фигура снимается с доски (мёрдж нового — за золото). */
  killMonster(piece) {
    const def = TOOL_DEFS[piece.type];
    const pos = this.piecePos(piece);
    // Запоминаем павшего: некромант может поднять его до конца волны.
    if (!this._graveyard) this._graveyard = [];
    this._graveyard.push({ type: piece.type, level: piece.level, row: piece.row, col: piece.col });
    spawnDeathParticles(this, pos.x, pos.y, def.mergeColors?.[piece.level - 1] || def.color, 14);
    floatText(this, pos.x, pos.y - 32, t("game_unit_slain", toolLabel(def)), "#ff8f8f", 14);
    audio.heroDeath();
    this.removePiece(piece);
  }

  updateHeroes(time, delta) {
    const grid = GAME_CONFIG.grid;
    const botY = this._gridBounds.bottomY;
    const dt = delta / 1000;
    for (let i = this.heroes.length - 1; i >= 0; i--) {
      const hero = this.heroes[i];
      if (hero.dead) continue;
      // Герой, задержанный эффектом полной остановки (blockedUntil), стоит на месте.
      if (!hero.engaged && hero.blockedUntil <= time) {
        const sm = hero.slowUntil > time ? hero.speedMultiplier : 1;
        hero.container.y += hero.speed * sm * dt;
      }
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

  // ============================
  // ЛОВУШКИ — строго по описанию из дизайн-документа, без «стрельбы» на дистанцию:
  //  • Шипы / Огненная плитка / Ледяная стена — только по героям, наступившим на клетку
  //    (каждый герой получает удар сразу при входе и повторно раз в кулдаун, пока стоит);
  //  • Молния Тесла — срабатывает, когда на клетку наступили, и бьёт цепочкой по 3 героям;
  //  • Телепорт — наступившего героя возвращает назад (один раз на героя);
  //  • Ядовитое облако — AoE по области 3×3 вокруг своей клетки;
  //  • Чёрная дыра — притягивает героев к себе, урон — только тем, кто в неё попал.
  // ============================

  /** Прямоугольник клетки (row, col), расширенный на `cells` клеток во все стороны. */
  _cellRect(row, col, cells = 0) {
    const g = GAME_CONFIG.grid;
    return {
      x1: g.offsetX + (col - cells) * g.cell, y1: g.offsetY + (row - cells) * g.cell,
      x2: g.offsetX + (col + cells + 1) * g.cell, y2: g.offsetY + (row + cells + 1) * g.cell,
    };
  }

  /** Живые герои внутри прямоугольника, на которых действуют ловушки. */
  _trapTargetsIn(rect) {
    const out = [];
    for (const h of this.heroes) {
      if (h.dead || h.disableTraps) continue;
      const { x, y } = h.container;
      if (x < rect.x1 || x >= rect.x2 || y < rect.y1 || y >= rect.y2) continue;
      out.push(h);
    }
    return out;
  }

  /** Герои, стоящие на клетке ловушки (наступили на неё). */
  _heroesOnTrap(piece) { return this._trapTargetsIn(this._cellRect(piece.row, piece.col)); }

  processTraps(time, delta) {
    for (const piece of this.piecesOfKind("trap")) {
      const def = TOOL_DEFS[piece.type];
      piece.cooldown -= delta;
      switch (def.trigger) {
        case "area": this._trapArea(piece, def, time); break;
        case "pull": this._trapPull(piece, def, time, delta); break;
        case "chain": this._trapChain(piece, def); break;
        case "teleport": this._trapTeleport(piece, def); break;
        default: this._trapStep(piece, def, time); break; // "step": шипы, огонь, лёд
      }
    }
  }

  /**
   * Шипы, огненная плитка, ледяная стена: бьют ТОЛЬКО наступивших на клетку.
   * Кулдаун — на каждого героя отдельно: вошёл на клетку — сразу получил удар,
   * стоит дальше — получает повторно раз в кулдаун. Никто не «проскакивает» мимо.
   */
  _trapStep(piece, def, time) {
    const onCell = this._heroesOnTrap(piece);
    if (!onCell.length) return;
    if (!piece.hitTimes) piece.hitTimes = new WeakMap();
    const cd = getTrapCooldown(def, saveManager.data);
    let hitAny = false;
    for (const h of onCell) {
      const last = piece.hitTimes.get(h);
      if (last !== undefined && time - last < cd) continue;
      piece.hitTimes.set(h, time);
      hitAny = true;
      const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, h.isBoss || false, h.weaknessTool);
      const applied = this.damageHero(h, dmg, isCrit);
      if (!applied || h.dead) continue;
      // Ледяная стена: замедление на 3 секунды (без полной остановки).
      if (def.slowFactor) {
        h.speedMultiplier = def.slowFactor;
        h.slowUntil = time + (def.slowDuration || 2000) * (saveManager.data.slowBonus ?? 1);
      }
      const blockMs = getBlockDuration(def, piece.level);
      if (blockMs) {
        h.blockedUntil = Math.max(h.blockedUntil || 0, time + blockMs);
        floatText(this, h.container.x, h.container.y - 40, t("game_frozen"), "#9fe8ff", 12);
      }
      // Огненная плитка: поджигает — урон по времени.
      const burn = getBurnEffect(def, piece.level, saveManager.data);
      if (burn) {
        h.burnDPS = Math.max(h.burnDPS || 0, burn.dps);
        h.burnEndTime = Math.max(h.burnEndTime || 0, time + burn.duration);
        h.burnTimer = 0;
      }
    }
    if (hitAny) { this.pulsePiece(piece); audio.trapHit(); }
  }

  /** Ядовитое облако: каждый тик задевает ВСЕХ героев в области 3×3 и отравляет их. */
  _trapArea(piece, def, time) {
    if (piece.cooldown > 0) return;
    const targets = this._trapTargetsIn(this._cellRect(piece.row, piece.col, def.aoeCells ?? 1));
    if (!targets.length) return; // облако не тратит заряд впустую
    for (const h of targets) {
      const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, h.isBoss || false, h.weaknessTool);
      // Яд накладывается, только если удар ловушки не заблокирован щитом.
      if (this.damageHero(h, dmg, isCrit) && !h.dead) {
        h.poisonDPS = Math.floor((def.poisonDPS || 8) * piece.level * (saveManager.data.poisonBonus ?? 1));
        h.poisonEndTime = time + (def.poisonDuration || 5000);
        h.poisonTimer = 0;
      }
    }
    const pPos = this.piecePos(piece);
    spawnPoisonCloud(this, pPos.x, pPos.y);
    audio.trapHit();
    piece.cooldown = getTrapCooldown(def, saveManager.data);
    this.pulsePiece(piece);
  }

  /**
   * Молния Тесла: срабатывает, когда герой наступает на клетку, и бьёт цепочкой
   * ровно по chainCount (3) героям: наступивший + ближайшие к предыдущему звену.
   */
  _trapChain(piece, def) {
    if (piece.cooldown > 0) return;
    const onCell = this._heroesOnTrap(piece);
    if (!onCell.length) return;
    const pPos = this.piecePos(piece);
    const first = onCell[0];
    const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, first.isBoss || false, first.weaknessTool);
    spawnLightningChain(this, pPos.x, pPos.y, first.container.x, first.container.y);
    this.damageHero(first, dmg, isCrit);
    const total = def.chainCount || 3;
    const chainR2 = (getTrapReach(def.chainRange || 2.5, saveManager.data) * GAME_CONFIG.grid.cell) ** 2;
    const hit = new Set([first]);
    let lastX = first.container.x, lastY = first.container.y;
    while (hit.size < total) {
      let next = null, bestD2 = Infinity;
      for (const h of this.heroes) {
        if (h.dead || h.disableTraps || hit.has(h)) continue;
        const d2 = distSq(h.container.x, h.container.y, lastX, lastY);
        if (d2 <= chainR2 && d2 < bestD2) { bestD2 = d2; next = h; }
      }
      if (!next) break;
      hit.add(next);
      spawnLightningChain(this, lastX, lastY, next.container.x, next.container.y);
      const { damage: cd, isCrit: cc } = computeDamage(def, piece.level, saveManager.data, next.isBoss || false, next.weaknessTool);
      this.damageHero(next, Math.floor(cd * 0.7), cc);
      lastX = next.container.x; lastY = next.container.y;
    }
    audio.trapHit();
    piece.cooldown = getTrapCooldown(def, saveManager.data);
    this.pulsePiece(piece);
  }

  /** Телепорт: наступившего героя возвращает назад. Каждого героя — один раз. */
  _trapTeleport(piece, def) {
    if (piece.cooldown > 0) return;
    if (!piece.teleported) piece.teleported = new WeakSet();
    const target = this._heroesOnTrap(piece).find((h) => !piece.teleported.has(h));
    if (!target) return;
    piece.teleported.add(target);
    const cellSize = GAME_CONFIG.grid.cell;
    const pPos = this.piecePos(piece);
    // Щит паладина блокирует и телепорт (это тоже эффект ловушки).
    if (!this._shieldBlocks(target)) {
      const rows = (def.teleportRows || 5) + piece.level;
      target.container.y = Math.max(GAME_CONFIG.grid.offsetY, target.container.y - rows * cellSize);
      spawnTeleportEffect(this, pPos.x, pPos.y);
      spawnTeleportEffect(this, target.container.x, target.container.y);
      floatText(this, pPos.x, pPos.y - 20, t("game_teleport"), "#cc88ff", 14);
    }
    audio.trapHit();
    piece.cooldown = getTrapCooldown(def, saveManager.data);
    this.pulsePiece(piece);
  }

  /**
   * Чёрная дыра: постоянно стягивает героев в радиусе к своей колонке (к себе),
   * урон получают только те, кого уже затянуло на клетку дыры.
   * Вертикально не тянет — иначе медленный босс мог бы «зависнуть» навсегда.
   */
  _trapPull(piece, def, time, delta) {
    const cellSize = GAME_CONFIG.grid.cell;
    const pPos = this.piecePos(piece);
    const pullR2 = (getTrapReach(def.pullRadius || 2.5, saveManager.data) * cellSize) ** 2;
    const step = (def.pullSpeed || 60) * delta / 1000;
    let pulling = false;
    for (const h of this.heroes) {
      if (h.dead || h.disableTraps) continue;
      if (h.container.y > pPos.y + cellSize / 2) continue; // уже прошёл мимо дыры
      if (distSq(h.container.x, h.container.y, pPos.x, pPos.y) > pullR2) continue;
      const dx = pPos.x - h.container.x;
      if (Math.abs(dx) < 0.5) continue;
      h.container.x += Math.sign(dx) * Math.min(Math.abs(dx), step);
      h.col = Math.floor((h.container.x - GAME_CONFIG.grid.offsetX) / cellSize);
      pulling = true;
    }
    if (pulling && !piece._pullFx) {
      piece._pullFx = true;
      spawnBlackholeEffect(this, pPos.x, pPos.y);
      this.time.delayedCall(600, () => { piece._pullFx = false; });
    }
    if (piece.cooldown > 0) return;
    const inside = this._heroesOnTrap(piece);
    if (!inside.length) return;
    for (const h of inside) {
      const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, h.isBoss || false, h.weaknessTool);
      this.damageHero(h, dmg, isCrit);
    }
    spawnBlackholeEffect(this, pPos.x, pPos.y);
    audio.trapHit();
    piece.cooldown = getTrapCooldown(def, saveManager.data);
    this.pulsePiece(piece);
  }

  processMonsters(time, delta) {
    const cellSize = GAME_CONFIG.grid.cell;
    for (const piece of this.piecesOfKind("monster")) {
      piece.cooldown -= delta;
      if (piece.cooldown > 0) continue;
      const def = TOOL_DEFS[piece.type];
      const pPos = this.piecePos(piece);
      const maxDist = getToolRange(def, saveManager.data) * cellSize;
      const maxDist2 = maxDist * maxDist;
      const buffMult = (piece._buffMult || 1) * (piece._archmageDebuffUntil > time ? 0.5 : 1);

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
        for (const tgt of targets) this.damageHero(tgt, buffedDmg, isCrit, "monster");
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
        for (const tgt of targets) this.damageHero(tgt, buffedDmg, isCrit, "monster");
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
      const { damage: dmg, isCrit } = computeDamage(def, piece.level, saveManager.data, isBossTarget, target.weaknessTool);
      const buffedDmg = Math.floor(dmg * buffMult);
      this.damageHero(target, buffedDmg, isCrit, "monster");

      if (def.id === "dark_knight" && bestD2 < (cellSize * 1.2) ** 2) {
        const counterDmg = Math.floor((def.counterDamage || 20) * piece.level * (saveManager.data.monsterDamageBonus ?? 1));
        this.time.delayedCall(200, () => {
          if (!target.dead) {
            this.damageHero(target, counterDmg, false, "monster");
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
    const monsters = this.piecesOfKind("monster");
    for (const p of monsters) p._buffMult = 1;
    const cellSize = GAME_CONFIG.grid.cell;
    for (const necro of monsters) {
      if (necro.type !== "necromancer") continue;
      const def = TOOL_DEFS.necromancer;
      const buffR2 = ((def.buffRadius || 2) * cellSize) ** 2;
      const buffAmt = ((def.buffAmount || 0.3) + (saveManager.data.necroBonusExtra || 0)) * necro.level;
      const nPos = this.piecePos(necro);
      necro.buffTimer = (necro.buffTimer || 0) + delta;
      if (necro.buffTimer >= 2000) { necro.buffTimer = 0; spawnNecromancerAura(this, nPos.x, nPos.y); }
      for (const other of monsters) {
        if (other === necro) continue;
        const oPos = this.piecePos(other);
        if (distSq(oPos.x, oPos.y, nPos.x, nPos.y) <= buffR2) other._buffMult = (other._buffMult || 1) + buffAmt;
      }
    }
  }

  /**
   * Некромант поднимает павших монстров (дизайн-док): раз в reviveInterval один из
   * убитых в этой волне монстров возвращается на своё место с частью HP.
   * Кладбище живёт только внутри волны и очищается при откате прерванной волны.
   */
  processNecromancerRevive(time, delta) {
    if (!this._graveyard.length) return;
    const necroDef = TOOL_DEFS.necromancer;
    for (const necro of this.piecesOfKind("monster")) {
      if (necro.type !== "necromancer" || !this._graveyard.length) continue;
      necro.reviveTimer = (necro.reviveTimer || 0) + delta;
      if (necro.reviveTimer < (necroDef.reviveInterval || 7000)) continue;
      necro.reviveTimer = 0;
      const idx = this._graveyard.findIndex((g) => {
        const def = TOOL_DEFS[g.type];
        return def && this.isFootprintFree(def, g.row, g.col);
      });
      if (idx === -1) continue;
      const fallen = this._graveyard.splice(idx, 1)[0];
      this.spawnBoardPiece({ row: fallen.row, col: fallen.col, type: fallen.type, level: fallen.level });
      const revived = this.cellEntry(fallen.row, fallen.col)?.monster;
      if (!revived) continue;
      revived.hp = getReviveHP(TOOL_DEFS[fallen.type], fallen.level);
      if (revived.hpBg) {
        revived.hpBg.setVisible(true); revived.hpFill.setVisible(true);
        revived.hpFill.width = revived.hpBarW * (revived.hp / revived.maxHp);
        revived.hpFill.setFillStyle(0xffd166);
      }
      const pos = this.piecePos(revived);
      spawnNecromancerAura(this, pos.x, pos.y);
      floatText(this, pos.x, pos.y - 30, t("game_revived"), "#cc88ff", 14);
      audio.place();
    }
  }

  /** Периодический урон: яд ловушки и горение от огненной плитки. */
  processDots(time, delta) {
    this.processPoison(time, delta);
    this.processBurn(time, delta);
  }

  processBurn(time, delta) {
    for (const hero of this.heroes) {
      if (hero.dead || hero.burnEndTime <= time || !hero.burnDPS) continue;
      hero.burnTimer += delta;
      if (hero.burnTimer < 1000) continue;
      hero.burnTimer -= 1000;
      hero.hp -= hero.burnDPS;
      floatText(this, hero.container.x, hero.container.y - 25, `-${hero.burnDPS}🔥`, "#ff9f43", 12);
      hero.graphic.setTint(0xff6b35);
      this.time.delayedCall(200, () => { if (!hero.dead) hero.graphic.clearTint(); });
      if (hero.hp <= 0) this.killHero(hero);
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

  processHeroAbilities(time, delta) {
    for (const hero of this.heroes) {
      if (hero.dead) continue;
      const interval = hero.typeDef.trapDestroyInterval;
      if (interval) {
        hero.abilityTimer = (hero.abilityTimer || 0) + delta;
        if (hero.abilityTimer >= interval) {
          hero.abilityTimer = 0;
          let closest = null, best = Infinity;
          for (const piece of this.piecesOfKind("trap")) {
            const pos = this.piecePos(piece), d = distSq(pos.x, pos.y, hero.container.x, hero.container.y);
            if (d < best && d < (GAME_CONFIG.grid.cell * 2) ** 2) { closest = piece; best = d; }
          }
          if (closest) { this.removePiece(closest); floatText(this, hero.container.x, hero.container.y - 35, t("game_dispel"), "#aabfff", 12); }
        }
      }
      if (hero.typeDef.monsterDebuffInterval) {
        hero.debuffTimer = (hero.debuffTimer || 0) + delta;
        if (hero.debuffTimer >= hero.typeDef.monsterDebuffInterval) {
          hero.debuffTimer = 0;
          let closest = null, best = Infinity;
          for (const piece of this.piecesOfKind("monster")) {
            const pos = this.piecePos(piece), d = distSq(pos.x, pos.y, hero.container.x, hero.container.y);
            if (d < best && d < (GAME_CONFIG.grid.cell * 3) ** 2) { closest = piece; best = d; }
          }
          if (closest) { closest._archmageDebuffUntil = time + 3500; floatText(this, hero.container.x, hero.container.y - 35, t("game_curse"), "#cc88ff", 12); }
        }
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

  /** Щит паладина: блокирует заданное число эффектов ЛОВУШЕК (но не атак монстров). */
  _shieldBlocks(hero) {
    if (hero.shieldHits > 0) {
      hero.shieldHits--;
      floatText(this, hero.container.x, hero.container.y - 28, t("game_shield_block"), "#ffd700", 14);
      audio.click();
      return true;
    }
    return false;
  }

  /**
   * Урон герою. source:
   *  "trap" — удар ловушки (щит паладина блокирует первые shieldHits попаданий);
   *  "monster" — атака монстра (щит не помогает — по дизайн-документу);
   *  "poison" — тики яда (блокировка уже учтена при наложении).
   * Возвращает true, если урон фактически нанесён.
   */
  damageHero(hero, amount, isCrit = false, source = "trap") {
    if (!hero || hero.dead) return false;
    if (source === "trap" && this._shieldBlocks(hero)) return false;
    hero.hp -= amount;

    const color = isCrit ? "#ffff00" : "#ff8f8f";
    const size = isCrit ? 18 : 15;
    const prefix = isCrit ? `${t("game_crit")} ` : "";
    floatText(this,
      hero.container.x + Phaser.Math.Between(-8, 8),
      hero.container.y - 28,
      `${prefix}-${amount}`, color, size
    );

    hero.graphic.setAlpha(0.4);
    this.time.delayedCall(80, () => { if (!hero.dead) hero.graphic.setAlpha(1); });
    if (hero.hp <= 0) this.killHero(hero);
    return true;
  }

  killHero(hero) {
    if (hero.dead) return;
    hero.dead = true;
    const reward = getHeroReward(hero.typeDef, saveManager.data);

    if (this.isEndless) {
      // В Бездне золото идёт в казну забега (с понижающим множителем), души — только финальной наградой.
      const runGold = Math.max(1, Math.floor(reward.gold * ENDLESS.killGoldFactor));
      this.addGold(runGold);
      this._endlessSoulsEarned += reward.souls;
      this.waveGoldEarned += runGold;
    } else {
      saveManager.data.gold += reward.gold;
      saveManager.data.souls += reward.souls;
      this.waveGoldEarned += reward.gold;
      this.waveSoulsEarned += reward.souls;
    }
    this.waveKills++;

    saveManager.incStat("totalKills", 1);
    if (hero.isBoss) {
      saveManager.incStat("bossKills", 1);
      // 🔮 Эссенция: гарантированная награда за каждого босса (+ шанс от таланта).
      let essence = 1;
      if (Math.random() < (saveManager.data.essenceDropChance ?? 0)) essence += 1;
      saveManager.grantReward({ essence });
      floatText(this, hero.container.x + 26, hero.container.y - 24, `+${essence}🔮`, "#cc88ff", 15);
      saveManager.saveThrottled();
    }

    const fs = hero.isBoss ? 18 : 13;
    floatText(this, hero.container.x - 14, hero.container.y - 10, `+${this.isEndless ? Math.max(1, Math.floor(reward.gold * ENDLESS.killGoldFactor)) : reward.gold}🪙`, hero.isBoss ? "#ffff00" : "#ffd700", fs);
    if (!this.isEndless) floatText(this, hero.container.x + 14, hero.container.y - 10, `+${reward.souls}💀`, hero.isBoss ? "#00ffaa" : "#57ffb8", fs);
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
    if (hero.typeDef.id === "thief") {
      const purse = this.goldAmt();
      const stolen = Math.min(purse, Math.max(1, Math.floor(purse * 0.1)));
      if (this.isEndless) this._runGold -= stolen; else saveManager.data.gold -= stolen;
      floatText(this, 270, this.crystalY - 45, `-${stolen}🪙`, "#ffbb55", 16);
    }
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
        floatText(this, 270, this.crystalY - 50, t("game_second_chance"), "#ffff00", 24);
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
  }

  clearHeroes() {
    for (const h of this.heroes) h.container.destroy(true);
    this.heroes.length = 0;
  }

  checkWaveEnd() {
    if (this.waveInProgress && this.spawnedCount >= this.totalToSpawn && this.heroes.length === 0 && !this.gameOverState) this.onWaveComplete();
  }

  onWaveComplete() {
    this.waveInProgress = false;
    SDK.gameplayStop();
    this.startWaveButton.setLabel(t("game_start_wave"));
    const regen = saveManager.data.regenPerWave ?? 2;
    this.crystalHP = Math.min(saveManager.data.maxCrystalHP, this.crystalHP + regen);

    if (this.isEndless) { this._onEndlessWaveComplete(); return; }

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

  /** Волна Бездны пройдена: авто-переход к следующей, промежуточные награды. */
  _onEndlessWaveComplete() {
    const wave = this._endlessWave;
    const prev = saveManager.data.stats?.endlessMaxWave || 0;
    saveManager.setStatMax("endlessMaxWave", wave);

    // 🔮 за каждую 5-ю волну, пополнение казны забега за каждую 10-ю.
    if (wave % ENDLESS.essenceEveryWaves === 0) {
      saveManager.grantReward({ essence: 1 });
      floatText(this, 270, this.crystalY - 50, "+1🔮", "#cc88ff", 18);
    }
    if (wave % ENDLESS.bonusGoldEveryWaves === 0) {
      this._runGold += ENDLESS.bonusGold;
      floatText(this, 270, this.crystalY - 70, `+${ENDLESS.bonusGold}🪙`, "#ffd700", 18);
    }
    if (wave > prev) achievements.checkAll();
    saveManager.saveThrottled();

    this.refreshUI();
    this.helpText.setText(t("endless_wave_done", wave, this.waveKills));
    this.rebuildToolbar();
    this.selectTool(this.selectedTool);
    audio.waveComplete();
    this._endlessWave++;
    this.time.delayedCall(ENDLESS.waveDelayMs, () => {
      if (!this.gameOverState && this.scene.isActive()) {
        this.helpText.setText(t("endless_wave_next", this._endlessWave));
        this.startWave();
      }
    });
  }

  abortWaveAndRollback(rebuildBoard = true) {
    if ((!this.waveInProgress && !this.pendingReward) || !this._runSnapshot) return;
    saveManager.data = JSON.parse(JSON.stringify(this._runSnapshot));
    saveManager.recalcBonuses();
    this.crystalHP = saveManager.data.crystalHP;
    this.waveInProgress = false; this.pendingReward = null;
    SDK.gameplayStop();
    this._graveyard.length = 0;
    this.clearHeroes();
    if (rebuildBoard) {
      // Доска сцены должна соответствовать откатанному сейву
      // (погибшие за прерванную волну монстры возвращаются, добыча отменяется).
      this._clearBoard();
      this.restoreBoard();
      this.startWaveButton?.setLabel(t("game_start_wave"));
      this.helpText?.setText(t("game_prepare_next"));
      this.refreshUI(true);
    }
    saveManager.save();
  }

  onGameOver() {
    if (this.gameOverState) return;
    this.waveInProgress = false; this.gameOverState = true;
    SDK.gameplayStop();
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
      if (res?.rewarded) await this.claimWaveReward(2);
    }, { color: 0x2b5c3c, hoverColor: 0x3a7a50, stroke: 0x7effa7, textSize: "16px", depth: D + 3 });
    this.popupObjects.push(overlay, panel, title, body, takeBtn.bg, takeBtn.txt, x2Btn.bg, x2Btn.txt);
  }

  async claimWaveReward(mult) {
    if (!this.pendingReward) return;
    saveManager.data.gold += this.pendingReward.gold * mult;
    saveManager.data.souls += this.pendingReward.souls * mult;
    saveManager.data.wave++;
    saveManager.incStat("wavesCompleted", 1);
    this.pendingReward = null;
    this._runSnapshot = null;
    if (mult === 2) audio.coinCollect();
    this.closePopup();
    this.refreshUI();
    this.helpText.setText(t("game_prepare_next"));
    achievements.checkAll();
    await this.persistProgress();
    // Интро главы важнее: если оно показано, межволновую рекламу пропускаем,
    // чтобы полноэкранная реклама не перекрывала сюжетный попап.
    if (mult === 1 && !this._maybeShowChapterIntro()) await adManager.showFullscreen(this);
  }

  // ============================
  // СЮЖЕТНЫЕ ГЛАВЫ
  // ============================

  /** Показывает интро текущей главы один раз. Возвращает true, если попап открыт. */
  _maybeShowChapterIntro() {
    if (this.isEndless || this.popupObjects.length) return false;
    const ch = getChapterForWave(saveManager.data.wave);
    if (!ch || saveManager.data.seenChapters.includes(ch.id)) return false;
    saveManager.data.seenChapters.push(ch.id);
    saveManager.saveThrottled();
    this._openChapterPopup(ch);
    return true;
  }

  _openChapterPopup(ch) {
    this.closePopup();
    const D = 500;
    const accent = ch.accent ?? 0x00fff5;
    const overlay = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.74).setInteractive().setDepth(D);
    const panel = this.add.rectangle(270, 450, 460, 380, 0x1f2440).setStrokeStyle(3, accent).setDepth(D + 1);
    const title = this.add.text(270, 325, t(ch.titleKey), {
      fontFamily: "Arial", fontSize: "22px", color: "#ffffff", fontStyle: "bold",
      align: "center", wordWrap: { width: 400 },
    }).setOrigin(0.5).setDepth(D + 2);
    const body = this.add.text(270, 445, t(ch.storyKey), {
      fontFamily: "Arial", fontSize: "15px", color: "#dce3ff",
      align: "center", wordWrap: { width: 400 }, lineSpacing: 7,
    }).setOrigin(0.5).setDepth(D + 2);
    const okBtn = createButton(this, 270, 585, 220, 50, t("chapter_continue"), () => {
      audio.waveStart();
      this.closePopup();
    }, { depth: D + 3, textSize: "16px" });
    this.popupObjects.push(overlay, panel, title, body, okBtn.bg, okBtn.txt);
  }

  openGameOverPopup() {
    this.closePopup();
    const D = 500;
    const overlay = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.76).setInteractive().setDepth(D);
    const panel = this.add.rectangle(270, 450, 440, 280, 0x3a1f2e).setStrokeStyle(3, 0xff8fa3).setDepth(D + 1);
    const title = this.add.text(270, 365, this.isEndless ? t("endless_over") : t("popup_game_over"), {
      fontFamily: "Arial", fontSize: "24px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5).setDepth(D + 2);

    if (this.isEndless) {
      // Финальная награда Бездны: накопленные души + бонус за волны. Начисляется один раз.
      const wavesDone = Math.max(0, this._endlessWave - 1);
      const souls = this._endlessSoulsEarned + wavesDone * ENDLESS.endSoulsPerWave;
      this._endlessSoulsEarned = 0;
      if (souls > 0) saveManager.grantReward({ souls });
      saveManager.saveThrottled();
      const body = this.add.text(270, 430, [
        t("endless_record", wavesDone),
        t("endless_best", saveManager.data.stats?.endlessMaxWave || wavesDone),
        "",
        t("endless_reward", souls),
      ].join("\n"), { fontFamily: "Arial", fontSize: "16px", color: "#f1dbe4", align: "center", lineSpacing: 5 }).setOrigin(0.5).setDepth(D + 2);
      const againBtn = createButton(this, 165, 540, 160, 52, t("endless_again"), async () => {
        this.clearHeroes(); this._clearBoard(); this.gameOverState = false;
        this._skipShutdownPersist = true;
        this.scene.restart({ mode: "endless" });
      }, { textSize: "15px", depth: D + 3 });
      const menuBtn = createButton(this, 375, 540, 160, 52, t("endless_to_menu"), async () => {
        await saveManager.save();
        this.scene.start("MenuScene");
      }, { color: 0x2b5c3c, hoverColor: 0x3a7a50, stroke: 0x7effa7, textSize: "15px", depth: D + 3 });
      this.popupObjects.push(overlay, panel, title, body, againBtn.bg, againBtn.txt, menuBtn.bg, menuBtn.txt);
      return;
    }

    const body = this.add.text(270, 430, [
      t("popup_reached_wave", saveManager.data.wave),
      t("popup_saved_souls", saveManager.data.souls),
      "",
      t("popup_reboot_hint"),
    ].join("\n"), { fontFamily: "Arial", fontSize: "15px", color: "#f1dbe4", align: "center", lineSpacing: 5 }).setOrigin(0.5).setDepth(D + 2);
    const rebootBtn = createButton(this, 165, 540, 160, 52, t("popup_reboot"), async () => {
      this.clearHeroes(); this._clearBoard(); this.gameOverState = false;
      await saveManager.reset();
      this.crystalHP = saveManager.data.crystalHP;
      this._skipShutdownPersist = true;
      this.scene.restart();
    }, { textSize: "15px", depth: D + 3 });
    const reviveBtn = createButton(this, 375, 540, 160, 52, t("popup_revive"), async () => {
      const res = await adManager.showRewarded(this);
      if (res?.rewarded) {
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
    const wave = this.waveNo(), gold = this.goldAmt();
    if (force || c.wave !== wave) {
      this.waveText.setText(this.isEndless ? t("endless_wave", wave) : t("game_wave", wave));
      c.wave = wave;
    }
    if (force || c.gold !== gold) { this.goldText.setText(`🪙 ${gold}`); c.gold = gold; }
    if (force || c.souls !== d.souls || this.isEndless) { this.soulsText.setText(`💀 ${d.souls}${this.isEndless ? ` +${this._endlessSoulsEarned}` : ""}`); c.souls = d.souls; }
    if (force || c.hp !== this.crystalHP || c.maxHp !== d.maxCrystalHP) {
      this.hpText.setText(t("game_hp", this.crystalHP, d.maxCrystalHP));
      c.hp = this.crystalHP; c.maxHp = d.maxCrystalHP;
      const r = Math.max(0, this.crystalHP / d.maxCrystalHP);
      this.hpBarFill.width = 280 * r;
      this.hpBarFill.setFillStyle(r > 0.5 ? 0x00fff5 : r > 0.25 ? 0xffd166 : 0xff4757);
    }
  }

  pauseForAd() { this._adInProgress = true; this.adPaused = true; SDK.gameplayStop(); }
  resumeAfterAd() {
    this._adInProgress = false;
    this.adPaused = false;
    if (this.waveInProgress && !document.hidden) SDK.gameplayStart();
  }

  async persistProgress() {
    if (this.isEndless) {
      // Доска/валюта забега не персистятся: награда Бездны выдаётся только по факту конца забега.
      await saveManager.save();
      return;
    }
    saveManager.data.crystalHP = this.crystalHP;
    saveManager.data.board = [];
    for (const i of this.iterPieces()) saveManager.data.board.push({ row: i.row, col: i.col, kind: i.kind, type: i.type, level: i.level });
    await saveManager.save();
  }

  pulsePiece(p) { this.tweens.add({ targets: p.container, scaleX: 1.15, scaleY: 1.15, yoyo: true, duration: 80 }); }
  isInsideGrid(x, y) { const b = this._gridBounds; return x >= b.x1 && x < b.x2 && y >= b.y1 && y < b.y2; }
  pointerToCell(x, y) { const g = GAME_CONFIG.grid; return { col: Phaser.Math.Clamp(((x - g.offsetX) / g.cell) | 0, 0, g.cols - 1), row: Phaser.Math.Clamp(((y - g.offsetY) / g.cell) | 0, 0, g.rows - 1) }; }
  cellKey(row, col) { return `${row}_${col}`; }
}