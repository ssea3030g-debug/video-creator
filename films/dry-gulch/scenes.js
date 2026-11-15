// scenes.js — Dry Gulch: desert sky + sun, mesas (far parallax), the main street's false-front buildings, the street, tumbleweed, the title card
import { W, H, C, T, bayer, hash, vnoise, clamp } from './px.js';
import { text, textW, textOutlined } from './font.js';

export const HORIZON = 104, WALK_Y = 114, FLOOR = 130;   // floor line stays above the dialog box (y 134)

export function sky(fb, sun, eve = false) {
  fb.gradV(0, 0, W, HORIZON + 2, eve ? [C.night, C.plum, C.rose, C.pink, C.orange, C.amber] : [C.navy, C.blue, C.blue, C.cyan, C.silver, C.sand]);
  // sun: white core + Bayer glow rings
  const { x, y, r } = sun;
  for (let yy = Math.max(0, y - r * 4); yy < Math.min(HORIZON, y + r * 4); yy++) for (let xx = x - r * 4; xx < x + r * 4; xx++) {
    const d = Math.hypot(xx - x, yy - y);
    if (d < r) fb.px(xx, yy, d < r - 2 ? C.white : C.yellow);
    else if (d < r * 2 && bayer(xx, yy) < 1 - (d - r) / r) fb.px(xx, yy, d < r * 1.4 ? C.yellow : C.silver);
    else if (d < r * 3.6 && bayer(xx, yy) < .25 * (1 - (d - r * 2) / (r * 1.6))) fb.px(xx, yy, C.silver);
  }
}
// Far mesas, flat-topped, parallax ~0.15
const MESAS = [[-40, 70, 22], [40, 46, 14], [110, 90, 26], [215, 54, 17], [290, 80, 24], [380, 60, 15], [450, 96, 28], [560, 70, 20]];
export function mesas(fb, cam) {
  const off = Math.round(cam * .15);
  for (const [mx, mw, mh] of MESAS) {
    const x0 = mx - off;
    for (let x = x0 - 10; x < x0 + mw + 10; x++) {
      if (x < 0 || x >= W) continue;
      const slope = x < x0 ? (x - (x0 - 10)) / 10 : x > x0 + mw ? 1 - (x - x0 - mw) / 10 : 1;
      const top = HORIZON - Math.round(mh * slope) + Math.round(vnoise(x * .3 + mx) * 2);
      for (let y = top; y < HORIZON + 2; y++) {
        const strata = ((y - top) % 6 === 2);
        fb.px(x, y, y === top ? C.clay : strata ? C.rust : x < x0 + 4 ? C.clay : (bayer(x, y) < .3 ? C.rust : C.tan));
      }
    }
  }
  // near hills band
  const off2 = Math.round(cam * .4);
  for (let x = 0; x < W; x++) {
    const top = HORIZON - 2 + Math.round(vnoise((x + off2) * .05) * 5);
    for (let y = top; y < WALK_Y; y++) fb.px(x, y, y === top ? C.sand : bayer(x, y) < .4 ? C.tan : C.sand);
  }
}

// —— Buildings (world x; parallax 1.0 with the street) ——
export const BUILDINGS = [
  { x: 0, w: 62, h: 42, wood: [C.sand, C.tan, C.brown], sign: 'STORE' },
  { x: 70, w: 74, h: 54, wood: [C.clay, C.brown, C.dbrown], sign: 'SALOON', saloon: true },
  { x: 152, w: 58, h: 46, wood: [C.clay, C.rust, C.dbrown], sign: 'BANK', brick: true },
  { x: 218, w: 44, h: 50, wood: [C.silver, C.steel, C.slate], clock: true },
  { x: 270, w: 66, h: 48, wood: [C.tan, C.brown, C.dbrown], sign: 'HOTEL' },
  { x: 344, w: 56, h: 40, wood: [C.sand, C.tan, C.brown], sign: 'SHERIFF' },
  { x: 408, w: 62, h: 44, wood: [C.clay, C.brown, C.dbrown], sign: 'STABLE' },
  { x: 478, w: 70, h: 50, wood: [C.tan, C.brown, C.dbrown], sign: 'GENERAL' },
];
export const CLOCK = { x: 240, y: WALK_Y - 50 - 18 };   // world centre of the clock face

