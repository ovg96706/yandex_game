import { t } from "./i18n.js";
// ============================================================
// Процедурная графика с кэшированием текстур
// ============================================================

const TEXTURE_CACHE = new Set();

/**
 * Создаёт текстуру из функции-рисователя, если её ещё нет.
 * Возвращает Sprite с этой текстурой (быстрее, чем Graphics).
 */
function makeCachedSprite(scene, key, drawFn, size = 48) {
  if (!TEXTURE_CACHE.has(key)) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.translateCanvas(size / 2, size / 2);
    drawFn(g);
    g.generateTexture(key, size, size);
    g.destroy();
    TEXTURE_CACHE.add(key);
  }
  return scene.add.sprite(0, 0, key);
}

// ------------------------------------------------------------
// ЛОВУШКИ (draw-функции работают с переданным Graphics)
// ------------------------------------------------------------

function paintSpikes(g, level) {
  const c = [0x888888, 0xaaaaaa, 0xccaa44, 0xff8800, 0xff2222][Math.min(level - 1, 4)];
  g.fillStyle(0x555555, 1); g.fillRect(-14, 4, 28, 8);
  g.fillStyle(c, 1);
  g.fillTriangle(-12, 4, -8, -10, -4, 4);
  g.fillTriangle(-3, 4, 1, -14, 5, 4);
  g.fillTriangle(4, 4, 8, -10, 12, 4);
  g.fillStyle(0xffffff, 0.5); g.fillTriangle(-1, 0, 1, -10, 2, 0);
}

function paintFireTile(g, level) {
  g.fillStyle(0x442200, 0.8); g.fillCircle(0, 0, 14);
  const flames = [
    { x: 0, h: 10 + level * 2, w: 6, c: 0xff6600 },
    { x: -6, h: 7 + level, w: 4, c: 0xff4400 },
    { x: 6, h: 7 + level, w: 4, c: 0xff8800 },
    { x: -3, h: 8 + level, w: 5, c: 0xffaa00 },
    { x: 3, h: 8 + level, w: 5, c: 0xff5500 },
  ];
  for (const f of flames) {
    g.fillStyle(f.c, 0.8);
    g.fillTriangle(f.x - f.w / 2, 2, f.x, -f.h, f.x + f.w / 2, 2);
  }
  g.fillStyle(0xffff44, 0.6); g.fillTriangle(-2, 1, 0, -6 - level, 2, 1);
}

function paintIceWall(g, level) {
  const c = [0x74b9ff, 0x55ccff, 0x33ddff, 0x00eeff, 0x00ffff][Math.min(level - 1, 4)];
  g.fillStyle(c, 0.5); g.fillRect(-14, -10, 28, 20);
  g.fillStyle(c, 0.8);
  g.fillTriangle(-14, 10, -6, -8, 0, 10);
  g.fillTriangle(-2, 10, 4, -12, 10, 10);
  g.fillTriangle(6, 10, 12, -6, 14, 10);
  g.fillStyle(0xffffff, 0.6); g.fillTriangle(-5, 0, -3, -6, -1, 0);
  g.fillStyle(0xffffff, 0.8); g.fillCircle(-8, -4, 1.5); g.fillCircle(6, -2, 1);
}

function paintPoison(g, level) {
  const c = [0x6c5ce7, 0x7d6cf0, 0x9b59b6, 0xbe2edd, 0xff00ff][Math.min(level - 1, 4)];
  g.fillStyle(c, 0.4); g.fillEllipse(0, 4, 30, 14);
  g.fillStyle(c, 0.7);
  g.fillCircle(-6, -2, 4 + level * 0.5);
  g.fillCircle(4, -5, 3 + level * 0.5);
  g.fillCircle(-2, -8, 2.5);
  g.fillCircle(7, 0, 2);
  g.fillStyle(0xffffff, 0.4); g.fillCircle(-7, -4, 1.5); g.fillCircle(3, -7, 1);
  g.fillStyle(c, 0.9);
  g.fillTriangle(0, -12, -2, -6, 2, -6);
  g.fillTriangle(6, -10, 5, -5, 8, -5);
  g.fillStyle(c, 0.3);
  g.fillCircle(-4, -14, 3); g.fillCircle(2, -16, 2.5); g.fillCircle(5, -12, 2);
}

