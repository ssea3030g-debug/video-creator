import * as db from './db.js';
import { openPdf } from './pdf.js';
import { parsePdf } from './parse.js';
import { newState, fmt } from './exam.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function addPaper(file, opts = {}) {
  const buf = await file.arrayBuffer();
  const id = await db.sha(buf);
  if (await db.get('papers', id)) return { id, dup: true }; // 같은 파일: 파싱 결과 재사용
  const doc = await openPdf(buf);
  const parsed = await parsePdf(doc);
  doc.destroy?.();
  if (!parsed.questions.length) throw new Error('문항을 찾지 못했습니다. 번호(1. 2. …)와 ①~⑤ 선지가 있는 텍스트 PDF인지 확인해 주세요.');
  await db.put('files', id, buf);
  const name = opts.name || file.name.replace(/\.pdf$/i, '');
  await db.put('papers', id, { id, name, addedAt: Date.now(), parsed, noTimer: !!opts.noTimer, src: opts.src || '' });
  return { id, dup: false, parsed };
}

// 배포에서 빠진 예전 기본 시험지(통짜 N제 등): 이미 기기에 있으면 지운다
const RETIRED = ['papers/paper-5.pdf'];

// 배포된 기본 시험지(public/papers/index.json)를 기기에 한 번만 가져온다. 지운 뒤에는 다시 가져오지 않는다.
export async function seedBuiltin(onProgress) {
  let list = [];
  try {
    list = await (await fetch('papers/index.json', { cache: 'no-cache' })).json();
  } catch {
    return;
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
      await addPaper(file, { name: item.name, noTimer: item.noTimer, src: item.file });
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

export async function openLibrary(root, go) {
  root.innerHTML = `
  <div class="lib">
    <header class="libbar"><h1>시험지</h1>
      <label class="primary filebtn">+ 시험지 추가<input id="file" type="file" accept="application/pdf,.pdf" multiple hidden></label>
    </header>
    <div id="msg" class="msg" hidden></div>
    <div id="seed" class="msg" hidden></div>
    <div id="list" class="list"></div>
    <div class="drop" id="drop">PDF를 여기에 끌어다 놓아도 됩니다</div>
  </div>`;
  const msg = root.querySelector('#msg');
  const list = root.querySelector('#list');
  const say = (t, bad) => {
    msg.hidden = !t;
    msg.textContent = t || '';
    msg.classList.toggle('bad', !!bad);
  };

  async function refresh() {
    const papers = (await db.all('papers')).sort((a, b) => b.addedAt - a.addedAt);
    if (!papers.length) {
      list.innerHTML = '<p class="empty">아직 시험지가 없습니다.<br>본문과 정답·해설이 함께 있는 PDF를 추가해 보세요.</p>';
      return;
    }
    const states = await Promise.all(papers.map((p) => db.get('state', p.id)));
    list.innerHTML = papers
      .map((p, i) => {
        const [badge, extra0] = statusText(states[i], p.noTimer);
        const extra = [p.noTimer && badge === '미시작' ? '타이머 없음' : '', extra0].filter(Boolean).join(' · ');
        const q = p.parsed;
        const warn = q.warnings.length ? `<div class="warn">⚠ ${esc(q.warnings.join(' · '))}</div>` : '';
        const action = badge === '완료' ? '결과 보기' : badge === '미시작' ? '풀기' : '이어하기';
        return `<div class="card paper" data-id="${p.id}" data-src="${esc(p.src || '')}" data-name="${esc(p.name)}">
          <div class="pt"><b>${esc(p.name)}</b><span class="badge ${badge === '완료' ? 'done' : badge === '미시작' ? '' : 'live'}">${badge}</span></div>
          <div class="muted">선택형 ${q.questions.length}${q.shorts.length ? ` · 단답형 ${q.shorts.length}` : ''} · ${q.hasKey ? `${q.total}점 · ` : ''}${q.examPages}쪽 · 정답 ${q.hasKey ? '자동 연결됨' : '없음'}${extra ? ` · ${extra}` : ''}</div>
          ${warn}
          <div class="actions"><button class="primary" data-act="open">${action}</button><button data-act="pdf">PDF 받기</button><button data-act="reset">초기화</button><button data-act="del">삭제</button></div>
        </div>`;
      })
      .join('');
  }

  async function handleFiles(files) {
    say('');
    for (const f of files) {
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { say(`${f.name}: PDF 파일만 올릴 수 있습니다.`, true); continue; }
      say(`${f.name} 분석 중…`);
      try {
        const r = await addPaper(f);
        say(r.dup ? `${f.name}: 이미 추가된 시험지입니다.` : '');
      } catch (err) {
        console.error(err);
        say(`${f.name}: ${err.message}`, true);
      }
    }
    refresh();
  }

  root.querySelector('#file').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
  const drop = root.querySelector('#drop');
  for (const ev of ['dragover', 'dragenter']) addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('on'); });
  addEventListener('dragleave', () => drop.classList.remove('on'));
  addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('on'); handleFiles([...(e.dataTransfer?.files || [])]); });

  list.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const id = e.target.closest('.paper')?.dataset.id;
    if (!act || !id) return;
    if (act === 'open') go(`#/e/${id}`);
    else if (act === 'pdf') {
      const card = e.target.closest('.paper');
      const src = card.dataset.src;
      if (src) {
        // 기본 시험지: 배포된 파일을 그대로 내려받기 (브라우저가 바로 받음)
        const a = document.createElement('a');
        a.href = src;
        a.download = `${card.dataset.name}.pdf`;
        document.body.append(a);
        a.click();
        a.remove();
      } else {
        await downloadPdf(id, card.dataset.name || 'exam');
      }
    }
    else if (act === 'reset') {
      if (confirm('이 시험지의 필기·마킹·기록을 지우고 처음 상태로 되돌립니다.')) { await db.put('state', id, newState()); refresh(); }
    } else if (act === 'del') {
      if (confirm('시험지를 삭제합니다. 필기와 기록도 함께 지워집니다.')) {
        await Promise.all([db.del('papers', id), db.del('files', id), db.del('state', id)]);
        refresh();
      }
    }
  });

  await refresh();
  const seedMsg = root.querySelector('#seed');
  seedBuiltin((t) => {
    seedMsg.hidden = !t;
    seedMsg.textContent = t;
    if (!t) refresh();
  });
}
