// main.js — director for "Dry Gulch": shots, transitions, palette timing, sound events (EV), subtitles (SUBS), on-screen texts (TEXTS)
import { W, H, FB, C, T, LUT, makeOut, mosaic, darken, whiten, bayer, clamp, ss, eio, eo } from './px.js';
import { text, textW, textOutlined } from './font.js';
import { dialog, battleMsg, commandWin, statusWin, win } from './ui.js';
import { KID, BLACKHAT, drawCowboy, portraitOf, eyesCU, GUNS } from './cowboy.js';
import { sky, mesas, town, foreground, tumbleweed, dust, titleCard, FLOOR, HORIZON } from './scenes.js';

const q = new URLSearchParams(location.search);
const fb = new FB(), out = makeOut(document.getElementById('c'));
const bufA = new Uint32Array(W * H);
const DUR = 47.5;

// ———————————————— Timeline ————————————————
const S = {
  title: [0, 4.5], street: [4.5, 12.6], swirl: [12.6, 13.4], battle: [13.4, 26.8], stand: [26.8, 30.4], draw: [30.4, 40.5], sunset: [40.5, DUR],
};
const MSG = {
  street: { t0: 5.4, t1: 9.0, text: 'MAIN STREET · 11:59 AM' },
  blocks: { t0: 13.7, t1: 17.4, text: 'BLACK HAT blocks the road!' },
  crit: { t0: 31.0, t1: 33.8, text: 'CRITICAL HIT!' },
  ran: { t0: 33.9, t1: 37.0, text: 'BLACK HAT ran away!' },
  learn: { t0: 37.1, t1: 40.5, text: 'KID learned QUICK DRAW!' },
};
const DLG = {
  kid: { t0: 18.3, t1: 21.9, text: 'Nobody has to die today.', who: KID, expr: 'worry', name: 'KID' },
  bh: { t0: 22.0, t1: 24.95, text: 'Then draw, kid.', who: BLACKHAT, expr: 'smirk', name: 'BLACK HAT' },
};
const END = { t0: 43.5, t1: 46.9, text: 'THE END' };

