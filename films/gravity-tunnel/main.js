// 42분 터널 — picture engine (Canvas 2D phosphor). MIT License, see LICENSE note in CREDITS.
// Every number on screen comes from R, G and the phase of the drawn motion.
'use strict';
(() => {
const W = innerWidth, H = innerHeight;
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const X = cv.getContext('2d');
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const LB = mk(), LT = mk(), LH = mk(), LA = mk();               // beam, text/graticule, hot, amber
const B = LB.getContext('2d'), T = LT.getContext('2d'), HC = LH.getContext('2d'), A = LA.getContext('2d');
const SM = mk(W / 4, H / 4), SMc = SM.getContext('2d');
const MD = mk(W / 2, H / 2), MDc = MD.getContext('2d');
const TMP = mk(), TMPc = TMP.getContext('2d');

// —— palette (STYLE.md §3) ——
const C = { bg: '#010402', amb: '#0B2412', beam: '#4DFF88', text: '#8DFFB0', hot: '#E6FFEC', amber: '#FFB547' };

// —— physics ——
const R_KM = 6371, G = 9.81, R_M = R_KM * 1000;
const OMEGA = Math.sqrt(G / R_M);                 // rad/s
const HALF = Math.PI / OMEGA;                     // s, one way
const HALF_MIN = HALF / 60;                       // 42.196…
const VMAX = Math.sqrt(G * R_M) / 1000;           // km/s
const mmss = s => { const q = Math.round(s), m = Math.floor(q / 60), r = q % 60; return `${m}분 ${String(r).padStart(2, '0')}초`; };
const ARR = mmss(HALF);                           // "42분 12초"

// —— helpers ——
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ss = x => x * x * (3 - 2 * x);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// —— timeline (seconds) — single source for picture, EV and subtitles ——
const DUR = 30.0;
const TL = {
  on: 0.0, circle0: 0.6, circle1: 1.6, title: 0.9,
  tun0: 2.0, tun1: 2.8, spawn: 2.6, fall0: 3.0, fall1: 11.0,
  stop: 14.6, chord0: 15.0, chord1: 15.9, run: 16.0, f2a: 16.0, f2b: 22.0,
  verdict: 25.2, off: 29.5,
};
const SUBS = [
  { t0: 1.2, t1: 5.0, text: '지구를 뚫고 뛰어들면?' },
  { t0: 5.4, t1: 9.6, text: '중심 통과 속도: 초속 7.9km' },
  { t0: 11.0, t1: 14.6, text: '반대편 도착까지 42분' },
  { t0: 15.0, t1: 19.4, text: '짧게 비스듬히 뚫으면?' },
  { t0: 22.0, t1: 25.6, text: '결과는 똑같이 42분' },
];

// phases (0..π) of the two motions
const ph1 = t => t < TL.f2a ? Math.PI * seg(t, TL.fall0, TL.fall1) : Math.PI * (1 + seg(t, TL.f2a, TL.f2b));
const ph2 = t => Math.PI * seg(t, TL.f2a, TL.f2b);
// world units: R = 1, y up
const ball1 = t => [0, Math.cos(ph1(t))];                     // top → bottom → top
const CH = (() => { const d = 0.6, L = 0.8, th = 160 * Math.PI / 180;
  const M = [d * Math.cos(th), d * Math.sin(th)], u = [-Math.sin(th), Math.cos(th)];
  return { d, L, M, u, P0: [M[0] - L * u[0], M[1] - L * u[1]], P1: [M[0] + L * u[0], M[1] + L * u[1]] }; })();
const s2 = t => -CH.L * Math.cos(ph2(t));                      // along chord, from P0 to P1
const ball2 = t => { const s = s2(t); return [CH.M[0] + s * CH.u[0], CH.M[1] + s * CH.u[1]]; };
const simSec = t => t < TL.f2a ? HALF * seg(t, TL.fall0, TL.fall1) : HALF * seg(t, TL.f2a, TL.f2b);

// —— camera ——
const EX = W / 2, EY = 770, S0 = 330;
function cam(t) {
  const bump = ss(seg(t, 3.0, 6.2)) * (1 - ss(seg(t, 7.6, 10.6)));
  let z = 1 + 0.9 * bump, cx = 0, cy = ball1(t)[1] * bump;
  const p = eio(seg(t, TL.stop, TL.run));                      // pan for the chord
  const push = ss(seg(t, TL.run, TL.f2b));
  cx = lerp(cx, -0.14, p); z = lerp(z, 0.94 + 0.08 * push, p);
  const v = eio(seg(t, TL.verdict, TL.verdict + 1.0));
  z = lerp(z, 0.98, v); cx = lerp(cx, -0.14, v);
  return { cx, cy, z };
}
let CAM = { cx: 0, cy: 0, z: 1 };
const w2s = (x, y) => [EX + (x - CAM.cx) * S0 * CAM.z, EY - (y - CAM.cy) * S0 * CAM.z];

// —— regions ——
const VIEW = { x0: 40, y0: 330, x1: W - 40, y1: 1190 };
const SC = { x0: 80, y0: 1340, x1: 1000, y1: 1580, divX: 10, divY: 4 };   // scope panel
const SC_MIN_PER_DIV = 5;
const scX = min => SC.x0 + (min / (SC_MIN_PER_DIV * SC.divX)) * (SC.x1 - SC.x0);
const scY = s => (SC.y0 + SC.y1) / 2 - s * (SC.y1 - SC.y0) / SC.divY;    // 1 div = 0.5 R → s=1 ⇒ 2 div

// —— text drawn by the beam ——
const TXT = [];                                              // TEXTS(t) records for this frame
const EVT = [];                                              // glyph ticks (collected once)
function beamText(ctx, s, x, y, font, color, t0, dur, t, opt = {}) {
  if (t < t0) return;
  const out = opt.t1 !== undefined ? seg(t, opt.t1, opt.t1 + 0.35) : 0;
  if (out >= 1) return;
  ctx.save(); ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const w = ctx.measureText(s).width; const xx = opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x;
  const p = seg(t, t0, t0 + dur), p1 = seg(p, 0, 0.65), p2 = seg(p, 0.55, 1);
  const outW = w * (1 - out);
  ctx.beginPath(); ctx.rect(xx - 4, y - 200, Math.max(0, w * p1) + 8, 260); ctx.clip();
  if (out > 0) { ctx.beginPath(); ctx.rect(xx - 4, y - 200, outW + 8, 260); ctx.clip(); }
  ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.globalAlpha = 1 - p2 * 0.6; ctx.strokeText(s, xx, y);
  ctx.globalAlpha = p2; ctx.fillStyle = color; ctx.fillText(s, xx, y);
  ctx.restore();
  // white-hot head while writing, flash when done
  const fl = 1 - seg(t, t0 + dur, t0 + dur + 0.35);
  if (p1 < 1) { const hx = xx + w * p1; dot(HC, hx, y - (opt.size || 40) * 0.35, 5, 1); }
  if (fl > 0 && p >= 1 && out === 0) { HC.save(); HC.font = font; HC.globalAlpha = fl * 0.85; HC.fillStyle = C.hot; HC.fillText(s, xx, y); HC.restore(); }
  if (opt.id && out === 0) TXT.push({ id: opt.id, text: s, x0: xx, y0: y - (opt.size || 40), x1: xx + w, y1: y + 10, pass: !!opt.pass });
}
function dot(ctx, x, y, r, a = 1, col = C.hot) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }
function line(ctx, pts, col, w, a = 1, dash) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = a; ctx.lineJoin = ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
}

