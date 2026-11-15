// cowboy.js — the two gunslingers: a code rig (capsule limbs, 3-tone shading from the upper left, 1-px ink outline) + hand-placed ASCII heads and hats,
// 32×32 dialog portraits, and native-resolution eye close-ups for the stand-off.
import { C, T, FB, sprFromRows, bayer, clamp } from './px.js';

// —— Costumes ——
export const KID = {
  hat: [C.sand, C.tan, C.brown], band: C.dbrown, skin: [C.skin, C.skin, C.skinS], hair: C.dbrown,
  shirt: [C.cyan, C.blue, C.navy], vest: [C.clay, C.brown, C.dbrown], legs: [C.steel, C.slate, C.dslate], boots: [C.brown, C.dbrown, C.umber],
  bandana: true, coat: false, tall: 4,
};
export const BLACKHAT = {
  hat: [C.dslate, C.night, C.ink], band: C.crimson, skin: [C.skin, C.skinS, C.brown], hair: C.ink,
  shirt: [C.rose, C.crimson, C.umber], vest: [C.slate, C.dslate, C.night], legs: [C.brown, C.dbrown, C.umber], boots: [C.dbrown, C.umber, C.ink],
  bandana: false, coat: true, tall: 5, mustache: true,
};

// —— Heads (facing right). f skin, s skin shade, h hair, e eye, m mustache ——
const HEAD_KID = ['hhffff.', 'hsffef.', 'hsffff.', 'hsfffff', '.sffss.', '..sss..'];
const HEAD_BH = ['hhffff.', 'hsfeef.', 'hsffff.', 'hsffmmf', '.smmms.', '..sss..'];
// Hats: L highlight, H base, D shade, B band
const HAT_KID = ['....LHHH...', '...LHHHHD..', '...HBBBBD..', 'LHHHHHHHHHD', '.DDDDDDDDD.'];
const HAT_BH = ['....LHHHD..', '...LHHHHD..', '...LHHHHD..', '...HBBBBD..', 'LHHHHHHHHHHD', '.DDDDDDDDDD.'];

function rows(fb, R, x0, y0, map) {
  R.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = map[r[x]]; if (c !== undefined) fb.px(x0 + x, y0 + y, c); } });
}
// Capsule limb with 3-tone shading: the column/row nearest the upper-left light is the highlight, the far one the shade
function limb(fb, x0, y0, x1, y1, w, cols) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1), vert = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    for (let k = 0; k < w; k++) {
      const c = k === 0 ? cols[0] : k === w - 1 ? cols[2] : cols[1];
      if (vert) fb.px(x - (w >> 1) + k, y, c); else fb.px(x, y - (w >> 1) + k, c);
    }
  }
}
function outline(s) {
  const o = s.d.slice();
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (s.d[y * s.w + x] !== T) continue;
    const nb = (X, Y) => X >= 0 && Y >= 0 && X < s.w && Y < s.h && s.d[Y * s.w + X] !== T;
    if (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1)) o[y * s.w + x] = C.ink;
  }
  s.d.set(o);
}
// Revolver, 4 orientations (for the flying gun) + the held one
const GUN_MAP = { s: C.silver, t: C.steel, k: C.ink, w: C.brown };
export const GUNS = [
  sprFromRows(['kkkkkkk.', 'tssssssk', 'wwtk....', 'ww......'], GUN_MAP),
  sprFromRows(['..kt', '..st', '..st', '.kst', 'wwst', 'ww.k'], GUN_MAP),
  sprFromRows(['......ww', '....ktww', 'kssssssk', '.kkkkkkk'], GUN_MAP),
  sprFromRows(['k.ts', 'tsww', 'tsk.', 'ts..', 'ts..', 'tk..'], GUN_MAP),
];

