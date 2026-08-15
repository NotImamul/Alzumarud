"use strict";

/* =========================================================
   ALZUMARUD — a small exploration game
   No win state. No score to chase. Just the walk.
   ========================================================= */

/* ---------- Start screen: color choice + preview ---------- */

const state = {
  playerColor: "#2ee6a6",
};

const previewCanvas = document.getElementById("preview-canvas");
const pctx = previewCanvas.getContext("2d");

// render the avatar preview at full display density instead of a fixed
// 72x72 backing store stretched (and blurred) up to its 76px CSS size —
// the drawing code below still works in the same 72x72 logical space
const PREVIEW_LOGICAL_SIZE = 72;
const PREVIEW_DPR = Math.min(window.devicePixelRatio || 1, 3);
previewCanvas.width = PREVIEW_LOGICAL_SIZE * PREVIEW_DPR;
previewCanvas.height = PREVIEW_LOGICAL_SIZE * PREVIEW_DPR;
pctx.setTransform(PREVIEW_DPR, 0, 0, PREVIEW_DPR, 0, 0);
pctx.imageSmoothingEnabled = true;
pctx.imageSmoothingQuality = "high";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/* ---- shared figure renderer: a hooded wanderer, used for both the
   start-screen preview and the in-game player so they always match ---- */
function drawWandererFigure(c, h, color, opts = {}) {
  const {
    walking = false,
    dashing = false,
    airborne = false,
    walkPhase = 0,
    time = 0,
    facing = 1,
  } = opts;

  const hw = h * 0.27;       // half-width at the shoulders
  const hemHW = h * 0.42;    // half-width at the robe hem
  const hemY = -h * 0.06;
  const shoulderY = -h * 0.62;
  const headCY = -h * 0.82;
  const headR = h * 0.155;

  c.save();
  c.scale(facing, 1);

  // dash streak, rises above the head
  if (dashing) {
    const top = headCY - headR - h * 0.5;
    const streak = c.createLinearGradient(0, top, 0, hemY);
    streak.addColorStop(0, "rgba(46,230,166,0)");
    streak.addColorStop(1, "rgba(46,230,166,0.5)");
    c.fillStyle = streak;
    c.fillRect(-hw * 0.7, top, hw * 1.4, hemY - top);
  }

  // trailing cape, drawn behind everything else
  const capeShade = lerpColor(color, "#04070a", 0.55);
  const sway = Math.sin(time * 1.4 + walkPhase * 0.3) * h * 0.05;
  c.fillStyle = capeShade;
  c.globalAlpha = 0.85;
  c.beginPath();
  c.moveTo(-hw * 0.75, shoulderY + h * 0.05);
  c.quadraticCurveTo(-hemHW * 1.1 + sway, shoulderY + h * 0.55, -hemHW * 0.85 + sway * 1.3, hemY + h * 0.1);
  c.quadraticCurveTo(-hw * 0.25, shoulderY + h * 0.35, -hw * 0.45, shoulderY);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;

  // legs, peeking below the hem
  const stepA = walking ? Math.sin(walkPhase) * h * 0.07 : (airborne ? h * 0.04 : 0);
  const stepB = walking ? Math.sin(walkPhase + Math.PI) * h * 0.07 : (airborne ? -h * 0.04 : 0);
  c.fillStyle = "#19120d";
  roundRect(c, -hw * 0.34 + stepA, hemY - 2, hw * 0.3, h * 0.15, 2); c.fill();
  roundRect(c, hw * 0.04 + stepB, hemY - 2, hw * 0.3, h * 0.15, 2); c.fill();

  // robe
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-hw, shoulderY);
  c.lineTo(hw, shoulderY);
  c.quadraticCurveTo(hemHW * 0.9, hemY - h * 0.1, hemHW, hemY);
  c.lineTo(-hemHW, hemY);
  c.quadraticCurveTo(-hemHW * 0.9, hemY - h * 0.1, -hw, shoulderY);
  c.closePath();
  c.fill();

  // faint fabric folds for a little dimension
  c.strokeStyle = "rgba(0,0,0,0.14)";
  c.lineWidth = 1;
  for (const fx of [-hw * 0.4, 0, hw * 0.4]) {
    c.beginPath();
    c.moveTo(fx * 0.6, shoulderY + h * 0.05);
    c.lineTo(fx, hemY - h * 0.02);
    c.stroke();
  }

  // chest emblem — always emerald, regardless of robe color, the one
  // constant marking the wanderer as part of this world
  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  c.globalCompositeOperation = "lighter";
  c.fillStyle = `rgba(46,230,166,${0.55 * pulse})`;
  const ey = shoulderY + h * 0.16;
  c.beginPath();
  c.moveTo(0, ey - h * 0.045);
  c.lineTo(h * 0.035, ey);
  c.lineTo(0, ey + h * 0.045);
  c.lineTo(-h * 0.035, ey);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = "source-over";

  // hood
  const hoodShade = lerpColor(color, "#04070a", 0.4);
  c.fillStyle = hoodShade;
  c.beginPath();
  c.arc(0, headCY, headR, 0, Math.PI * 2);
  c.fill();

  // shadowed face, concealed beneath the hood
  c.fillStyle = "rgba(4,6,9,0.78)";
  c.beginPath();
  c.ellipse(0, headCY + headR * 0.16, headR * 0.62, headR * 0.5, 0, 0, Math.PI * 2);
  c.fill();

  // two soft glowing eyes
  c.globalCompositeOperation = "lighter";
  c.fillStyle = color;
  c.beginPath(); c.arc(-headR * 0.24, headCY + headR * 0.12, headR * 0.11, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(headR * 0.24, headCY + headR * 0.12, headR * 0.11, 0, Math.PI * 2); c.fill();
  c.globalCompositeOperation = "source-over";

  c.restore();
}

function drawPreview(color) {
  pctx.clearRect(0, 0, 72, 72);
  pctx.save();
  pctx.translate(36, 62);

  pctx.globalCompositeOperation = "lighter";
  const glow = pctx.createRadialGradient(0, -24, 2, 0, -24, 30);
  glow.addColorStop(0, color + "77");
  glow.addColorStop(1, color + "00");
  pctx.fillStyle = glow;
  pctx.beginPath();
  pctx.arc(0, -24, 30, 0, Math.PI * 2);
  pctx.fill();
  pctx.globalCompositeOperation = "source-over";

  drawWandererFigure(pctx, 42, color, { time: previewTime });
  pctx.restore();
}

let previewTime = 0;
function tickPreview(ts) {
  previewTime = ts / 1000;
  drawPreview(state.playerColor);
  requestAnimationFrame(tickPreview);
}
requestAnimationFrame(tickPreview);

const swatchEls = Array.from(document.querySelectorAll(".swatch"));
swatchEls.forEach((el, i) => {
  el.addEventListener("click", () => {
    swatchEls.forEach((s) => s.classList.remove("active"));
    el.classList.add("active");
    state.playerColor = el.dataset.color;
  });
  if (i === 0) el.classList.add("active");
});