// —— graticule (world, refined in levels of 5 as zoom grows) ——
function graticule(t, a) {
  if (a <= 0) return;
  T.save(); T.beginPath(); T.rect(VIEW.x0, VIEW.y0, VIEW.x1 - VIEW.x0, VIEW.y1 - VIEW.y0); T.clip();
  const step = 0.2, fine = step / 5, fineA = seg(CAM.z, 1.3, 1.8);
  const [wx0, wy1] = [CAM.cx - (EX - VIEW.x0) / (S0 * CAM.z), CAM.cy + (EY - VIEW.y0) / (S0 * CAM.z)];
  const [wx1, wy0] = [CAM.cx + (VIEW.x1 - EX) / (S0 * CAM.z), CAM.cy - (VIEW.y1 - EY) / (S0 * CAM.z)];
  T.fillStyle = C.text;
  for (let gx = Math.ceil(wx0 / step) * step; gx <= wx1; gx += step) {
    const axis = Math.abs(gx) < 1e-6;
    const [sx] = w2s(gx, 0);
    if (axis) { T.globalAlpha = a * 0.42; T.fillRect(sx - 0.6, VIEW.y0, 1.2, VIEW.y1 - VIEW.y0); }
    else for (let gy = Math.ceil(wy0 / fine) * fine; gy <= wy1; gy += fine) { const [, sy] = w2s(0, gy); T.globalAlpha = a * 0.3; T.fillRect(sx - 1, sy - 1, 2, 2); }
  }
  for (let gy = Math.ceil(wy0 / step) * step; gy <= wy1; gy += step) {
    const axis = Math.abs(gy) < 1e-6; const [, sy] = w2s(0, gy);
    if (axis) { T.globalAlpha = a * 0.42; T.fillRect(VIEW.x0, sy - 0.6, VIEW.x1 - VIEW.x0, 1.2); }
    else for (let gx = Math.ceil(wx0 / fine) * fine; gx <= wx1; gx += fine) { const [sx] = w2s(gx, 0); T.globalAlpha = a * 0.3; T.fillRect(sx - 1, sy - 1, 2, 2); }
  }
  if (fineA > 0) {                                    // finer level fades in
    const f2 = fine / 5;
    T.globalAlpha = a * 0.16 * fineA;
    for (let gx = Math.ceil(wx0 / fine) * fine; gx <= wx1; gx += fine) for (let gy = Math.ceil(wy0 / f2) * f2; gy <= wy1; gy += f2) { const [sx, sy] = w2s(gx, gy); T.fillRect(sx - .6, sy - .6, 1.2, 1.2); }
  }
  // axis ticks every 0.2 div
  T.globalAlpha = a * 0.5;
  const [ax, ay] = w2s(0, 0);
  for (let k = -40; k <= 40; k++) { const d = k * step / 5 * S0 * CAM.z, L = k % 5 ? 5 : 10; T.fillRect(ax + d - .6, ay - L / 2, 1.2, L); T.fillRect(ax - L / 2, ay + d - .6, L, 1.2); }
  T.restore();
}