function building(fb, b, sx, clockMin) {
  const [L, M, D] = b.wood, top = WALK_Y - b.h;
  // false front with stepped top
  fb.rect(sx, top, b.w, b.h, M);
  fb.rect(sx + 6, top - 4, b.w - 12, 4, M); fb.rect(sx + 14, top - 7, b.w - 28, 3, M);
  for (let x = sx; x < sx + b.w; x += 4) fb.vline(x, top, WALK_Y - 1, b.brick ? M : D);
  if (b.brick) for (let y = top + 2; y < WALK_Y; y += 3) for (let x = sx + ((y >> 1) % 2 ? 0 : 3); x < sx + b.w; x += 6) fb.px(x, y, D);
  fb.hline(sx, sx + b.w - 1, top, L); fb.hline(sx + 6, sx + b.w - 7, top - 4, L); fb.hline(sx + 14, sx + b.w - 15, top - 7, L);
  fb.vline(sx, top, WALK_Y - 1, L); fb.vline(sx + b.w - 1, top, WALK_Y - 1, D);
  // sign board
  if (b.sign) {
    const tw = textW(b.sign), bw = tw + 8, bx = sx + Math.round((b.w - bw) / 2), by = top + 3;
    fb.rect(bx, by, bw, 11, C.ink); fb.rect(bx + 1, by + 1, bw - 2, 9, C.sand); text(fb, b.sign, bx + 4, by + 2, C.dbrown);
  }
  // windows
  const wy = top + 18;
  for (const wx of [sx + 6, sx + b.w - 18]) {
    if (b.h < 44 && b.clock) continue;
    fb.rect(wx, wy, 12, 11, C.ink); fb.rect(wx + 1, wy + 1, 10, 9, C.night); fb.rect(wx + 1, wy + 1, 4, 3, C.dslate); fb.vline(wx + 6, wy + 1, wy + 9, C.ink); fb.hline(wx + 1, wx + 10, wy + 5, C.ink);
  }
  // door
  const dx = sx + Math.round(b.w / 2) - 6;
  if (b.saloon) {   // swinging half-doors
    fb.rect(dx - 1, WALK_Y - 22, 14, 22, C.ink);
    fb.rect(dx, WALK_Y - 16, 6, 9, L); fb.rect(dx + 7, WALK_Y - 16, 6, 9, L); fb.hline(dx, dx + 12, WALK_Y - 12, D);
  } else if (!b.clock) { fb.rect(dx, WALK_Y - 20, 12, 20, D); fb.rect(dx + 1, WALK_Y - 19, 10, 19, C.umber); fb.px(dx + 9, WALK_Y - 10, C.amber); fb.rect(dx + 2, WALK_Y - 17, 3, 6, C.dbrown); fb.rect(dx + 7, WALK_Y - 17, 3, 6, C.dbrown); }
  // awning over the boardwalk
  if (!b.clock) {
    const ay = WALK_Y - 34;
    for (let y = 0; y < 4; y++) fb.hline(sx - 2 + y, sx + b.w + 1 - y, ay + y, y === 0 ? L : y === 3 ? C.umber : D);
    fb.vline(sx + 2, ay + 4, WALK_Y - 1, D); fb.vline(sx + b.w - 3, ay + 4, WALK_Y - 1, D);
  }
  // clock tower
  if (b.clock) {
    const tx = sx + 8, tw = b.w - 16, tt = top - 22;
    fb.rect(tx, tt, tw, 22, M); fb.vline(tx, tt, top, L); fb.vline(tx + tw - 1, tt, top, D);
    for (let y = 0; y < 8; y++) fb.hline(tx + 2 + y * 1.6, tx + tw - 3 - y * 1.6, tt - 8 + y, y < 2 ? C.crimson : C.rust);   // pointed roof
    fb.px(tx + tw / 2, tt - 9, C.ink);
    const cx = sx + Math.round(b.w / 2), cy = tt + 11 - 1;
    fb.disc(cx, cy, 8, C.ink); fb.disc(cx, cy, 7, C.white);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; fb.px(cx + Math.round(Math.sin(a) * 6), cy - Math.round(Math.cos(a) * 6), k % 3 ? C.steel : C.ink); }
    const am = (clockMin / 60) * Math.PI * 2, ah = ((11 + clockMin / 60) / 12) * Math.PI * 2;
    fb.line(cx, cy, cx + Math.round(Math.sin(am) * 6), cy - Math.round(Math.cos(am) * 6), C.ink);
    fb.line(cx, cy, cx + Math.round(Math.sin(ah) * 4), cy - Math.round(Math.cos(ah) * 4), C.crimson);
    // bell window below
    fb.rect(cx - 5, top + 6, 10, 12, C.ink); fb.rect(cx - 3, top + 8, 6, 6, C.amber); fb.rect(cx - 2, top + 14, 4, 1, C.tan);
  }
}
export function town(fb, cam, clockMin = 59) {
  for (const b of BUILDINGS) { const sx = b.x - Math.round(cam); if (sx > W + 20 || sx + b.w < -20) continue; building(fb, b, sx, clockMin); }
  // boardwalk + street
  for (let y = WALK_Y - 1; y < WALK_Y + 3; y++) for (let x = 0; x < W; x++) fb.px(x, y, y === WALK_Y - 1 ? C.tan : ((x + Math.round(cam)) % 9 === 0 ? C.dbrown : C.brown));
  for (let y = WALK_Y + 3; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = x + Math.round(cam), rut = (y === 140 || y === 141 || y === 156 || y === 157) && hash(wx >> 2, y) > .3;
    fb.px(x, y, rut ? C.tan : bayer(x, y) < (y - WALK_Y) / 120 ? C.tan : (hash(wx, y) > .985 ? C.brown : C.sand));
  }
  fb.dither(0, WALK_Y + 3, W, 4, (x, y) => 1 - (y - WALK_Y - 3) / 4, C.sand, C.tan);
}
// foreground posts (parallax 1.4)
export function foreground(fb, cam) {
  const off = Math.round(cam * 1.4);
  for (let wx = 0; wx < 900; wx += 96) {
    const x = wx - off; if (x < -10 || x > W + 10) continue;
    fb.rect(x, 150, 5, 30, C.ink); fb.rect(x + 1, 151, 3, 29, C.dbrown); fb.vline(x + 1, 151, 179, C.brown);
    fb.rect(x - 30, 156, 64, 3, C.ink); fb.rect(x - 30, 157, 64, 1, C.brown);
  }
}
// tumbleweed: rolls (angle = distance / radius) and bounces
export function tumbleweed(fb, x, y, r = 6) {
  const a = x / r;
  for (let k = 0; k < 9; k++) {
    const t0 = a + k * .7, t1 = t0 + 2.2;
    const rr = r * (.55 + .45 * ((k * 37) % 5) / 4);
    fb.line(x + Math.cos(t0) * rr, y + Math.sin(t0) * rr, x + Math.cos(t1) * rr * .6, y + Math.sin(t1) * rr * .6, k % 2 ? C.brown : C.dbrown);
  }
  fb.line(x - r + 1, y, x + r - 1, y, C.umber);
}
// dust puff (n frames, 0..1)
export function dust(fb, x, y, u) {
  if (u < 0 || u > 1) return;
  for (let k = 0; k < 5; k++) { const dx = (k - 2) * (3 + u * 5), dy = -u * 4 - (k % 2) * 2, r = 2 + u * 2; for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r && bayer(x + dx + xx, y + dy + yy) > u) fb.px(x + dx + xx, y + dy + yy, C.sand); }
}