/* =========================================================
   SAVE SYSTEM — a single local save, stored in the browser's
   localStorage and lightly encrypted so it isn't sitting
   around as plain readable JSON. This is local obfuscation
   against casual tampering/snooping, not a security boundary —
   anyone with access to the browser's storage also has access
   to the cipher key below.
   ========================================================= */

const SAVE_KEY = "alzumarud_save_v1";
const SAVE_CIPHER_KEY = "alzumarud-emerald-wanderer-v1";

function xorCipher(str, key) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function encryptSave(obj) {
  const json = JSON.stringify(obj);
  const xored = xorCipher(json, SAVE_CIPHER_KEY);
  return btoa(unescape(encodeURIComponent(xored)));
}

function decryptSave(encoded) {
  try {
    const xored = decodeURIComponent(escape(atob(encoded)));
    const json = xorCipher(xored, SAVE_CIPHER_KEY);
    return JSON.parse(json);
  } catch (e) {
    return null; // corrupted, tampered with, or from an incompatible version
  }
}

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? decryptSave(raw) : null;
  } catch (e) {
    console.warn("Could not read save data", e);
    return null;
  }
}

function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, encryptSave(data));
    return true;
  } catch (e) {
    console.warn("Could not write save data", e);
    return false;
  }
}

function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn("Could not delete save data", e);
  }
}

function buildSaveData() {
  return {
    version: 1,
    savedAt: Date.now(),
    playerColor: player ? player.color : state.playerColor,
    playerX: player ? player.x : SPAWN_X,
    distanceMax: game.distanceMax,
    gameTime: game.time,
    fragmentsHeld: totalOf("emerald_fragment"),
    enchantedHeld: totalOf("enchanted_emerald"),
    collectedGemIds: Array.from(collectedGemIds),
    inventoryPack: inventory.pack,
    inventoryCrafting: inventory.crafting,
  };
}

function saveGame() {
  const ok = writeSave(buildSaveData());
  flashSaveButton(ok);
}

function flashSaveButton(ok) {
  const btn = document.getElementById("save-game-btn");
  if (!btn) return;
  btn.textContent = ok ? "Saved ✓" : "Save Failed";
  btn.classList.toggle("saved-flash", ok);
  clearTimeout(flashSaveButton._t);
  flashSaveButton._t = setTimeout(() => {
    btn.textContent = "Save Game";
    btn.classList.remove("saved-flash");
  }, 1200);
}

function refreshContinueHint() {
  const data = readSave();
  const hintEl = document.getElementById("continue-hint");
  if (!hintEl) return data;
  if (data) {
    const dist = Math.floor(data.distanceMax || 0);
    hintEl.textContent = `A saved journey awaits — ${dist}m walked, ${data.fragmentsHeld || 0} fragments`;
    hintEl.classList.add("visible");
    if (data.playerColor) {
      state.playerColor = data.playerColor;
      swatchEls.forEach((s) => s.classList.toggle("active", s.dataset.color === data.playerColor));
    }
  } else {
    hintEl.textContent = "";
    hintEl.classList.remove("visible");
  }
  return data;
}
refreshContinueHint();

document.getElementById("reset-data-btn").addEventListener("click", () => {
  const confirmed = confirm(
    "This will permanently delete your saved journey from this browser. This cannot be undone. Continue?"
  );
  if (!confirmed) return;
  deleteSave();
  refreshContinueHint();
});

document.getElementById("begin-btn").addEventListener("click", () => {
  const loadData = readSave(); // pick up the freshest save, in case one was just made or reset
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");
  startGame(state.playerColor, loadData);
});

document.getElementById("menu-return-btn").addEventListener("click", () => {
  document.getElementById("game-screen").classList.add("hidden");
  document.getElementById("start-screen").classList.remove("hidden");
  if (game.running) game.running = false;
  refreshContinueHint(); // reflect anything saved during this session
});

/* ================= GAME ================= */

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let W = 0, H = 0;
let DPR = 1;
function resize() {
  // clamp to 3x so a very high-density phone/tablet display doesn't tank
  // performance — desktop displays (1x/1.25x/1.5x/2x) are unaffected, and
  // this is what makes the canvas render at full native resolution instead
  // of a blurry, upscaled one
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = canvas.width = window.innerWidth * DPR;
  H = canvas.height = window.innerHeight * DPR;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}
window.addEventListener("resize", resize);
resize();

const GRAVITY = 1450;
const MOVE_SPEED = 260;
const SPRINT_SPEED = 400;
const JUMP_VELOCITY = 620;
const DOUBLE_JUMP_VELOCITY = 540;
const DASH_VELOCITY = 1250;
const GROUND_BASE = 480;

const CHUNK_WIDTH = 800;
const LOAD_RADIUS = 3;   // chunks kept loaded on each side of the player's chunk
const UNLOAD_BUFFER = 1; // extra chunks of hysteresis before unloading, avoids load/unload thrashing at the edge

const CAMERA_Y_BIAS = 0.58; // fraction down the screen the player rests at vertically
const CYCLE_PERIOD = 200;   // seconds for a full day-night cycle
const SPAWN_X = 260;        // the one fixed origin point distance-walked is measured from

/* ---- seeded RNG so a chunk always regenerates identically if revisited ---- */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- generate one 800px-wide slice of the world: platforms, trees, gems, fireflies ---- */
function generateChunk(chunkIndex) {
  const startX = chunkIndex * CHUNK_WIDTH;
  const rand = mulberry32(chunkIndex * 7919 + 104729);

  const platforms = [];
  let px = startX + rand() * 200;
  while (px < startX + CHUNK_WIDTH) {
    const gy = groundHeightAt(px);
    const y = gy - 100 - rand() * 120; // reachable with a single or double jump
    const width = 90 + rand() * 110;
    platforms.push({ x: px, y, w: width, h: 18 });
    px += 380 + rand() * 420;
  }

  const trees = [];
  let tx = startX + rand() * 60;
  while (tx < startX + CHUNK_WIDTH) {
    if (rand() > 0.35) {
      const big = rand() > 0.82; // most trees stay small; a few grow tall
      trees.push({
        x: tx,
        h: big ? 170 + rand() * 90 : 60 + rand() * 70,
        big,
        sway: rand() * Math.PI * 2,
        hue: rand() > 0.5 ? "#1a8f68" : "#14684d",
      });
    }
    tx += 90 + rand() * 140;
  }

  const gems = [];
  let gx = startX + rand() * 150;
  let gi = 0;
  while (gx < startX + CHUNK_WIDTH) {
    const onPlatform = platforms.length ? platforms[gi % platforms.length] : null;
    let px2, py2;
    if (gi % 3 === 0 && onPlatform) {
      px2 = onPlatform.x + onPlatform.w / 2;
      py2 = onPlatform.y - 26;
    } else {
      px2 = gx;
      py2 = groundHeightAt(px2) - 24;
    }
    const id = `g_${chunkIndex}_${gi}`;
    gems.push({ id, x: px2, y: py2, collected: collectedGemIds.has(id), bob: rand() * Math.PI * 2 });
    gx += 260 + rand() * 260;
    gi++;
  }

  const fireflies = [];
  const flyCount = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < flyCount; i++) {
    fireflies.push({
      x: startX + rand() * CHUNK_WIDTH,
      baseY: GROUND_BASE - 40 - rand() * 260,
      phase: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 0.6,
      radius: 12 + rand() * 24,
    });
  }

  return { platforms, trees, gems, fireflies };
}