// ———————————————— Events (sound) and subtitles ————————————————
const EV = [], SUBS = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(3), type, ...o });
function typing(t0, s, cps, type, every = 2) { let k = 0; for (let i = 0; i < s.length; i++) { if (s[i] === ' ') continue; if (k++ % every === 0) ev(t0 + i / cps, type, { ch: i }); } }
ev(0, 'mus', { name: 'title', t1: 4.3 }); ev(4.6, 'mus', { name: 'street', t1: 11.4 }); ev(13.6, 'mus', { name: 'battle', t1: 26.6 });
ev(37.1, 'mus', { name: 'fanfare', t1: 38.9 }); ev(40.6, 'mus', { name: 'sunset', t1: 47.2 });
ev(0, 'bed', { name: 'wind', t1: 29.8, gain: .5 }); ev(30.4, 'bed', { name: 'wind', t1: 47.3, gain: .45 });
// title
ev(0.15, 'shot', { big: 1 }); ev(0.55, 'shot', { big: 0, pan: .3 }); ev(0.6, 'ricochet'); ev(3.9, 'select'); ev(4.1, 'mosaic', { up: 1 });
// street
ev(4.5, 'mosaic', { up: 0 });
for (let s = 4.8; s < 10.8; s += .25) ev(s, 'step', { v: .7 });
ev(5.35, 'openUI'); typing(5.4, MSG.street.text, 45, 'blipUI');
ev(7.0, 'tumble', { t1: 9.6 });
ev(11.4, 'door'); for (let s = 11.6; s < 12.4; s += .25) ev(s, 'bootstep');
ev(12.6, 'swirl', { t1: 13.4 });
// battle
ev(13.6, 'slide'); ev(13.7, 'openUI'); typing(13.7, MSG.blocks.text, 45, 'blipUI');
ev(17.6, 'cursor'); ev(18.2, 'select'); ev(18.25, 'open'); typing(18.3, DLG.kid.text, 38, 'blipK');
ev(21.95, 'open'); typing(22.0, DLG.bh.text, 30, 'blipB');
ev(24.95, 'slide'); ev(25.4, 'cursor'); ev(26.6, 'select'); ev(26.7, 'mosaic', { up: 1 });
// stand-off: heartbeats, two bells of noon, true silence before the shot
for (const s of [27.0, 27.65, 28.85, 29.35]) ev(s, 'heart');
ev(27.3, 'bell'); ev(28.5, 'bell');
ev(29.8, 'silence', { t1: 30.4 });
// draw
ev(30.4, 'shot', { big: 1 }); ev(30.42, 'ricochet', { pan: .5 }); ev(31.5, 'clatter', { pan: .6 }); ev(31.8, 'clatter', { pan: .6, v: .5 });
ev(31.0, 'openUI'); typing(31.0, MSG.crit.text, 45, 'blipUI'); ev(31.0, 'crit');
ev(33.0, 'spin'); ev(33.9, 'openUI'); typing(33.9, MSG.ran.text, 45, 'blipUI');
for (let s = 34.0; s < 35.3; s += .125) ev(s, 'runstep', { pan: .5 + (s - 34) * .4 });
ev(37.1, 'openUI'); typing(37.1, MSG.learn.text, 45, 'blipUI'); ev(37.1, 'sparkle');
ev(40.3, 'mosaic', { up: 1 }); ev(40.6, 'mosaic', { up: 0 });
for (let s = 41.0; s < 46.5; s += .375) ev(s, 'step', { v: .55 * (1 - (s - 41) / 6), pan: (s - 41) / 6 });
[41.9, 43.3].forEach((s, i) => ev(s, 'bitdrop', { k: i }));
window.EV = EV;
for (const m of Object.values(MSG)) SUBS.push({ t0: m.t0, t1: m.t1, text: m.text });
for (const d of Object.values(DLG)) SUBS.push({ t0: d.t0, t1: d.t1, text: d.name + ': ' + d.text });
window.SUBS = SUBS;

// ———————————————— Shots ————————————————
const inB = (b, t) => t >= b.t0 && t < b.t1;
const kidWX = t => t < 4.8 ? 20 : t < 10.8 ? 20 + 26 * (t - 4.8) : 176;
const streetCam = t => clamp(kidWX(t) - 96, 0, 80);
const BATTLE_CAM = 80, KID_X = 92, BH_X = 232, FY = 128, K = 2;

