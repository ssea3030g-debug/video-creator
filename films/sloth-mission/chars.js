// 나무늘보 · 아기 늘보 · 맹수 — midcentury-toon 문법(오프레지스터 셀, 끊기는 잉크선)으로 그린다.
import { PAL, shape, ink, ellipse, spline, xform, rrect, star, lerp, TAU } from './engine/toon.js';

export const C = {
  fur: PAL.kraft, furD: PAL.kraftD, furL: PAL.kraftL, mask: PAL.white, stripe: PAL.brown,
  helmet: PAL.coral, helmetD: PAL.coralD,
};

function bumpy(cx, cy, r, k, amp, n = 40, seed = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU; const rr = r + amp * Math.sin(a * k + seed); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return pts;
}

// 긴 팔: 잉크 리본 위에 털색 리본, 끝에 세 개의 발톱
function arm(g, sx, sy, hx, hy, side, lw, seed) {
  const mx = (sx + hx) / 2 + side * 34, my = (sy + hy) / 2 + 20;
  const P = spline([[sx, sy], [mx, my], [hx, hy]], false, 12);
  ink(g, P, 58, { color: PAL.ink, taper: false, wob: 0.15, seed });
  ink(g, P, 44, { color: C.fur, taper: false, wob: 0.1, seed: seed + 1 });
  const a = Math.atan2(hy - my, hx - mx);
  for (let i = -1; i <= 1; i++) {
    const b = a + i * 0.32;
    const c = [[hx, hy], [hx + Math.cos(b) * 34, hy + Math.sin(b) * 34], [hx + Math.cos(b + side * 0.9) * 52, hy + Math.sin(b + side * 0.9) * 52]];
    ink(g, spline(c, false, 6), 13, { color: PAL.ink, seed: seed + 5 + i });
    ink(g, spline(c, false, 6), 7, { color: PAL.paper, seed: seed + 9 + i, taper: true });
  }
}

