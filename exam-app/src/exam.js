import * as db from './db.js';
import { openPdf } from './pdf.js';
import { PEN_SIZE, strokePath, livePath, hitStroke } from './ink.js';
import { grade } from './grade.js';

export const DEFAULT_MIN = 45;
const MAX_ZOOM = 3;
const MAX_PX = 9e6; // 캔버스 한 장 최대 픽셀 (iPad 메모리 보호)

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

export async function openExam(root, id, goBack) {
  const rec = await db.get('papers', id);
  const buf = await db.get('files', id);
  if (!rec || !buf) return goBack();
  const parsed = rec.parsed;
  const st = (await db.get('state', id)) || newState();
  const doc = await openPdf(buf);

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
        <span class="zl" id="zl">100%</span>
        <button data-a="zoomin" aria-label="확대">＋</button>
        <button data-a="nav">문항</button>
        <button data-a="pause">일시정지</button>
        <button data-a="submit" class="primary">제출</button>
      </div>
    </header>
    <div class="scroller" id="scroller"><div class="stack" id="stack"></div></div>
    <div class="cover" id="cover" hidden></div>
    <div class="sheet" id="sheet" hidden></div>
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

  /* ---------- 상태 저장 ---------- */
  let saveT = 0;
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(flush, 700);
  };
  const flush = () => {
    clearTimeout(saveT);
    return db.put('state', id, JSON.parse(JSON.stringify(st)));
  };
  const onHide = () => document.visibilityState === 'hidden' && flush();
  document.addEventListener('visibilitychange', onHide);
  addEventListener('pagehide', flush);

  /* ---------- 페이지 구성 ---------- */
  const pages = [];
  const marksByQ = new Map(); // n -> question
  parsed.questions.forEach((q) => marksByQ.set(q.n, q));
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
    const pg = { i, w, h, el, layer, pdf: null, ink: null, rs: 0, visible: false, token: 0, proxy: null, choices: [], mk: new Map(), inputs: [] };
    pages.push(pg);
    if (!st.strokes[i]) st.strokes[i] = [];
  }
  for (const q of parsed.questions) {
    for (const c of q.choices) {
      const pg = pages[c.p - 1];
      if (pg) pg.choices.push({ n: q.n, c: c.c, x: c.x, y: c.y, w: c.w, h: c.h });
    }
  }

  // 마킹 표시 / 단답형 입력칸 (레이어는 pt 단위를 scale로 확대)
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
        refreshNav();
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
      for (const el of pg.mk.values()) el.remove();
      pg.mk.clear();
    }
    const fin = st.status === 'finished';
    for (const q of parsed.questions) {
      const mine = st.marks[q.n];
      for (const c of q.choices) {
        const isMine = mine === c.c;
        const isAns = fin && q.answer === c.c;
        if (!isMine && !isAns) continue;
        const pg = pages[c.p - 1];
        const d = document.createElement('div');
        d.className = 'mk' + (isMine ? ' mine' : '') + (fin ? (isMine ? (q.answer === c.c ? ' ok' : ' bad') : ' key') : '');
        d.style.left = c.x - 3.2 + 'px';
        d.style.top = c.y - 2.4 + 'px';
        d.style.width = c.w + 6.4 + 'px';
        d.style.height = c.h + 3.4 + 'px';
        pg.layer.append(d);
        pg.mk.set(`${q.n}:${c.c}${isMine ? 'm' : 'a'}`, d);
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

  /* ---------- 렌더링 ---------- */
  const targetRs = (pg) => Math.min(s * dpr, Math.sqrt(MAX_PX / (pg.w * pg.h)));

  function drawInk(pg, canvas, rs) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(rs, 0, 0, rs, 0, 0);
    ctx.fillStyle = '#111';
    for (const stroke of st.strokes[pg.i]) ctx.fill(strokePath(stroke));
  }

  function makeCanvas(cls, pg, rs) {
    const c = document.createElement('canvas');
    c.className = cls;
    c.width = Math.round(pg.w * rs);
    c.height = Math.round(pg.h * rs);
    return c;
  }

  async function renderPage(pg) {
    if (!pg.visible) return;
    const rs = targetRs(pg);
    if (pg.rs && Math.abs(pg.rs - rs) / rs < 0.03) return;
    const token = ++pg.token;
    pg.proxy ||= await doc.getPage(pg.i + 1);
    if (token !== pg.token || !pg.visible) return;
    const pdfC = makeCanvas('pdf', pg, rs);
    const inkC = makeCanvas('ink', pg, rs);
    const task = pg.proxy.render({ canvasContext: pdfC.getContext('2d'), viewport: pg.proxy.getViewport({ scale: rs }) });
    pg.task?.cancel?.();
    pg.task = task;
    try {
      await task.promise;
    } catch {
      return; // 취소됨
    }
    if (token !== pg.token || !pg.visible) return;
    drawInk(pg, inkC, rs);
    pg.pdf?.remove();
    pg.ink?.remove();
    pg.el.prepend(pdfC);
    pdfC.after(inkC);
    pg.pdf = pdfC;
    pg.ink = inkC;
    pg.rs = rs;
  }

  function release(pg) {
    pg.token++;
    pg.task?.cancel?.();
    for (const c of [pg.pdf, pg.ink]) if (c) { c.width = c.height = 0; c.remove(); }
    pg.pdf = pg.ink = null;
    pg.rs = 0;
  }

  let rt = 0;
  const scheduleRender = (delay = 120) => {
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
    { root: scroller, rootMargin: '60% 0px' }
  );

  function applyScale(ns) {
    s = ns;
    for (const pg of pages) {
      pg.el.style.width = pg.w * s + 'px';
      pg.el.style.height = pg.h * s + 'px';
      pg.layer.style.transform = `scale(${s})`;
    }
    zl.textContent = Math.round(z * 100) + '%';
  }

  function setZoom(nz, cx, cy) {
    nz = Math.max(1, Math.min(MAX_ZOOM, nz));
    if (nz === z) return;
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

  applyScale(fit());
  pages.forEach((pg) => io.observe(pg.el));
  const onResize = () => {
    applyScale(fit() * z);
    scheduleRender(200);
  };
  addEventListener('resize', onResize);

  /* ---------- 좌표 / 히트 테스트 ---------- */
  function pageAt(x, y) {
    for (const pg of pages) {
      const r = pg.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { pg, px: (x - r.left) / s, py: (y - r.top) / s };
    }
    return null;
  }

  function choiceAt(x, y) {
    const hit = pageAt(x, y);
    if (!hit) return null;
    const rad = 16 / s; // 약 16 css px
    let best = null, bd = rad * rad;
    for (const c of hit.pg.choices) {
      const d = (hit.px - (c.x + c.w / 2)) ** 2 + (hit.py - (c.y + c.h / 2)) ** 2;
      if (d <= bd) { bd = d; best = c; }
    }
    return best;
  }

  function toggleMark(c) {
    if (st.status !== 'running') return;
    if (st.marks[c.n] === c.c) delete st.marks[c.n];
    else st.marks[c.n] = c.c;
    renderMarks();
    refreshNav();
    save();
    navigator.vibrate?.(8);
  }

  /* ---------- 필기 / 지우개 ---------- */
  let tool = 'pen';
  const undo = [];
  const redo = [];
  const pushUndo = (a) => { undo.push(a); redo.length = 0; };
  const redrawInk = (pg) => {
    if (!pg.ink) return;
    const ctx = pg.ink.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pg.ink.width, pg.ink.height);
    drawInk(pg, pg.ink, pg.rs);
  };

  let cur = null; // 진행 중인 포인터 작업
  let penDown = false;
  let penUpAt = 0;

  function startStroke(e, hit) {
    const pg = hit.pg;
    if (!pg.ink) return;
    const live = makeCanvas('live', pg, pg.rs);
    pg.el.append(live);
    cur = {
      mode: 'pen', id: e.pointerId, pg, live,
      ctx: live.getContext('2d'),
      stroke: { size: PEN_SIZE, sim: e.pointerType !== 'pen', pts: [] },
      len: 0, t0: performance.now(), x0: e.clientX, y0: e.clientY,
      downChoice: choiceAt(e.clientX, e.clientY),
      raf: 0,
    };
    addPoints(e);
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
      if (n >= 3) cur.len += Math.hypot(ev.clientX - (cur.lx ?? cur.x0), ev.clientY - (cur.ly ?? cur.y0));
      cur.lx = ev.clientX;
      cur.ly = ev.clientY;
      p.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(pr * 100) / 100);
    }
    if (!cur.raf) cur.raf = requestAnimationFrame(paintLive);
  }

  function paintLive() {
    if (!cur || cur.mode !== 'pen') return;
    cur.raf = 0;
    const { ctx, live, pg } = cur;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, live.width, live.height);
    ctx.setTransform(pg.rs, 0, 0, pg.rs, 0, 0);
    ctx.fillStyle = '#111';
    ctx.fill(livePath(cur.stroke));
  }

  function endStroke(cancel) {
    const c = cur;
    cur = null;
    cancelAnimationFrame(c.raf);
    c.live.width = c.live.height = 0;
    c.live.remove();
    if (cancel || !c.stroke.pts.length) return;
    // 번호 위를 짧게 톡 친 경우: 필기가 아니라 마킹
    if (c.len < 6 && performance.now() - c.t0 < 350 && c.downChoice) return toggleMark(c.downChoice);
    st.strokes[c.pg.i].push(c.stroke);
    pushUndo({ t: 'add', i: c.pg.i, stroke: c.stroke });
    if (c.pg.ink) {
      const ctx = c.pg.ink.getContext('2d');
      ctx.setTransform(c.pg.rs, 0, 0, c.pg.rs, 0, 0);
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
      if (!cur.raf) cur.raf = requestAnimationFrame(() => { cur && (cur.raf = 0, cur.dirty.forEach(redrawInk), cur.dirty.clear()); });
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
  const touches = new Map();
  let g = null; // 터치 제스처
  let inertia = 0;

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

  const canInk = () => st.status === 'running';

  scroller.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input')) return;
    document.activeElement?.blur?.();
    if (e.pointerType === 'touch') {
      if (penDown || performance.now() - penUpAt < 350) return; // 손바닥 무시
      stopInertia();
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 1) {
        g = { mode: 'tap', x0: e.clientX, y0: e.clientY, t0: performance.now(), lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 };
      } else if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: z };
      }
      return;
    }
    // 펜 / 마우스
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'pen') penDown = true;
    if (!canInk()) return;
    const hit = pageAt(e.clientX, e.clientY);
    if (!hit) return;
    scroller.setPointerCapture(e.pointerId);
    const erasing = tool === 'eraser' || (e.pointerType === 'pen' && (e.buttons & 32));
    if (erasing) {
      cur = { mode: 'erase', id: e.pointerId, removed: [], dirty: new Set(), raf: 0 };
      eraseAt(e.clientX, e.clientY);
    } else {
      startStroke(e, hit);
    }
  });

  scroller.addEventListener('pointermove', (e) => {
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
      if (g.mode === 'pinch' && touches.size === 2) {
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

  const up = (e) => {
    if (e.pointerType === 'touch') {
      const had = touches.delete(e.pointerId);
      if (!had || !g) return;
      if (touches.size === 0) {
        if (g.mode === 'tap' && performance.now() - g.t0 < 400 && st.status === 'running') {
          const c = choiceAt(g.x0, g.y0);
          if (c) toggleMark(c);
        } else if (g.mode === 'pan' && performance.now() - g.lt < 80) startInertia(g.vx, g.vy);
        g = null;
      } else if (g.mode === 'pinch') g = { mode: 'pan', lx: 0, ly: 0, lt: performance.now(), vx: 0, vy: 0 }; // 남은 손가락은 이동으로
      return;
    }
    if (e.pointerType === 'pen') { penDown = false; penUpAt = performance.now(); }
    if (cur && cur.id === e.pointerId) {
      const c = cur;
      if (c.mode === 'pen') {
        if (e.type === 'pointerup') addPoints(e);
        endStroke(e.type === 'pointercancel');
      } else endErase();
    }
  };
  scroller.addEventListener('pointerup', up);
  scroller.addEventListener('pointercancel', up);
  scroller.addEventListener('pointerleave', () => (ring.hidden = true));

  // 트랙패드/마우스: Ctrl+휠 = 확대
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = scroller.getBoundingClientRect();
    setZoom(z * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

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
        <p class="muted small">시작하면 시험지가 보이고 타이머가 흐릅니다. 선지 번호를 탭하면 마킹, 펜슬로 필기합니다.</p>
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
    refreshNav();
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

  /* ---------- 문항 이동 / 결과 ---------- */
  function jumpTo(c) {
    const pg = pages[c.p - 1];
    const top = pg.el.offsetTop + c.y * s - 90;
    scroller.scrollTo({ top, behavior: 'smooth' });
  }

  function refreshNav() {
    if (sheet.hidden || sheet.dataset.kind !== 'nav') return;
    showNav(true);
  }

  function showNav(keep) {
    const fin = st.status === 'finished';
    const res = st.result?.items || [];
    const cells = parsed.questions.map((q) => {
      const r = res.find((x) => x.kind === 'q' && x.n === q.n);
      const cls = fin ? (r?.ok ? 'ok' : 'bad') : st.marks[q.n] ? 'done' : '';
      return `<button class="cell ${cls}" data-jump="q${q.n}">${q.n}<small>${st.marks[q.n] ? '①②③④⑤'[st.marks[q.n] - 1] : ''}</small></button>`;
    });
    for (const sa of parsed.shorts) {
      const filled = sa.fields.every((f) => (st.texts[`${sa.id}:${f.label}`] || '').trim());
      const okAll = fin && sa.fields.every((f) => res.find((x) => x.kind === 's' && x.id === sa.id && x.label === f.label)?.ok);
      cells.push(`<button class="cell ${fin ? (okAll ? 'ok' : 'bad') : filled ? 'done' : ''}" data-jump="s${sa.id}">단${sa.id}</button>`);
    }
    const done = Object.keys(st.marks).length;
    sheet.dataset.kind = 'nav';
    sheet.hidden = false;
    sheet.innerHTML = `<div class="panel"><div class="ph"><b>문항 ${done}/${parsed.questions.length} 마킹</b><button data-a="closesheet">닫기</button></div><div class="grid">${cells.join('')}</div></div>`;
    if (!keep) sheet.scrollTop = 0;
  }

  function showResult() {
    const r = st.result || grade(parsed, st);
    const wrong = r.items.filter((x) => !x.ok);
    const circ = (n) => (n ? '①②③④⑤'[n - 1] : '–');
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
    doneCleanup();
    openExam(root, id, goBack);
  }

  /* ---------- 버튼 ---------- */
  function doneCleanup() {
    clearInterval(tick);
    clearTimeout(rt);
    io.disconnect();
    removeEventListener('resize', onResize);
    removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onHide);
    stopInertia();
    pages.forEach(release);
    doc.destroy?.();
  }

  root.querySelector('.exam').addEventListener('click', async (e) => {
    const j = e.target.closest('[data-jump]');
    if (j) {
      const v = j.dataset.jump;
      const c = v[0] === 'q' ? marksByQ.get(Number(v.slice(1)))?.choices[0] : { p: parsed.shorts.find((a) => a.id === Number(v.slice(1)))?.p, y: parsed.shorts.find((a) => a.id === Number(v.slice(1)))?.fields[0]?.y };
      if (c?.p) { sheet.hidden = true; jumpTo(c); }
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'back') { await flush(); doneCleanup(); goBack(); }
    else if (a === 'pen' || a === 'eraser') {
      tool = a;
      root.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
      ring.hidden = true;
    }
    else if (a === 'undo') doUndo();
    else if (a === 'redo') doRedo();
    else if (a === 'zoomin') setZoom(z * 1.25, ...center());
    else if (a === 'zoomout') setZoom(z / 1.25, ...center());
    else if (a === 'nav') (sheet.hidden || sheet.dataset.kind !== 'nav') ? showNav() : (sheet.hidden = true);
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
  window.__exam = { st, pages, parsed, get s() { return s; }, setZoom }; // 디버그/테스트용
}
