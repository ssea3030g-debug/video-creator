// ui.js — windows, dialog box, battle-log window, hand cursor (adapted from the pixel-rpg engine), plus the duel's command menu and status window
import { W, H, C, T, GBI, bayer, sprFromRows } from './px.js';
import { text, textW, wrap, LINE_H } from './font.js';

// Windows: skin snes = blue gradient + white/silver border; nes = black background with white frame; gb = light background with dark frame (pass in 4-colour indices)
export function win(fb, x, y, w, h, skin = 'snes') {
  if (skin === 'gb') {
    const [K, D, Lg, Wt] = GBI;
    fb.rect(x + 1, y, w - 2, h, K); fb.rect(x, y + 1, w, h - 2, K);
    fb.rect(x + 1, y + 1, w - 2, h - 2, D); fb.rect(x + 2, y + 2, w - 4, h - 4, Wt); return;
  }
  if (skin === 'nes') {
    fb.rect(x + 1, y, w - 2, h, C.ink); fb.rect(x, y + 1, w, h - 2, C.ink);
    fb.rect(x + 2, y + 2, w - 4, h - 4, C.white); fb.rect(x + 4, y + 4, w - 8, h - 8, C.ink); fb.px(x + 2, y + 2, C.ink); fb.px(x + w - 3, y + 2, C.ink); fb.px(x + 2, y + h - 3, C.ink); fb.px(x + w - 3, y + h - 3, C.ink); return;
  }
  fb.rect(x + 2, y, w - 4, h, C.ink); fb.rect(x, y + 2, w, h - 4, C.ink); fb.rect(x + 1, y + 1, w - 2, h - 2, C.ink);
  fb.rect(x + 2, y + 1, w - 4, h - 2, C.white); fb.rect(x + 1, y + 2, w - 2, h - 4, C.white);
  fb.rect(x + 2, y + 2, w - 4, h - 4, C.silver);
  fb.gradV(x + 3, y + 3, w - 6, h - 6, [C.blue, C.navy, C.navy, C.night]);
  fb.hline(x + 3, x + w - 4, y + 3, C.blue);
}

// —— Dialogue box (subtitles) ——
// o: { skin, portrait(spr|null), text, t (seconds since typing starts), cps, big: on the 160 resolution when gb }
export function dialog(fb, o) {
  const skin = o.skin || 'snes', gb = skin === 'gb';
  const X = gb ? 3 : 8, Y = gb ? 62 : 134, Wd = gb ? 154 : 304, Hd = gb ? 26 : 42;
  win(fb, X, Y, Wd, Hd, skin);
  let tx = X + (gb ? 6 : 10);
  if (o.portrait) {
    const p = o.portrait, px = X + 5, py = Y + Math.round((Hd - p.h) / 2);
    if (skin === 'snes') { fb.rect(px - 1, py - 1, p.w + 2, p.h + 2, C.ink); fb.gradV(px, py, p.w, p.h, [C.navy, C.night]); }
    fb.blit(p, px, py); tx = px + p.w + 7;
  }
  const n = Math.max(0, Math.floor(o.t * (o.cps || 38)));
  const lines = wrap(o.text, X + Wd - tx - 8);
  const col = gb ? GBI[0] : C.white, sh = gb ? null : (skin === 'nes' ? null : C.night);
  let used = 0;
  lines.forEach((ln, i) => { const vis = ln.slice(0, Math.max(0, n - used)); used += ln.length + 1; text(fb, vis, tx, Y + (gb ? 5 : 9) + i * (gb ? 9 : 12), col, sh); });
  const total = o.text.length;
  if (n >= total && Math.floor(o.t * 3) % 2 === 0) text(fb, '▼', X + Wd - (gb ? 10 : 14), Y + Hd - (gb ? 10 : 12), gb ? GBI[1] : C.white);
  return { n: Math.min(n, total), total };
}
// Top battle-log window
export function battleMsg(fb, s, t) {
  const w = Math.max(120, textW(s) + 24), x = Math.round((W - w) / 2);
  win(fb, x, 4, w, 17);
  const n = Math.floor(t * 45); text(fb, s.slice(0, n), x + Math.round((w - textW(s)) / 2), 9, C.white, C.night);
}

// —— Hand cursor ——
const HAND = sprFromRows([
  '.kk......',
  'kwwk.....',
  'kwwwkkkk.',
  'kwwwwwwwk',
  'kwwwwkkk.',
  'kwwwwk...',
  '.kkkk....',
], { k: C.ink, w: C.white });
export function hand(fb, x, y, t, bob = true) { fb.blit(HAND, x + (bob && Math.floor(t * 4) % 2 ? 1 : 0), y); }


// —— Command menu (battle): items, cursor row (fractional while moving), bob=false while the hero hesitates ——
export function commandWin(fb, x, y, items, cursor, t, bob = true, pick = -1, dim = -1) {
  win(fb, x, y, 92, 44);
  const pos = i => [x + 18 + (i % 2) * 40, y + 11 + Math.floor(i / 2) * 16];   // 2 × 2 grid
  items.forEach((it, i) => { const [tx, ty] = pos(i); text(fb, it, tx, ty, i === pick ? C.yellow : i === dim ? C.slate : C.white, C.night); });
  const a = Math.floor(cursor), b = Math.min(items.length - 1, a + 1), f = cursor - a, [ax, ay] = pos(a), [bx, by] = pos(b);
  hand(fb, Math.round(ax + (bx - ax) * f) - 12, Math.round(ay + (by - ay) * f), t, bob);
}
// —— Status window: name, HP bar ——
export function statusWin(fb, x, y, rows) {
  win(fb, x, y, 206, 44);
  rows.forEach((r, i) => {
    const yy = y + 9 + i * 15;
    text(fb, r.name, x + 10, yy, r.dim ? C.steel : C.white, C.night);
    text(fb, 'HP', x + 88, yy, C.silver, C.night);
    const bx = x + 104, bw = 64; fb.rect(bx - 1, yy, bw + 2, 7, C.ink); fb.rect(bx, yy + 1, bw, 5, C.night);
    const fw = Math.round(bw * r.hp); fb.rect(bx, yy + 1, fw, 3, r.c1); fb.rect(bx, yy + 4, fw, 2, r.c2);
    text(fb, String(r.val), x + 174, yy, C.white, C.night);
  });
}