function shotTitle(t) {
  const holes = []; if (t >= .15) holes.push([118, 72]); if (t >= .55) holes.push([205, 80]);
  if (t < .15) { fb.clear(C.ink); return; }
  titleCard(fb, t, holes);
  // the title text exists for the reading check
}
function shotStreet(t) {
  const cam = streetCam(t);
  sky(fb, { x: 236 - Math.round(cam * .05), y: 20, r: 9 });
  mesas(fb, cam); town(fb, cam, 59);
  // Black Hat steps out of the hotel door
  if (t >= 11.4) {
    const u = clamp((t - 11.5) / 0.9, 0, 1), wx = 297 + 7 * u, walking = t < 12.4;
    drawCowboy(fb, BLACKHAT, wx - cam, FLOOR, walking ? { walk: Math.floor(t * 8) % 4 } : { arm: 'side' }, t < 12.2 ? 1 : -1);
  }
  const kx = kidWX(t) - cam, walking = t >= 4.8 && t < 10.8;
  drawCowboy(fb, KID, kx, FLOOR, walking ? { walk: Math.floor(t * 8) % 4, wind: (Math.floor(t * 4) % 2) } : { wind: Math.floor(t * 4) % 2 });
  if (t >= 7.0 && t < 9.6) { const u = (t - 7.0) / 2.6, x = 340 - u * 380, y = FLOOR - 6 - Math.abs(Math.sin(u * 9)) * 7; tumbleweed(fb, x, y, 8); }
  foreground(fb, cam);
  if (t >= 11.4 && t < 12.6 && Math.floor(t * 12) % 2 === 0 && t < 11.6) {} // door bang (sound only)
  if (inB(MSG.street, t)) battleMsg(fb, MSG.street.text, t - MSG.street.t0);
}
function battleBG(t, clockMin = 0) {
  sky(fb, { x: 236 - 4, y: 20, r: 9 }); mesas(fb, BATTLE_CAM); town(fb, BATTLE_CAM, clockMin);
}
function battleUI(t, o) {
  const slide = Math.round(52 * (1 - eo(clamp((t - o.slideT) / .3, 0, 1))));
  const y = 132 + slide;
  commandWin(fb, 6, y, ['FIGHT', 'TALK', 'ITEM', 'RUN'], o.cursor, t, o.bob, o.pick, o.dimTalk ? 1 : -1);
  statusWin(fb, 104, y, [
    { name: 'KID', hp: 1, val: 48, c1: C.lime, c2: C.green },
    { name: 'BLACK HAT', hp: o.bhHp ?? 1, val: o.bhVal ?? 60, c1: C.orange, c2: C.rust },
  ]);
}
function shotBattle(t) {
  const clockMin = t < 26.8 ? 59 : 60;
  battleBG(t, clockMin);
  const wind = Math.floor(t * 4) % 2;
  drawCowboy(fb, BLACKHAT, BH_X, FY, { arm: t > 25.4 ? 'holster' : 'side' }, -1, K);
  drawCowboy(fb, KID, KID_X, FY, { arm: t > 25.4 ? 'holster' : 'side', wind }, 1, K);
  if (inB(MSG.blocks, t)) battleMsg(fb, MSG.blocks.text, t - MSG.blocks.t0);
  // menu: FIGHT → TALK (select) → dialog → back; cursor creeps to FIGHT and stops bobbing while he hesitates
  if (t < DLG.kid.t0 - .1 || t >= 24.95) {
    let cursor, pick = -1, bob = true, slideT = 13.6;
    if (t < 24.95) { cursor = t < 17.6 ? 0 : t < 17.75 ? 1 - (17.75 - t) / .15 : 1; if (t >= 18.2) pick = 1; }
    else { slideT = 24.95; cursor = t < 25.4 ? 1 : t < 25.55 ? 1 - (t - 25.4) / .15 : 0; bob = !(t >= 25.4 && t < 26.6); if (t >= 26.6) pick = 0; }
    battleUI(t, { cursor, pick, bob, slideT, dimTalk: t >= 24.95 });
  }
  for (const d of Object.values(DLG)) if (inB(d, t)) dialog(fb, { portrait: portraitOf(d.who, d.expr), text: d.text, t: t - d.t0, cps: d === DLG.bh ? 30 : 38 });
}
function shotStand(t) {
  fb.clear(C.ink);
  const band = (P, y0, h, lid, sweat) => eyesCU(fb, P, 0, y0, W, h, lid, t, sweat);
  if (t < 28.1) band(KID, 50, 80, .2, clamp((t - 27.0) / 1.1, 0, 1));
  else if (t < 29.3) band(BLACKHAT, 50, 80, .45 + .2 * ss(28.3, 29.0, t), -1);
  else { band(KID, 14, 74, .35, 1); band(BLACKHAT, 92, 74, .65, -1); }
}
function shotDraw(t) {
  battleBG(t, 0);
  const u = t - 30.4;
  // smoke from the Kid's barrel
  // Black Hat: hurt hand, then runs off to the right
  if (t < 34.0) drawCowboy(fb, BLACKHAT, BH_X, FY, { arm: 'hurt', shake: Math.floor(t * 12) % 2 && t < 32, noGun: true }, -1, K);
  else { const k = t - 34.0, x = BH_X + k * k * 40 + k * 60; if (x < W + 30) drawCowboy(fb, BLACKHAT, x, FY, { walk: Math.floor(t * 12) % 4, run: true, noGun: true }, 1, K); dust(fb, BH_X + 8, FY, (t - 34.0) / .6); }
  // Kid: aim → spin back to holster → item-get raise
  let kpose = { arm: 'aim', wind: 1 };
  if (t >= 33.0 && t < 37.1) kpose = { arm: t < 33.3 ? 'holster' : 'side', wind: Math.floor(t * 4) % 2 };
  if (t >= 37.1) kpose = { arm: 'raise', wind: Math.floor(t * 4) % 2 };
  drawCowboy(fb, KID, KID_X, FY, kpose, 1, K);
  // muzzle flash + tracer + spark at Black Hat's hand
  if (u >= 0 && u < .09) {
    const mx = KID_X + 15 * K, my = FY - 21 * K;
    fb.line(mx, my, BH_X - 7 * K, FY - 20 * K, C.white);
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, -1], [2, 1], [1, -2], [1, 2], [5, 0]]) fb.px(mx + dx, my + dy, C.yellow);
    fb.disc(mx + 2, my, 2, C.white);
  }
  if (u >= 0 && u < .18) for (let k = 0; k < 6; k++) { const a = k * 1.05; fb.px(BH_X - 7 * K + Math.round(Math.cos(a) * 5), FY - 20 * K + Math.round(Math.sin(a) * 5), C.yellow); }
  // the gun flies: ballistic arc, spinning 4 frames per turn, lands and bounces once
  if (u >= .02) {
    const g = 300, vx = 40, vy = -150;
    let gx, gy, frame;
    if (u < 1.1) { gx = BH_X - 14 + vx * u; gy = FY - 40 + vy * u + .5 * g * u * u; frame = Math.floor(u * 16) % 4; }
    else if (u < 1.4) { const k = u - 1.1; gx = BH_X - 14 + vx * 1.1 + 20 * k; gy = FY - 6 - (Math.sin(k / .3 * Math.PI) * 6); frame = Math.floor(u * 12) % 4; }
    else { gx = BH_X - 14 + vx * 1.1 + 6; gy = FY - 3; frame = 0; }
    gy = Math.min(gy, FY - 4);
    const sp = GUNS[frame], gx0 = Math.round(gx - sp.w), gy0 = Math.round(gy - sp.h);
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) { const c = sp.d[j * sp.w + i]; if (c !== T) fb.rect(gx0 + i * 2, gy0 + j * 2, 2, 2, c); }
    if (u >= 1.1) dust(fb, Math.round(gx), FY, (u - 1.1) / .5);
  }
  // barrel smoke
  if (u > .05 && u < 2.6) for (let k = 0; k < 4; k++) {
    const age = u - k * .25; if (age < 0) continue;
    const sx = KID_X + 32 + Math.round(Math.sin(age * 3 + k) * 2 + age * 3), sy = FY - 44 - Math.round(age * 9), r = 1 + age * 1.2;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r && bayer(sx + xx, sy + yy) > age / 2.6) fb.px(sx + xx, sy + yy, C.silver);
  }
  // item-get: sparkles around the raised gun
  if (t >= 37.1) for (const [dx, dy, ph] of [[-6, -44, 0], [7, -40, .3], [0, -50, .6]]) {
    const k = Math.floor((t + ph) * 6) % 3; if (k === 2) continue; const sx = KID_X + 4 + dx * 2, sy = FY + dy * 2 + 6;
    fb.px(sx, sy, C.white); if (k === 0) { fb.px(sx - 1, sy, C.yellow); fb.px(sx + 1, sy, C.yellow); fb.px(sx, sy - 1, C.yellow); fb.px(sx, sy + 1, C.yellow); }
  }
  // damage number
  if (u > .1 && u < 1.6) { const s = '999'; text(fb, s, BH_X - 8, FY - 82 - Math.round(eo(clamp(u / .4, 0, 1)) * 8), C.white, C.ink); }
  for (const m of [MSG.crit, MSG.ran, MSG.learn]) if (inB(m, t)) battleMsg(fb, m.text, t - m.t0);
}
function shotSunset(t) {
  sky(fb, { x: 250, y: HORIZON - 6, r: 13 }, true);
  mesas(fb, BATTLE_CAM); town(fb, BATTLE_CAM, 0);
  const k = clamp((t - 41.0) / 6.0, 0, 1), kx = KID_X + k * 236, walking = t >= 41.0;
  // long evening shadow to the left
  if (kx < W + 20) { for (let i = 0; i < 26; i++) fb.hline(kx - 2 - i * 1.2, kx + 2 - i * 1.2, FLOOR - 4 + Math.min(3, i >> 3) + 4, C.tan); }
  drawCowboy(fb, KID, kx, FLOOR, walking ? { walk: Math.floor(t * 6) % 4, wind: Math.floor(t * 3) % 2 } : { wind: 0 });
  foreground(fb, BATTLE_CAM);
  if (inB(END, t)) { const s = END.text, sc = 2, x = Math.round((W - textW(s, sc)) / 2); textOutlined(fb, s, x, 18, y => y < 3 ? C.yellow : y < 5 ? C.amber : C.orange, C.ink, sc); }
}
function shake(u32, dx, dy) { if (!dx && !dy) return; const s = u32.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const X = x - dx, Y = y - dy; u32[y * W + x] = X < 0 || Y < 0 || X >= W || Y >= H ? 0xff000000 : s[Y * W + X]; } }
const SHAKE = [[3, 0], [-3, 2], [2, -2], [-2, 1], [1, -1], [-1, 0], [1, 1], [0, 0]];
function shakeAt(t, t0) { if (t >= t0 && t < t0 + SHAKE.length / 24) { const [dx, dy] = SHAKE[Math.floor((t - t0) * 24)]; shake(out.u32, dx, dy); } }
function sunsetLUT(t) { return t < 41.9 ? LUT.full : t < 43.3 ? LUT.eve1 : LUT.eve2; }