/* ---- chunk streaming: load nearby chunks, unload distant ones, like Minecraft's world stream ---- */
const loadedChunks = new Map(); // chunkIndex -> {platforms, trees, gems, fireflies}

function ensureChunksAround(x) {
  const centerChunk = Math.floor(x / CHUNK_WIDTH);
  const needed = new Set();
  for (let i = centerChunk - LOAD_RADIUS; i <= centerChunk + LOAD_RADIUS; i++) needed.add(i);

  let changed = false;
  for (const idx of needed) {
    if (!loadedChunks.has(idx)) {
      loadedChunks.set(idx, generateChunk(idx));
      changed = true;
    }
  }
  for (const idx of Array.from(loadedChunks.keys())) {
    if (Math.abs(idx - centerChunk) > LOAD_RADIUS + UNLOAD_BUFFER) {
      loadedChunks.delete(idx);
      changed = true;
    }
  }
  if (changed) rebuildFlatArrays();
}

function rebuildFlatArrays() {
  platforms = [];
  trees = [];
  gems = [];
  fireflies = [];
  const sortedIdx = Array.from(loadedChunks.keys()).sort((a, b) => a - b);
  for (const idx of sortedIdx) {
    const c = loadedChunks.get(idx);
    platforms.push(...c.platforms);
    trees.push(...c.trees);
    gems.push(...c.gems);
    fireflies.push(...c.fireflies);
  }
}

/* ---- terrain: smooth rolling ground made of overlapping sine waves, defined for any x ---- */
function groundHeightAt(x) {
  return (
    GROUND_BASE +
    Math.sin(x * 0.0022) * 70 +
    Math.sin(x * 0.006 + 1.3) * 26 +
    Math.sin(x * 0.0009 + 4.0) * 40
  );
}

/* ---- ambient narrative lines, triggered by distance traveled ---- */
const AMBIENT_LINES = [
  "The path continues, whether or not you follow it.",
  "Not every road leads somewhere. That's alright.",
  "You have gone further than you needed to.",
  "Something here was left for no one in particular.",
  "The wind moves like it remembers something.",
  "There is no map for this. There was never meant to be.",
  "You could turn back. Most don't.",
  "Some places exist just to be passed through, quietly.",
];

/* ================= INVENTORY & CRAFTING ================= */

function drawFragmentIcon(ictx, cx, cy, size) {
  ictx.save();
  ictx.translate(cx, cy);
  ictx.globalCompositeOperation = "lighter";
  const glow = ictx.createRadialGradient(0, 0, 1, 0, 0, size * 1.15);
  glow.addColorStop(0, "rgba(46,230,166,0.55)");
  glow.addColorStop(1, "rgba(46,230,166,0)");
  ictx.fillStyle = glow;
  ictx.beginPath(); ictx.arc(0, 0, size * 1.15, 0, Math.PI * 2); ictx.fill();
  ictx.globalCompositeOperation = "source-over";
  ictx.fillStyle = "#2ee6a6";
  ictx.beginPath();
  ictx.moveTo(0, -size * 0.6);
  ictx.lineTo(size * 0.5, -size * 0.05);
  ictx.lineTo(0, size * 0.6);
  ictx.lineTo(-size * 0.5, -size * 0.05);
  ictx.closePath();
  ictx.fill();
  ictx.strokeStyle = "rgba(255,255,255,0.5)";
  ictx.lineWidth = 1;
  ictx.stroke();
  ictx.restore();
}

function drawEnchantedIcon(ictx, cx, cy, size) {
  ictx.save();
  ictx.translate(cx, cy);
  ictx.globalCompositeOperation = "lighter";
  const glow = ictx.createRadialGradient(0, 0, 1, 0, 0, size * 1.4);
  glow.addColorStop(0, "rgba(157,141,241,0.7)");
  glow.addColorStop(0.5, "rgba(46,230,166,0.35)");
  glow.addColorStop(1, "rgba(46,230,166,0)");
  ictx.fillStyle = glow;
  ictx.beginPath(); ictx.arc(0, 0, size * 1.4, 0, Math.PI * 2); ictx.fill();
  ictx.globalCompositeOperation = "source-over";
  ictx.fillStyle = "#9d8df1";
  ictx.beginPath();
  ictx.moveTo(0, -size * 0.75);
  ictx.lineTo(size * 0.55, -size * 0.2);
  ictx.lineTo(size * 0.4, size * 0.7);
  ictx.lineTo(-size * 0.4, size * 0.7);
  ictx.lineTo(-size * 0.55, -size * 0.2);
  ictx.closePath();
  ictx.fill();
  ictx.fillStyle = "rgba(46,230,166,0.55)";
  ictx.beginPath();
  ictx.moveTo(0, -size * 0.75);
  ictx.lineTo(size * 0.55, -size * 0.2);
  ictx.lineTo(0, 0);
  ictx.closePath();
  ictx.fill();
  ictx.strokeStyle = "rgba(255,255,255,0.6)";
  ictx.lineWidth = 1;
  ictx.stroke();
  ictx.restore();
}

const ITEM_DEFS = {
  emerald_fragment: {
    name: "Emerald Fragment",
    maxStack: 99,
    draw: drawFragmentIcon,
  },
  enchanted_emerald: {
    name: "Enchanted Emerald",
    maxStack: 99,
    draw: drawEnchantedIcon,
  },
};

const PACK_SIZE = 15;

const inventory = {
  pack: Array.from({ length: PACK_SIZE }, () => null),
  crafting: Array.from({ length: 9 }, () => null),
  result: null,
};
let selectedSlot = null; // { area: 'pack' | 'crafting', index } — the stack currently "picked up"
let dragTargets = []; // ordered unique list of "area:index" strings touched during an active split-drag
let mouseIsDown = false;
let justDistributed = false; // guards against the native click firing right after a drag ends on its start slot

window.addEventListener("mousedown", () => { mouseIsDown = true; });
window.addEventListener("mouseup", () => {
  mouseIsDown = false;
  if (selectedSlot && dragTargets.length > 0) performDistribution();
  dragTargets = [];
});

function addItemToPack(itemId, amount) {
  const def = ITEM_DEFS[itemId];
  let remaining = amount;
  for (const slot of inventory.pack) {
    if (remaining <= 0) break;
    if (slot && slot.item === itemId && slot.count < def.maxStack) {
      const add = Math.min(def.maxStack - slot.count, remaining);
      slot.count += add;
      remaining -= add;
    }
  }
  if (remaining > 0) {
    for (let i = 0; i < inventory.pack.length; i++) {
      if (remaining <= 0) break;
      if (!inventory.pack[i]) {
        const add = Math.min(def.maxStack, remaining);
        inventory.pack[i] = { item: itemId, count: add };
        remaining -= add;
      }
    }
  }
  return remaining; // leftover, if the pack is full
}