// o: x,y,s, face('flat'|'wow'|'sleepy'|'proud'), blink 0..1, helmet, armL/armR {x,y} 손 위치(로컬), legs
export function drawSloth(g, o) {
  const { x, y, s = 1, face = 'flat', blink = 0, helmet = true, seed = 1, look = 0 } = o;
  const armL = o.armL || { x: -150, y: 60 }, armR = o.armR || { x: 150, y: 60 };
  const lw = 4.5 / s;
  g.save(); g.translate(x, y); g.scale(s, s);
  // legs
  for (const sd of [-1, 1]) {
    shape(g, ellipse(sd * 78, 170, 52, 38, 24), { fill: C.furD, line: lw, seed: seed + 20 + sd });
    for (let i = -1; i <= 1; i++) ink(g, [[sd * 78 + i * 18, 196], [sd * 78 + i * 20, 222]], 9, { color: PAL.paper, seed: seed + 30 + i });
  }
  // body + belly
  const body = spline([[0, -150], [130, -110], [160, 40], [110, 170], [0, 195], [-110, 170], [-160, 40], [-130, -110]], true, 8);
  shape(g, body, { fill: C.fur, line: lw, seed: seed + 2, shade: [{ pts: ellipse(70, 40, 90, 150, 24), color: C.furD, alpha: 0.35 }] });
  shape(g, ellipse(0, 40, 92, 120, 30), { fill: C.furL, line: 0, seed: seed + 3, grain: 0.3 });
  // arms
  arm(g, -115, -95, armL.x, armL.y, -1, lw, seed + 40);
  arm(g, 115, -95, armR.x, armR.y, 1, lw, seed + 50);
  // head
  const hy = -235;
  shape(g, bumpy(0, hy, 128, 9, 6, 54, seed), { fill: C.fur, line: lw, seed: seed + 4 });
  shape(g, ellipse(look * 8, hy + 18, 98, 76, 32), { fill: C.mask, line: 0, seed: seed + 5, grain: 0.2 });
  // eye stripes (세가락나무늘보의 눈 줄무늬)
  for (const sd of [-1, 1]) {
    const st = xform(spline([[-18, -10], [30, -16], [78, 6], [60, 26], [8, 18]], true, 6), sd * 30 + look * 8, hy + 6, sd > 0 ? 0.35 : Math.PI - 0.35, 1, sd > 0 ? 1 : -1);
    shape(g, st, { fill: C.stripe, line: 0, seed: seed + 6 + sd, grain: 0.2 });
    const ex = sd * 44 + look * 12, ey = hy + 4;
    const er = face === 'wow' ? 15 : 10;
    shape(g, ellipse(ex, ey, er, er, 16), { fill: PAL.ink, line: 0, off: [0, 0], grain: 0 });
    if (face === 'wow') shape(g, ellipse(ex + 4, ey - 5, 4, 4, 8), { fill: PAL.white, line: 0, off: [0, 0], grain: 0 });
    let lid = blink;
    if (face === 'sleepy') lid = Math.max(lid, 0.55);
    if (face === 'proud') lid = Math.max(lid, 0.45);
    if (lid > 0.02) {
      g.save(); g.beginPath(); g.ellipse(ex, ey, er + 6, er + 6, 0, 0, TAU); g.clip();
      g.fillStyle = C.stripe; g.fillRect(ex - er - 8, ey - er - 8, (er + 8) * 2, (er + 8) * 2 * lid);
      g.restore();
      ink(g, [[ex - er - 4, ey - er - 6 + (er * 2 + 8) * lid], [ex + er + 4, ey - er - 6 + (er * 2 + 8) * lid]], 4, { color: PAL.ink, seed: seed + 60 });
    }
  }
  // nose + mouth
  shape(g, ellipse(look * 10, hy + 34, 22, 14, 20), { fill: PAL.ink, line: 0, grain: 0 });
  if (face === 'wow') shape(g, ellipse(look * 10, hy + 66, 12, 15, 16), { fill: PAL.ink, line: 0, grain: 0 });
  else ink(g, spline([[-30 + look * 10, hy + 58], [look * 10, hy + 70], [30 + look * 10, hy + 58]], false, 8), 5, { seed: seed + 7 });
  // helmet
  if (helmet) {
    const dome = [...ellipse(0, hy - 58, 136, 104, 30, Math.PI, TAU)];
    shape(g, dome, { fill: C.helmet, line: lw, seed: seed + 8, shade: [{ pts: ellipse(60, hy - 90, 60, 60, 20), color: C.helmetD, alpha: 0.4 }] });
    shape(g, rrect(-150, hy - 66, 300, 30, 12), { fill: C.helmetD, line: lw, seed: seed + 9 });
    shape(g, ellipse(0, hy - 120, 22, 22, 16), { fill: PAL.mustard, line: lw * 0.8, seed: seed + 10 });
    ink(g, spline([[-132, hy - 40], [-118, hy + 40], [-60, hy + 98], [0, hy + 106]], false, 8), 7, { color: PAL.ink, seed: seed + 11 });
    ink(g, spline([[132, hy - 40], [118, hy + 40], [60, hy + 98], [0, hy + 106]], false, 8), 7, { color: PAL.ink, seed: seed + 12 });
    shape(g, rrect(-16, hy + 96, 32, 22, 5), { fill: PAL.mustard, line: 3, seed: seed + 13 });
  }
  g.restore();
}