function paintLightning(g, level) {
  const c = [0xf9ca24, 0xfbda52, 0xfdeb71, 0xffff00, 0xffffff][Math.min(level - 1, 4)];
  g.fillStyle(0x555555, 1); g.fillRect(-8, 4, 16, 6);
  g.fillStyle(0x777777, 1); g.fillRect(-6, 0, 12, 5);
  g.fillStyle(0x888888, 1); g.fillRect(-1.5, -10, 3, 14);
  g.lineStyle(2, 0x999999, 0.8);
  g.beginPath(); g.arc(0, -2, 5, 0, Math.PI * 2); g.strokePath();
  g.beginPath(); g.arc(0, 2, 4, 0, Math.PI * 2); g.strokePath();
  g.lineStyle(2, c, 0.9);
  g.beginPath(); g.moveTo(0, -10); g.lineTo(-6, -6); g.lineTo(2, -3); g.lineTo(-8, 2); g.strokePath();
  g.beginPath(); g.moveTo(0, -10); g.lineTo(5, -5); g.lineTo(-1, -2); g.lineTo(7, 3); g.strokePath();
  g.fillStyle(c, 0.8);
  g.fillCircle(-8, 2, 2); g.fillCircle(7, 3, 2);
  g.fillCircle(-5, -8, 1.5); g.fillCircle(6, -6, 1.5);
  g.fillStyle(c, 0.5); g.fillCircle(0, -10, 4);
}

function paintTeleport(g, level) {
  const c = [0xa855f7, 0xb86ef8, 0xc884f9, 0xd89afa, 0xe8b0fb][Math.min(level - 1, 4)];
  g.lineStyle(3, c, 0.8);
  g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.strokePath();
  g.lineStyle(2, c, 0.5);
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.strokePath();
  g.lineStyle(1, c, 0.3);
  g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.strokePath();
  const runeCount = 4 + level;
  g.fillStyle(c, 0.7);
  for (let i = 0; i < runeCount; i++) {
    const a = (Math.PI * 2 * i) / runeCount;
    g.fillRect(Math.cos(a) * 12 - 1.5, Math.sin(a) * 12 - 1.5, 3, 3);
  }
  g.fillStyle(c, 0.4); g.fillCircle(0, 0, 5);
  g.fillStyle(0xffffff, 0.3); g.fillCircle(-1, -1, 2);
  g.fillStyle(0xffffff, 0.6); g.fillTriangle(-3, -4, 0, -10, 3, -4);
}

function paintBlackhole(g, level) {
  const c = [0x2d1b69, 0x3d2b79, 0x4d3b89, 0x5d4b99, 0x7d6bb9][Math.min(level - 1, 4)];
  g.lineStyle(4, 0x6633cc, 0.4);
  g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.strokePath();
  g.lineStyle(3, 0x9966ff, 0.3);
  g.beginPath(); g.arc(0, 0, 11, 0.5, Math.PI + 0.5); g.strokePath();
  g.lineStyle(2, 0xcc99ff, 0.2);
  g.beginPath(); g.arc(0, 0, 8, 1, Math.PI * 2 - 1); g.strokePath();
  g.fillStyle(0x000000, 1); g.fillCircle(0, 0, 6);
  g.fillStyle(c, 0.5); g.fillCircle(0, 0, 4);
  g.fillStyle(0xaa88ff, 0.5);
  g.fillCircle(-10, -8, 1.5); g.fillCircle(12, 5, 1.5);
  g.fillCircle(8, -10, 1); g.fillCircle(-11, 7, 1);
  g.fillCircle(-5, 12, 1.5); g.fillCircle(4, -13, 1);
}

// ------------------------------------------------------------
// МОНСТРЫ
// ------------------------------------------------------------