// —— the Earth, drawn by the beam ——
function earth(t) {
  // power on: dot → line → circle
  if (t < TL.circle0) {
    const p = seg(t, 0.25, TL.circle0); const [cx, cy] = w2s(0, 0);
    if (p <= 0) { dot(HC, cx, cy, 4 + 3 * seg(t, 0, 0.1), 1); return; }
    const half = S0 * CAM.z * ss(p); line(B, [[cx - half, cy], [cx + half, cy]], C.beam, 2.4, 1); line(HC, [[cx - half * .3, cy], [cx + half * .3, cy]], C.hot, 1.2, .8);
    return;
  }
  const p = ss(seg(t, TL.circle0, TL.circle1));
  if (t < TL.circle1) {                               // the line folds up into a circle
    const [cx, cy] = w2s(0, 0), half = S0 * CAM.z * (1 - p);
    if (half > 1) line(B, [[cx - half, cy], [cx + half, cy]], C.beam, 2.4, 1 - p * 0.5);
  }
  const N = 240, a0 = Math.PI / 2, pts = [];
  for (let i = 0; i <= N * p; i++) { const a = a0 - i / N * 2 * Math.PI; pts.push(w2s(Math.cos(a), Math.sin(a))); }
  if (pts.length > 1) line(B, pts, C.beam, 2.6, 1);
  if (p < 1 && pts.length) { const h = pts[pts.length - 1]; dot(HC, h[0], h[1], 5, 1); }
  const fl = 1 - seg(t, TL.circle1, TL.circle1 + 0.4);
  if (fl > 0 && p >= 1) line(HC, pts, C.hot, 1.4, fl * 0.8);
  // inner reference rings (dotted), faint
  if (p >= 1) for (const r of [0.5]) { const q = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * 2 * Math.PI; q.push(w2s(r * Math.cos(a), r * Math.sin(a))); } line(T, q, C.text, 1, 0.18 * seg(t, 1.6, 2.2), [2, 8]); }
}

