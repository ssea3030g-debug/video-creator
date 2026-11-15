// 「똥 작전」 30초 세로(1080×1920) · midcentury-toon · 120 BPM(1박=0.5s=12프레임)
import {
  PAL, setClock, shape, plane, ink, text, measure, arrow, star, sparkle, rays, ellipse, rect, rrect, spline,
  xform, seg, ss, eo, eio, back, lerp, clamp, twos, TAU, paperFinish, REG, starPts, hash,
} from './engine/toon.js';
import { drawSloth, drawCat, eyesPair, bush, C } from './chars.js';

export const W = 1080, H = 1920, DUR = 30;
const HAN = px => `${px}px Han`, JUA = px => `${px}px Jua`;
const SC = { s1: 0, s2: 5, s3: 10, s4: 15, s5: 21, s6: 26.5 };

// ---------------------------------------------------------------- 텍스트 기록 (readcheck용)
let TX = null;
function note(id, str, x0, y0, x1, y1, pass = false) { if (TX) TX.push({ id, text: str, x0, y0, x1, y1, ...(pass ? { pass: true } : {}) }); }

// ---------------------------------------------------------------- 공용 UI
function header(g, t, t0, n, title) {
  const u = seg(t, t0, t0 + 0.3), k = back(u);
  if (u <= 0) return;
  const tw = twos(t);
  const x = 140, y = 210;
  g.save(); g.translate(lerp(-260, 0, eo(seg(tw, t0, t0 + 0.3))), 0);
  shape(g, ellipse(x, y, 74 * k, 74 * k, 30), { fill: PAL.ink, line: 0, seed: 401 });
  text(g, String(n), x, y + 30, { font: HAN(84), fill: PAL.paper, align: 'center', plate: PAL.coral, seed: 402 });
  text(g, `작전 ${n} / 4`, 240, y - 28, { font: JUA(40), fill: PAL.ink, track: 4 });
  text(g, title, 240, y + 48, { font: HAN(76), fill: PAL.ink, plate: PAL.white, seed: 403 });
  g.restore();
  if (u >= 1) { note(`h${n}a`, `작전 ${n} / 4`, 240, y - 64, 520, y - 20); note(`h${n}b`, title, 240, y - 20, 240 + measure(g, title, HAN(76)), y + 60); }
}

function tag(g, t, t0, t1, str, cx, cy, o = {}) {
  const u = seg(t, t0, t0 + 0.25), out = seg(t, t1 - 0.15, t1);
  if (u <= 0 || out >= 1) return;
  const k = back(u) * (1 - out), px = o.px || 50;
  const w = measure(g, str, JUA(px)) + 110, h = px + 46;
  g.save(); g.translate(cx, cy); g.rotate(o.rot || 0); g.scale(k, k);
  shape(g, rrect(-w / 2, -h / 2, w, h, 20), { fill: o.fill || PAL.white, line: 4, seed: o.seed || 410 });
  sparkle(g, -w / 2 + 40, 0, 22, { fill: PAL.coral, rot: t * 2 });
  text(g, str, 18, px * 0.36, { font: JUA(px), fill: PAL.ink, align: 'center' });
  g.restore();
  if (u >= 1 && out <= 0) note('tag:' + str, str, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, !!o.pass);
}