function paintSlime(g, level) {
  const c = [0x57ffb8, 0x44ff99, 0x33ff77, 0x22ff55, 0x00ff33][Math.min(level - 1, 4)];
  g.fillStyle(c, 0.85); g.fillEllipse(0, 2, 28, 22);
  g.fillStyle(c, 0.5); g.fillEllipse(0, -2, 22, 14);
  g.fillStyle(0xffffff, 0.6); g.fillEllipse(-5, -4, 6, 4);
  g.fillStyle(0x000000, 1); g.fillCircle(-5, 0, 2.5); g.fillCircle(5, 0, 2.5);
  g.fillStyle(0xffffff, 1); g.fillCircle(-4, -1, 1); g.fillCircle(6, -1, 1);
  g.lineStyle(1.5, 0x000000, 0.6);
  g.beginPath(); g.arc(0, 3, 3, 0, Math.PI, false); g.strokePath();
  if (level >= 3) {
    g.fillStyle(0xffd700, 1);
    g.fillTriangle(-6, -10, -4, -16, -2, -10);
    g.fillTriangle(-1, -10, 1, -18, 3, -10);
    g.fillTriangle(2, -10, 4, -16, 6, -10);
    g.fillRect(-6, -10, 12, 3);
  }
}

function paintSkeleton(g, level) {
  const bc = [0xe8dcc8, 0xf0e8d8, 0xf8f0e0, 0xffcc66, 0xff6600][Math.min(level - 1, 4)];
  g.fillStyle(bc, 1); g.fillRect(-3, -2, 6, 14); g.fillCircle(0, -6, 7);
  g.fillStyle(0x000000, 1); g.fillCircle(-3, -7, 2); g.fillCircle(3, -7, 2);
  g.fillStyle(0xff0000, 1); g.fillCircle(-3, -7, 1); g.fillCircle(3, -7, 1);
  g.fillStyle(0x000000, 1); g.fillRect(-4, -3, 8, 1.5);
  g.lineStyle(2, bc, 1);
  g.beginPath(); g.moveTo(-3, 2); g.lineTo(-10, 6); g.strokePath();
  g.beginPath(); g.moveTo(3, 2); g.lineTo(10, 6); g.strokePath();
  g.fillStyle(0xaaaaaa, 1); g.fillRect(10, -2, 2, 12);
  g.fillStyle(0x666666, 1); g.fillRect(8, 5, 6, 2);
  if (level >= 3) { g.fillStyle(0x888888, 0.7); g.fillEllipse(0, -10, 16, 8); }
}

function paintGoblin(g, level) {
  const bc = [0x88cc44, 0x99dd44, 0xaaee44, 0xccff00, 0xffff00][Math.min(level - 1, 4)];
  g.fillStyle(bc, 1); g.fillEllipse(0, 4, 16, 18); g.fillCircle(0, -6, 8);
  g.fillTriangle(-8, -6, -14, -12, -8, -2);
  g.fillTriangle(8, -6, 14, -12, 8, -2);
  g.fillStyle(0xffff00, 1); g.fillCircle(-3, -7, 2.5); g.fillCircle(3, -7, 2.5);
  g.fillStyle(0x000000, 1); g.fillCircle(-3, -7, 1.2); g.fillCircle(3, -7, 1.2);
  g.lineStyle(2, 0x8B4513, 1);
  g.beginPath(); g.arc(12, 0, 10, -1.2, 1.2, false); g.strokePath();
}

function paintElemental(g, level) {
  const c = [0xff6348, 0xff7b5e, 0xff9374, 0xffab8a, 0xffc3a0][Math.min(level - 1, 4)];
  g.fillStyle(c, 0.9); g.fillCircle(0, 0, 10);
  g.fillStyle(0xffff00, 0.5); g.fillCircle(0, 0, 6);
  g.fillStyle(0xffffff, 0.3); g.fillCircle(-2, -2, 3);
  g.fillStyle(c, 0.7);
  g.fillTriangle(-10, 0, -18, -6, -10, -6);
  g.fillTriangle(10, 0, 18, -6, 10, -6);
  g.fillTriangle(-10, 2, -16, 8, -10, 6);
  g.fillTriangle(10, 2, 16, 8, 10, 6);
  g.fillStyle(c, 0.6);
  g.fillTriangle(-4, -10, -2, -18, 0, -10);
  g.fillTriangle(0, -10, 2, -20, 4, -10);
  g.fillTriangle(4, -10, 6, -16, 8, -10);
  g.fillStyle(0xffffff, 1); g.fillCircle(-3, -1, 2); g.fillCircle(3, -1, 2);
  g.fillStyle(0x000000, 1); g.fillCircle(-3, -1, 1); g.fillCircle(3, -1, 1);
}