function tunnel(ctx, P0, P1, t0, t1, t) {
  if (t < t0) return;
  const p = ss(seg(t, t0, t1));
  const a = w2s(...P0), b = w2s(...P1), m = [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
  // two walls
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * 6, ny = dx / L * 6;
  line(T, [[a[0] + nx, a[1] + ny], [m[0] + nx, m[1] + ny]], C.text, 1.2, 0.55);
  line(T, [[a[0] - nx, a[1] - ny], [m[0] - nx, m[1] - ny]], C.text, 1.2, 0.55);
  if (p < 1) dot(HC, m[0], m[1], 5.5, 1);
  else { const fl = 1 - seg(t, t1, t1 + 0.35); if (fl > 0) line(HC, [a, b], C.hot, 1.4, fl * .7); }
}

function ballDraw(posFn, t, tShow, label) {
  if (t < tShow) return;
  const born = seg(t, tShow, tShow + 0.45);
  // afterglow: sub-frame ghosts + short trail (drawn, not accumulated)
  const trail = [];
  for (let k = 0; k <= 24; k++) trail.push(w2s(...posFn(t - k * 0.015)));
  for (let k = 0; k < 24; k++) line(B, [trail[k], trail[k + 1]], C.beam, 3.2, Math.pow(1 - k / 24, 2) * 0.9);
  for (let k = 8; k >= 1; k--) { const [gx, gy] = w2s(...posFn(t - k * 0.006)); dot(B, gx, gy, 6, Math.pow(1 - k / 9, 2.2) * 0.5, C.beam); }
  const [x, y] = w2s(...posFn(t));
  dot(B, x, y, 9 * (0.4 + 0.6 * born), 1, C.beam);
  dot(HC, x, y, 4.5 * (0.4 + 0.6 * born) + 6 * (1 - born), 1);
  if (label) { T.save(); T.font = '600 26px Mono'; T.fillStyle = C.text; T.globalAlpha = 0.85 * born; T.fillText(label, x + 18, y - 14); T.restore(); }
  return [x, y];
}

// gravity arrows on the chord ball: pull to centre and its component along the tunnel
function arrow(ctx, a, b, col, w, al) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 6) return;
  const ux = dx / L, uy = dy / L, h = Math.min(14, L * .4);
  line(ctx, [a, b], col, w, al);
  line(ctx, [[b[0] - ux * h - uy * h * .55, b[1] - uy * h + ux * h * .55], b, [b[0] - ux * h + uy * h * .55, b[1] - uy * h - ux * h * .55]], col, w, al);
}
function forces(t) {
  const a = seg(t, TL.f2a - 0.3, TL.f2a + 0.2) * (1 - seg(t, TL.f2b - 0.4, TL.f2b));
  if (a <= 0) return;
  const p = ball2(t), k = 0.42;                         // |g| ∝ r (uniform Earth)
  const g = [-p[0] * k, -p[1] * k], gu = g[0] * CH.u[0] + g[1] * CH.u[1];
  const tip = [p[0] + g[0], p[1] + g[1]], par = [p[0] + gu * CH.u[0], p[1] + gu * CH.u[1]];
  arrow(T, w2s(...p), w2s(...tip), C.text, 1.4, 0.55 * a);
  arrow(B, w2s(...p), w2s(...par), C.beam, 2.4, 0.95 * a);
}

