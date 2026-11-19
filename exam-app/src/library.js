import * as db from './db.js';
import { openPdf } from './pdf.js';
import { parsePdf } from './parse.js';
import { newState, fmt } from './exam.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function addPaper(file) {
  const buf = await file.arrayBuffer();
  const id = await db.sha(buf);
  if (await db.get('papers', id)) return { id, dup: true }; // 같은 파일: 파싱 결과 재사용
  const doc = await openPdf(buf);
  const parsed = await parsePdf(doc);
  doc.destroy?.();
  if (!parsed.questions.length) throw new Error('문항을 찾지 못했습니다. 번호(1. 2. …)와 ①~⑤ 선지가 있는 텍스트 PDF인지 확인해 주세요.');
  await db.put('files', id, buf);
  await db.put('papers', id, { id, name: file.name.replace(/\.pdf$/i, ''), addedAt: Date.now(), parsed });
  return { id, dup: false, parsed };
}

function statusText(st) {
  if (!st || st.status === 'ready') return ['미시작', ''];
  if (st.status === 'running') {
    const rem = Math.max(0, st.endAt - Date.now());
    return ['진행 중', `남은 ${fmt(rem)}`];
  }
  if (st.status === 'paused') return ['일시정지', `남은 ${fmt(st.remainingMs)}`];
  return ['완료', st.result ? `${st.result.earned} / ${st.result.total}점` : ''];
}

export async function openLibrary(root, go) {
  root.innerHTML = `
  <div class="lib">
    <header class="libbar"><h1>시험지</h1>
      <label class="primary filebtn">+ 시험지 추가<input id="file" type="file" accept="application/pdf,.pdf" multiple hidden></label>
    </header>
    <div id="msg" class="msg" hidden></div>
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
        const [badge, extra] = statusText(states[i]);
        const q = p.parsed;
        const warn = q.warnings.length ? `<div class="warn">⚠ ${esc(q.warnings.join(' · '))}</div>` : '';
        const action = badge === '완료' ? '결과 보기' : badge === '미시작' ? '풀기' : '이어하기';
        return `<div class="card paper" data-id="${p.id}">
          <div class="pt"><b>${esc(p.name)}</b><span class="badge ${badge === '완료' ? 'done' : badge === '미시작' ? '' : 'live'}">${badge}</span></div>
          <div class="muted">선택형 ${q.questions.length}${q.shorts.length ? ` · 단답형 ${q.shorts.length}` : ''} · ${q.total}점 · ${q.examPages}쪽 · 정답 ${q.hasKey ? '자동 연결됨' : '없음'}${extra ? ` · ${extra}` : ''}</div>
          ${warn}
          <div class="actions"><button class="primary" data-act="open">${action}</button><button data-act="reset">초기화</button><button data-act="del">삭제</button></div>
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
}