function paintDarkKnight(g, level) {
  const c = [0x2c3e50, 0x34495e, 0x3d566e, 0x4a6480, 0x5d7a96][Math.min(level - 1, 4)];
  g.fillStyle(c, 1); g.fillRect(-8, -3, 16, 18);
  g.fillStyle(0x1a1a2e, 1);
  g.fillEllipse(-10, -1, 8, 6); g.fillEllipse(10, -1, 8, 6);
  g.fillStyle(c, 1); g.fillCircle(0, -8, 8);
  g.fillStyle(0x000000, 1); g.fillRect(-5, -9, 10, 4);
  g.fillStyle(0xff0000, 0.8); g.fillCircle(-3, -8, 1.5); g.fillCircle(3, -8, 1.5);
  g.fillStyle(0x333333, 1);
  g.fillTriangle(-8, -10, -12, -20, -6, -14);
  g.fillTriangle(8, -10, 12, -20, 6, -14);
  g.fillStyle(0x444466, 1); g.fillRect(12, -14, 3, 24);
  g.fillStyle(0xff4444, 0.6); g.fillRect(12, -14, 3, 4);
  g.fillStyle(0x222233, 1); g.fillRect(10, 2, 7, 3);
  g.fillStyle(0x1a0a2e, 0.6); g.fillTriangle(-10, 15, 0, 6, 10, 15);
}

function paintNecromancer(g, level) {
  const c = [0x6c3483, 0x7d3c98, 0x8e44ad, 0xa04cbf, 0xb355d1][Math.min(level - 1, 4)];
  g.fillStyle(0x1a0a2e, 1); g.fillTriangle(-10, 16, 0, -4, 10, 16);
  g.fillStyle(c, 0.4); g.fillTriangle(-8, 14, 0, -2, 8, 14);
  g.fillStyle(0xccbbdd, 1); g.fillCircle(0, -8, 6);
  g.fillStyle(0x220044, 1); g.fillEllipse(0, -12, 16, 8);
  g.fillStyle(0x00ff66, 1); g.fillCircle(-2, -8, 2); g.fillCircle(2, -8, 2);
  g.fillStyle(0xffffff, 0.5); g.fillCircle(-2, -9, 0.8); g.fillCircle(2, -9, 0.8);
  g.fillStyle(0x553300, 1); g.fillRect(12, -16, 2, 26);
  g.fillStyle(0xdddddd, 1); g.fillCircle(13, -16, 4);
  g.fillStyle(0x000000, 1); g.fillCircle(12, -17, 1); g.fillCircle(14, -17, 1);
  g.fillStyle(0x000000, 0.5); g.fillRect(11, -14, 4, 1.5);
  g.lineStyle(1.5, c, 0.4);
  g.beginPath(); g.arc(0, 10, 10, 0, Math.PI * 2); g.strokePath();
  g.fillStyle(c, 0.5);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    g.fillRect(Math.cos(a) * 10 - 1, 10 + Math.sin(a) * 10 - 1, 2, 2);
  }
  g.fillStyle(0x88ff88, 0.3); g.fillCircle(-12, 4, 3); g.fillCircle(14, 6, 2.5);
}

