// ============================================================
// Общие утилиты и пулы объектов
// ============================================================

// --- Троттлинг ---
export function throttle(fn, ms) {
  let last = 0;
  return function (...args) {
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      return fn.apply(this, args);
    }
  };
}

// --- Дебаунс ---
export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// --- Быстрая дистанция без sqrt (для сравнений) ---
export function distSq(x1, y1, x2, y2) {
  const dx = x1 - x2, dy = y1 - y2;
  return dx * dx + dy * dy;
}

// --- Пул текстовых объектов ---
export class TextPool {
  constructor(scene, max = 40) {
    this.scene = scene;
    this.max = max;
    this.pool = [];
    this.active = new Set();
  }

  get() {
    let t;
    if (this.pool.length > 0) {
      t = this.pool.pop();
      t.setVisible(true).setActive(true);
    } else {
      t = this.scene.add.text(0, 0, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(9999);
    }
    this.active.add(t);
    return t;
  }

  release(t) {
    if (!this.active.has(t)) return;
    this.active.delete(t);
    t.setVisible(false).setActive(false).setAlpha(1).setScale(1);
    if (this.pool.length < this.max) {
      this.pool.push(t);
    } else {
      t.destroy();
    }
  }

  destroyAll() {
    for (const t of this.active) t.destroy();
    for (const t of this.pool) t.destroy();
    this.active.clear();
    this.pool.length = 0;
  }
}

// --- Пул кругов для частиц ---
export class CirclePool {
  constructor(scene, max = 60) {
    this.scene = scene;
    this.max = max;
    this.pool = [];
    this.active = new Set();
  }

  get(x, y, radius, color, alpha = 1) {
    let c;
    if (this.pool.length > 0) {
      c = this.pool.pop();
      c.setVisible(true).setActive(true);
      c.setPosition(x, y);
      c.setRadius(radius);
      c.setFillStyle(color, alpha);
      c.setScale(1);
      c.setAlpha(alpha);
    } else {
      c = this.scene.add.circle(x, y, radius, color, alpha);
    }
    this.active.add(c);
    return c;
  }

  release(c) {
    if (!this.active.has(c)) return;
    this.active.delete(c);
    c.setVisible(false).setActive(false);
    if (this.pool.length < this.max) {
      this.pool.push(c);
    } else {
      c.destroy();
    }
  }

  destroyAll() {
    for (const c of this.active) c.destroy();
    for (const c of this.pool) c.destroy();
    this.active.clear();
    this.pool.length = 0;
  }
}