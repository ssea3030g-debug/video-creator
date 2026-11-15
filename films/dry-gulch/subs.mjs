// subs.mjs — export dry-gulch.srt from window.SUBS (the same data as the burned-in boxes). Run from the library root: node <project>/subs.mjs <project>
import fs from 'fs'; import path from 'path';
const demo = path.resolve(process.argv[2]);
const { openDemo, closeServer } = await import(path.resolve(process.env.LIB || '.', 'core/render/page.mjs'));
const { browser, page } = await openDemo(demo, { gl: false });
const subs = (await page.evaluate(() => window.SUBS)).sort((a, b) => a.t0 - b.t0);
const ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
fs.writeFileSync(path.join(demo, 'dry-gulch.srt'), subs.map((s, i) => `${i + 1}\n${ts(s.t0)} --> ${ts(s.t1)}\n${s.text}\n`).join('\n'));
console.log('srt', subs.length); await browser.close(); closeServer();