function totalOf(itemId) {
  let sum = 0;
  for (const s of inventory.pack) if (s && s.item === itemId) sum += s.count;
  for (const s of inventory.crafting) if (s && s.item === itemId) sum += s.count;
  return sum;
}

function checkCraftingRecipe() {
  const allFragments = inventory.crafting.every((s) => s && s.item === "emerald_fragment" && s.count >= 1);
  inventory.result = allFragments ? { item: "enchanted_emerald", count: 1 } : null;
}

function getSlotArray(area) {
  return area === "pack" ? inventory.pack : inventory.crafting;
}

function onSlotClick(area, index) {
  if (justDistributed) { justDistributed = false; return; } // this click is the tail end of a drag, not a real click
  const arr = getSlotArray(area);
  if (!selectedSlot) {
    if (arr[index]) selectedSlot = { area, index };
  } else if (selectedSlot.area === area && selectedSlot.index === index) {
    selectedSlot = null;
  } else {
    const fromArr = getSlotArray(selectedSlot.area);
    const tmp = arr[index];
    arr[index] = fromArr[selectedSlot.index];
    fromArr[selectedSlot.index] = tmp;
    selectedSlot = null;
    checkCraftingRecipe();
  }
  renderInventory();
}

/* Minecraft-style split drag: click a stack to pick it up (selectedSlot),
   then drag across other slots — every valid slot the pointer crosses
   while the button is held becomes a target, and releasing the mouse
   splits the stack as evenly as possible across all of them. */
function trackDragTarget(area, index) {
  // mouseIsDown gating happens at the call sites (mousedown fires before the
  // global mouseIsDown flag updates, since bubbling reaches window last —
  // checking it here would drop the very first slot touched in a drag)
  if (!selectedSlot) return;
  if (area === selectedSlot.area && index === selectedSlot.index) return; // can't target the source itself

  const sourceArr = getSlotArray(selectedSlot.area);
  const source = sourceArr[selectedSlot.index];
  if (!source) return;
  const def = ITEM_DEFS[source.item];

  const targetArr = getSlotArray(area);
  const target = targetArr[index];
  if (target && (target.item !== source.item || target.count >= def.maxStack)) return; // not a valid target

  const key = area + ":" + index;
  if (!dragTargets.includes(key)) {
    dragTargets.push(key);
    renderInventory(); // live-highlight the slots queued to receive a share
  }
}

function performDistribution() {
  if (!selectedSlot || dragTargets.length === 0) { dragTargets = []; return; }

  const sourceArr = getSlotArray(selectedSlot.area);
  const startIndex = selectedSlot.index;
  const source = sourceArr[startIndex];
  if (!source) { selectedSlot = null; dragTargets = []; renderInventory(); return; }

  const def = ITEM_DEFS[source.item];
  const numTargets = dragTargets.length;
  const base = Math.floor(source.count / numTargets);

  if (base < 1) {
    // not enough items to give every dragged-over slot at least one — cancel quietly
    dragTargets = [];
    justDistributed = true;
    renderInventory();
    return;
  }

  let remainder = source.count - base * numTargets;
  let totalGiven = 0;

  for (const key of dragTargets) {
    const sep = key.lastIndexOf(":");
    const area = key.slice(0, sep);
    const idx = Number(key.slice(sep + 1));
    const arr = getSlotArray(area);
    const target = arr[idx];

    let give = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    if (target) {
      if (target.item !== source.item) continue;
      give = Math.min(give, def.maxStack - target.count);
      target.count += give;
    } else {
      give = Math.min(give, def.maxStack);
      if (give > 0) arr[idx] = { item: source.item, count: give };
    }
    totalGiven += give;
  }

  source.count -= totalGiven;
  if (source.count <= 0) sourceArr[startIndex] = null;

  selectedSlot = null;
  dragTargets = [];
  justDistributed = true;
  checkCraftingRecipe();
  renderInventory();
}

/* Double-click: gather every stack of the same item within the same area
   (pack or crafting, never crossing between them) into the clicked slot,
   overflowing into fresh full stacks nearby rather than losing anything. */
function onSlotDoubleClick(area, index) {
  const arr = getSlotArray(area);
  const clicked = arr[index];
  if (!clicked) return;
  const def = ITEM_DEFS[clicked.item];

  let total = clicked.count;
  for (let i = 0; i < arr.length; i++) {
    if (i === index) continue;
    const s = arr[i];
    if (s && s.item === clicked.item) {
      total += s.count;
      arr[i] = null;
    }
  }

  arr[index] = { item: clicked.item, count: Math.min(total, def.maxStack) };
  let overflow = total - def.maxStack;
  let i = 0;
  while (overflow > 0 && i < arr.length) {
    if (i !== index && !arr[i]) {
      const give = Math.min(overflow, def.maxStack);
      arr[i] = { item: clicked.item, count: give };
      overflow -= give;
    }
    i++;
  }

  selectedSlot = null;
  justDistributed = true; // the two clicks inside a dblclick shouldn't also trigger a select/swap
  checkCraftingRecipe();
  renderInventory();
}

function onResultClick() {
  if (!inventory.result) return;
  const def = ITEM_DEFS[inventory.result.item];
  // guarantee the pack can actually receive the output before consuming the
  // nine fragments — otherwise a full pack would destroy them for nothing
  const hasRoom = inventory.pack.some((s) => !s || (s.item === inventory.result.item && s.count < def.maxStack));
  if (!hasRoom) {
    document.getElementById("crafting-hint").textContent = "Your pack is full — make room before crafting.";
    return;
  }
  for (let i = 0; i < 9; i++) {
    const s = inventory.crafting[i];
    if (s) {
      s.count -= 1;
      if (s.count <= 0) inventory.crafting[i] = null;
    }
  }
  addItemToPack(inventory.result.item, inventory.result.count);
  checkCraftingRecipe();
  renderInventory();
  updateHUD();
}

function renderSlotGrid(containerEl, arr, area) {
  containerEl.innerHTML = "";
  arr.forEach((slot, i) => {
    const el = document.createElement("div");
    const isSelected = selectedSlot && selectedSlot.area === area && selectedSlot.index === i;
    const isDragTarget = dragTargets.includes(area + ":" + i);
    el.className = "slot" + (isSelected ? " selected" : "") + (isDragTarget ? " drag-target" : "");
    if (slot) {
      const def = ITEM_DEFS[slot.item];
      el.title = def.name + (slot.count > 1 ? ` ×${slot.count}` : "");
      const cv = document.createElement("canvas");
      cv.width = 32; cv.height = 32;
      def.draw(cv.getContext("2d"), 16, 16, 13);
      el.appendChild(cv);
      if (slot.count > 1) {
        const badge = document.createElement("span");
        badge.className = "slot-count";
        badge.textContent = slot.count;
        el.appendChild(badge);
      }
    }
    el.addEventListener("click", () => onSlotClick(area, i));
    el.addEventListener("dblclick", (ev) => { ev.preventDefault(); onSlotDoubleClick(area, i); });
    // the first slot touched in a drag is caught here — mouseenter never
    // fires for the element the pointer was already resting on
    el.addEventListener("mousedown", (ev) => {
      if (selectedSlot) ev.preventDefault(); // stop native text/ghost-drag while splitting a stack
      trackDragTarget(area, i);
    });
    // every slot the pointer moves across afterward, while still held down
    el.addEventListener("mouseenter", () => {
      if (mouseIsDown) trackDragTarget(area, i);
    });
    containerEl.appendChild(el);
  });
}