// —— scope panel ——
function scope(t) {
  const a = seg(t, 1.0, 1.8); if (a <= 0) return;
  const { x0, y0, x1, y1, divX, divY } = SC, dx = (x1 - x0) / divX, dy = (y1 - y0) / divY;
  T.save(); T.fillStyle = C.text;
  for (let i = 0; i <= divX; i++) for (let j = 0; j <= divY * 5; j++) { T.globalAlpha = a * (i === 0 || i === divX ? .45 : .28); T.fillRect(x0 + i * dx - 1, y0 + j * dy / 5 - 1, 2, 2); }
  for (let j = 0; j <= divY; j++) for (let i = 0; i <= divX * 5; i++) { T.globalAlpha = a * .28; T.fillRect(x0 + i * dx / 5 - 1, y0 + j * dy - 1, 2, 2); }
  T.globalAlpha = a * .45; T.fillRect(x0, (y0 + y1) / 2 - .6, x1 - x0, 1.2);
  for (let i = 0; i <= divX * 5; i++) { const L = i % 5 ? 6 : 12; T.fillRect(x0 + i * dx / 5 - .6, (y0 + y1) / 2 - L / 2, 1.2, L); }
  T.globalAlpha = a * .8; T.font = '400 22px Mono';
  T.fillText(`${SC_MIN_PER_DIV}분/div`, x1 - 108, y1 + 34);
  T.fillText('0.5R/div', x0, y1 + 34);
  T.fillText('터널 중점에서의 거리', x0, y0 - 16);
  T.restore();
  TXT.push({ id: 'sc-lab', text: `${SC_MIN_PER_DIV}분/div 0.5R/div 터널 중점에서의 거리`, x0, y0: y0 - 40, x1, y1: y1 + 40 });

  // traces: sampled at screen resolution; steep parts dimmer; older parts fade
  const trace = (sFn, tA, tB, col, chW, chA, label, ly) => {
    if (t < tA) return;
    const now = clamp(t, tA, tB), pts = [];
    const tauNow = HALF * seg(now, tA, tB) / 60;     // minutes
    const pxN = Math.ceil(scX(tauNow) - x0);
    for (let i = 0; i <= pxN; i += 2) { const min = Math.min(tauNow, (i / (x1 - x0)) * SC_MIN_PER_DIV * divX); pts.push([scX(min), scY(sFn(min * 60))]); }
    for (let i = 0; i + 1 < pts.length; i++) {
      const sl = Math.abs(pts[i + 1][1] - pts[i][1]) / Math.max(1e-3, Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
      line(B, [pts[i], pts[i + 1]], col, chW, chA * (1 - 0.42 * sl));
    }
    if (pts.length && t < tB + 0.05) { const h = pts[pts.length - 1]; dot(HC, h[0], h[1], 4.5, 1); }
    if (label) { T.save(); T.font = '600 22px Mono'; T.fillStyle = col; T.globalAlpha = .9; T.fillText(label, x0 + 8, ly); T.restore(); }
  };
  const part2 = t >= TL.stop;
  const clearA = part2 ? 1 - seg(t, TL.stop, TL.stop + 0.3) : 1;   // STOP + new sweep clears the screen
  if (!part2 || clearA > 0) {
    B.save(); B.globalAlpha = clearA;
    trace(sec => Math.cos(OMEGA * sec), TL.fall0, TL.fall1, C.beam, 2.4, 1, null);
    B.restore();
  }
  if (t >= TL.f2a) {
    trace(sec => -Math.cos(OMEGA * sec), TL.f2a, TL.f2b, C.beam, 2.4, 1, 'CH1', y0 + 26);
    trace(sec => -CH.L * Math.cos(OMEGA * sec), TL.f2a, TL.f2b, C.text, 2.0, 0.85, 'CH2', y0 + 52);
    TXT.push({ id: 'sc-ch', text: 'CH1 CH2', x0, y0, x1: x0 + 80, y1: y0 + 60 });
  }
}

// —— amber measurement ——
function cursor(t, tc, labels, id, ly0 = SC.y0 + 30) {
  const a = seg(t, tc, tc + 0.2); if (a <= 0) return;
  const out = t >= TL.stop && tc < TL.stop ? 1 - seg(t, TL.stop, TL.stop + 0.3) : 1; if (out <= 0) return;
  const x = scX(HALF_MIN), gr = a * out;
  A.save(); A.globalAlpha = gr; A.strokeStyle = C.amber; A.lineWidth = 1.6; A.setLineDash([6, 6]);
  A.beginPath(); A.moveTo(x, SC.y0 - 6); A.lineTo(x, SC.y1 + 6); A.moveTo(SC.x0, SC.y0 - 6); A.lineTo(SC.x0, SC.y1 + 6); A.stroke(); A.setLineDash([]);
  const yy = SC.y1 - 22, w = (x - SC.x0) * ss(seg(t, tc, tc + 0.5));
  arrow(A, [SC.x0 + 4, yy], [SC.x0 + Math.max(10, w), yy], C.amber, 1.8, gr);
  A.font = '600 26px Mono'; A.fillStyle = C.amber; A.textAlign = 'right';
  labels.forEach((s, i) => A.fillText(s, x - 12, ly0 + i * 30));
  A.restore();
  TXT.push({ id, text: labels.join(' '), x0: x - 300, y0: ly0 - 30, x1: x, y1: ly0 + labels.length * 30 });
}
function ring(t, tc, P, tEnd) {
  const a = seg(t, tc, tc + 0.15) * (tEnd ? 1 - seg(t, tEnd, tEnd + 0.3) : 1); if (a <= 0) return;
  const [x, y] = w2s(...P), r = 18 + 10 * (1 - ss(seg(t, tc, tc + 0.5)));
  A.save(); A.globalAlpha = a; A.strokeStyle = C.amber; A.lineWidth = 2; A.beginPath(); A.arc(x, y, r, 0, 7); A.stroke(); A.restore();
}

// —— readouts (live, computed from the drawn state) ——
function readouts(t) {
  const a = seg(t, 1.2, 1.6) * (1 - seg(t, TL.verdict - 0.3, TL.verdict)); if (a <= 0) return;
  const rows = [], yb = 1238, xs = [250, 750];
  const sim = simSec(t);
  if (t < TL.stop) {
    const y = ball1(t)[1];
    const v = VMAX * Math.abs(Math.sin(ph1(t)));
    rows.push([0, '시간', mmss(sim)], [0, '속도', `${v.toFixed(2)} km/s`], [1, '중심까지', `${Math.round(Math.abs(y) * R_KM)} km`], [1, '최고속도', `${VMAX.toFixed(2)} km/s`]);
  } else {
    const v1 = VMAX * Math.abs(Math.sin(ph1(t))), v2 = VMAX * CH.L * Math.abs(Math.sin(ph2(t)));
    rows.push([0, '시간', mmss(sim)], [0, 'CH1 속도', `${v1.toFixed(2)} km/s`], [1, 'CH2 길이', `${Math.round(2 * CH.L * R_KM)} km`], [1, 'CH2 속도', `${v2.toFixed(2)} km/s`]);
  }
  T.save(); T.globalAlpha = a * 0.92; T.font = '400 28px Mono'; T.fillStyle = C.text;
  const cnt = [0, 0];
  for (const [c, k, v] of rows) {
    const y = yb + cnt[c]++ * 42, x = xs[c];
    T.textAlign = 'right'; T.fillText(k, x - 18, y); T.textAlign = 'center'; T.fillText('=', x, y); T.textAlign = 'left'; T.fillText(v, x + 18, y);
  }
  T.restore();
  TXT.push({ id: 'readout', text: rows.map(r => r[1] + r[2]).join(' '), x0: 60, y0: yb - 30, x1: W - 60, y1: yb + 60, pass: true });
}

// —— glass HUD: run/stop, formula, title, subtitles ——
function hud(t) {
  const a = seg(t, 1.0, 1.4); if (a <= 0) return;
  const stopped = (t >= TL.stop && t < TL.run);
  T.save(); T.font = '600 24px Mono'; T.textAlign = 'right'; T.globalAlpha = a * .85; T.fillStyle = C.text;
  T.fillText(stopped ? '' : 'RUN', W - 70, 96); T.restore();
  if (stopped) { HC.save(); HC.font = '600 24px Mono'; HC.textAlign = 'right'; HC.fillStyle = C.hot; HC.fillText('STOP', W - 70, 96); HC.restore(); }
  T.save(); T.font = '400 22px Mono'; T.globalAlpha = a * .7; T.fillStyle = C.text;
  T.fillText(`R = ${R_KM} km   g = ${G} m/s²`, 70, 96); T.restore();
  TXT.push({ id: 'hud', text: `R = ${R_KM} km g = ${G} m/s²`, x0: 70, y0: 70, x1: 520, y1: 104 });
}
function title(t) {
  beamText(T, '지구 관통 터널', 70, 196, '600 64px KR', C.text, TL.title, 1.0, t, { id: 'title', size: 64, t1: TL.verdict - 0.4 });
  beamText(T, 'a = −(g/R)·r', 72, 266, 'italic 40px Stix', C.text, 1.9, 0.8, t, { id: 'f1', size: 40, t1: TL.verdict - 0.4 });
  // verdict
  beamText(T, '어디로 뚫어도', 70, 190, '600 60px KR', C.text, TL.verdict, 0.9, t, { id: 'v1', size: 60 });
  beamText(T, '42분', 70, 300, '600 108px KR', C.beam, TL.verdict + 0.7, 0.7, t, { id: 'v2', size: 108 });
  beamText(T, `t = π√(R/g) ≈ ${HALF_MIN.toFixed(1)}분`, 70, 1262, 'italic 46px Stix, KR', C.text, TL.verdict + 0.4, 1.0, t, { id: 'v3', size: 44 });
  beamText(T, '밀도 균일 · 마찰과 공기저항 없음 가정', 96, 1652, '600 26px KR', C.text, TL.verdict + 1.0, 0.6, t, { id: 'v4', size: 26, pass: true });
  beamText(T, '실제 지구를 중심으로 관통하면 약 38분', 96, 1694, '600 26px KR', C.text, TL.verdict + 1.2, 0.6, t, { id: 'v5', size: 26, pass: true });
}
function subtitles(t) {
  for (const s of SUBS) {
    if (t < s.t0 - 0.01 || t > s.t1) continue;
    const a = seg(t, s.t0, s.t0 + 0.12) * (1 - seg(t, s.t1 - 0.12, s.t1));
    const y = 1690;
    X.save(); X.globalAlpha = a * 0.78;
    const g = X.createLinearGradient(0, y - 70, 0, y + 30); g.addColorStop(0, 'rgba(1,4,2,0)'); g.addColorStop(.3, 'rgba(1,4,2,.9)'); g.addColorStop(1, 'rgba(1,4,2,.9)');
    X.fillStyle = g; X.fillRect(40, y - 70, W - 80, 100); X.restore();
    X.save(); X.globalAlpha = a; X.fillStyle = C.text; X.fillRect(70, y - 44, 3, 56); X.font = '600 46px KR'; X.fillText(s.text, 96, y); X.restore();
  }
}

// —— compositing: phosphor glow, vignette, dither ——
const NZ = mk(256, 256); { const c = NZ.getContext('2d'), d = c.createImageData(256, 256), r = mulberry(11); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); }
function composite(t) {
  X.globalCompositeOperation = 'source-over'; X.filter = 'none'; X.globalAlpha = 1;
  X.fillStyle = C.bg; X.fillRect(0, 0, W, H);
  const g = X.createRadialGradient(W / 2, EY, 50, W / 2, EY, 1100); g.addColorStop(0, 'rgba(11,36,18,.85)'); g.addColorStop(1, 'rgba(11,36,18,0)');
  X.fillStyle = g; X.fillRect(0, 0, W, H);
  // bloom: beams strong, text faint
  for (const [cnv, sc, blur, al] of [[SM, 4, 14, 0.9], [SM, 4, 4, 0.8], [MD, 2, 3, 0.7]]) {
    const c = cnv.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, cnv.width, cnv.height);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(LB, 0, 0, cnv.width, cnv.height); c.drawImage(LH, 0, 0, cnv.width, cnv.height); c.drawImage(LA, 0, 0, cnv.width, cnv.height);
    c.globalAlpha = 0.18; c.drawImage(LT, 0, 0, cnv.width, cnv.height); c.globalAlpha = 1;
    X.globalCompositeOperation = 'lighter'; X.globalAlpha = al; X.filter = `blur(${blur}px)`;
    X.drawImage(cnv, 0, 0, W, H); X.filter = 'none';
  }
  X.globalAlpha = 1;
  X.drawImage(LT, 0, 0); X.drawImage(LB, 0, 0); X.drawImage(LA, 0, 0); X.drawImage(LH, 0, 0);
  X.globalCompositeOperation = 'source-over';
  const v = X.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  X.fillStyle = v; X.fillRect(0, 0, W, H);
  // dither
  const fr = Math.round(t * 24), r = mulberry(fr * 7919 + 3);
  X.globalCompositeOperation = 'lighter'; X.globalAlpha = 0.022;
  X.save(); X.translate(-Math.floor(r() * 256), -Math.floor(r() * 256));
  X.fillStyle = X.createPattern(NZ, 'repeat'); X.fillRect(0, 0, W + 256, H + 256); X.restore();
  X.globalAlpha = 1; X.globalCompositeOperation = 'source-over';
}
function powerOff(t) {
  if (t < TL.off) return;
  const p1 = seg(t, TL.off, TL.off + 0.22), p2 = seg(t, TL.off + 0.22, TL.off + 0.4), p3 = seg(t, TL.off + 0.4, DUR - 0.02);
  TMPc.clearRect(0, 0, W, H); TMPc.drawImage(cv, 0, 0);
  X.fillStyle = '#000'; X.fillRect(0, 0, W, H);
  const sy = Math.max(0.004, 1 - ss(p1)), sx = Math.max(0.006, 1 - ss(p2));
  X.save(); X.translate(W / 2, EY); X.scale(sx, sy); X.globalCompositeOperation = 'lighter'; X.globalAlpha = 1 + p1 * 2;
  X.drawImage(TMP, -W / 2, -EY); X.restore();
  if (p1 >= 1) { const g = X.createRadialGradient(W / 2, EY, 0, W / 2, EY, 40); g.addColorStop(0, `rgba(230,255,236,${1 - p3})`); g.addColorStop(1, 'rgba(77,255,136,0)'); X.fillStyle = g; X.fillRect(W / 2 - 60, EY - 60, 120, 120); }
}