// Pose: { walk: phase 0..3 | -1, arm: 'side'|'holster'|'aim'|'hurt'|'tip'|'raise', run: bool, wind: 0..1 (bandana tail), crouch }
// Returns a sprite {w,h,d} with its foot point at (20, 46)
export function cowboy(P, pose = {}) {
  const s = new FB(40, 48); s.clear(T);
  const ox = 20, oy = 46, X = v => ox + v, Y = v => oy + v;
  const ph = pose.walk ?? -1, run = !!pose.run;
  const amp = run ? 4 : 3;
  const ff = ph < 0 ? 1 : [amp, 0, -amp, 0][ph], fb_ = ph < 0 ? -2 : [-amp, 0, amp, 0][ph];
  const bob = ph < 0 ? 0 : (ph % 2 ? -1 : 0);
  const crouch = pose.crouch ? 1 : 0;
  const lean = run ? 2 : 0;
  const hipY = -11 + bob + crouch, shY = -20 + bob + crouch;
  // back arm (behind the torso, shaded tones)
  const backHand = pose.arm === 'aim' ? [-5, -14] : ph < 0 ? [-3, -12] : [-2 - [2, 0, -2, 0][ph] + lean, -12 + bob];
  limb(s, X(-2 + lean), Y(shY + 1), X(backHand[0]), Y(backHand[1]), 3, [P.shirt[1], P.shirt[2], P.shirt[2]]);
  s.rect(X(backHand[0]) - 1, Y(backHand[1]), 2, 2, P.skin[2]);
  // legs
  const lift = l => (ph === 1 && l) || (ph === 3 && !l) ? -1 : 0;
  limb(s, X(-1), Y(hipY + 1), X(fb_), Y(-3 + lift(0)), 3, [P.legs[1], P.legs[2], P.legs[2]]);
  s.rect(X(fb_) - 1, Y(-3 + lift(0)), 4, 3, P.boots[2]);
  limb(s, X(1), Y(hipY + 1), X(ff), Y(-3 + lift(1)), 3, P.legs);
  s.rect(X(ff) - 1, Y(-3 + lift(1)), 4, 3, P.boots[1]); s.hline(X(ff) - 1, X(ff) + 2, Y(-3 + lift(1)), P.boots[0]);
  // duster coat skirt (Black Hat)
  if (P.coat) {
    const sw = ph < 0 ? 0 : [1, 0, -1, 0][ph];
    for (let y = hipY - 1; y <= -5 + crouch; y++) { const k = y - hipY; s.hline(X(-5 + lean - (k >> 2) - (sw < 0 ? 1 : 0)), X(4 + lean + (k >> 2) + (sw > 0 ? 1 : 0)), Y(y), y % 3 ? P.vest[1] : P.vest[2]); }
    s.vline(X(0 + lean), Y(hipY + 2), Y(-5 + crouch), P.vest[2]);
  }
  // torso: shirt, vest, belt, holster
  for (let y = shY; y <= hipY; y++) {
    const xl = -3 + lean - (y > shY + 1 ? 0 : 0), xr = 2 + lean;
    for (let x = xl; x <= xr; x++) s.px(X(x), Y(y), x === xl ? P.shirt[0] : x === xr ? P.shirt[2] : P.shirt[1]);
  }
  // vest panels
  for (let y = shY + 1; y <= hipY - 1; y++) { s.px(X(-3 + lean), Y(y), P.vest[0]); s.px(X(-2 + lean), Y(y), P.vest[1]); s.px(X(2 + lean), Y(y), P.vest[2]); if (y > shY + 2) s.px(X(1 + lean), Y(y), P.vest[1]); }
  if (P.coat) for (let y = shY; y <= hipY; y++) { s.px(X(-4 + lean), Y(y), P.vest[1]); s.px(X(-3 + lean), Y(y), P.vest[0]); s.px(X(3 + lean), Y(y), P.vest[2]); }
  s.hline(X(-3 + lean), X(2 + lean), Y(hipY), C.umber); s.px(X(0 + lean), Y(hipY), C.amber);
  const gunInHolster = !(pose.arm === 'aim' || pose.arm === 'raise' || pose.noGun);
  s.rect(X(2 + lean), Y(hipY + 1), 2, 4, C.dbrown);
  if (gunInHolster) { s.px(X(3 + lean), Y(hipY - 1), C.brown); s.px(X(3 + lean), Y(hipY), C.brown); }
  // neck + bandana (protected colours: the thread through the film)
  const headX = X(-3 + lean), headY = Y(shY - 7);
  if (P.bandana) {
    s.hline(X(-3 + lean), X(2 + lean), Y(shY), C.scarf); s.hline(X(-2 + lean), X(2 + lean), Y(shY + 1), C.scarf);
    s.px(X(1 + lean), Y(shY + 2), C.scarfD); s.px(X(2 + lean), Y(shY + 1), C.scarfD); s.px(X(-2 + lean), Y(shY), C.scarfL);
    // the knot tail flutters behind: the hero's silhouette mark
    const w = Math.round((pose.wind ?? 0) * 2);
    s.px(X(-4 + lean), Y(shY), C.scarf); s.px(X(-5 + lean), Y(shY + (w ? 0 : 1)), C.scarfD); if (w > 1 || run) s.px(X(-6 + lean), Y(shY - (w > 1 ? 1 : 0)), C.scarfD);
  }
  // head + hat
  rows(s, P.mustache ? HEAD_BH : HEAD_KID, headX, headY + 1, { f: P.skin[0], s: P.skin[2], h: P.hair, e: C.ink, m: C.ink });
  const hatR = P.mustache ? HAT_BH : HAT_KID, hatY = headY + 2 - hatR.length;
  const tipUp = pose.arm === 'tip' ? -1 : 0;
  rows(s, hatR, headX - 2, hatY + tipUp, { L: P.hat[0], H: P.hat[1], D: P.hat[2], B: P.band });
  // front arm
  const shX = X(0 + lean), shYp = Y(shY + 1);
  let hand;
  switch (pose.arm) {
    case 'holster': hand = [3, hipY - 1]; break;
    case 'aim': hand = [9, shY + 1]; break;
    case 'hurt': hand = [6, shY - 2 + (pose.shake ? 1 : 0)]; break;
    case 'tip': hand = [3, shY - 7]; break;
    case 'raise': hand = [2, shY - 10]; break;
    default: hand = ph < 0 ? [1, -12 + bob] : [1 + [2, 0, -2, 0][ph] + lean, -12 + bob];
  }
  if (pose.arm === 'tip' || pose.arm === 'raise') {
    limb(s, shX, shYp, X(hand[0] + 1), Y(shY - 3), 3, P.shirt); limb(s, X(hand[0] + 1), Y(shY - 3), X(hand[0]), Y(hand[1]), 3, P.shirt);
  } else limb(s, shX, shYp, X(hand[0]), Y(hand[1]), 3, P.shirt);
  s.rect(X(hand[0]) - 1, Y(hand[1]) - 1, 2, 2, P.skin[0]); s.px(X(hand[0]), Y(hand[1]), P.skin[2]);
  if (pose.arm === 'aim') { s.rect(X(hand[0]) + 1, Y(hand[1]) - 2, 5, 1, C.silver); s.rect(X(hand[0]) + 1, Y(hand[1]) - 1, 5, 1, C.steel); s.px(X(hand[0]), Y(hand[1]) + 1, C.brown); }
  if (pose.arm === 'raise') { s.rect(X(hand[0]) - 1, Y(hand[1]) - 6, 2, 5, C.silver); s.px(X(hand[0]), Y(hand[1]) - 6, C.steel); }
  outline(s);
  return s;
}
const cache = new Map();
export function cowboyC(P, pose) { const k = (P === KID ? 'k' : 'b') + JSON.stringify(pose); if (!cache.has(k)) cache.set(k, cowboy(P, pose)); return cache.get(k); }
// draw at feet (x, y); face: 1 right, -1 left
export function drawCowboy(fb, P, x, y, pose, face = 1, k = 1) {
  const s = cowboyC(P, pose);
  if (k === 1) { fb.blit(s, Math.round(x) - (face > 0 ? 20 : 19), Math.round(y) - 46, face < 0); return; }
  const x0 = Math.round(x) - (face > 0 ? 20 : 19) * k, y0 = Math.round(y) - 46 * k;   // integer ×k (battle close view)
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) { const c = s.d[j * s.w + (face < 0 ? s.w - 1 - i : i)]; if (c !== T) fb.rect(x0 + i * k, y0 + j * k, k, k, c); }
}