function paintDragon(g, level) {
  const c = [0x8b0000, 0xa01010, 0xb52020, 0xcc3030, 0xff4444][Math.min(level - 1, 4)];
  g.fillStyle(c, 1); g.fillEllipse(0, 4, 26, 20);
  g.fillStyle(0xddaa44, 0.7); g.fillEllipse(0, 6, 14, 12);
  g.fillStyle(c, 1); g.fillCircle(0, -10, 9);
  g.fillStyle(c, 0.9); g.fillEllipse(0, -6, 12, 6);
  g.fillStyle(0x000000, 1); g.fillCircle(-2, -5, 1); g.fillCircle(2, -5, 1);
  g.fillStyle(0xffff00, 1); g.fillCircle(-4, -11, 2.5); g.fillCircle(4, -11, 2.5);
  g.fillStyle(0x000000, 1); g.fillCircle(-4, -11, 1.2); g.fillCircle(4, -11, 1.2);
  g.fillStyle(0x444444, 1);
  g.fillTriangle(-8, -12, -14, -22, -4, -16);
  g.fillTriangle(8, -12, 14, -22, 4, -16);
  g.fillStyle(c, 0.7);
  g.fillTriangle(-12, 0, -26, -10, -16, 10);
  g.fillTriangle(12, 0, 26, -10, 16, 10);
  g.fillStyle(0xcc6644, 0.4);
  g.fillTriangle(-12, 0, -24, -8, -14, 8);
  g.fillTriangle(12, 0, 24, -8, 14, 8);
  g.lineStyle(3, c, 0.8);
  g.beginPath(); g.moveTo(0, 14); g.lineTo(-4, 20); g.lineTo(-2, 24); g.lineTo(2, 22); g.strokePath();
  if (level >= 2) {
    g.fillStyle(0xff6600, 0.6); g.fillTriangle(-3, -4, 0, 8 + level * 2, 3, -4);
    g.fillStyle(0xffff00, 0.4); g.fillTriangle(-1.5, -4, 0, 4 + level, 1.5, -4);
  }
}

// ------------------------------------------------------------
// ГЕРОИ
// ------------------------------------------------------------