function frame(t) {
  fb.clear(C.ink);
  if (t < S.title[1]) {
    shotTitle(t);
    let L = LUT.full; if (t >= .15 && t < .2) L = whiten(L, 1); else if (t >= .55 && t < .58) L = whiten(L, .5);
    out.present(fb, L); shakeAt(t, .15); shakeAt(t, .55);
    if (t > 4.1) mosaic(out.u32, Math.round(1 + 15 * ss(4.1, 4.5, t)));
  } else if (t < S.street[1]) {
    shotStreet(t); out.present(fb, LUT.full);
    if (t < 4.8) mosaic(out.u32, Math.round(1 + 15 * (1 - ss(4.5, 4.8, t))));
    if (t >= 11.6 && t < 12.4) { const k = Math.floor((t - 11.6) * 4); if (Math.floor((t - 11.6) * 24) % 6 === 0) shake(out.u32, 0, k % 2 ? 1 : -1); }
  } else if (t < S.swirl[1]) {
    // encounter swirl: polar twist + mosaic + Bayer dissolve to white
    shotStreet(12.6); out.present(fb, LUT.full); bufA.set(out.u32);
    const s = Math.pow((t - 12.6) / .8, 1.6), n = 1 + Math.round(6 * s);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - W / 2, dy = y - H / 2, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + s * 7 * (1.2 - r / 190);
      let sx = Math.round(W / 2 + Math.cos(a) * r * (1 - s * .35)), sy = Math.round(H / 2 + Math.sin(a) * r * (1 - s * .35));
      sx = clamp(Math.floor(sx / n) * n, 0, W - 1); sy = clamp(Math.floor(sy / n) * n, 0, H - 1);
      out.u32[y * W + x] = bufA[sy * W + sx];
    }
    if (t > 13.28) out.u32.fill(0xffffffff);
    else if (t > 13.16) for (let i = 0; i < out.u32.length; i++) if (bayer(i % W, (i / W) | 0) < .5) out.u32[i] = 0xffffffff;
  } else if (t < S.battle[1]) {
    shotBattle(t);
    let L = LUT.full; if (t < 13.6) L = whiten(L, 1 - (t - 13.4) / .2);
    out.present(fb, L);
    if (t > 26.7) mosaic(out.u32, Math.round(1 + 11 * ss(26.7, 26.8, t)));
  } else if (t < S.stand[1]) {
    shotStand(t); out.present(fb, LUT.full);
    if (t < 26.9) mosaic(out.u32, Math.round(1 + 11 * (1 - ss(26.8, 26.9, t))));
  } else if (t < S.draw[1]) {
    shotDraw(t);
    let L = LUT.full; if (t < 30.46) L = whiten(L, 1); else if (t < 30.55) L = whiten(L, .5);
    out.present(fb, L); shakeAt(t, 30.4);
    if (t > 40.3) mosaic(out.u32, Math.round(1 + 15 * ss(40.3, 40.5, t)));
  } else {
    shotSunset(t);
    let L = sunsetLUT(t); if (t > 46.8) L = darken(L, (t - 46.8) / .7);
    out.present(fb, L);
    if (t < 40.7) mosaic(out.u32, Math.round(1 + 15 * (1 - ss(40.5, 40.7, t))));
  }
  out.show();
}

