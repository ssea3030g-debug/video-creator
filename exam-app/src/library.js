import * as db from './db.js';
import { openPdf } from './pdf.js';
import { parsePdf, PARSER_V } from './parse.js';
import { newState, fmt } from './exam.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 정답을 직접 준 시험지(글자 정보가 없는 PDF): 문항 수와 정답만 쓰고, 선지 위치는 없다 → 답안지 패널로 마킹
async function manualParsed(doc, answers) {
  const pageSizes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const v = (await doc.getPage(p)).getViewport({ scale: 1 });
    pageSizes.push([v.width, v.height]);
  }
  const per = Math.ceil(answers.length / doc.numPages);
  const questions = answers.map((a, i) => ({
    n: i + 1, p: Math.min(doc.numPages, Math.floor(i / per) + 1), choices: [], answer: a, pts: 1, passage: '', text: '',
  }));
  return {
    v: PARSER_V, numPages: doc.numPages, examPages: doc.numPages, hasKey: true, questions, shorts: [],
    total: answers.length, warnings: ['선지 위치를 찾지 못해 답안지(OMR)에서 마킹합니다'], pageSizes, manual: true,
  };
}

export async function addPaper(file, opts = {}) {
  const buf = await file.arrayBuffer();
  const id = await db.sha(buf);
  if (await db.get('papers', id)) return { id, dup: true }; // 같은 파일: 파싱 결과 재사용
  const doc = await openPdf(buf);
  const parsed = opts.answers ? await manualParsed(doc, opts.answers) : await parsePdf(doc);
  doc.destroy?.();
  if (!parsed.questions.length) throw new Error('문항을 찾지 못했습니다. 번호(1. 2. …)와 ①~⑤ 선지가 있는 텍스트 PDF인지 확인해 주세요.');
  await db.put('files', id, buf);
  const name = opts.name || file.name.replace(/\.pdf$/i, '');
  await db.put('papers', id, { id, name, addedAt: Date.now(), parsed, noTimer: !!opts.noTimer, src: opts.src || '', order: opts.order, manual: !!opts.answers, group: opts.group || 'mock', hidden: !!opts.hidden });
  return { id, dup: false, parsed };
}

// 배포에서 빠진 예전 기본 시험지(통짜 N제 등): 이미 기기에 있으면 지운다
const RETIRED = ['papers/paper-5.pdf', 'papers/paper-7.pdf', 'papers/paper-7-1.pdf', 'papers/paper-7-2.pdf', 'papers/paper-7-3.pdf', 'papers/paper-7-4.pdf', 'papers/paper-7-5.pdf'];

// 배포된 기본 시험지(public/papers/index.json)를 기기에 한 번만 가져온다. 지운 뒤에는 다시 가져오지 않는다.
export async function seedBuiltin(onProgress) {
  let list = [];
  try {
    list = await (await fetch('papers/index.json', { cache: 'no-cache' })).json();
  } catch {
    return;
  }
  // 이미 가져온 시험지의 이름이 목록과 다르면 새 이름으로 바꾼다 (예: v3 설명 추가)
  const byFile = new Map(list.map((it, i) => [it.file, { it, order: i }]));
  for (const rec of await db.all('papers')) {
    const hit = byFile.get(rec.src);
    if (!hit) continue;
    const group = hit.it.group || 'mock';
    if (hit.it.name !== rec.name || rec.order !== hit.order || rec.group !== group || !!rec.hidden !== !!hit.it.hidden) {
      await db.put('papers', rec.id, { ...rec, name: hit.it.name, order: hit.order, group, hidden: !!hit.it.hidden });
    }
  }
  for (const rec of await db.all('papers')) {
    if (RETIRED.includes(rec.src) || /^2026 독서와 작문 고난도 N제 \(156문항\)/.test(rec.name)) {
      await Promise.all([db.del('papers', rec.id), db.del('files', rec.id), db.del('state', rec.id)]);
    }
  }
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const key = `seed:${item.file}`;
    if (await db.get('state', key)) continue;
    onProgress?.(`기본 시험지 가져오는 중 (${i + 1}/${list.length})`);
    try {
      const res = await fetch(item.file, { cache: 'no-cache' });
      if (!res.ok) continue;
      const blob = await res.blob();
      const file = new File([blob], item.file.split('/').pop(), { type: 'application/pdf' });
      await addPaper(file, { name: item.name, noTimer: item.noTimer, src: item.file, order: i, answers: item.answers, group: item.group, hidden: item.hidden });
      await db.put('state', key, true);
    } catch (err) {
      console.error(err);
    }
  }
  onProgress?.('');
}