function renderResultSlot() {
  const el = document.getElementById("crafting-result-slot");
  el.innerHTML = "";
  el.classList.toggle("ready", !!inventory.result);
  if (inventory.result) {
    const def = ITEM_DEFS[inventory.result.item];
    el.title = def.name;
    const cv = document.createElement("canvas");
    cv.width = 36; cv.height = 36;
    def.draw(cv.getContext("2d"), 18, 18, 15);
    el.appendChild(cv);
  }
}

function updateCraftingHint() {
  const hintEl = document.getElementById("crafting-hint");
  hintEl.textContent = inventory.result
    ? "Nine fragments remember what they were. Click to craft."
    : "Fill all nine slots with emerald fragments.";
}

function renderInventory() {
  // a stale selection (e.g. the last unit of a stack was just consumed
  // elsewhere) would otherwise leave a "selected" outline on an empty slot
  if (selectedSlot) {
    const arr = getSlotArray(selectedSlot.area);
    if (!arr[selectedSlot.index]) {
      selectedSlot = null;
      dragTargets = [];
    }
  }
  renderSlotGrid(document.getElementById("pack-grid"), inventory.pack, "pack");
  renderSlotGrid(document.getElementById("crafting-grid"), inventory.crafting, "crafting");
  renderResultSlot();
  updateCraftingHint();
}

/* ================= GAME STATE ================= */

const game = {
  running: false,
  time: 0, // seconds elapsed, drives day/night cycle
  distanceMax: 0,
  triggeredLines: new Set(),
  gemsCollected: 0,
};

const collectedGemIds = new Set();

let player, platforms, trees, gems, fireflies, cameraX, cameraY;
const keys = {};
let prevKeys = {};
let prevLeftShiftHeld = false;
let particles = [];

function spawnJumpBurst() {
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI + Math.random() * Math.PI; // downward fan
    const speed = 60 + Math.random() * 90;
    particles.push({
      x: player.x,
      y: player.y + player.h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.4 + Math.random() * 0.2,
      age: 0,
      color: player.color,
    });
  }
}

/* trickles upward behind the player while diving, like a rush of air */
function spawnDashTrail() {
  for (let i = 0; i < 2; i++) {
    particles.push({
      x: player.x + (Math.random() - 0.5) * player.w,
      y: player.y + player.h * 0.2 + Math.random() * player.h * 0.6,
      vx: (Math.random() - 0.5) * 30,
      vy: -60 - Math.random() * 60,
      life: 0.28 + Math.random() * 0.12,
      age: 0,
      color: "#2ee6a6",
    });
  }
}

/* burst on impact when a dash lands */
function spawnDashImpact() {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 160;
    particles.push({
      x: player.x,
      y: player.y + player.h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.5 - 40,
      life: 0.35 + Math.random() * 0.25,
      age: 0,
      color: "#2ee6a6",
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
  }
  particles = particles.filter((p) => p.age < p.life);
}

function drawParticles() {
  for (const p of particles) {
    const t = 1 - p.age / p.life;
    ctx.globalAlpha = t;
    ctx.fillStyle = p.color || player.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5 * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function normalizeSlotArray(arr, size) {
  return Array.from({ length: size }, (_, i) => (arr && arr[i]) ? { ...arr[i] } : null);
}

function startGame(color, loadData = null) {
  const startX = loadData && typeof loadData.playerX === "number" ? loadData.playerX : SPAWN_X;
  const startColor = loadData && loadData.playerColor ? loadData.playerColor : color;

  player = {
    x: startX,
    y: groundHeightAt(startX) - 40,
    w: 20,
    h: 40,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    color: startColor,
    walkCycle: 0,
    jumpsUsed: 0,
    dashing: false,
    sprinting: false,
  };

  loadedChunks.clear();
  collectedGemIds.clear();
  if (loadData && Array.isArray(loadData.collectedGemIds)) {
    for (const id of loadData.collectedGemIds) collectedGemIds.add(id);
  }
  platforms = [];
  trees = [];
  gems = [];
  fireflies = [];
  ensureChunksAround(player.x);

  cameraX = player.x - window.innerWidth / 2;
  cameraY = player.y + player.h / 2 - window.innerHeight * CAMERA_Y_BIAS;
  particles = [];
  prevKeys = {};
  prevLeftShiftHeld = false;
  leftShiftHeld = false;
  rightShiftHeld = false;
  dragTargets = [];
  mouseIsDown = false;
  game.running = true;
  game.time = loadData && typeof loadData.gameTime === "number" ? loadData.gameTime : 0;
  game.distanceMax = loadData && typeof loadData.distanceMax === "number" ? loadData.distanceMax : 0;
  game.triggeredLines = new Set();
  game.gemsCollected = 0;

  inventory.pack = loadData ? normalizeSlotArray(loadData.inventoryPack, PACK_SIZE) : Array.from({ length: PACK_SIZE }, () => null);
  inventory.crafting = loadData ? normalizeSlotArray(loadData.inventoryCrafting, 9) : Array.from({ length: 9 }, () => null);
  inventory.result = null;
  checkCraftingRecipe();
  selectedSlot = null;
  updateHUD();

  lastTS = performance.now();
  requestAnimationFrame(loop);
}

/* ---------- input ----------
   Left Shift and Right Shift both report key === "Shift", so they can only
   be told apart via e.code. Left Shift stays bound to the double jump;
   Right Shift is dedicated to sprinting so the two never fight each other. */
let leftShiftHeld = false;
let rightShiftHeld = false;

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === "ShiftLeft") leftShiftHeld = true;
  if (e.code === "ShiftRight") rightShiftHeld = true;
  if (e.key.toLowerCase() === "i") toggleInventory();
  if (["arrowup", "arrowdown", " "].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
  if (e.code === "ShiftLeft") leftShiftHeld = false;
  if (e.code === "ShiftRight") rightShiftHeld = false;
});
// if the window loses focus mid-press (alt-tab, clicking a browser chrome
// element), stuck keys used to keep the player moving/sprinting forever
window.addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
  leftShiftHeld = false;
  rightShiftHeld = false;
  mouseIsDown = false;
  dragTargets = [];
});

const inventoryPanel = document.getElementById("inventory-panel");
document.getElementById("close-inventory").addEventListener("click", toggleInventory);
document.getElementById("crafting-result-slot").addEventListener("click", onResultClick);
document.getElementById("save-game-btn").addEventListener("click", () => {
  if (!game.running) return;
  saveGame();
});

function toggleInventory() {
  inventoryPanel.classList.toggle("hidden");
  if (!inventoryPanel.classList.contains("hidden")) {
    selectedSlot = null;
    renderInventory();
  }
}