// ———————————————— Reading check: every text on screen, in 1080p pixels ————————————————
const SC = 6;
const box = (id, s, x, y, w, h, pass = false) => ({ id, text: s, x0: x * SC, y0: y * SC, x1: (x + w) * SC, y1: (y + h) * SC, pass });
window.TEXTS = t => {
  const o = [];
  if (t >= .15 && t < 4.1) { o.push(box('title', 'DRY GULCH', 50, 60, 220, 30)); o.push(box('sub', 'A NOON SHOWDOWN', 100, 92, 120, 10, true)); }
  if (t > 1.2 && t < 4.1) o.push(box('press', 'PRESS START', 120, 148, 80, 10, true));
  for (const [k, m] of Object.entries(MSG)) if (t >= m.t0 + m.text.length / 45 && t < m.t1) o.push(box(k, m.text, 60, 4, 200, 17));
  for (const [k, d] of Object.entries(DLG)) if (t >= d.t0 + d.text.length / (d === DLG.bh ? 30 : 38) && t < d.t1) o.push(box(k, d.text, 8, 134, 304, 42));
  if (t >= END.t0 && t < END.t1) o.push(box('end', END.text, 100, 16, 120, 20));
  return o;
};

// Test frames: ?sheet=1 model sheet
function sheet() {
  fb.clear(C.night);
  fb.gradV(0, 0, W, H, [C.night, C.dslate]);
  text(fb, 'MODEL SHEET · KID / BLACK HAT', 8, 6, C.white, C.ink);
  const poses = [{}, { walk: 0 }, { walk: 1 }, { walk: 2 }, { walk: 3 }, { arm: 'holster' }, { arm: 'aim', wind: 1 }, { arm: 'tip' }, { arm: 'raise' }];
  poses.forEach((p, i) => drawCowboy(fb, KID, 22 + i * 33, 66, p));
  const bp = [{}, { walk: 0 }, { walk: 1 }, { walk: 2 }, { walk: 3 }, { arm: 'holster' }, { arm: 'hurt', noGun: true }, { walk: 0, run: true, noGun: true }, { walk: 2, run: true, noGun: true }];
  bp.forEach((p, i) => drawCowboy(fb, BLACKHAT, 22 + i * 33, 118, p, i < 7 ? -1 : 1));
  ['neutral', 'firm', 'worry', 'smile'].forEach((e, i) => fb.blit(portraitOf(KID, e), 8 + i * 36, 140));
  ['neutral', 'smirk'].forEach((e, i) => fb.blit(portraitOf(BLACKHAT, e), 160 + i * 36, 140));
  GUNS.forEach((g, i) => fb.blit(g, 240 + i * 14, 150));
  out.present(fb, LUT.full); out.show();
}
window.render = t => q.has('sheet') ? sheet() : frame(t);
window.DUR = DUR; window.READY = true;