export async function downloadPdf(id, name) {
  const buf = await db.get('files', id);
  if (!buf) return;
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.pdf`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function statusText(st, noTimer) {
  if (!st || st.status === 'ready') return ['미시작', ''];
  if (st.status === 'running') {
    if (noTimer) return ['진행 중', '타이머 없음'];
    const rem = Math.max(0, st.endAt - Date.now());
    return ['진행 중', `남은 ${fmt(rem)}`];
  }
  if (st.status === 'paused') return ['일시정지', noTimer ? '' : `남은 ${fmt(st.remainingMs)}`];
  return ['완료', st.result ? `${st.result.earned} / ${st.result.total}점` : ''];
}

// 도트(픽셀) 로고: 12×12 격자
const PIX_COLOR = { k: '#1f2937', w: '#ffffff', r: '#dc2626', b: '#2563eb', y: '#f59e0b' };
const LOGO = {
  paper: [
    '............',
    '..kkkkkkkk..',
    '..kwwwwwwk..',
    '..kwrrrwwk..',
    '..kwwrwwwk..',
    '..kwrwrwwk..',
    '..kwwrwwwk..',
    '..kwwwwwwk..',
    '..kwbbbbwk..',
    '..kkkkkkkk..',
    '............',
    '............',
  ],
  nje: [
    '............',
    '..kkkkkkkk..',
    '..kbbbbbbk..',
    '..kbwwwwbk..',
    '..kbbbbbbk..',
    '..kyyyyyyk..',
    '..kyyyyyyk..',
    '..kwwwwwwk..',
    '..kbbbbbbk..',
    '..kkkkkkkk..',
    '............',
    '............',
  ],
};
function pixelLogo(name) {
  const rows = LOGO[name];
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PIX_COLOR[ch]}"/>`;
  }));
  return `<svg class="pixlogo" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

const SESSIONS = {
  mock: { title: '시험지', sub: '독서 모의고사' },
  nje: { title: 'N제', sub: '고난도 N제 (파트별)' },
};

export async function openLibrary(root, go) {
  let view = null; // null = 세션 선택, 'mock' | 'nje'
  let showHidden = false;
  root.innerHTML = `
  <div class="lib">
    <header class="libbar">
      <h1 id="title">시험지 풀이</h1>
      <div class="libbtns">
        <button id="back" hidden>‹ 세션</button>
        <label class="primary filebtn" id="addbtn">+ 시험지 추가<input id="file" type="file" accept="application/pdf,.pdf" multiple hidden></label>
      </div>
    </header>
    <div id="msg" class="msg" hidden></div>
    <div id="seed" class="msg" hidden></div>
    <div id="body"></div>
  </div>`;
  const $ = (q) => root.querySelector(q);
  const msg = $('#msg');
  const body = $('#body');
  const say = (t, bad) => {
    msg.hidden = !t;
    msg.textContent = t || '';
    msg.classList.toggle('bad', !!bad);
  };

  async function refresh() {
    const all = (await db.all('papers')).sort((a, b) => (a.order ?? 1e6) - (b.order ?? 1e6) || b.addedAt - a.addedAt);
    const groupOf = (p) => p.group || 'mock';
    $('#title').textContent = view ? SESSIONS[view].title : '시험지 풀이';
    $('#back').hidden = !view;
    $('#addbtn').hidden = view === 'nje';

    if (!view) {
      const mockN = all.filter((p) => groupOf(p) === 'mock' && !p.hidden).length;
      const njeN = all.filter((p) => groupOf(p) === 'nje').length;
      body.innerHTML = `<div class="sessions">
        <button class="sess" data-sess="mock">${pixelLogo('paper')}<b>시험지</b><span>${SESSIONS.mock.sub} · ${mockN}개</span></button>
        <button class="sess" data-sess="nje">${pixelLogo('nje')}<b>N제</b><span>${SESSIONS.nje.sub} · ${njeN}개</span></button>
      </div>`;
      return;
    }

    const shown = all.filter((p) => groupOf(p) === view && !p.hidden);
    const hidden = all.filter((p) => groupOf(p) === view && p.hidden);
    const cards = async (list) => {
      if (!list.length) return '<p class="empty">아직 시험지가 없습니다.</p>';
      const states = await Promise.all(list.map((p) => db.get('state', p.id)));
      return list.map((p, i) => {
        const q = p.parsed;
        const [badge, extra0] = statusText(states[i], p.noTimer);
        const extra = [p.noTimer && badge === '미시작' ? '타이머 없음' : '', extra0].filter(Boolean).join(' · ');
        const warn = q.warnings.length ? `<div class="warn">⚠ ${esc(q.warnings.join(' · '))}</div>` : '';
        const action = badge === '완료' ? '결과 보기' : badge === '미시작' ? '풀기' : '이어하기';
        return `<div class="card paper" data-id="${p.id}" data-src="${esc(p.src || '')}" data-name="${esc(p.name)}">
          <div class="pt"><b>${esc(p.name)}</b><span class="badge ${badge === '완료' ? 'done' : badge === '미시작' ? '' : 'live'}">${badge}</span></div>
          <div class="muted">선택형 ${q.questions.length}${q.shorts.length ? ` · 단답형 ${q.shorts.length}` : ''} · ${q.hasKey ? `${q.total}점 · ` : ''}${q.examPages}쪽 · 정답 ${q.hasKey ? '자동 연결됨' : '없음'}${extra ? ` · ${extra}` : ''}</div>
          ${warn}
          <div class="actions"><button class="primary" data-act="open">${action}</button><button data-act="pdf">PDF 받기</button><button data-act="reset">초기화</button><button data-act="del">삭제</button></div>
        </div>`;
      }).join('');
    };
    let html = await cards(shown);
    if (view === 'mock') {
      html += `<p class="muted small todo">준비 중: v6 보완 (파일이 올라오면 추가됩니다)</p>`;
      if (hidden.length) {
        html += `<button class="ghost" data-act="toggle-hidden">${showHidden ? '보완 전 시험지 숨기기' : `보완 전 시험지 보기 (${hidden.length})`}</button>`;
        if (showHidden) html += `<h3 class="sub">보완 전 시험지</h3>` + (await cards(hidden));
      }
    }
    body.innerHTML = html;
  }

  body.addEventListener('click', async (e) => {
    const sess = e.target.closest('[data-sess]')?.dataset.sess;
    if (sess) { view = sess; showHidden = false; say(''); return refresh(); }
    if (e.target.closest('[data-act=toggle-hidden]')) { showHidden = !showHidden; return refresh(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    const card = e.target.closest('.paper');
    const id = card?.dataset.id;
    if (!act || !id) return;
    if (act === 'open') go(`#/e/${id}`);
    else if (act === 'pdf') {
      const src = card.dataset.src;
      if (src) {
        const a = document.createElement('a');
        a.href = src;
        a.download = `${card.dataset.name}.pdf`;
        document.body.append(a);
        a.click();
        a.remove();
      } else {
        await downloadPdf(id, card.dataset.name || 'exam');
      }
    } else if (act === 'reset') {
      if (confirm('이 시험지의 필기·마킹·기록을 지우고 처음 상태로 되돌립니다.')) { await db.put('state', id, newState()); refresh(); }
    } else if (act === 'del') {
      if (confirm('시험지를 삭제합니다. 필기와 기록도 함께 지워집니다.')) {
        await Promise.all([db.del('papers', id), db.del('files', id), db.del('state', id)]);
        refresh();
      }
    }
  });

  $('#back').addEventListener('click', () => { view = null; say(''); refresh(); });

  async function handleFiles(files) {
    say('');
    for (const f of files) {
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { say(`${f.name}: PDF 파일만 올릴 수 있습니다.`, true); continue; }
      say(`${f.name} 분석 중…`);
      try {
        const r = await addPaper(f, { group: 'mock' });
        say(r.dup ? `${f.name}: 이미 추가된 시험지입니다.` : '');
      } catch (err) {
        console.error(err);
        say(`${f.name}: ${err.message}`, true);
      }
    }
    refresh();
  }
  $('#file').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
  addEventListener('drop', (e) => { if (view === 'mock') { e.preventDefault(); handleFiles([...(e.dataTransfer?.files || [])]); } });
  addEventListener('dragover', (e) => { if (view === 'mock') e.preventDefault(); });

  await refresh();
  const seedMsg = $('#seed');
  seedBuiltin((t) => {
    seedMsg.hidden = !t;
    seedMsg.textContent = t;
    if (!t) refresh();
  });
}