// —— Title card ——
export function titleCard(fb, t, holes) {
  sky(fb, { x: 160, y: 40, r: 12 });
  mesas(fb, 60);
  // desert floor with a road vanishing to the horizon
  for (let y = WALK_Y; y < H; y++) for (let x = 0; x < W; x++) fb.px(x, y, bayer(x, y) < (y - WALK_Y) / 90 ? C.tan : C.sand);
  for (let y = WALK_Y; y < H; y++) { const k = (y - WALK_Y) / (H - WALK_Y), hw = 2 + k * 70; fb.hline(160 - hw, 160 + hw, y, bayer(0, y) < .5 ? C.tan : C.clay); }
  // saguaro silhouettes
  for (const [cx, base, h] of [[38, 150, 46], [280, 140, 34]]) {
    fb.rect(cx - 3, base - h, 6, h, C.dgreen); fb.vline(cx - 2, base - h, base, C.green);
    fb.rect(cx - 10, base - h * .6, 4, 14, C.dgreen); fb.rect(cx - 10, base - h * .6 + 10, 8, 4, C.dgreen);
    fb.rect(cx + 6, base - h * .75, 4, 12, C.dgreen); fb.rect(cx + 2, base - h * .75 + 8, 8, 4, C.dgreen);
  }
  const s1 = 'DRY GULCH', sc = 3, tw = textW(s1, sc), tx = Math.round((W - tw) / 2), ty = 66;
  const col = y => y < 2 ? C.yellow : y < 4 ? C.amber : y < 6 ? C.orange : C.rust;
  textOutlined(fb, s1, tx, ty, col, C.ink, sc);
  // bullet holes punched into the title
  for (const [hx, hy] of holes) { fb.disc(hx, hy, 2, C.ink); fb.px(hx - 1, hy - 1, C.night); fb.px(hx - 3, hy, C.white); fb.px(hx + 2, hy + 2, C.white); fb.px(hx + 3, hy - 2, C.white); }
  const s2 = 'A NOON SHOWDOWN'; text(fb, s2, Math.round((W - textW(s2)) / 2), 94, C.white, C.dbrown);
  if (t > 1.2 && Math.floor(t * 2.5) % 2 === 0) { const s3 = 'PRESS START'; text(fb, s3, Math.round((W - textW(s3)) / 2), 150, C.white, C.ink); }
  return { tx, ty, tw };
}