// —— frame ——
function render(t) {
  TXT.length = 0;
  for (const c of [B, T, HC, A]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, W, H); }
  CAM = cam(t);
  for (const c of [B, T, HC, A]) { c.save(); c.beginPath(); c.rect(VIEW.x0, VIEW.y0 - 20, VIEW.x1 - VIEW.x0, VIEW.y1 - VIEW.y0 + 20); c.clip(); }
  graticule(t, seg(t, 0.6, 1.4));
  earth(t);
  tunnel(T, [0, 1], [0, -1], TL.tun0, TL.tun1, t);
  tunnel(T, CH.P0, CH.P1, TL.chord0, TL.chord1, t);
  forces(t);
  ballDraw(ball1, t, TL.spawn, t >= TL.f2a ? 'CH1' : null);
  if (t >= TL.chord1 - 0.1) ballDraw(ball2, t, TL.chord1 - 0.1, 'CH2');
  ring(t, TL.fall1, [0, -1], TL.stop);
  ring(t, TL.f2b, [0, 1]); ring(t, TL.f2b + 0.08, CH.P1);
  for (const c of [B, T, HC, A]) c.restore();
  scope(t);
  cursor(t, TL.fall1 + 0.3, [`Δt = ${ARR}`], 'cur1');
  cursor(t, TL.f2b + 0.3, [`CH1 = ${ARR}`, `CH2 = ${ARR}`, 'Δt = 0'], 'cur2', (SC.y0 + SC.y1) / 2 + 28);
  readouts(t); hud(t); title(t);
  composite(t);
  subtitles(t);                    // fixed to the glass, over a dark scrim
  powerOff(t);
}