// —— Portraits 32×32 (3/4 view facing right) ——
function portrait(P, expr) {
  const s = new FB(32, 32); s.clear(T);
  const sk = P.skin;
  // shoulders / collar
  s.rect(3, 27, 26, 5, P.shirt[1]); s.rect(3, 27, 3, 5, P.shirt[0]); s.rect(24, 27, 5, 5, P.shirt[2]);
  s.rect(5, 28, 5, 4, P.vest[1]); s.rect(22, 28, 5, 4, P.vest[2]);
  if (P.coat) { s.rect(2, 27, 6, 5, P.vest[1]); s.rect(24, 27, 6, 5, P.vest[2]); }
  // neck
  s.rect(12, 23, 8, 5, sk[2]);
  // face
  for (let y = 9; y <= 25; y++) {
    const half = y < 22 ? 8 : 8 - (y - 21);
    for (let x = 16 - half; x <= 16 + half - 1; x++) s.px(x, y, x < 11 ? sk[2] : (x > 21 && y > 18) ? sk[1] : sk[0]);
  }
  s.px(24, 18, sk[0]); s.px(24, 19, sk[0]); s.px(25, 19, sk[1]); // nose
  // ear + hair
  s.rect(7, 14, 3, 5, sk[2]); s.px(8, 16, sk[1]);
  s.rect(6, 9, 4, 6, P.hair); s.rect(9, 9, 10, 2, P.hair);
  // eyes / brows by expression
  const e = expr || 'neutral';
  const browL = e === 'firm' || e === 'smirk' ? [[12, 13], [13, 13], [14, 14], [15, 14]] : [[12, 13], [13, 13], [14, 13], [15, 13]];
  const browR = e === 'firm' || e === 'smirk' ? [[19, 14], [20, 14], [21, 13], [22, 13]] : [[19, 13], [20, 13], [21, 13], [22, 13]];
  if (e === 'worry') { browL.splice(0, 4, [12, 14], [13, 13], [14, 13], [15, 12]); browR.splice(0, 4, [19, 12], [20, 13], [21, 13], [22, 14]); }
  for (const [x, y] of [...browL, ...browR]) s.px(x, y, P.hair === C.ink ? C.ink : C.dbrown);
  const squint = e === 'firm' || e === 'smirk' || P.mustache;
  for (const ex of [13, 20]) {
    s.rect(ex, 16, 3, 1, C.ink);
    if (!squint) { s.px(ex, 17, C.white); s.px(ex + 1, 17, C.ink); s.px(ex + 2, 17, C.white); }
    else { s.px(ex + 1, 17, C.ink); }
  }
  // mouth
  if (P.mustache) {
    s.rect(17, 21, 8, 2, C.ink); s.px(16, 22, C.ink); s.px(25, 22, C.ink);
    if (e === 'smirk') { s.px(23, 23, C.crimson); s.px(24, 23, C.ink); } else s.hline(19, 22, 23, C.umber);
    for (const [x, y] of [[12, 22], [14, 24], [17, 25], [21, 25], [11, 20], [13, 20]]) s.px(x, y, sk[2]);   // stubble
    s.line(18, 10, 22, 14, C.rose);                                                                     // scar
  } else {
    if (e === 'smile') { s.hline(18, 22, 22, C.umber); s.px(23, 21, C.umber); }
    else s.hline(18, 22, 22, C.umber);
  }
  // hat (big brim crossing the frame)
  const hc = P.hat;
  s.rect(8, 1, 15, 8, hc[1]); s.rect(8, 1, 2, 8, hc[0]); s.rect(20, 1, 3, 8, hc[2]); s.hline(10, 19, 1, hc[0]);
  s.rect(8, 6, 15, 2, P.band);
  s.rect(1, 8, 30, 2, hc[1]); s.hline(1, 30, 8, hc[0]); s.hline(2, 29, 10, hc[2]);
  // bandana
  if (P.bandana) { s.rect(10, 25, 12, 3, C.scarf); s.hline(10, 21, 25, C.scarfL); s.rect(14, 28, 5, 2, C.scarf); s.rect(15, 30, 3, 1, C.scarfD); s.px(21, 27, C.scarfD); }
  outline(s);
  return s;
}
const pcache = new Map();
export function portraitOf(P, expr) { const k = (P === KID ? 'k' : 'b') + expr; if (!pcache.has(k)) pcache.set(k, portrait(P, expr)); return pcache.get(k); }