function paintPeasant(g) {
  g.fillStyle(0x8B7355, 1); g.fillRect(-5, -2, 10, 14);
  g.fillStyle(0xffd5b4, 1); g.fillCircle(0, -6, 6);
  g.fillStyle(0x8B4513, 1); g.fillEllipse(0, -10, 10, 5);
  g.fillStyle(0x000000, 1); g.fillCircle(-2, -6, 1); g.fillCircle(2, -6, 1);
  g.fillStyle(0x666666, 1); g.fillRect(8, -12, 1.5, 18);
  g.fillRect(6, -12, 1.5, 4); g.fillRect(9.5, -12, 1.5, 4);
}
function paintWarrior(g) {
  g.fillStyle(0x888888, 1); g.fillRect(-6, -2, 12, 14);
  g.fillStyle(0xffd5b4, 1); g.fillCircle(0, -6, 6);
  g.fillStyle(0x999999, 1); g.fillEllipse(0, -10, 14, 6);
  g.fillStyle(0x000000, 1); g.fillCircle(-2, -6, 1.2); g.fillCircle(2, -6, 1.2);
  g.fillStyle(0xcccccc, 1); g.fillRect(9, -8, 2, 16);
  g.fillStyle(0x2244aa, 0.8); g.fillEllipse(-9, 4, 8, 10);
}
function paintMage(g) {
  g.fillStyle(0x3355aa, 1); g.fillTriangle(-8, 14, 0, -4, 8, 14);
  g.fillStyle(0xffd5b4, 1); g.fillCircle(0, -6, 5);
  g.fillStyle(0x2244aa, 1); g.fillTriangle(-6, -8, 0, -20, 6, -8);
  g.fillStyle(0xffff00, 1); g.fillCircle(0, -14, 1.5);
  g.fillStyle(0x8B4513, 1); g.fillRect(9, -14, 1.5, 22);
  g.fillStyle(0x00ffff, 0.9); g.fillCircle(10, -14, 3);
}
function paintKnight(g) {
  g.fillStyle(0xbbbbbb, 1); g.fillRect(-7, -2, 14, 16);
  g.fillStyle(0xaaaaaa, 1); g.fillCircle(0, -6, 7);
  g.fillStyle(0x333333, 1); g.fillRect(-4, -7, 8, 3);
  g.fillStyle(0xff0000, 1); g.fillTriangle(-1, -13, 0, -22, 1, -13);
  g.fillStyle(0xcc0000, 0.9); g.fillEllipse(-10, 4, 10, 14);
  g.fillStyle(0xdddddd, 1); g.fillRect(10, -10, 2, 20);
}
function paintThief(g) {
  g.fillStyle(0x333344, 1); g.fillTriangle(-7, 14, 0, -2, 7, 14);
  g.fillStyle(0xffd5b4, 1); g.fillCircle(0, -6, 5);
  g.fillStyle(0x222222, 0.9); g.fillRect(-5, -8, 10, 4);
  g.fillStyle(0xffff00, 1); g.fillEllipse(-2, -7, 3, 2); g.fillEllipse(2, -7, 3, 2);
  g.fillStyle(0x222233, 1); g.fillEllipse(0, -10, 12, 6);
  g.fillStyle(0xcccccc, 1); g.fillRect(-10, -2, 1.5, 10); g.fillRect(9, -2, 1.5, 10);
}
function paintHealer(g) {
  g.fillStyle(0xeeeeff, 1); g.fillTriangle(-8, 14, 0, -4, 8, 14);
  g.fillStyle(0xffd5b4, 1); g.fillCircle(0, -6, 5);
  g.fillStyle(0xddddee, 1); g.fillEllipse(0, -10, 12, 6);
  g.fillStyle(0xff4444, 1); g.fillRect(-1, 0, 2, 6); g.fillRect(-3, 2, 6, 2);
  g.fillStyle(0x88ff88, 0.5); g.fillCircle(-8, 6, 4); g.fillCircle(8, 6, 4);
}
function paintBossPaladin(g) {
  g.fillStyle(0xddaa00, 1); g.fillRect(-10, -4, 20, 22);
  g.fillStyle(0xffd5b4, 1); g.fillCircle(0, -10, 8);
  g.fillStyle(0xffcc00, 1); g.fillEllipse(0, -14, 20, 8);
  g.fillStyle(0xffffff, 1); g.fillRect(-1, -18, 2, 8); g.fillRect(-3, -15, 6, 2);
  g.fillStyle(0x000000, 1); g.fillRect(-4, -11, 3, 2); g.fillRect(1, -11, 3, 2);
  g.lineStyle(2, 0xffff88, 0.6);
  g.beginPath(); g.arc(0, -20, 10, Math.PI, 0, false); g.strokePath();
  g.fillStyle(0x888888, 1); g.fillRect(14, -14, 3, 24);
  g.fillStyle(0xffd700, 0.9); g.fillEllipse(-14, 6, 12, 16);
  g.fillStyle(0xcc0000, 0.6); g.fillTriangle(-10, 18, 0, 6, 10, 18);
}
function paintBossArchmage(g) {
  g.fillStyle(0x220066, 1); g.fillTriangle(-14, 20, 0, -6, 14, 20);
  g.fillStyle(0x4400aa, 0.8); g.fillTriangle(-10, 18, 0, -2, 10, 18);
  g.fillStyle(0x8866ff, 0.6);
  g.fillCircle(-5, 8, 2); g.fillCircle(5, 8, 2); g.fillCircle(0, 14, 2);
  g.fillStyle(0xeeddff, 1); g.fillCircle(0, -10, 7);
  g.fillStyle(0x330088, 1); g.fillTriangle(-10, -10, 0, -32, 10, -10);
  g.fillStyle(0xff00ff, 1); g.fillCircle(-3, -10, 2); g.fillCircle(3, -10, 2);
  g.lineStyle(2, 0xaa66ff, 0.5);
  g.beginPath(); g.arc(0, 4, 16, 0, Math.PI * 2); g.strokePath();
  g.fillStyle(0x553300, 1); g.fillRect(16, -24, 2, 36);
  g.fillStyle(0xff00ff, 0.9); g.fillCircle(17, -24, 5);
}
function paintBossKing(g) {
  g.fillStyle(0xcc0000, 1); g.fillRect(-12, -6, 24, 28);
  g.fillStyle(0xffd700, 0.8); g.fillRect(-12, -6, 24, 4); g.fillRect(-12, 18, 24, 4);
  g.fillStyle(0xffd5b4, 1); g.fillCircle(0, -12, 9);
  g.fillStyle(0xffd700, 1); g.fillRect(-10, -22, 20, 5);
  g.fillTriangle(-10, -22, -8, -30, -6, -22);
  g.fillTriangle(-3, -22, 0, -32, 3, -22);
  g.fillTriangle(6, -22, 8, -30, 10, -22);
  g.fillStyle(0xff0000, 1); g.fillCircle(-7, -26, 1.5);
  g.fillStyle(0x0055ff, 1); g.fillCircle(0, -28, 2);
  g.fillStyle(0x000000, 1); g.fillCircle(-3, -12, 1.5); g.fillCircle(3, -12, 1.5);
  g.fillStyle(0x888888, 0.8); g.fillTriangle(-6, -6, 0, 4, 6, -6);
  g.fillStyle(0xffd700, 1); g.fillRect(16, -20, 2, 30); g.fillCircle(17, -20, 4);
  g.fillStyle(0x880000, 0.7); g.fillTriangle(-14, 22, 0, 8, 14, 22);
}