function caption(g, t, t0, t1, str) {
  const u = seg(t, t0, t0 + 0.2), out = seg(t, t1 - 0.15, t1);
  if (u <= 0 || out >= 1) return;
  const px = 62, w = measure(g, str, HAN(px)) + 150, h = 128, cx = W / 2, cy = 1700 - eo(u) * 16;
  g.save(); g.globalAlpha = (1 - out) * eo(u);
  shape(g, rrect(cx - w / 2, cy - h / 2, w, h, 34), { fill: PAL.paper, line: 4.5, seed: 420 });
  star(g, cx - w / 2 + 44, cy, 20, { n: 4, inner: 0.3, fill: PAL.mustard, rot: t * 1.5 });
  star(g, cx + w / 2 - 44, cy, 20, { n: 4, inner: 0.3, fill: PAL.mustard, rot: -t * 1.5 });
  text(g, str, cx, cy + px * 0.36, { font: HAN(px), fill: PAL.ink, align: 'center', plate: PAL.coralL, seed: 421 });
  g.restore();
  if (u >= 1 && out <= 0) note('cap:' + str, str, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
}

function stampBox(g, t, t0, str, cx, cy, o = {}) {
  const u = seg(t, t0, t0 + 0.18);
  if (u <= 0) return;
  const px = o.px || 96, rot = o.rot ?? -0.18;
  const k = lerp(1.8, 1, eo(u)), w = measure(g, str, HAN(px)) + 70, h = px + 50;
  g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(k, k); g.globalAlpha = u;
  ink(g, rrect(-w / 2, -h / 2, w, h, 16), 9, { closed: true, color: o.color || PAL.coral, breaks: 0.22, seed: 430 });
  text(g, str, 0, px * 0.36, { font: HAN(px), fill: o.color || PAL.coral, align: 'center' });
  g.restore();
  if (u >= 1) note('st:' + str, str, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, !!o.pass);
}

function medallion(g, cx, cy, r, n) {
  shape(g, starPts(cx, cy, r * 1.25, 14, 0.82), { fill: PAL.mustard, line: 4, seed: 440 });
  shape(g, ellipse(cx, cy, r, r, 40), { fill: PAL.ink, line: 0, seed: 441 });
  text(g, String(n), cx, cy + r * 0.4, { font: HAN(r * 1.15), fill: PAL.paper, align: 'center', plate: PAL.coral });
}

// ---------------------------------------------------------------- 장면 1: 훅
function scene1(g, t) {
  plane(g, rect(0, 0, W, H), PAL.tealL);
  rays(g, W / 2, 900, 30, 1400, PAL.white, { alpha: 0.18, rot: twos(t) * 0.05 });
  const push = lerp(1, 1.06, ss(seg(t, 0, 5)));
  g.save(); g.translate(W / 2, 1100); g.scale(push, push); g.translate(-W / 2, -1100);
  // 늘보 바스트
  const blink = t < 1.75 ? 0 : t < 2.15 ? ss(seg(t, 1.75, 2.15)) : t < 2.35 ? 1 : 1 - ss(seg(t, 2.35, 2.75));
  const fold = eo(seg(twos(t), 3.0, 3.5));
  const hand = { x: lerp(140, 118, fold), y: lerp(420, 30, fold) };
  drawSloth(g, { x: W / 2, y: 1360, s: 2.05, blink, armL: { x: -150, y: 120 }, armR: hand, seed: 3 });
  // 서류철
  if (fold > 0) {
    const fx = W / 2 + hand.x * 2.05 + 60, fy = 1360 + hand.y * 2.05 - 40;
    g.save(); g.translate(fx, fy); g.rotate(-0.08);
    shape(g, rrect(-150, -110, 300, 220, 10), { fill: PAL.kraftL, line: 4.5, seed: 450 });
    shape(g, rrect(-150, -134, 120, 34, 8), { fill: PAL.kraftL, line: 4.5, seed: 451 });
    shape(g, rrect(-118, -40, 236, 74, 8), { fill: PAL.white, line: 3.5, seed: 452 });
    text(g, '작전 계획서', 0, 14, { font: HAN(44), fill: PAL.coral, align: 'center' });
    g.restore();
    if (fold >= 1) note('folder', '작전 계획서', fx - 120, fy - 40, fx + 120, fy + 34, true);
  }
  g.restore();
  // 나뭇가지(앞)
  shape(g, spline([[-40, 1640], [400, 1610], [800, 1630], [1120, 1600], [1120, 1760], [-40, 1780]], true, 6), { fill: PAL.brown, line: 4.5, seed: 455 });
  // 훅 자막
  const l1 = '여기, 똥 한 번 싸려고', l2 = '계획을 세우는 동물이 있습니다.';
  const u1 = back(seg(t, 0.2, 0.45)), u2 = back(seg(t, 0.4, 0.65));
  if (u1 > 0) {
    g.save(); g.translate(W / 2, 250); g.scale(u1, u1);
    shape(g, rrect(-500, -86, 1000, 150, 26), { fill: PAL.paper, line: 4.5, seed: 460 });
    text(g, l1, 0, 26, { font: HAN(84), fill: PAL.ink, align: 'center', plate: PAL.coral, maxW: 930 });
    g.restore();
    if (t >= 0.45) note('hook1', l1, 40, 164, 1040, 314);
  }
  if (u2 > 0) {
    g.save(); g.translate(W / 2, 400); g.scale(u2, u2);
    text(g, l2, 0, 20, { font: HAN(64), fill: PAL.ink, align: 'center', plate: PAL.white, maxW: 980 });
    g.restore();
    if (t >= 0.65) note('hook2', l2, 50, 350, 1030, 430);
  }
}

// ---------------------------------------------------------------- 장면 2: 브리핑
function scene2(g, t) {
  plane(g, rect(0, 0, W, H), PAL.blueL);
  plane(g, rect(0, 1480, W, 440), PAL.blue);
  const lt = t - SC.s2;
  const push = lerp(1, 1.04, ss(seg(lt, 0, 5)));
  g.save(); g.translate(W / 2, 1000); g.scale(push, push); g.translate(-W / 2, -1000);
  // 이젤 + 칠판
  for (const lx of [380, 940]) shape(g, [[lx - 14, 1200], [lx + 14, 1200], [lx + 30, 1560], [lx + 2, 1560]], { fill: PAL.brownL, line: 4, seed: 470 + lx });
  shape(g, rrect(290, 520, 740, 720, 18), { fill: PAL.kraft, line: 4.5, seed: 472 });
  shape(g, rrect(320, 550, 680, 660, 10), { fill: PAL.tealDD, line: 3.5, seed: 473 });
  REG.on = false;
  const chalk = { color: PAL.white, breaks: 0.15, taper: true };
  ink(g, [[470, 1150], [470, 700]], 9, { ...chalk, seed: 474 });
  ink(g, [[500, 1150], [500, 700]], 9, { ...chalk, seed: 475 });
  ink(g, ellipse(485, 660, 120, 70, 30), 7, { ...chalk, closed: true, seed: 476 });
  ink(g, ellipse(560, 680, 26, 26, 20), 6, { ...chalk, closed: true, seed: 477 });
  ink(g, [[360, 1160], [960, 1160]], 8, { ...chalk, seed: 478 });
  ink(g, spline([[740, 1160], [770, 1080], [840, 1060], [910, 1090], [930, 1160]], false, 8), 7, { ...chalk, seed: 479 });
  for (const ex of [810, 870]) ink(g, ellipse(ex, 1115, 12, 8, 12), 5, { ...chalk, closed: true, seed: ex });
  // X
  ink(g, [[505, 1125], [565, 1185]], 10, { color: PAL.coralL, seed: 480 }); ink(g, [[565, 1125], [505, 1185]], 10, { color: PAL.coralL, seed: 481 });
  REG.on = true;
  arrow(g, [600, 700], [560, 1100], { u: eio(seg(lt, 1.0, 2.5)), bend: -0.28, fill: PAL.coral, color: PAL.white, w: 8, head: 40, bob: (lt * 2) % 1 });
  // 늘보 + 지시봉 (늘보 속도: 2.5초 동안 몇 cm)
  const p = ss(seg(lt, 2.0, 4.6));
  const tip = [lerp(420, 455, p), lerp(840, 880, p)];
  const hand = { x: 150, y: -40 };
  const sx = 230, sy = 1420, s = 1.35;
  const hw = [sx + hand.x * s, sy + hand.y * s];
  ink(g, [hw, tip], 12, { color: PAL.ink, taper: false, seed: 482 }); ink(g, [hw, tip], 7, { color: PAL.brownL, taper: false, seed: 483 });
  drawSloth(g, { x: sx, y: sy, s, face: 'flat', armR: hand, armL: { x: -140, y: 100 }, look: 1, blink: lt > 3.4 && lt < 3.7 ? 1 : 0, seed: 5 });
  stampBox(g, lt, 3.0, '금지!', 840, 1040, { px: 84, rot: -0.22 });
  g.restore();
  header(g, lt, 0.4, 1, '브리핑');
  tag(g, lt, 1.0, 5.2, 'D-7 · 작전명: 하강', 640, 1380, { px: 50 });
}

// ---------------------------------------------------------------- 장면 3: 장비 · 유언
function scene3(g, t) {
  const lt = t - SC.s3;
  plane(g, rect(0, 0, W, H), PAL.mustardL);
  plane(g, rect(0, 1520, W, 400), PAL.mustard);
  for (let i = 0; i < 6; i++) sparkle(g, 120 + i * 170, 520 + (i % 2) * 90, 18, { fill: PAL.white, rot: twos(t) * 0.6 + i });
  const sx = 360, sy = 1340, s = 1.3;
  const tpHand = lt > 1.1 ? { x: -150, y: -20 } : { x: -140, y: 100 };
  const noteU = eo(seg(twos(lt), 1.7, 2.1));
  const handR = lt < 1.0 ? { x: lerp(150, 40, eo(seg(lt, 0.3, 0.9))), y: lerp(60, -110, eo(seg(lt, 0.3, 0.9))) } : { x: lerp(40, 190, noteU), y: lerp(-110, -10, noteU) };
  drawSloth(g, { x: sx, y: sy, s, face: lt > 1.0 && lt < 1.3 ? 'proud' : 'flat', armL: tpHand, armR: handR, seed: 7 });
  // 휴지 1칸
  if (lt > 1.1) {
    const hx = sx + tpHand.x * s, hy = sy + tpHand.y * s - 40;
    shape(g, rrect(hx - 34, hy - 34, 68, 68, 4), { fill: PAL.white, line: 3.5, seed: 490 });
    for (let i = 1; i < 4; i++) ink(g, [[hx - 34 + i * 17, hy - 30], [hx - 34 + i * 17, hy + 30]], 2, { color: PAL.paperDD, seed: 491 + i });
  }
  // 아기 늘보 (아주 느리게 손 흔들기)
  const wave = Math.sin(seg(lt, 1.8, 5) * Math.PI * 1.2);
  drawSloth(g, { x: 860, y: 1500, s: 0.55, helmet: false, face: 'wow', armR: { x: 120 + wave * 40, y: -280 + wave * 30 }, armL: { x: -150, y: 80 }, seed: 9 });
  // 쪽지
  if (noteU > 0) {
    const nx = 760, ny = 1130;
    g.save(); g.translate(nx, ny); g.rotate(0.06); g.scale(noteU, noteU);
    shape(g, rrect(-250, -70, 500, 140, 8), { fill: PAL.white, line: 4, seed: 495 });
    text(g, '혹시 못 돌아오면…', 0, 16, { font: JUA(50), fill: PAL.ink, align: 'center' });
    g.restore();
    if (noteU >= 1) note('note', '혹시 못 돌아오면…', nx - 250, ny - 70, nx + 250, ny + 70);
  }
  // 콜아웃: 헬멧 끈 딸깍
  const co = seg(lt, 0.3, 0.55) * (1 - seg(lt, 1.45, 1.65));
  if (co > 0) {
    const cx = 790, cy = 640, r = 220 * back(co);
    ink(g, [[cx - 150, cy + 150], [sx + 10, sy - 210 * s]], 5, { seed: 497 });
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
    plane(g, rect(cx - r, cy - r, 2 * r, 2 * r), PAL.white);
    shape(g, ellipse(cx - 40, cy - 120, 260, 120, 30), { fill: C.helmet, line: 5, seed: 498 });
    ink(g, [[cx - 200, cy - 40], [cx - 30, cy + 40]], 16, { seed: 499 });
    const click = lt > 0.95;
    shape(g, rrect(cx - 40 + (click ? 0 : 40), cy + 10, 90, 64, 10), { fill: PAL.mustard, line: 5, seed: 500 });
    shape(g, rrect(cx + 40, cy + 18, 80, 48, 8), { fill: PAL.mustardD, line: 5, seed: 501 });
    if (click && lt < 1.3) star(g, cx + 60, cy - 10, 70, { n: 10, inner: 0.45, fill: PAL.white, line: 4 });
    if (click && lt < 1.3) text(g, '딸깍', cx + 60, cy + 4, { font: HAN(40), fill: PAL.coral, align: 'center' });
    g.restore();
    ink(g, ellipse(cx, cy, r, r, 60), 6, { closed: true, breaks: 0.12, seed: 502 });
    if (click && lt < 1.3) note('click', '딸깍', cx, cy - 30, cx + 120, cy + 20, true);
  }
  header(g, lt, 0.2, 2, '장비 · 유언');
  tag(g, lt, 1.2, 5.0, '휴지 1칸', 250, 900, { px: 50, rot: -0.05 });
}

// ---------------------------------------------------------------- 장면 4: 하강 (세로 틸트)
const SKY = [[15.0, PAL.blueL], [16.0, PAL.coralL], [17.0, PAL.plum], [18.0, PAL.pink], [19.0, PAL.blueL]];
function scene4(g, t) {
  const lt = t - SC.s4;
  let sky = SKY[0][1], phase = 0; for (let i = 0; i < SKY.length; i++) if (t >= SKY[i][0]) { sky = SKY[i][1]; phase = i; }
  const night = phase === 2;
  plane(g, rect(0, 0, W, H), sky);
  if (phase === 1 || phase === 3) shape(g, ellipse(860, 520, 120, 120, 30), { fill: PAL.mustardL, line: 0, seed: 510 });
  if (night) { shape(g, ellipse(860, 480, 90, 90, 30), { fill: PAL.paper, line: 0, seed: 511 }); for (let i = 0; i < 9; i++) sparkle(g, 80 + hash(i, 1) * 920, 300 + hash(i, 2) * 900, 14, { fill: PAL.paper }); }
  // 카메라: 20.0~20.75 빠르게 땅까지 틸트
  const tilt = eio(seg(t, 20.0, 20.75));
  const camY = tilt * 2600;
  const slothY = t < 20.0 ? 760 + phase * 26 : lerp(760 + 4 * 26, 3240, tilt);
  g.save(); g.translate(0, -camY);
  shape(g, rect(410, -200, 260, 4200), { fill: PAL.brown, line: 4.5, seed: 512, shade: [{ pts: rect(580, -200, 90, 4200), color: PAL.ink, alpha: 0.18 }] });
  for (let i = 0; i < 8; i++) ink(g, spline([[450, i * 480 + 100], [520, i * 480 + 130], [610, i * 480 + 90]], false, 6), 4, { color: PAL.ink, alpha: 0.5, seed: 513 + i });
  plane(g, rect(0, 3420, W, 900), PAL.avocado);
  bush(g, 860, 3420, 1.1);
  if (tilt > 0.6) eyesPair(g, 860, 3330, 1.3, 0, 1);
  drawSloth(g, { x: 540, y: slothY, s: 1.4, face: tilt > 0 ? 'wow' : 'flat', armL: { x: -60, y: -300 }, armR: { x: 60, y: -300 }, seed: 11 });
  g.restore();
  if (tilt > 0 && tilt < 1) for (let i = 0; i < 7; i++) ink(g, [[120 + i * 140, 200 + hash(i, 5) * 600], [120 + i * 140, 700 + hash(i, 6) * 900]], 5, { color: PAL.white, alpha: 0.6, seed: 520 + i });
  if (t >= 20.0) return;
  // 콜아웃: 덤불 속 눈 1 → 3 → 7
  const co = back(seg(lt, 0.4, 0.7));
  if (co > 0) {
    const cx = 260, cy = 1380, r = 200 * co;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
    plane(g, rect(cx - r, cy - r, 2 * r, 2 * r), PAL.tealDD);
    bush(g, cx, cy + 120, 1.0, PAL.avocadoD, 95);
    const n = t < 17.0 ? 1 : t < 18.5 ? 3 : 7;
    const spots = [[0, 40], [-90, 70], [90, 60], [-50, -10], [60, -20], [-110, 130], [120, 120]];
    for (let i = 0; i < n; i++) eyesPair(g, cx + spots[i][0], cy + spots[i][1], 0.9, i === 3 && t > 19.0 ? 0.6 : 0, i);
    g.restore();
    ink(g, ellipse(cx, cy, r, r, 60), 6, { closed: true, breaks: 0.12, seed: 525 });
    text(g, '↓ 땅', cx, cy + r + 56, { font: HAN(44), fill: PAL.ink, align: 'center' });
    if (t > 19.0) text(g, 'Zz', cx + 150, cy - 140, { font: HAN(48), fill: PAL.paper, align: 'center' });
    if (co >= 1) note('ground', '↓ 땅', cx - 60, cy + r + 10, cx + 60, cy + r + 66, true);
  }
  header(g, lt, 0.2, 3, '하강');
  tag(g, lt, 0.5, 5.0, '남은 거리 10m · 예상 소요: 하루', W / 2, 1740, { px: 44 });
}

// ---------------------------------------------------------------- 장면 5: 임무
function scene5(g, t) {
  const lt = t - SC.s5;
  plane(g, rect(0, 0, W, H), PAL.avocadoL);
  plane(g, rect(0, 1420, W, 500), PAL.avocado);
  shape(g, rect(150, -100, 220, 1560), { fill: PAL.brown, line: 4.5, seed: 530 });
  const catIn = seg(lt, 3.0, 3.25);
  bush(g, 820, 1440, 1.15, PAL.avocadoD, 96);
  if (catIn <= 0) eyesPair(g, 820, 1350, 1.2, 0, 3);
  // 늘보: 나무 아래. 24.0부터 아주 느리게 오르기
  const climb = ss(seg(lt, 3.0, 5.5)) * 40;
  drawSloth(g, { x: 300, y: 1320 - climb, s: 1.1, face: lt > 3.0 && lt < 3.6 ? 'wow' : 'flat', armL: { x: -110, y: -300 }, armR: { x: 0, y: -310 }, look: 1, seed: 13 });
  // 맹수
  if (catIn > 0) {
    const walk = seg(lt, 4.5, 5.5);
    const yawn = ss(seg(lt, 3.3, 3.7)) * (1 - ss(seg(lt, 4.6, 4.9)));
    const k = back(catIn);
    rays(g, 780, 1230, 24, 520 * k * (1 - seg(lt, 3.3, 3.8)), PAL.white, { alpha: 0.5 });
    drawCat(g, { x: 860 + walk * 420, y: 1330, s: 1.1 * k, mouth: yawn, sleepy: lt > 4.0 ? 0.5 : 0, dir: walk > 0 ? -1 : 1, step: walk * 4, seed: 70 });
    // 하품 말풍선
    const bu = back(seg(lt, 3.3, 3.5)) * (1 - seg(lt, 5.45, 5.5));
    if (bu > 0) {
      const bx = 700 + walk * 300, by = 960;
      g.save(); g.translate(bx, by); g.scale(bu, bu);
      shape(g, [...ellipse(0, 0, 150, 90, 30)], { fill: PAL.white, line: 4.5, seed: 540 });
      shape(g, [[-20, 80], [20, 82], [-50, 150]], { fill: PAL.white, line: 0, seed: 541 });
      text(g, '하암', 0, 24, { font: HAN(70), fill: PAL.ink, align: 'center' });
      g.restore();
      if (bu >= 1) note('yawn', '하암', bx - 150, by - 90, bx + 150, by + 90);
    }
  }
  // 잎 가림막
  const leaf = eio(seg(lt, 0.5, 0.8)) * (1 - eio(seg(lt, 2.25, 2.55)));
  if (leaf > 0) {
    const lx = lerp(-500, 300, leaf);
    g.save(); g.translate(lx, 1200); g.rotate(-0.1);
    const lp = spline([[0, -430], [260, -200], [250, 220], [0, 430], [-250, 220], [-260, -200]], true, 8);
    shape(g, lp, { fill: PAL.avocadoD, line: 5, seed: 545 });
    ink(g, [[0, -400], [0, 400]], 7, { color: PAL.tealDD, seed: 546 });
    shape(g, rrect(-130, -60, 260, 110, 10), { fill: PAL.white, line: 4, seed: 547 });
    text(g, '작업 중', 0, 22, { font: HAN(64), fill: PAL.coral, align: 'center' });
    g.restore();
    if (leaf >= 1) note('leaf', '작업 중', lx - 130, 1140, lx + 130, 1250, true);
  }
  // 뽕
  const pp = seg(lt, 1.5, 1.6) * (1 - seg(lt, 2.1, 2.25));
  if (pp > 0) {
    star(g, 330, 720, 110 * back(seg(lt, 1.5, 1.7)), { n: 9, inner: 0.5, fill: PAL.mustardL, line: 4 });
    text(g, '뽕', 330, 750, { font: HAN(90), fill: PAL.ink, align: 'center' });
    note('pop', '뽕', 250, 640, 410, 780, true);
  }
  header(g, lt, 0.0, 4, '임무');
  stampBox(g, lt, 2.5, '임무 완수', W / 2, 560, { px: 104, rot: -0.12 });
}

// ---------------------------------------------------------------- 장면 6: 달력 반전
const CAL = { x: 130, y: 640, w: 820, h: 620 };
function cell(r, c) { const cw = (CAL.w - 180) / 7, ch = 170; return { x: CAL.x + 160 + c * cw, y: CAL.y + 170 + r * (ch + 30), w: cw - 8, h: ch }; }
function scene6(g, t) {
  const lt = t - SC.s6;
  plane(g, rect(0, 0, W, H), PAL.blueL);
  rays(g, W / 2, 900, 28, 1500, PAL.white, { alpha: 0.14, rot: twos(t) * 0.04 });
  const target = cell(1, 0), tcx = target.x + target.w / 2, tcy = target.y + target.h / 2;
  const pb = eio(seg(lt, 0.5, 1.1));
  const z = lerp(3.0, 1, pb), fx = lerp(tcx, W / 2, pb), fy = lerp(tcy, 960, pb);
  g.save(); g.translate(W / 2, 960); g.scale(z, z); g.translate(-fx, -fy);
  // 가지와 끈
  shape(g, spline([[-60, 440], [500, 420], [1140, 450], [1140, 520], [-60, 520]], true, 6), { fill: PAL.brown, line: 4.5, seed: 560 });
  ink(g, [[CAL.x + 140, CAL.y], [W / 2, 480], [CAL.x + CAL.w - 140, CAL.y]], 5, { seed: 561 });
  shape(g, rrect(CAL.x, CAL.y, CAL.w, CAL.h, 14), { fill: PAL.paper, line: 5, seed: 562 });
  const days = '월화수목금토일';
  for (let c = 0; c < 7; c++) { const k = cell(0, c); text(g, days[c], k.x + k.w / 2, CAL.y + 130, { font: JUA(40), fill: PAL.inkSoft, align: 'center' }); }
  for (let r = 0; r < 2; r++) {
    text(g, r ? '다음 주' : '이번 주', CAL.x + 80, cell(r, 0).y + 100, { font: HAN(40), fill: r ? PAL.coral : PAL.ink, align: 'center' });
    for (let c = 0; c < 7; c++) { const k = cell(r, c); shape(g, rect(k.x, k.y, k.w, k.h), { fill: PAL.white, line: 3, seed: 563 + r * 7 + c, breaks: 0.1 }); }
  }
  // 이번 주 월요일: 이미 동그라미(지난 작전)
  const c0 = cell(0, 0);
  ink(g, ellipse(c0.x + c0.w / 2, c0.y + c0.h / 2, 34, 34, 30), 6, { closed: true, color: PAL.coral, seed: 580 });
  const c1 = cell(1, 0);
  ink(g, ellipse(c1.x + c1.w / 2, c1.y + c1.h / 2, 34, 34, 30), 6, { closed: true, color: PAL.coral, seed: 581 });
  // X 긋기
  const xu = seg(lt, 0.05, 0.45);
  ink(g, [[c1.x + 14, c1.y + 30], [c1.x + c1.w - 14, c1.y + c1.h - 30]], 12, { upto: clamp(xu * 2), seed: 582 });
  ink(g, [[c1.x + c1.w - 14, c1.y + 30], [c1.x + 14, c1.y + c1.h - 30]], 12, { upto: clamp(xu * 2 - 1), seed: 583 });
  g.restore();
  if (pb >= 1) {
    note('cal1', '이번 주', CAL.x + 20, cell(0, 0).y + 60, CAL.x + 140, cell(0, 0).y + 110);
    note('cal2', '다음 주', CAL.x + 20, cell(1, 0).y + 60, CAL.x + 140, cell(1, 0).y + 110);
    note('days', days, CAL.x + 160, CAL.y + 90, CAL.x + CAL.w, CAL.y + 140, true);
  }
  // 늘보: 처음엔 손만, 풀백 후 전신
  if (pb > 0.4) {
    const grab = eo(seg(twos(lt), 2.5, 3.0));
    drawSloth(g, { x: 800, y: 1560, s: 1.05, face: lt < 2.3 ? 'wow' : 'flat', armL: { x: -170, y: -260 + grab * 40 }, armR: { x: 150, y: lerp(60, -200, grab) }, look: -1, seed: 15 });
    if (grab > 0) { const hx = 800 + 150 * 1.05, hy = 1560 + lerp(60, -200, grab) * 1.05; ink(g, [[hx, hy], [hx - 60, hy - 260]], 12, { taper: false, seed: 590 }); ink(g, [[hx, hy], [hx - 60, hy - 260]], 7, { color: PAL.brownL, taper: false, seed: 591 }); }
    if (lt > 3.1) for (let i = 0; i < 3; i++) sparkle(g, 700 + i * 90, 1150 - (i % 2) * 40, 26 * back(seg(lt, 3.1 + i * 0.08, 3.3 + i * 0.08)), { fill: PAL.white });
  }
  tag(g, lt, 0.5, 4.0, '작전의 날', 330, 1380, { px: 46, rot: 0.06, fill: PAL.mustardL });
  stampBox(g, lt, 1.2, '※ 실화', 860, 430, { px: 66, rot: 0.12, color: PAL.ink });
  caption(g, t, 26.85, 30.2, '다음 작전: 오늘');
}

// ---------------------------------------------------------------- 전환
function clipCircle(g, cx, cy, r) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip(); }
export function renderFilm(g, t) {
  setClock(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H);
  if (t < SC.s2) scene1(g, t);
  else if (t < SC.s3) scene2(g, t);
  else if (t < SC.s4) scene3(g, t);
  else if (t < SC.s5) scene4(g, t);
  else if (t < SC.s6) scene5(g, t);
  else scene6(g, t);
  // 1→2: 메달리온 스탬프 후 아이리스
  if (t >= 4.5 && t < 5.25) {
    const k = back(seg(t, 4.5, 4.62));
    if (t >= 4.75) { g.save(); clipCircle(g, W / 2, 1000, eio(seg(t, 4.75, 5.25)) * 1300); scene2(g, Math.max(t, 5.0)); g.restore(); }
    if (t < 5.0) medallion(g, W / 2, 1000, 110 * k * (1 + seg(t, 4.75, 5.0) * 3), 1);
  }
  // 2→3, 3→4: 아래에서 위로 색면 와이프
  for (const [t0, col, next] of [[9.75, PAL.mustard, scene3], [14.75, PAL.blue, scene4]]) {
    if (t >= t0 && t < t0 + 0.5) {
      const u = eio(seg(t, t0, t0 + 0.5)), y = H * (1 - u);
      if (t >= t0 + 0.25) { g.save(); g.beginPath(); g.rect(0, y, W, H - y); g.clip(); next(g, Math.max(t, t0 + 0.25)); g.restore(); }
      plane(g, rect(0, y - 60, W, 60), col);
    }
  }
  // 5→6: 위로 올라가는 와이프(위에서 아래로)
  if (t >= 26.25 && t < 26.75) {
    const u = eio(seg(t, 26.25, 26.75)), y = H * u;
    if (t < 26.5) { g.save(); g.beginPath(); g.rect(0, 0, W, y); g.clip(); scene6(g, 26.5); g.restore(); }
    plane(g, rect(0, y, W, 60), PAL.blue);
  }
  if (t >= 12.6 && t < 15.4) caption(g, t, 12.6, 15.4, '※ 매주 합니다.');
  paperFinish(g, W, H, 0.9);
}