function updateHUD() {
  document.getElementById("gem-count").textContent = totalOf("emerald_fragment");
  document.getElementById("enchanted-count").textContent = totalOf("enchanted_emerald");
}

/* ---------- ambient text ---------- */
const ambientEl = document.getElementById("ambient-text");
let ambientTimer = null;
function showAmbient(text) {
  ambientEl.textContent = text;
  ambientEl.classList.add("visible");
  clearTimeout(ambientTimer);
  ambientTimer = setTimeout(() => ambientEl.classList.remove("visible"), 5200);
}

/* ================= UPDATE ================= */

let lastTS = 0;

function loop(ts) {
  if (!game.running) return;
  const dt = Math.min((ts - lastTS) / 1000, 0.033);
  lastTS = ts;
  game.time += dt;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt) {
  // horizontal input
  const left = keys["a"] || keys["arrowleft"];
  const right = keys["d"] || keys["arrowright"];
  const jumpHeld = keys["w"] || keys["arrowup"] || keys[" "];
  const dashHeld = keys["s"] || keys["arrowdown"];

  const jumpPressed =
    jumpHeld &&
    !(prevKeys["w"] || prevKeys["arrowup"] || prevKeys[" "]);
  const doubleJumpPressed = leftShiftHeld && !prevLeftShiftHeld;
  const dashPressed = dashHeld && !(prevKeys["s"] || prevKeys["arrowdown"]);

  const sprinting = rightShiftHeld && (left !== right);
  player.sprinting = sprinting;
  const moveSpeed = sprinting ? SPRINT_SPEED : MOVE_SPEED;

  if (left && !right) {
    player.vx = -moveSpeed;
    player.facing = -1;
  } else if (right && !left) {
    player.vx = moveSpeed;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  if (jumpPressed && player.onGround) {
    player.vy = -JUMP_VELOCITY;
    player.onGround = false;
    player.jumpsUsed = 1;
  } else if (doubleJumpPressed && !player.onGround && player.jumpsUsed < 2) {
    player.vy = -DOUBLE_JUMP_VELOCITY;
    player.jumpsUsed = 2;
    spawnJumpBurst();
  } else if (dashPressed && !player.onGround && !player.dashing) {
    player.vy = DASH_VELOCITY;
    player.dashing = true;
  }

  player.vy += GRAVITY * dt;

  // horizontal move — the world has no edges
  player.x += player.vx * dt;

  // vertical move — track feet position before and after so fast falls
  // (or a dash) can't tunnel straight through a platform in one frame
  const prevFeetY = player.y + player.h;
  const wasOnGround = player.onGround;
  player.y += player.vy * dt;
  const feetY = player.y + player.h;

  // platform collision: only lands if the feet actually crossed the
  // platform's top surface this frame while moving downward
  player.onGround = false;
  for (const p of platforms) {
    const withinX = player.x + player.w / 2 > p.x && player.x - player.w / 2 < p.x + p.w;
    const crossedTop = player.vy >= 0 && prevFeetY <= p.y + 1 && feetY >= p.y;
    if (withinX && crossedTop) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumpsUsed = 0;
    }
  }

  // ground collision
  const gy = groundHeightAt(player.x);
  if (player.y + player.h >= gy) {
    player.y = gy - player.h;
    player.vy = 0;
    player.onGround = true;
    player.jumpsUsed = 0;
  }

  // just landed this frame — settle the dash and, if it was a dash landing, kick up an impact burst
  if (player.onGround && !wasOnGround) {
    if (player.dashing) spawnDashImpact();
    player.dashing = false;
  }

  if (player.dashing) spawnDashTrail();

  if (player.vx !== 0 && player.onGround) player.walkCycle += dt * (sprinting ? 16 : 10);

  prevKeys = { ...keys };
  prevLeftShiftHeld = leftShiftHeld;

  // camera follow — no clamp, the world streams in both directions.
  // Vertical follow keeps the ground in view regardless of terrain height
  // or window size (previously the camera never moved on Y, so low dips
  // in the terrain could render below the visible canvas).
  const targetCamX = player.x - window.innerWidth / 2;
  cameraX += (targetCamX - cameraX) * Math.min(1, dt * 6);
  const targetCamY = player.y + player.h / 2 - window.innerHeight * CAMERA_Y_BIAS;
  cameraY += (targetCamY - cameraY) * Math.min(1, dt * 5);

  // stream chunks in/out around the player, Minecraft-style
  ensureChunksAround(player.x);

  // track the furthest the player has ever wandered from the fixed spawn
  // point — this was previously declared but never actually updated
  game.distanceMax = Math.max(game.distanceMax, Math.abs(player.x - SPAWN_X));

  // gem pickup — goes into the pack as an Emerald Fragment
  for (const g of gems) {
    if (g.collected) continue;
    const dx = g.x - player.x;
    const dy = g.y - (player.y + player.h / 2);
    if (Math.hypot(dx, dy) < 34) {
      g.collected = true;
      collectedGemIds.add(g.id);
      addItemToPack("emerald_fragment", 1);
      updateHUD();
      if (!inventoryPanel.classList.contains("hidden")) renderInventory();
    }
  }

  // ambient narrative triggers by distance
  const dist = Math.floor(Math.abs(player.x) / 700);
  if (dist > 0 && dist <= AMBIENT_LINES.length && !game.triggeredLines.has(dist)) {
    game.triggeredLines.add(dist);
    showAmbient(AMBIENT_LINES[dist - 1]);
  }

  updateParticles(dt);
}

/* ================= RENDER ================= */

/* ---- star field: generated once, tiled seamlessly so panning never pops/glitches ---- */
const STAR_LAYER_CONFIG = [
  { count: 90, period: 2200, yMin: 0.02, yMax: 0.34, parallax: 0.025, sizeMin: 0.7, sizeMax: 1.4 },
  { count: 55, period: 1500, yMin: 0.05, yMax: 0.48, parallax: 0.07, sizeMin: 1.1, sizeMax: 2.1 },
];
function buildStarLayers() {
  return STAR_LAYER_CONFIG.map((cfg) => ({
    ...cfg,
    stars: Array.from({ length: cfg.count }, () => ({
      xSeed: Math.random() * cfg.period,
      yFrac: cfg.yMin + Math.random() * (cfg.yMax - cfg.yMin),
      size: cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin),
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 1.4,
    })),
  }));
}
const starLayers = buildStarLayers();

/* ---- drifting clouds, tiled the same way as the stars, fade in with daylight ---- */
const CLOUD_CONFIG = { count: 14, period: 2600, yMin: 0.06, yMax: 0.3, parallax: 0.04 };
function buildClouds() {
  return Array.from({ length: CLOUD_CONFIG.count }, () => ({
    xSeed: Math.random() * CLOUD_CONFIG.period,
    yFrac: CLOUD_CONFIG.yMin + Math.random() * (CLOUD_CONFIG.yMax - CLOUD_CONFIG.yMin),
    scale: 0.6 + Math.random() * 0.9,
    speed: 4 + Math.random() * 6,
  }));
}
const clouds = buildClouds();