// ------------------------------------------------------------
// ПУБЛИЧНОЕ API
// ------------------------------------------------------------

const TRAP_PAINTERS = {
  spikes: paintSpikes, fire_tile: paintFireTile, ice_wall: paintIceWall,
  poison: paintPoison, lightning: paintLightning, teleport: paintTeleport, blackhole: paintBlackhole,
};

const MONSTER_PAINTERS = {
  slime: paintSlime, skeleton: paintSkeleton, goblin: paintGoblin,
  elemental: paintElemental, dark_knight: paintDarkKnight, necromancer: paintNecromancer, dragon: paintDragon,
};

const HERO_PAINTERS = {
  peasant: paintPeasant, warrior: paintWarrior, mage: paintMage,
  knight: paintKnight, thief: paintThief, healer: paintHealer,
  paladin: paintBossPaladin, archmage: paintBossArchmage, king: paintBossKing,
};

export function drawPiece(scene, type, kind, level) {
  const key = `pc_${type}_${level}`;
  const painter = kind === "trap" ? TRAP_PAINTERS[type] : MONSTER_PAINTERS[type];
  if (!painter) {
    const g = scene.add.graphics();
    g.fillStyle(0xff00ff, 1); g.fillRect(-10, -10, 20, 20);
    return g;
  }
  return makeCachedSprite(scene, key, (g) => painter(g, level), 60);
}

export function drawHeroByType(scene, typeId) {
  const key = `hero_${typeId}`;
  const painter = HERO_PAINTERS[typeId] || paintPeasant;
  return makeCachedSprite(scene, key, (g) => painter(g), 70);
}

// ------------------------------------------------------------
// ЭФФЕКТЫ (через пулы)
// ------------------------------------------------------------

export function spawnDeathParticles(scene, x, y, color = 0xffffff, count = 8) {
  const pool = scene.circlePool;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = Phaser.Math.Between(30, 80);
    const size = Phaser.Math.Between(2, 5);
    const p = pool ? pool.get(x, y, size, color, 0.9) : scene.add.circle(x, y, size, color, 0.9);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * speed,
      y: y + Math.sin(angle) * speed,
      alpha: 0, scaleX: 0.2, scaleY: 0.2,
      duration: Phaser.Math.Between(250, 500),
      onComplete: () => pool ? pool.release(p) : p.destroy(),
    });
  }
}

export function spawnMergeEffect(scene, x, y) {
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    const star = scene.add.text(x + Math.cos(a) * 25, y + Math.sin(a) * 25, "✦", {
      fontFamily: "Arial", fontSize: "14px", color: "#ffd700"
    }).setOrigin(0.5).setDepth(8000);
    scene.tweens.add({
      targets: star, x, y, alpha: 0, scaleX: 0.3, scaleY: 0.3,
      duration: 350, delay: i * 25, onComplete: () => star.destroy()
    });
  }
  const flash = scene.add.circle(x, y, 8, 0xffd700, 0.9).setDepth(8000);
  scene.tweens.add({
    targets: flash, scaleX: 4, scaleY: 4, alpha: 0,
    duration: 400, onComplete: () => flash.destroy()
  });
}

