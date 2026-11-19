import * as db from './db.js';
import { openPdf } from './pdf.js';
import { parsePdf, PARSER_V } from './parse.js';
import { PEN_SIZE, strokePath, livePath, hitStroke } from './ink.js';
import { grade } from './grade.js';

export const DEFAULT_MIN = 45;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const MAX_PX = 6e6; // 캔버스 한 장 최대 픽셀 (iPad 메모리 보호). 확대 시에는 보이는 부분만 고해상도로 그림
const CIRC = '①②③④⑤';

export function newState() {
  return {
    status: 'ready', // ready | running | paused | finished
    durationMs: DEFAULT_MIN * 60000,
    remainingMs: DEFAULT_MIN * 60000,
    endAt: 0,
    marks: {},
    texts: {},
    strokes: {},
    result: null,
  };
}

export const fmt = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const HELP = `<ul class="help">
  <li><b>마킹</b>: 선지 <b>번호나 문장을 한 번 탭</b>하면 파란 동그라미로 표시됩니다. 같은 선지를 다시 탭하면 해제. 위쪽 <b>답안지</b> 버튼에서 번호를 눌러도 됩니다.</li>
  <li><b>필기</b>: 애플 펜슬로 씁니다. 펜슬로 선지를 <b>톡</b> 치면 마킹, 길게 그으면 필기입니다.</li>
  <li><b>이동</b>: 손가락 한 개로 밀기 · <b>확대/축소</b>: 손가락 두 개로 벌리기/모으기 (－ ＋ 버튼, 100% 누르면 처음 크기)</li>
  <li><b>지우개</b>: 지우개 버튼을 누르고 지울 획 위를 문지르기 (획 단위로 지워집니다)</li>
  <li><b>단답형</b>: 파란 입력칸을 눌러 키보드로 입력, Enter = 다음 칸</li>
</ul>`;