// —— Eye close-up for the stand-off: a band (x0,y0,w,h) of face at native resolution ——
// lid: 0 open .. 1 shut squint; t for sweat
export function eyesCU(fb, P, x0, y0, w, h, lid, t, sweat = -1) {
  const sk = P.skin;
  fb.clip = [x0, y0, x0 + w, y0 + h];
  // skin with a soft dithered vertical shade; hat-brim shadow across the top
  fb.gradV(x0, y0, w, h, [sk[2], sk[0], sk[0], sk[1], sk[2]]);
  const brimH = Math.round(h * .22);
  fb.gradV(x0, y0, w, brimH, [P.hat[2], P.hat[2], P.hat[1]]);
  fb.dither(x0, y0 + brimH, w, 4, (x, y) => 1 - (y - y0 - brimH) / 4, sk[2], P.hat[2]);
  const cx = x0 + w / 2, ey = y0 + Math.round(h * .55);
  for (const side of [-1, 1]) {
    const ex = Math.round(cx + side * 58), ew = 34, eh = 12;
    const open = Math.max(1, Math.round(eh * (1 - lid) * .5));
    // brow
    const bAng = P.mustache ? 4 : 3;
    for (let i = -22; i <= 22; i++) {
      const dy = Math.round((side * i) / 22 * bAng);
      const yy = ey - 14 - (P.mustache ? 0 : 2) + dy;
      fb.rect(ex + i, yy, 1, 4, P.hair === C.ink ? C.ink : C.dbrown);
    }
    // sclera (ellipse), iris, pupil, glint
    for (let y = -open; y <= open; y++) for (let x = -ew / 2; x <= ew / 2; x++) {
      if ((x * x) / ((ew / 2) ** 2) + (y * y) / (open * open + .01) > 1) continue;
      fb.px(ex + x, ey + y, C.white);
    }
    const irisC = P.mustache ? C.umber : C.blue, irisD = P.mustache ? C.ink : C.navy;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      if (x * x + y * y > 36 || Math.abs(y) > open) continue;
      fb.px(ex + side * 2 + x, ey + y, x * x + y * y < 9 ? C.ink : (y < -2 ? irisD : irisC));
    }
    if (open > 3) { fb.rect(ex + side * 2 - 3, ey - 3, 2, 2, C.white); }
    // upper lid: thick ink line + lash; lower lid shade
    for (let x = -ew / 2 - 1; x <= ew / 2 + 1; x++) { const k = 1 - (x * x) / ((ew / 2 + 1) ** 2); const yy = ey - Math.round(open * Math.sqrt(Math.max(0, k))) - 1; fb.rect(ex + x, yy - 1, 1, 2, C.ink); fb.px(ex + x, ey + Math.round(open * Math.sqrt(Math.max(0, k))) + 1, sk[2]); }
    // crow's-feet / scar
    if (P.mustache) { fb.line(ex + side * 22, ey - 2, ex + side * 28, ey - 5, sk[2]); fb.line(ex + side * 22, ey + 1, ex + side * 28, ey + 3, sk[2]); }
  }
  if (P.mustache) fb.line(cx + 40, y0 + brimH + 3, cx + 52, ey + 6, C.rose);     // scar through the right brow
  // nose bridge
  fb.rect(Math.round(cx) - 3, ey - 6, 6, h, sk[1]); fb.rect(Math.round(cx) + 2, ey - 6, 2, h, sk[2]);
  // a bead of sweat runs down the Kid's temple
  if (sweat >= 0) {
    const sy = Math.round(y0 + brimH + 6 + sweat * (h - brimH - 10)), sx = Math.round(cx - 92);
    fb.rect(sx, sy, 3, 4, C.white); fb.px(sx + 1, sy - 1, C.white); fb.px(sx + 2, sy + 2, C.silver); fb.px(sx, sy + 3, C.cyan);
  }
  fb.clip = [0, 0, fb.w, fb.h];
}