export function spawnPlaceEffect(scene, x, y, color = 0x00fff5) {
  const ring = scene.add.circle(x, y, 8, color, 0).setStrokeStyle(2, color);
  scene.tweens.add({
    targets: ring, scaleX: 2.5, scaleY: 2.5, alpha: 0,
    duration: 300, onComplete: () => ring.destroy()
  });
}

export function spawnBossWarning(scene) {
  const warn = scene.add.text(270, 480, t("game_boss_incoming"), {
    fontFamily: "Arial", fontSize: "36px", color: "#ff3333",
    fontStyle: "bold", stroke: "#000000", strokeThickness: 5
  }).setOrigin(0.5).setDepth(9000).setAlpha(0);
  scene.tweens.add({
    targets: warn, alpha: 1, scaleX: 1.2, scaleY: 1.2,
    yoyo: true, duration: 600, repeat: 1,
    onComplete: () => warn.destroy(),
  });
  scene.cameras.main.shake(400, 0.01);
}

export function spawnLightningChain(scene, x1, y1, x2, y2, color = 0xf9ca24) {
  const g = scene.add.graphics().setDepth(7000);
  g.lineStyle(2, color, 0.9);
  g.beginPath(); g.moveTo(x1, y1);
  const segs = 4;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    g.lineTo(x1 + (x2 - x1) * t + Phaser.Math.Between(-8, 8),
             y1 + (y2 - y1) * t + Phaser.Math.Between(-8, 8));
  }
  g.lineTo(x2, y2); g.strokePath();
  scene.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
}

export function spawnPoisonCloud(scene, x, y) {
  const pool = scene.circlePool;
  for (let i = 0; i < 5; i++) {
    const px = x + Phaser.Math.Between(-12, 12);
    const py = y + Phaser.Math.Between(-12, 12);
    const size = Phaser.Math.Between(3, 6);
    const p = pool ? pool.get(px, py, size, 0x6c5ce7, 0.5) : scene.add.circle(px, py, size, 0x6c5ce7, 0.5);
    p.setDepth(6000);
    scene.tweens.add({
      targets: p, y: py - 20, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 600, delay: i * 80,
      onComplete: () => pool ? pool.release(p) : p.destroy()
    });
  }
}

export function spawnTeleportEffect(scene, x, y) {
  const ring = scene.add.circle(x, y, 6, 0xa855f7, 0.8).setDepth(7000);
  scene.tweens.add({
    targets: ring, scaleX: 3, scaleY: 3, alpha: 0,
    duration: 400, onComplete: () => ring.destroy()
  });
}

export function spawnBlackholeEffect(scene, x, y) {
  const pool = scene.circlePool;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    const px = x + Math.cos(a) * 30, py = y + Math.sin(a) * 30;
    const p = pool ? pool.get(px, py, 3, 0x9966ff, 0.7) : scene.add.circle(px, py, 3, 0x9966ff, 0.7);
    p.setDepth(7000);
    scene.tweens.add({
      targets: p, x, y, alpha: 0,
      duration: 500, delay: i * 50,
      onComplete: () => pool ? pool.release(p) : p.destroy()
    });
  }
}

export function spawnDragonBreath(scene, x, y, targetY) {
  const g = scene.add.graphics().setDepth(7000);
  g.fillStyle(0xff6600, 0.4);
  g.fillTriangle(x - 10, y, x, targetY, x + 10, y);
  g.fillStyle(0xffff00, 0.2);
  g.fillTriangle(x - 5, y, x, targetY + 10, x + 5, y);
  scene.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
}

export function spawnNecromancerAura(scene, x, y) {
  const ring = scene.add.circle(x, y, 6, 0x6c3483, 0).setStrokeStyle(2, 0x6c3483, 0.6).setDepth(6000);
  scene.tweens.add({
    targets: ring, scaleX: 4, scaleY: 4, alpha: 0,
    duration: 600, onComplete: () => ring.destroy()
  });
}