export function texts(g, t) { TX = []; renderFilm(g, t); const r = TX; TX = null; return r; }

// ---------------------------------------------------------------- 사운드 이벤트
export function events() {
  const E = [
    ['room', 0], ['pop', 0.25], ['pop', 0.5], ['creak', 1.75], ['creak', 2.4], ['paper', 3.0],
    ['stamp', 4.5], ['iris', 4.75], ['swish', 5.4], ['pop', 6.0], ['chalk', 6.0, 1.5], ['creak', 7.0], ['stamp', 8.0],
    ['wipe', 9.75], ['swish', 10.2], ['click', 10.95], ['pop', 11.2], ['paper', 11.7], ['pop', 12.6],
    ['wipe', 14.75], ['swish', 15.2], ['pop', 15.5], ['jump', 16.0], ['jump', 17.0], ['jump', 18.0], ['jump', 19.0], ['snore', 19.0],
    ['fall', 20.0], ['thump', 20.75], ['silence', 21.0, 0.5], ['leaf', 21.5], ['plop', 22.5], ['leaf', 23.25], ['stamp', 23.5],
    ['cat', 24.0], ['yawn', 24.3], ['steps', 25.5, 1.0], ['wipe', 26.25], ['chalk', 26.55, 0.4], ['whistle', 27.0], ['reveal', 27.0],
    ['stamp', 27.7], ['tap', 29.0], ['ding', 29.6],
  ];
  return E.map(([type, t, d]) => ({ type, t, ...(d ? { d } : {}) }));
}
export function srtCues() {
  return [
    { t0: 0.2, t1: 5.0, text: '여기, 똥 한 번 싸려고\n계획을 세우는 동물이 있습니다.' },
    { t0: 5.4, t1: 10.0, text: '작전 1/4 브리핑 — D-7 · 작전명: 하강' },
    { t0: 10.2, t1: 12.5, text: '작전 2/4 장비 · 유언 — 휴지 1칸' },
    { t0: 12.6, t1: 15.0, text: '혹시 못 돌아오면… / ※ 매주 합니다.' },
    { t0: 15.2, t1: 21.0, text: '작전 3/4 하강 — 남은 거리 10m · 예상 소요: 하루' },
    { t0: 21.0, t1: 24.4, text: '작전 4/4 임무 — 작업 중… 뽕. 임무 완수' },
    { t0: 24.5, t1: 26.4, text: '(맹수) 하암' },
    { t0: 27.0, t1: 30.0, text: '다음 작전: 오늘 (※ 실화)' },
  ];
}