function drawCloudPuff(x, y, scale) {
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const blobs = [[0, 0, 26], [20, 4, 20], [-20, 4, 20], [10, -8, 16], [-10, -8, 16]];
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClouds(dayAmount) {
  if (dayAmount < 0.05) return;
  const w = window.innerWidth, h = window.innerHeight;
  ctx.save();
  ctx.globalAlpha = Math.min(1, dayAmount) * 0.75;
  for (const c of clouds) {
    const copies = Math.ceil(w / CLOUD_CONFIG.period) + 2;
    let base = (c.xSeed - cameraX * CLOUD_CONFIG.parallax + game.time * c.speed) % CLOUD_CONFIG.period;
    if (base < 0) base += CLOUD_CONFIG.period;
    for (let k = -1; k <= copies; k++) {
      const cx = base + k * CLOUD_CONFIG.period;
      if (cx < -120 || cx > w + 120) continue;
      drawCloudPuff(cx, c.yFrac * h, c.scale);
    }
  }
  ctx.restore();
}

/* ---- sun & moon: opposite points on one continuous cycle, low light = rim glow / bloom ---- */
function skyState(t) {
  const angle = (t / CYCLE_PERIOD) * Math.PI * 2;
  const cyclePos = (-Math.cos(angle) + 1) / 2; // 0 = midnight, 1 = noon, smooth throughout

  const sunElevation = -Math.cos(angle);
  const moonAngle = angle + Math.PI;
  const moonElevation = -Math.cos(moonAngle);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const horizonY = h * 0.56;
  const arcHeight = h * 0.42;

  const sunFrac = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
  const moonFrac = ((moonAngle / (Math.PI * 2)) % 1 + 1) % 1;

  const nightTop = [7, 12, 20];
  const dayTop = [78, 138, 196]; // brighter, more saturated sky blue at noon
  const nightBottom = [18, 26, 40];
  const dayBottom = [186, 220, 218]; // brighter hazy horizon
  const lerp = (a, b) => Math.round(a + (b - a) * cyclePos);
  const top = `rgb(${lerp(nightTop[0], dayTop[0])},${lerp(nightTop[1], dayTop[1])},${lerp(nightTop[2], dayTop[2])})`;
  const bottom = `rgb(${lerp(nightBottom[0], dayBottom[0])},${lerp(nightBottom[1], dayBottom[1])},${lerp(nightBottom[2], dayBottom[2])})`;

  return {
    cyclePos,
    top,
    bottom,
    sun: { x: w * sunFrac, y: horizonY - sunElevation * arcHeight, elevation: sunElevation },
    moon: { x: w * moonFrac, y: horizonY - moonElevation * arcHeight, elevation: moonElevation },
  };
}

function drawStars(nightFactor) {
  if (nightFactor <= 0.01) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.save();
  for (const layer of starLayers) {
    const copies = Math.ceil(w / layer.period) + 2;
    for (const s of layer.stars) {
      let base = (s.xSeed - cameraX * layer.parallax) % layer.period;
      if (base < 0) base += layer.period;
      for (let k = -1; k <= copies; k++) {
        const sx = base + k * layer.period;
        if (sx < -6 || sx > w + 6) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(game.time * s.twinkleSpeed + s.twinklePhase);
        ctx.globalAlpha = nightFactor * (0.35 + 0.65 * twinkle);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(sx, s.yFrac * h, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawSun(sun) {
  if (sun.elevation <= 0) return;
  const alpha = Math.min(1, sun.elevation * 1.8);
  const { x, y } = sun;
  ctx.save();
  ctx.globalAlpha = alpha;

  // rotating rays, additive blend for a soft bloom look
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,221,140,0.4)";
  ctx.lineWidth = 2;
  const rayCount = 12;
  for (let i = 0; i < rayCount; i++) {
    const a = (i / rayCount) * Math.PI * 2 + game.time * 0.06;
    const r1 = 24;
    const r2 = 52 + Math.sin(game.time * 1.4 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    ctx.stroke();
  }

  // bloom halo
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 85);
  glow.addColorStop(0, "rgba(255,246,222,0.95)");
  glow.addColorStop(0.35, "rgba(255,219,125,0.4)");
  glow.addColorStop(1, "rgba(255,219,125,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 85, 0, Math.PI * 2);
  ctx.fill();

  // solid core
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(moon) {
  if (moon.elevation <= 0) return;
  const alpha = Math.min(1, moon.elevation * 1.8);
  const { x, y } = moon;
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 55);
  glow.addColorStop(0, "rgba(220,230,255,0.65)");
  glow.addColorStop(1, "rgba(220,230,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 55, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#eef2f5";
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  // soft craters for a little texture
  ctx.fillStyle = "rgba(180,190,205,0.55)";
  ctx.beginPath(); ctx.arc(x - 5, y - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4, y + 5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2, y - 6, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function render() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const sky = skyState(game.time);
  const nightFactor = 1 - sky.cyclePos;

  // sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, sky.top);
  grad.addColorStop(1, sky.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawStars(nightFactor);
  drawMoon(sky.moon);
  drawSun(sky.sun);

  // distant mountains — solid parallax silhouettes, smooth ridgeline (no jagged abs-sine glitching)
  drawMountains(0.15, 0.64, lerpColor("#0a131f", "#5c7c92", sky.cyclePos), 0.05);
  drawMountains(0.3, 0.72, lerpColor("#060d16", "#3f566e", sky.cyclePos), 0.09);

  drawClouds(sky.cyclePos);

  // ground + trees + platforms + gems + fireflies + player, all in world space
  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  drawGround(sky.cyclePos);
  drawGrassTufts(sky.cyclePos);
  drawTrees();
  drawPlatforms();
  drawFireflies(sky.cyclePos);
  drawGems();
  drawParticles();
  drawPlayer();

  ctx.restore();

  // vignette — eased back a bit during daylight so noon actually reads as bright,
  // while keeping the fuller moody vignette at night
  const vignetteStrength = 0.35 - 0.12 * sky.cyclePos;
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${vignetteStrength})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawMountains(parallaxX, baseYFrac, color, verticalParallax) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const offsetX = -cameraX * parallaxX;
  const restCamY = GROUND_BASE - h * CAMERA_Y_BIAS;
  const baseY = h * baseYFrac + (cameraY - restCamY) * verticalParallax;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const step = 22; // finer sampling = smoother ridgeline instead of a faceted low-poly silhouette
  for (let x = -step; x <= w + step; x += step) {
    const worldX = x - offsetX;
    // smooth rolling ridge, no absolute-value kinks (that jaggedness read as "glitchy fog")
    const ridge = Math.sin(worldX * 0.0012) * 0.5 + Math.sin(worldX * 0.00045 + 2) * 0.5;
    const y = baseY - (ridge * 0.5 + 0.5) * 95;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawGround(dayAmount) {
  const startX = cameraX - 50;
  const endX = cameraX + window.innerWidth + 50;
  const step = 5; // finer sampling of the terrain curve = smoother silhouette, no more faceted-looking hills
  ctx.beginPath();
  const bottom = cameraY + window.innerHeight + 300; // always past the visible area, whatever the camera height
  ctx.moveTo(startX, bottom);
  for (let x = startX; x <= endX; x += step) {
    ctx.lineTo(x, groundHeightAt(x));
  }
  ctx.lineTo(endX, bottom);
  ctx.closePath();

  const grassColor = lerpColor("#0f2a22", "#2b5645", dayAmount);
  ctx.fillStyle = grassColor;
  ctx.fill();

  // thin glowing edge along the surface
  ctx.beginPath();
  for (let x = startX; x <= endX; x += step) {
    const y = groundHeightAt(x);
    if (x === startX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(46,230,166,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ---- small grass tufts along the ground, positioned deterministically from x so they never jitter as the camera pans ---- */
function drawGrassTufts(dayAmount) {
  const startX = cameraX - 50;
  const endX = cameraX + window.innerWidth + 50;
  ctx.strokeStyle = lerpColor("#123527", "#2c6b4d", dayAmount);
  ctx.lineWidth = 1.4;
  const step = 18;
  for (let x = Math.floor(startX / step) * step; x < endX; x += step) {
    const seed = Math.sin(x * 12.9898) * 43758.5453;
    const frac = seed - Math.floor(seed);
    if (frac > 0.5) continue; // sparse, not every slot gets a tuft
    const gy = groundHeightAt(x);
    const bladeH = 5 + frac * 11;
    const lean = Math.sin(game.time * 1.2 + x * 0.05) * 2;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.quadraticCurveTo(x + lean * 0.5, gy - bladeH * 0.6, x + lean, gy - bladeH);
    ctx.stroke();
  }
}

function drawFireflies(cyclePos) {
  // fireflies belong to the dark — they fade in near dusk and vanish completely by day
  const DAY_CUTOFF = 0.55;
  const FADE_START = 0.4;
  if (cyclePos >= DAY_CUTOFF) return;
  const visibility = cyclePos <= FADE_START ? 1 : 1 - (cyclePos - FADE_START) / (DAY_CUTOFF - FADE_START);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const f of fireflies) {
    if (f.x < cameraX - 60 || f.x > cameraX + window.innerWidth + 60) continue;
    const y = f.baseY + Math.sin(game.time * f.speed + f.phase) * f.radius * 0.3;
    const x = f.x + Math.cos(game.time * f.speed * 0.7 + f.phase) * f.radius;
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(game.time * 2 + f.phase));
    ctx.globalAlpha = visibility * flicker * 0.9;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
    glow.addColorStop(0, "rgba(244,211,94,0.9)");
    glow.addColorStop(1, "rgba(244,211,94,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTrees() {
  const startX = cameraX - 150;
  const endX = cameraX + window.innerWidth + 150;
  for (const t of trees) {
    if (t.x < startX || t.x > endX) continue;
    const gy = groundHeightAt(t.x);
    const swayAngle = Math.sin(game.time * 0.6 + t.sway) * (t.big ? 0.035 : 0.05);
    ctx.save();
    ctx.translate(t.x, gy);

    // trunk
    ctx.fillStyle = t.big ? "#231a13" : "#2a1f18";
    const trunkW = t.big ? 10 : 6;
    ctx.fillRect(-trunkW / 2, -t.h * 0.4, trunkW, t.h * 0.4);

    // canopy: a cluster of overlapping blobs that sways as one rigid unit,
    // rotated around the top of the trunk rather than shifted per-vertex
    ctx.save();
    ctx.translate(0, -t.h * 0.4);
    ctx.rotate(swayAngle);
    ctx.fillStyle = t.hue;
    const canopyH = t.h * 0.75;
    const blobs = t.big
      ? [
          [0, -canopyH * 0.55, canopyH * 0.42],
          [-canopyH * 0.28, -canopyH * 0.32, canopyH * 0.3],
          [canopyH * 0.28, -canopyH * 0.32, canopyH * 0.3],
          [0, -canopyH * 0.15, canopyH * 0.34],
          [-canopyH * 0.2, -canopyH * 0.02, canopyH * 0.22],
          [canopyH * 0.2, -canopyH * 0.02, canopyH * 0.22],
        ]
      : [
          [0, -canopyH * 0.5, canopyH * 0.36],
          [-canopyH * 0.22, -canopyH * 0.28, canopyH * 0.24],
          [canopyH * 0.22, -canopyH * 0.28, canopyH * 0.24],
        ];
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    // soft rim highlight for a little dimension
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.arc(-canopyH * 0.12, -canopyH * 0.6, canopyH * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

function drawPlatforms() {
  for (const p of platforms) {
    if (p.x + p.w < cameraX - 50 || p.x > cameraX + window.innerWidth + 50) continue;

    const grad = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    grad.addColorStop(0, "#2b3f52");
    grad.addColorStop(1, "#1a2836");
    ctx.fillStyle = grad;
    roundRect(ctx, p.x, p.y, p.w, p.h, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(46,230,166,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // scattered moss speckles, deterministic from position
    ctx.fillStyle = "rgba(46,230,166,0.2)";
    const specCount = Math.max(2, Math.floor(p.w / 24));
    for (let i = 0; i < specCount; i++) {
      const sx = p.x + 6 + i * (p.w - 12) / specCount;
      const seed = Math.sin((p.x + i * 13.7) * 4.11) * 10000;
      const jy = (seed - Math.floor(seed)) * (p.h - 6);
      ctx.beginPath();
      ctx.arc(sx, p.y + 3 + jy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // faint glowing rune in the center, a quiet nod to the fragments scattered nearby
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.3 + 0.2 * Math.sin(game.time * 1.5 + p.x * 0.01);
    ctx.strokeStyle = `rgba(46,230,166,${pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(7, p.h * 0.3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGems() {
  for (const g of gems) {
    if (g.collected) continue;
    if (g.x < cameraX - 50 || g.x > cameraX + window.innerWidth + 50) continue;
    const bob = Math.sin(game.time * 2 + g.bob) * 5;
    const pulse = 0.75 + 0.25 * Math.sin(game.time * 3 + g.bob);
    const y = g.y + bob;
    ctx.save();
    ctx.translate(g.x, y);

    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, `rgba(46,230,166,${0.6 * pulse})`);
    glow.addColorStop(1, "rgba(46,230,166,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = "#2ee6a6";
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, -1);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y + player.h); // anchor at the feet

  // aura
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(0, -player.h * 0.5, 2, 0, -player.h * 0.5, 36);
  glow.addColorStop(0, player.color + "55");
  glow.addColorStop(1, player.color + "00");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -player.h * 0.5, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  const walking = player.onGround && player.vx !== 0;
  const hop = walking ? Math.abs(Math.sin(player.walkCycle)) * 2 : 0;
  ctx.translate(0, -hop);

  if (player.sprinting && walking) ctx.rotate(-0.14 * player.facing);

  const stretch = player.dashing ? 1.22 : 1;
  ctx.scale(1 / Math.sqrt(stretch), stretch);

  drawWandererFigure(ctx, player.h, player.color, {
    walking,
    dashing: player.dashing,
    airborne: !player.onGround,
    walkPhase: player.walkCycle,
    time: game.time,
    facing: player.facing,
  });

  ctx.restore();
}