// 맹수: 기하학적 재규어형. o: x,y,s, mouth 0..1 (하품), dir, eyes('open'|'sleepy')
export function drawCat(g, o) {
  const { x, y, s = 1, mouth = 0, dir = -1, sleepy = 0, step = 0, seed = 70 } = o;
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  const lw = 4.5 / s;
  const fur = PAL.mustard, furD = PAL.mustardD;
  // tail
  ink(g, spline([[150, -10], [230, -60], [260, -150], [230, -200]], false, 10), 30, { color: PAL.ink, taper: false, seed });
  ink(g, spline([[150, -10], [230, -60], [260, -150], [230, -200]], false, 10), 20, { color: fur, taper: false, seed: seed + 1 });
  // legs
  for (const [lx, ph] of [[-110, 0], [-50, 0.5], [70, 0.25], [130, 0.75]]) {
    const k = Math.sin((step + ph) * TAU) * 14;
    shape(g, rrect(lx - 22 + k, 20, 44, 110, 20), { fill: furD, line: lw, seed: seed + lx });
  }
  // body
  shape(g, spline([[-170, -60], [0, -100], [170, -70], [190, 20], [120, 70], [-120, 70], [-190, 20]], true, 8), { fill: fur, line: lw, seed: seed + 2 });
  for (const [sx, sy, r] of [[-90, -30, 16], [-30, 0, 14], [30, -40, 18], [100, -10, 15], [-130, 20, 12], [60, 30, 12]]) {
    ink(g, ellipse(sx, sy, r, r * 0.8, 16), 6, { closed: true, color: PAL.ink, breaks: 0.35, seed: seed + sx });
  }
  // head
  const hx = -200, hy = -90;
  for (const sd of [-1, 1]) shape(g, ellipse(hx + sd * 58, hy - 78, 30, 30, 16), { fill: fur, line: lw, seed: seed + 3 + sd });
  shape(g, ellipse(hx, hy, 108, 96, 36), { fill: fur, line: lw, seed: seed + 5 });
  shape(g, ellipse(hx, hy + 40, 62, 44, 24), { fill: PAL.white, line: 0, seed: seed + 6, grain: 0.2 });
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 40, ey = hy - 22;
    shape(g, ellipse(ex, ey, 22, 18, 18), { fill: PAL.white, line: 3.5 / s, seed: seed + 7 + sd });
    const lid = Math.max(sleepy, mouth * 0.9);
    if (lid < 0.9) shape(g, ellipse(ex + 4, ey + 2, 5, 13, 12), { fill: PAL.ink, line: 0, grain: 0, off: [0, 0] });
    if (lid > 0.02) {
      g.save(); g.beginPath(); g.ellipse(ex, ey, 24, 20, 0, 0, TAU); g.clip();
      g.fillStyle = furD; g.fillRect(ex - 26, ey - 22, 52, 44 * lid); g.restore();
      ink(g, [[ex - 24, ey - 20 + 40 * lid], [ex + 24, ey - 20 + 40 * lid]], 4, { seed: seed + 8 });
    }
  }
  shape(g, ellipse(hx, hy + 22, 16, 11, 12), { fill: PAL.ink, line: 0, grain: 0 });
  if (mouth > 0.05) {
    const mh = 10 + mouth * 62;
    shape(g, ellipse(hx, hy + 52 + mh * 0.4, 30 + mouth * 14, mh, 24), { fill: PAL.coralD, line: lw, seed: seed + 9 });
    for (const sd of [-1, 1]) shape(g, [[hx + sd * 22, hy + 44], [hx + sd * 14, hy + 64], [hx + sd * 6, hy + 44]], { fill: PAL.white, line: 0, grain: 0, off: [0, 0] });
  } else ink(g, spline([[hx - 24, hy + 48], [hx, hy + 58], [hx + 24, hy + 48]], false, 8), 5, { seed: seed + 10 });
  g.restore();
}

// 덤불 속 눈 한 쌍
export function eyesPair(g, x, y, s, lid = 0, seed = 0) {
  for (const sd of [-1, 1]) {
    const ex = x + sd * 22 * s;
    shape(g, ellipse(ex, y, 15 * s, 11 * s, 14), { fill: PAL.mustardL, line: 0, grain: 0, off: [0, 0] });
    if (lid < 0.85) shape(g, ellipse(ex, y, 3 * s, 9 * s * (1 - lid), 10), { fill: PAL.ink, line: 0, grain: 0, off: [0, 0] });
    if (lid > 0.02) { g.save(); g.beginPath(); g.ellipse(ex, y, 16 * s, 12 * s, 0, 0, TAU); g.clip(); g.fillStyle = PAL.avocadoD; g.fillRect(ex - 17 * s, y - 13 * s, 34 * s, 26 * s * lid); g.restore(); }
  }
}

export function bush(g, cx, cy, s, fill = PAL.avocadoD, seed = 90) {
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI; const r = 1 + 0.14 * Math.sin(i * 2.7 + seed); pts.push([cx + Math.cos(a) * 200 * s * r, cy + Math.sin(a) * 150 * s * r]); }
  pts.push([cx + 200 * s, cy + 20 * s], [cx - 200 * s, cy + 20 * s]);
  shape(g, spline(pts, true, 4), { fill, line: 4.5, seed });
}
