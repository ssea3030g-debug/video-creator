import './style.css';
import { openLibrary } from './library.js';
import { openExam } from './exam.js';

const app = document.getElementById('app');
const go = (h) => (location.hash = h);

function route() {
  const m = /^#\/e\/(\w+)/.exec(location.hash);
  app.innerHTML = '';
  if (m) openExam(app, m[1], () => go('#/'));
  else openLibrary(app, go);
}
addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
