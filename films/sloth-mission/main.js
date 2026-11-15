// 페이지 계약: window.READY, render(t), DUR, EV, TEXTS
import { textures } from './engine/toon.js';
const cv = document.getElementById('c'), g = cv.getContext('2d');
await Promise.all(['80px Han', '40px Jua'].map(f => document.fonts.load(f)));
textures();
const film = await import('./film.js');
window.DUR = film.DUR; window.EV = film.events(); window.SRT = film.srtCues();
window.render = t => film.renderFilm(g, t);
window.TEXTS = t => film.texts(g, t);
window.READY = true;