export async function openExam(root, id, goBack) {
  const rec = await db.get('papers', id);
  const buf = await db.get('files', id);
  if (!rec || !buf) return goBack();
  const doc = await openPdf(buf);
  if (rec.parsed.v !== PARSER_V) {
    // 분석 규칙이 바뀐 경우: 저장된 PDF로 조용히 다시 분석
    rec.parsed = await parsePdf(doc);
    await db.put('papers', id, rec);
  }
  const parsed = rec.parsed;
  const st = (await db.get('state', id)) || newState();

  root.innerHTML = `
  <div class="exam">
    <header class="bar">
      <button data-a="back">‹ 목록</button>
      <div class="title">${esc(rec.name)}</div>
      <div class="timer" id="timer">45:00</div>
      <div class="tools">
        <button data-a="pen" class="tool on">펜</button>
        <button data-a="eraser" class="tool">지우개</button>
        <button data-a="undo" aria-label="되돌리기">↶</button>
        <button data-a="redo" aria-label="다시">↷</button>
        <button data-a="zoomout" aria-label="축소">－</button>
        <button data-a="zoomreset" class="zl" id="zl">100%</button>
        <button data-a="zoomin" aria-label="확대">＋</button>
        <button data-a="nav">답안지</button>
        <button data-a="help" aria-label="사용법">?</button>
        <button data-a="pause">일시정지</button>
        <button data-a="submit" class="primary">제출</button>
      </div>
    </header>
    <div class="scroller" id="scroller"><div class="stack" id="stack"></div></div>
    <div class="cover" id="cover" hidden></div>
    <div class="sheet" id="sheet" hidden></div>
    <div class="toast" id="toast" hidden></div>
    <div class="ring" id="ring" hidden></div>
  </div>`;
  const $ = (q) => root.querySelector(q);
  const scroller = $('#scroller');
  const stack = $('#stack');
  const timerEl = $('#timer');
  const cover = $('#cover');
  const sheet = $('#sheet');
  const ring = $('#ring');
  const zl = $('#zl');
  const toastEl = $('#toast');

  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (toastEl.hidden = true), 1300);
  }

  /* ---------- 상태 저장 (필기 중에는 미루고, 손을 뗀 뒤 저장) ---------- */
  let saveT = 0;
  const flush = () => {
    clearTimeout(saveT);
    return db.put('state', id, st);
  };
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(function tryNow() {
      if (cur || touches.size) saveT = setTimeout(tryNow, 800);
      else flush();
    }, 1500);
  };
  const onHide = () => document.visibilityState === 'hidden' && flush();
  document.addEventListener('visibilitychange', onHide);
  addEventListener('pagehide', flush);

  /* ---------- 페이지 구성 ---------- */
  const pages = [];
  const qByN = new Map(parsed.questions.map((q) => [q.n, q]));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const maxW = Math.max(...parsed.pageSizes.map((p) => p[0]));
  let z = 1;
  let s = 1;
  const fit = () => Math.max(0.3, (scroller.clientWidth - 24) / maxW);

  for (let i = 0; i < parsed.examPages; i++) {
    const [w, h] = parsed.pageSizes[i];
    const el = document.createElement('div');
    el.className = 'page';
    const layer = document.createElement('div');
    layer.className = 'layer';
    layer.style.width = w + 'px';
    layer.style.height = h + 'px';
    el.append(layer);
    stack.append(el);
    pages.push({ i, w, h, el, layer, pdf: null, ink: null, win: null, rs: 0, visible: false, token: 0, proxy: null, choices: [], mk: [], inputs: [] });
    if (!st.strokes[i]) st.strokes[i] = [];
  }
  for (const q of parsed.questions) {
    for (const c of q.choices) {
      pages[c.p - 1]?.choices.push({ n: q.n, c: c.c, x: c.x, y: c.y, w: c.w, h: c.h, r: c.r });
    }
  }

  // 단답형 입력칸
  for (const sa of parsed.shorts) {
    const pg = pages[sa.p - 1];
    for (const f of sa.fields) {
      const k = 16 / 9.5; // iOS 입력 확대 방지: 글자 16px 유지 후 축소
      const inp = document.createElement('input');
      inp.className = 'sa';
      inp.type = 'text';
      inp.autocomplete = 'off';
      inp.autocapitalize = 'off';
      inp.spellcheck = false;
      inp.enterKeyHint = 'next';
      inp.style.left = f.x + 'px';
      inp.style.top = f.y + 'px';
      inp.style.width = f.w * k + 'px';
      inp.style.height = f.h * k + 'px';
      inp.style.transform = `scale(${1 / k})`;
      inp.value = st.texts[`${sa.id}:${f.label}`] || '';
      inp.dataset.key = `${sa.id}:${f.label}`;
      inp.addEventListener('input', () => {
        st.texts[inp.dataset.key] = inp.value;
        save();
        if (sheetKind() === 'nav') showNav(true);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const all = pages.flatMap((p) => p.inputs);
        const nx = all[all.indexOf(inp) + 1];
        nx ? nx.focus() : inp.blur();
      });
      pg.layer.append(inp);
      pg.inputs.push(inp);
      f._inp = inp;
    }
  }

  function renderMarks() {
    for (const pg of pages) {
      for (const el of pg.mk) el.remove();
      pg.mk = [];
    }
    const fin = st.status === 'finished';
    for (const q of parsed.questions) {
      const mine = st.marks[q.n];
      for (const c of q.choices) {
        const isMine = mine === c.c;
        const isAns = fin && q.answer === c.c;
        if (!isMine && !isAns) continue;
        const pg = pages[c.p - 1];
        const state = fin ? (isMine ? (q.answer === c.c ? ' ok' : ' bad') : ' key') : '';
        if (c.r && isMine) {
          const t = document.createElement('div');
          t.className = 'mkr' + state;
          t.style.cssText = `left:${c.r[0]}px;top:${c.r[1]}px;width:${c.r[2] - c.r[0]}px;height:${c.r[3] - c.r[1]}px`;
          pg.layer.prepend(t);
          pg.mk.push(t);
        }
        const d = document.createElement('div');
        d.className = 'mk' + (isMine ? ' mine' : '') + state;
        d.style.left = c.x - 3.2 + 'px';
        d.style.top = c.y - 2.4 + 'px';
        d.style.width = c.w + 6.4 + 'px';
        d.style.height = c.h + 3.4 + 'px';
        pg.layer.append(d);
        pg.mk.push(d);
      }
    }
    // 단답형: 시험 중에만 입력, 끝나면 채점 색과 정답 표시
    for (const sa of parsed.shorts) {
      for (const f of sa.fields) {
        f._inp.disabled = st.status !== 'running';
        const it = fin && (st.result?.items || []).find((x) => x.kind === 's' && x.id === sa.id && x.label === f.label);
        f._inp.classList.toggle('ok', !!it?.ok);
        f._inp.classList.toggle('bad', !!it && !it.ok);
        f._inp.title = fin ? `정답: ${f.answer ?? '?'}` : '';
      }
    }
  }

  /* ---------- 렌더링: 작은 확대는 페이지 전체, 큰 확대는 보이는 부분만 고해상도 ---------- */
  function visRect(pg, frac) {
    const r = pg.el.getBoundingClientRect();
    const v = scroller.getBoundingClientRect();
    const mx = v.width * frac, my = v.height * frac;
    return [
      Math.max(0, (v.left - mx - r.left) / s),
      Math.max(0, (v.top - my - r.top) / s),
      Math.min(pg.w, (v.right + mx - r.left) / s),
      Math.min(pg.h, (v.bottom + my - r.top) / s),
    ];
  }

  function plan(pg) {
    let rs = s * dpr;
    if (pg.w * pg.h * rs * rs <= MAX_PX) return { win: [0, 0, pg.w, pg.h], rs };
    const win = visRect(pg, 0.5);
    const area = (win[2] - win[0]) * (win[3] - win[1]);
    if (area * rs * rs > MAX_PX) rs = Math.sqrt(MAX_PX / area);
    return { win, rs };
  }

  function needsRender(pg) {
    if (!pg.pdf) return true;
    const want = plan(pg);
    if (Math.abs(pg.rs - want.rs) / want.rs > 0.03) return true;
    if (pg.win[0] === 0 && pg.win[1] === 0 && pg.win[2] === pg.w && pg.win[3] === pg.h) return false; // 전체 렌더
    const need = visRect(pg, 0.05);
    const e = 1;
    return need[0] < pg.win[0] - e || need[1] < pg.win[1] - e || need[2] > pg.win[2] + e || need[3] > pg.win[3] + e;
  }

  function place(pg) {
    if (!pg.win) return;
    const [x0, y0, x1, y1] = pg.win;
    for (const c of [pg.pdf, pg.ink, live.parentNode === pg.el ? live : null]) {
      if (!c) continue;
      c.style.left = x0 * s + 'px';
      c.style.top = y0 * s + 'px';
      c.style.width = (x1 - x0) * s + 'px';
      c.style.height = (y1 - y0) * s + 'px';
    }
  }

  function drawInk(pg, canvas) {
    const ctx = canvas.getContext('2d');
    const [x0, y0, x1, y1] = pg.win;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(pg.rs, 0, 0, pg.rs, -x0 * pg.rs, -y0 * pg.rs);
    ctx.fillStyle = '#111';
    for (const stroke of st.strokes[pg.i]) {
      const b = stroke.bb;
      if (b && (b[2] < x0 - 3 || b[0] > x1 + 3 || b[3] < y0 - 3 || b[1] > y1 + 3)) continue;
      ctx.fill(strokePath(stroke));
    }
  }

  function makeCanvas(cls, win, rs) {
    const c = document.createElement('canvas');
    c.className = cls;
    c.width = Math.max(1, Math.round((win[2] - win[0]) * rs));
    c.height = Math.max(1, Math.round((win[3] - win[1]) * rs));
    return c;
  }

  async function renderPage(pg) {
    if (!pg.visible || !needsRender(pg)) return;
    const { win, rs } = plan(pg);
    if (win[2] - win[0] < 1 || win[3] - win[1] < 1) return;
    const token = ++pg.token;
    pg.proxy ||= await doc.getPage(pg.i + 1);
    if (token !== pg.token || !pg.visible) return;
    const pdfC = makeCanvas('pdf', win, rs);
    const inkC = makeCanvas('ink', win, rs);
    pg.task?.cancel?.();
    const task = pg.proxy.render({
      canvasContext: pdfC.getContext('2d'),
      viewport: pg.proxy.getViewport({ scale: rs }),
      transform: [1, 0, 0, 1, -win[0] * rs, -win[1] * rs],
    });
    pg.task = task;
    try {
      await task.promise;
    } catch {
      return; // 취소됨
    }
    if (token !== pg.token || !pg.visible) return;
    const prev = { win: pg.win, rs: pg.rs };
    pg.win = win;
    pg.rs = rs;
    drawInk(pg, inkC);
    // 필기 중인 페이지는 캔버스를 바꾸지 않고 나중에 다시 시도
    if (cur?.pg === pg) {
      pg.win = prev.win;
      pg.rs = prev.rs;
      inkC.width = pdfC.width = 0;
      setTimeout(() => renderPage(pg), 400);
      return;
    }
    pg.pdf?.remove();
    pg.ink?.remove();
    for (const c of [pg.pdf, pg.ink]) if (c) c.width = c.height = 0;
    pg.el.prepend(pdfC);
    pdfC.after(inkC);
    pg.pdf = pdfC;
    pg.ink = inkC;
    place(pg);
  }

  function release(pg) {
    pg.token++;
    pg.task?.cancel?.();
    if (cur?.pg === pg) return;
    for (const c of [pg.pdf, pg.ink]) if (c) { c.width = c.height = 0; c.remove(); }
    pg.pdf = pg.ink = null;
    pg.win = null;
    pg.rs = 0;
  }

  let rt = 0;
  const scheduleRender = (delay = 140) => {
    clearTimeout(rt);
    rt = setTimeout(() => pages.forEach(renderPage), delay);
  };

  const io = new IntersectionObserver(
    (ents) => {
      for (const e of ents) {
        const pg = pages[[...stack.children].indexOf(e.target)];
        pg.visible = e.isIntersecting;
        pg.visible ? renderPage(pg) : release(pg);
      }
    },
    { root: scroller, rootMargin: '40% 0px' }
  );

  function applyScale(ns) {
    s = ns;
    for (const pg of pages) {
      pg.el.style.width = pg.w * s + 'px';
      pg.el.style.height = pg.h * s + 'px';
      pg.layer.style.transform = `scale(${s})`;
      place(pg);
    }
    zl.textContent = Math.round(z * 100) + '%';
  }

  function setZoom(nz, cx, cy) {
    nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nz));
    if (Math.abs(nz - z) < 1e-4) return;
    const r = (fit() * nz) / s;
    const ox = scroller.scrollLeft + cx;
    const oy = scroller.scrollTop + cy;
    z = nz;
    applyScale(fit() * z);
    scroller.scrollLeft = ox * r - cx;
    scroller.scrollTop = oy * r - cy;
    scheduleRender();
  }
  const center = () => [scroller.clientWidth / 2, scroller.clientHeight / 2];

  // 필기용 라이브 캔버스(하나를 재사용: 획마다 새로 만들면 iPad에서 끊김)
  const live = document.createElement('canvas');
  live.className = 'live';
  const lctx = live.getContext('2d', { desynchronized: true });

  applyScale(fit());
  pages.forEach((pg) => io.observe(pg.el));
  const onResize = () => {
    applyScale(fit() * z);
    scheduleRender(200);
  };
  addEventListener('resize', onResize);
  scroller.addEventListener('scroll', () => scheduleRender(160), { passive: true });

  /* ---------- 좌표 / 히트 테스트 ---------- */
  function pageAt(x, y) {
    for (const pg of pages) {
      const r = pg.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { pg, px: (x - r.left) / s, py: (y - r.top) / s };
    }
    return null;
  }

  // 번호 글자에 가까우면 그 선지, 아니면 선지 문장 영역 안이면 그 선지
  function choiceAt(x, y) {
    const hit = pageAt(x, y);
    if (!hit) return null;
    const rad = 18 / s;
    let best = null, bd = rad * rad;
    for (const c of hit.pg.choices) {
      const d = (hit.px - (c.x + c.w / 2)) ** 2 + (hit.py - (c.y + c.h / 2)) ** 2;
      if (d <= bd) { bd = d; best = c; }
    }
    if (best) return best;
    let ba = Infinity;
    for (const c of hit.pg.choices) {
      const r = c.r;
      if (!r || hit.px < r[0] || hit.px > r[2] || hit.py < r[1] || hit.py > r[3]) continue;
      const a = (r[2] - r[0]) * (r[3] - r[1]);
      if (a < ba) { ba = a; best = c; }
    }
    return best;
  }

  function setMark(n, c) {
    if (st.status !== 'running') return;
    if (st.marks[n] === c) {
      delete st.marks[n];
      toast(`${n}번 마킹 해제`);
    } else {
      st.marks[n] = c;
      toast(`${n}번 → ${CIRC[c - 1]}`);
    }
    renderMarks();
    if (sheetKind() === 'nav') showNav(true);
    save();
    navigator.vibrate?.(8);
  }

  /* ---------- 필기 / 지우개 ---------- */
  let tool = 'pen';
  const undo = [];
  const redo = [];
  const pushUndo = (a) => { undo.push(a); redo.length = 0; };
  const redrawInk = (pg) => pg.ink && drawInk(pg, pg.ink);

  let cur = null; // 진행 중인 펜/마우스 작업

  function attachLive(pg) {
    if (live.parentNode !== pg.el) pg.el.append(live);
    if (live.width !== pg.pdf.width || live.height !== pg.pdf.height) {
      live.width = pg.pdf.width;
      live.height = pg.pdf.height;
    }
    place(pg);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, live.width, live.height);
  }

  function startStroke(e, hit) {
    const pg = hit.pg;
    if (!pg.ink || !pg.pdf) return false;
    attachLive(pg);
    cur = {
      mode: 'pen', id: e.pointerId, pg,
      stroke: { size: PEN_SIZE, sim: e.pointerType !== 'pen', pts: [] },
      len: 0, t0: performance.now(), x0: e.clientX, y0: e.clientY,
      downChoice: choiceAt(e.clientX, e.clientY),
      raf: 0, box: null,
    };
    addPoints(e);
    return true;
  }

  function addPoints(e) {
    const r = cur.pg.el.getBoundingClientRect();
    const list = e.getCoalescedEvents?.() || [];
    const evs = list.length ? list : [e];
    const p = cur.stroke.pts;
    for (const ev of evs) {
      const x = (ev.clientX - r.left) / s;
      const y = (ev.clientY - r.top) / s;
      const pr = ev.pointerType === 'pen' ? Math.max(0.05, ev.pressure || 0.5) : 0.5;
      const n = p.length;
      if (n >= 3 && Math.abs(p[n - 3] - x) < 0.04 && Math.abs(p[n - 2] - y) < 0.04) continue;
      cur.len += Math.hypot(ev.clientX - (cur.lx ?? cur.x0), ev.clientY - (cur.ly ?? cur.y0));
      cur.lx = ev.clientX;
      cur.ly = ev.clientY;
      p.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(pr * 100) / 100);
      const b = cur.box;
      if (!b) cur.box = [x, y, x, y];
      else { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    }
    if (!cur.raf) cur.raf = requestAnimationFrame(paintLive);
  }

  // 획이 지나간 영역만 지우고 다시 그려 프레임 비용을 작게 유지
  function dirtyRect(pg, box) {
    const pad = PEN_SIZE * 2 + 3;
    const [x0, y0] = pg.win;
    return [(box[0] - pad - x0) * pg.rs, (box[1] - pad - y0) * pg.rs, (box[2] - box[0] + pad * 2) * pg.rs, (box[3] - box[1] + pad * 2) * pg.rs];
  }

  function paintLive() {
    if (!cur || cur.mode !== 'pen') return;
    cur.raf = 0;
    const { pg } = cur;
    const [dx, dy, dw, dh] = dirtyRect(pg, cur.box);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(dx, dy, dw, dh);
    lctx.setTransform(pg.rs, 0, 0, pg.rs, -pg.win[0] * pg.rs, -pg.win[1] * pg.rs);
    lctx.fillStyle = '#111';
    lctx.fill(livePath(cur.stroke));
  }

  function endStroke(cancelled) {
    const c = cur;
    cur = null;
    cancelAnimationFrame(c.raf);
    const { pg } = c;
    if (c.box && pg.win) {
      const [dx, dy, dw, dh] = dirtyRect(pg, c.box);
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(dx, dy, dw, dh);
    }
    live.remove();
    if (!c.stroke.pts.length || (cancelled && c.stroke.pts.length < 6)) return;
    // 번호/선지를 짧게 톡 친 경우: 필기가 아니라 마킹
    if (c.len < 6 && performance.now() - c.t0 < 350 && c.downChoice && tool === 'pen') return setMark(c.downChoice.n, c.downChoice.c);
    st.strokes[pg.i].push(c.stroke);
    pushUndo({ t: 'add', i: pg.i, stroke: c.stroke });
    if (pg.ink && pg.win) {
      const ctx = pg.ink.getContext('2d');
      ctx.setTransform(pg.rs, 0, 0, pg.rs, -pg.win[0] * pg.rs, -pg.win[1] * pg.rs);
      ctx.fillStyle = '#111';
      ctx.fill(strokePath(c.stroke));
    }
    save();
  }

  function eraseAt(x, y) {
    const hit = pageAt(x, y);
    if (!hit) return;
    const r = 9 / s;
    const arr = st.strokes[hit.pg.i];
    let removed = false;
    for (let k = arr.length - 1; k >= 0; k--) {
      if (hitStroke(arr[k], hit.px, hit.py, r)) {
        cur.removed.push({ i: hit.pg.i, stroke: arr[k], idx: k });
        arr.splice(k, 1);
        removed = true;
      }
    }
    if (removed) {
      cur.dirty.add(hit.pg);
      if (!cur.raf) cur.raf = requestAnimationFrame(() => { if (cur) { cur.raf = 0; cur.dirty.forEach(redrawInk); cur.dirty.clear(); } });
    }
  }

  function endErase() {
    const c = cur;
    cur = null;
    cancelAnimationFrame(c.raf);
    c.dirty.forEach(redrawInk);
    if (c.removed.length) {
      pushUndo({ t: 'del', items: c.removed });
      save();
    }
  }

  function doUndo() {
    const a = undo.pop();
    if (!a) return;
    if (a.t === 'add') {
      const arr = st.strokes[a.i];
      const k = arr.indexOf(a.stroke);
      if (k >= 0) arr.splice(k, 1);
      redrawInk(pages[a.i]);
    } else {
      [...a.items].sort((p, q) => p.idx - q.idx).forEach((it) => st.strokes[it.i].splice(it.idx, 0, it.stroke));
      new Set(a.items.map((it) => it.i)).forEach((i) => redrawInk(pages[i]));
    }
    redo.push(a);
    save();
  }
  function doRedo() {
    const a = redo.pop();
    if (!a) return;
    if (a.t === 'add') {
      st.strokes[a.i].push(a.stroke);
      redrawInk(pages[a.i]);
    } else {
      for (const it of a.items) {
        const arr = st.strokes[it.i];
        const k = arr.indexOf(it.stroke);
        if (k >= 0) arr.splice(k, 1);
      }
      new Set(a.items.map((it) => it.i)).forEach((i) => redrawInk(pages[i]));
    }
    undo.push(a);
    save();
  }

  /* ---------- 포인터: 펜=필기, 손가락=이동/확대/탭 ---------- */
  const touches = new Map(); // 눌려 있는 손가락
  let g = null; // 터치 제스처
  let inertia = 0;
  const penIds = new Set(); // 화면에 닿아 있는 펜
  let penSeenAt = 0; // 마지막 펜 이벤트(호버 포함)
  // 펜이 닿았거나 막 떼였거나 근처에 떠 있으면 손바닥으로 보고 터치를 무시
  const penNear = () => penIds.size > 0 || performance.now() - penSeenAt < 450;

  function stopInertia() { cancelAnimationFrame(inertia); }
  function startInertia(vx, vy) {
    stopInertia();
    const step = () => {
      if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) return;
      scroller.scrollLeft -= vx * 16;
      scroller.scrollTop -= vy * 16;
      vx *= 0.94;
      vy *= 0.94;
      inertia = requestAnimationFrame(step);
    };
    inertia = requestAnimationFrame(step);
  }
  function dropTouches() { touches.clear(); g = null; stopInertia(); }

  const canInk = () => st.status === 'running';

  scroller.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input')) return;
    document.activeElement?.blur?.();
    if (e.pointerType === 'touch') {
      if (penNear()) return; // 손바닥
      if (e.width >= 40 || e.height >= 40) return; // 큰 접촉면 = 손바닥
      if (e.isPrimary) touches.clear(); // 첫 손가락이면 남아 있던 찌꺼기 제거
      stopInertia();
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 1) {
        const now = performance.now();
        g = { mode: 'tap', x0: e.clientX, y0: e.clientY, t0: now, lx: e.clientX, ly: e.clientY, lt: now, vx: 0, vy: 0 };
      } else if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: z };
      }
      return;
    }
    // 펜 / 마우스
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'pen') {
      penIds.add(e.pointerId);
      penSeenAt = performance.now();
      dropTouches(); // 먼저 닿은 손바닥이 만든 이동/확대를 끊음
    }
    if (!canInk()) return;
    const hit = pageAt(e.clientX, e.clientY);
    if (!hit) return;
    scroller.setPointerCapture?.(e.pointerId);
    const erasing = tool === 'eraser' || (e.pointerType === 'pen' && (e.buttons & 32));
    if (erasing) {
      cur = { mode: 'erase', id: e.pointerId, removed: [], dirty: new Set(), raf: 0 };
      eraseAt(e.clientX, e.clientY);
    } else if (!startStroke(e, hit)) {
      scheduleRender(0); // 아직 그려지지 않은 페이지
    }
  });

  scroller.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'pen') penSeenAt = performance.now();
    if (e.pointerType !== 'touch') {
      if (tool === 'eraser' && canInk()) {
        ring.hidden = false;
        const d = 18;
        ring.style.cssText = `width:${d}px;height:${d}px;transform:translate(${e.clientX - d / 2}px,${e.clientY - d / 2}px)`;
      } else ring.hidden = true;
    }
    if (e.pointerType === 'touch') {
      const t = touches.get(e.pointerId);
      if (!t || !g) return;
      t.x = e.clientX;
      t.y = e.clientY;
      if (g.mode === 'pinch' && touches.size >= 2) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = scroller.getBoundingClientRect();
        setZoom(g.z0 * (d / g.d0), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (touches.size === 1) {
        if (g.mode === 'tap' && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) g.mode = 'pan';
        if (g.mode === 'pan' && g.lx === 0) { g.lx = e.clientX; g.ly = e.clientY; return; }
        if (g.mode === 'pan') {
          const now = performance.now();
          const dx = e.clientX - g.lx, dy = e.clientY - g.ly;
          scroller.scrollLeft -= dx;
          scroller.scrollTop -= dy;
          const dt = Math.max(1, now - g.lt);
          g.vx = 0.8 * g.vx + 0.2 * (dx / dt);
          g.vy = 0.8 * g.vy + 0.2 * (dy / dt);
          g.lx = e.clientX; g.ly = e.clientY; g.lt = now;
        }
      }
      return;
    }
    if (!cur || cur.id !== e.pointerId) return;
    if (cur.mode === 'pen') addPoints(e);
    else if (cur.mode === 'erase') {
      const list = e.getCoalescedEvents?.() || [];
      (list.length ? list : [e]).forEach((ev) => eraseAt(ev.clientX, ev.clientY));
    }
  });

  // 창 전체에서 손을 뗌/취소를 받아, 놓친 이벤트로 상태가 굳는 일을 막는다
  const endPointer = (e) => {
    if (e.pointerType === 'pen') {
      penIds.delete(e.pointerId);
      penSeenAt = performance.now();
    }
    if (e.pointerType === 'touch') {
      const had = touches.delete(e.pointerId);
      if (!had || !g) return;
      if (touches.size === 0) {
        const now = performance.now();
        if (g.mode === 'tap' && now - g.t0 < 400 && e.type === 'pointerup' && st.status === 'running') {
          const c = choiceAt(g.x0, g.y0);
          if (c) setMark(c.n, c.c);
        } else if (g.mode === 'pan' && now - g.lt < 80) startInertia(g.vx, g.vy);
        g = null;
      } else if (g.mode === 'pinch' && touches.size === 1) {
        g = { mode: 'pan', lx: 0, ly: 0, lt: performance.now(), vx: 0, vy: 0 }; // 남은 손가락은 이동으로
      }
      return;
    }
    if (cur && cur.id === e.pointerId) {
      if (cur.mode === 'pen') {
        if (e.type === 'pointerup' && !e.noPoint) addPoints(e);
        endStroke(e.type === 'pointercancel'); // 취소돼도 그린 만큼은 남김
      } else endErase();
    }
  };
  addEventListener('pointerup', endPointer, true);
  addEventListener('pointercancel', endPointer, true);
  scroller.addEventListener('lostpointercapture', (e) => {
    if (cur && cur.id === e.pointerId && cur.mode === 'pen') endPointer({ type: 'pointerup', pointerType: e.pointerType, pointerId: e.pointerId, clientX: 0, clientY: 0, noPoint: true });
  });
  scroller.addEventListener('pointerleave', () => (ring.hidden = true));

  // 트랙패드/마우스: Ctrl+휠 = 확대
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = scroller.getBoundingClientRect();
    setZoom(z * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  // iOS Safari 제스처 이벤트(핀치)는 페이지 확대로 번지지 않게 막음
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) scroller.addEventListener(t, (e) => e.preventDefault());

  /* ---------- 타이머 / 상태 전환 ---------- */
  const remaining = () => (st.status === 'running' ? Math.max(0, st.endAt - Date.now()) : st.remainingMs);

  function paintHeader() {
    const rem = remaining();
    timerEl.textContent = fmt(rem);
    timerEl.classList.toggle('low', st.status === 'running' && rem < 5 * 60000);
    timerEl.classList.toggle('dim', st.status !== 'running');
    root.querySelector('[data-a=pause]').hidden = st.status === 'finished';
    root.querySelector('[data-a=submit]').textContent = st.status === 'finished' ? '결과' : '제출';
    root.querySelector('[data-a=pause]').textContent = st.status === 'paused' ? '계속' : '일시정지';
  }

  function paintCover() {
    if (st.status === 'ready') {
      const minutes = Math.round(st.durationMs / 60000);
      cover.hidden = false;
      cover.innerHTML = `<div class="card">
        <h2>${esc(rec.name)}</h2>
        <p class="muted">선택형 ${parsed.questions.length}문항${parsed.shorts.length ? ` · 단답형 ${parsed.shorts.length}문항` : ''} · ${parsed.total}점${parsed.hasKey ? '' : ' · <b>정답표 없음(채점 불가)</b>'}</p>
        <label class="row">제한 시간 <input id="mins" type="number" min="1" max="300" value="${minutes}" inputmode="numeric"> 분</label>
        <button class="primary big" data-a="start">시험 시작</button>
        <div class="left">${HELP}</div>
      </div>`;
    } else if (st.status === 'paused') {
      cover.hidden = false;
      cover.innerHTML = `<div class="card"><h2>일시정지</h2><p class="muted">남은 시간 ${fmt(st.remainingMs)}</p><button class="primary big" data-a="resume">계속하기</button></div>`;
    } else cover.hidden = true;
  }

  function setStatus() {
    paintHeader();
    paintCover();
    renderMarks();
    if (sheetKind() === 'nav') showNav(true);
    scroller.classList.toggle('locked', st.status === 'ready' || st.status === 'paused');
  }

  function resume() {
    st.status = 'running';
    st.endAt = Date.now() + st.remainingMs;
    setStatus();
    flush();
  }
  function start() {
    const m = Math.max(1, Math.min(300, Number(root.querySelector('#mins')?.value) || DEFAULT_MIN));
    st.durationMs = st.remainingMs = m * 60000;
    resume();
    pages.forEach(renderPage);
  }
  function pause() {
    if (st.status !== 'running') return;
    st.remainingMs = remaining();
    st.status = 'paused';
    setStatus();
    flush();
  }
  function finish() {
    st.remainingMs = remaining();
    st.status = 'finished';
    st.finishedAt = Date.now();
    st.result = grade(parsed, st);
    document.activeElement?.blur?.();
    setStatus();
    flush();
    showResult();
  }

  const tick = setInterval(() => {
    if (st.status !== 'running') return;
    paintHeader();
    if (remaining() <= 0) finish();
  }, 250);

  /* ---------- 답안지 / 도움말 / 결과 ---------- */
  const sheetKind = () => (sheet.hidden ? '' : sheet.dataset.kind);

  function jumpTo(p, y) {
    const pg = pages[p - 1];
    scroller.scrollTo({ top: pg.el.offsetTop + y * s - 90, behavior: 'smooth' });
  }

  function showNav(keep) {
    const fin = st.status === 'finished';
    const res = st.result?.items || [];
    const keepTop = keep ? sheet.querySelector('.panel')?.scrollTop : 0;
    const rows = parsed.questions.map((q) => {
      const r = res.find((x) => x.kind === 'q' && x.n === q.n);
      const bubbles = [1, 2, 3, 4, 5]
        .map((c) => {
          const mine = st.marks[q.n] === c;
          const cls = ['bub', mine ? 'on' : '', fin && q.answer === c ? 'key' : '', fin && mine && q.answer !== c ? 'bad' : ''].join(' ');
          return `<button class="${cls}" data-mark="${q.n}:${c}" ${st.status === 'running' ? '' : 'disabled'}>${CIRC[c - 1]}</button>`;
        })
        .join('');
      return `<div class="orow ${fin ? (r?.ok ? 'ok' : 'bad') : ''}"><button class="qn" data-jump="q${q.n}">${q.n}</button>${bubbles}</div>`;
    });
    const shorts = parsed.shorts.map((sa) => {
      const filled = sa.fields.every((f) => (st.texts[`${sa.id}:${f.label}`] || '').trim());
      const okAll = fin && sa.fields.every((f) => res.find((x) => x.kind === 's' && x.id === sa.id && x.label === f.label)?.ok);
      return `<button class="cell ${fin ? (okAll ? 'ok' : 'bad') : filled ? 'done' : ''}" data-jump="s${sa.id}">단답형 ${sa.id}${filled ? ' ✓' : ''}</button>`;
    });
    const done = Object.keys(st.marks).length;
    sheet.dataset.kind = 'nav';
    sheet.hidden = false;
    sheet.innerHTML = `<div class="panel"><div class="ph"><b>답안지 · ${done}/${parsed.questions.length} 마킹</b><button data-a="closesheet">닫기</button></div>
      <p class="muted small">번호(①~⑤)를 누르면 마킹, 다시 누르면 해제. 왼쪽 문항 번호를 누르면 그 문제로 이동합니다.</p>
      <div class="omr">${rows.join('')}</div>${shorts.length ? `<div class="shorts">${shorts.join('')}</div>` : ''}</div>`;
    const panel = sheet.querySelector('.panel');
    if (keepTop) panel.scrollTop = keepTop;
  }

  function showHelp() {
    sheet.dataset.kind = 'help';
    sheet.hidden = false;
    sheet.innerHTML = `<div class="panel"><div class="ph"><b>사용법</b><button data-a="closesheet">닫기</button></div>${HELP}</div>`;
  }

  function showResult() {
    const r = st.result || grade(parsed, st);
    const wrong = r.items.filter((x) => !x.ok);
    const circ = (n) => (n ? CIRC[n - 1] : '–');
    const rows = r.items
      .map((x) => {
        const mine = x.kind === 'q' ? circ(x.mine) : esc(x.mine || '–');
        const ans = x.kind === 'q' ? circ(x.answer) : esc(x.answer ?? '?');
        return `<tr class="${x.ok ? 'ok' : 'bad'}"><td>${x.n}</td><td>${mine}</td><td>${ans}</td><td>${x.ok ? '○' : '✕'}</td></tr>`;
      })
      .join('');
    sheet.dataset.kind = 'result';
    sheet.hidden = false;
    sheet.innerHTML = `<div class="panel wide">
      <div class="ph"><b>결과</b><button data-a="closesheet">닫기</button></div>
      <div class="score"><span>${r.earned}</span> / ${r.total}점</div>
      <p class="muted center">정답 ${r.items.length - wrong.length} · 오답 ${wrong.length} · 사용 시간 ${fmt(st.durationMs - st.remainingMs)}${parsed.hasKey ? '' : ' · 정답표가 없어 채점되지 않았습니다'}</p>
      <div class="actions"><button data-a="retry">다시 풀기 (초기화)</button><button data-a="review" class="primary">시험지로 돌아가기</button></div>
      <table class="res"><thead><tr><th>문항</th><th>내 답</th><th>정답</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  async function resetAll() {
    if (!confirm('필기·마킹·기록을 모두 지우고 처음부터 다시 풉니다.')) return;
    await db.put('state', id, newState());
    cleanup();
    openExam(root, id, goBack);
  }

  function cleanup() {
    clearInterval(tick);
    clearTimeout(rt);
    clearTimeout(saveT);
    io.disconnect();
    removeEventListener('resize', onResize);
    removeEventListener('pagehide', flush);
    removeEventListener('pointerup', endPointer, true);
    removeEventListener('pointercancel', endPointer, true);
    document.removeEventListener('visibilitychange', onHide);
    stopInertia();
    pages.forEach(release);
    live.width = live.height = 0;
    doc.destroy?.();
  }

  root.querySelector('.exam').addEventListener('click', async (e) => {
    if (e.target === sheet) { sheet.hidden = true; return; } // 바깥을 누르면 닫기
    const mk = e.target.closest('[data-mark]');
    if (mk) {
      const [n, c] = mk.dataset.mark.split(':').map(Number);
      return setMark(n, c);
    }
    const j = e.target.closest('[data-jump]');
    if (j) {
      const v = j.dataset.jump;
      let p, y;
      if (v[0] === 'q') {
        const c = qByN.get(Number(v.slice(1)))?.choices[0];
        p = c?.p; y = c?.y;
      } else {
        const sa = parsed.shorts.find((a) => a.id === Number(v.slice(1)));
        p = sa?.p; y = sa?.fields[0]?.y;
      }
      if (p) { sheet.hidden = true; jumpTo(p, y); }
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'back') { await flush(); cleanup(); goBack(); }
    else if (a === 'pen' || a === 'eraser') {
      tool = a;
      root.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
      ring.hidden = true;
    }
    else if (a === 'undo') doUndo();
    else if (a === 'redo') doRedo();
    else if (a === 'zoomin') setZoom(z * 1.25, ...center());
    else if (a === 'zoomout') setZoom(z / 1.25, ...center());
    else if (a === 'zoomreset') setZoom(1, ...center());
    else if (a === 'nav') sheetKind() === 'nav' ? (sheet.hidden = true) : showNav();
    else if (a === 'help') sheetKind() === 'help' ? (sheet.hidden = true) : showHelp();
    else if (a === 'pause') st.status === 'paused' ? resume() : pause();
    else if (a === 'resume') resume();
    else if (a === 'start') start();
    else if (a === 'submit') {
      if (st.status === 'finished') return showResult();
      const left = parsed.questions.length - Object.keys(st.marks).length;
      if (confirm(left ? `아직 마킹하지 않은 문항이 ${left}개 있습니다. 제출할까요?` : '제출할까요?')) finish();
    }
    else if (a === 'closesheet' || a === 'review') sheet.hidden = true;
    else if (a === 'retry') resetAll();
  });

  setStatus();
  if (st.status === 'running' && remaining() <= 0) finish();
  window.__exam = { st, pages, parsed, get s() { return s; }, get z() { return z; }, setZoom, get live() { return live; } }; // 디버그/테스트용
}