// —— events for the mixer (same timeline) ——
const EV = [];
EV.push({ t: TL.on, type: 'relay' }, { t: 0.25, type: 'zap_on' }, { t: TL.circle0, type: 'draw', d: TL.circle1 - TL.circle0 });
EV.push({ t: TL.tun0, type: 'draw', d: TL.tun1 - TL.tun0 }, { t: TL.spawn, type: 'spawn' });
EV.push({ t: TL.fall0, type: 'fall', t1: TL.fall1, amp: 1, ch: 1 }, { t: (TL.fall0 + TL.fall1) / 2, type: 'center' }, { t: TL.fall1, type: 'arrive', big: 0 });
EV.push({ t: TL.fall1 + 0.3, type: 'blip' }, { t: TL.stop, type: 'relay' }, { t: TL.stop, type: 'stop' });
EV.push({ t: TL.chord0, type: 'draw', d: TL.chord1 - TL.chord0 }, { t: TL.chord1 - 0.1, type: 'spawn' }, { t: TL.run, type: 'relay' });
EV.push({ t: TL.f2a, type: 'fall', t1: TL.f2b, amp: 1, ch: 1 }, { t: TL.f2a, type: 'fall', t1: TL.f2b, amp: CH.L, ch: 2 }, { t: (TL.f2a + TL.f2b) / 2, type: 'center' });
EV.push({ t: TL.f2b, type: 'arrive', big: 1 }, { t: TL.f2b + 0.3, type: 'blip' }, { t: TL.f2b + 0.5, type: 'blip' });
EV.push({ t: TL.off, type: 'zap_off' });
// glyph ticks for every beam-written text
const glyphs = (t0, dur, s) => { const n = [...s.replace(/\s/g, '')].length; for (let i = 0; i < n; i++) EV.push({ t: +(t0 + dur * 0.65 * i / n).toFixed(3), type: 'tick' }); };
glyphs(TL.title, 1.0, '지구 관통 터널'); glyphs(1.9, 0.8, 'a=−(g/R)·r');
glyphs(TL.verdict, 0.9, '어디로 뚫어도'); glyphs(TL.verdict + 0.7, 0.7, '42분'); glyphs(TL.verdict + 0.4, 1.0, 't=π√(R/g)≈42.2분');
EV.push({ t: 0, type: 'mus', name: 'all', t1: DUR, bpm: 120, stop: TL.stop, run: TL.run, hush0: TL.f2b - 0.6, arrive1: TL.fall1, arrive2: TL.f2b, verdict: TL.verdict, off: TL.off });
EV.push({ t: 0, type: 'phys', half: HALF, vmax: VMAX });
SUBS.forEach(s => EV.push({ t: s.t0, type: 'sub', t1: s.t1, text: s.text }));
EV.sort((a, b) => a.t - b.t);

window.DUR = DUR; window.EV = EV; window.render = render;
window.TEXTS = t => { render(t); return TXT.slice(); };
document.fonts.load('600 46px KR', '가').then(() => Promise.all([document.fonts.load('400 28px Mono'), document.fonts.load('600 28px Mono'), document.fonts.load('italic 40px Stix')]))
  .then(() => document.fonts.ready).then(() => { render(0); window.READY = true; });
})();
