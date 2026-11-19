// 시험지 PDF 파서: 텍스트 레이어 좌표만 사용 (AI 호출 없음).
// 입력: pdf.js PDFDocumentProxy. 출력: 문항/선지 위치, 단답형 빈칸, 정답·배점.

const CIRC = '①②③④⑤';
const isLabel = (ch) => ch >= '㉠' && ch <= '㉻'; // ㉠~㉻ (원문자 한글)

/** y(위→아래) 기준으로 줄 묶기. 각 줄은 x순 정렬. */
function groupLines(items, tol = 2.5) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) {
      last.items.push(it);
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.s).join('');
  }
  return lines;
}

async function readPages(doc) {
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = [];
    for (const i of tc.items) {
      if (!i.str) continue;
      items.push({
        s: i.str,
        x: i.transform[4],
        y: vp.height - i.transform[5], // 베이스라인, 위→아래
        w: i.width,
        h: i.height || 9,
      });
    }
    pages.push({ p, w: vp.width, h: vp.height, items });
  }
  return pages;
}

function parseQuestions(examPages, warnings) {
  const questions = [];
  let cur = null;
  for (const pg of examPages) {
    const mid = pg.w / 2;
    // 읽는 순서: 왼쪽 단 → 오른쪽 단, 단 안에서는 위→아래
    const body = pg.items.filter((i) => i.y > 60 && i.y < pg.h - 55); // 제목·바닥글 제외
    for (const col of [0, 1]) {
      const items = body.filter((i) => (i.x < mid ? 0 : 1) === col);
      const colRight = col === 0 ? mid - 6 : pg.w - 24;
      let open = null; // 줄바꿈된 선지 문장까지 터치 영역을 넓히기 위한 현재 선지
      for (const line of groupLines(items)) {
        let header = false;
        let started = null;
        for (const it of line.items) {
          const m = /^\s*(\d{1,2})\.(?:\s|\(|$)/.exec(it.s);
          const expected = questions.length + 1;
          if (m && Number(m[1]) === expected) {
            cur = { n: expected, p: pg.p, choices: [] };
            questions.push(cur);
            header = true;
            continue;
          }
          if (!cur) continue;
          for (let k = 0; k < it.s.length; k++) {
            const ci = CIRC.indexOf(it.s[k]);
            if (ci >= 0 && ci + 1 === cur.choices.length + 1) {
              const cw = it.w / it.s.length;
              started = {
                c: ci + 1,
                p: pg.p,
                x: it.x + cw * k,
                y: it.y - it.h,
                w: cw,
                h: it.h * 1.2,
              };
              cur.choices.push(started);
            }
          }
        }
        const first = line.items.find((i) => i.s.trim());
        if (started) {
          open = started;
          open.r = [open.x - 5, open.y - 3, colRight, line.y + 3];
          open._y = line.y;
        } else if (header) {
          open = null;
        } else if (open && first && first.x > open.x + 3 && line.y - open._y < 22) {
          open.r[3] = line.y + 3;
          open._y = line.y;
        } else {
          open = null;
        }
      }
    }
  }
  for (const q of questions) {
    for (const c of q.choices) delete c._y;
    if (q.choices.length !== 5) warnings.push(`${q.n}번 선지 ${q.choices.length}개`);
  }
  return questions;
}

function parseShortBlanks(examPages, warnings) {
  const shorts = [];
  for (const pg of examPages) {
    const mid = pg.w / 2;
    const body = pg.items.filter((i) => i.y > 60 && i.y < pg.h - 55);
    for (const col of [0, 1]) {
      const items = body.filter((i) => (i.x < mid ? 0 : 1) === col);
      const lines = groupLines(items);
      for (let li = 0; li < lines.length; li++) {
        const m = /^\s*\[\s*단답형\s*(\d+)\s*\]/.exec(lines[li].text.replace(/\s+/g, ' '));
        if (!m) continue;
        const sa = { id: Number(m[1]), p: pg.p, fields: [] };
        // 헤더 아래에서 ": (   )" 빈칸이 있는 첫 줄
        const hasBlank = (its) => its.some((i) => /^\s*[:：]?\s*\(\s*$/.test(i.s));
        for (let lj = li + 1; lj < lines.length && lj < li + 25; lj++) {
          const its = lines[lj].items;
          // 다음 문제·지문·단답형 제목이 나오면 여기서 끝
          if (/^\s*\[\s*(\d+\s*~|단답형)/.test(lines[lj].text.replace(/\s+/g, ' '))) break; // [10~14] 같은 지문 제목만 (배점 [3점]은 제외)
          if (sa.fields.length && !hasBlank(its)) break;
          for (let k = 0; k < its.length; k++) {
            let it = its[k];
            let row = its;
            let from = k + 1;
            if (/^\s*[:：]\s*$/.test(it.s) && its.slice(k + 1).every((i) => !i.s.trim())) {
              // ":" 에서 줄이 바뀌고 다음 줄이 "(   )" 로 시작하는 경우
              const nx = lines[lj + 1]?.items || [];
              if (!nx.length || !/^\s*\(\s*$/.test(nx[0].s)) continue;
              it = nx[0];
              row = nx;
              from = 1;
            } else if (!/^\s*[:：]\s*\(\s*$/.test(it.s)) {
              continue; // ": (" 빈칸 시작
            }
            // 바로 앞(공백 제외)이 ㉠ 같은 라벨이어야 함
            let b = k - 1;
            while (b >= 0 && !its[b].s.trim()) b--;
            const label = b >= 0 ? [...its[b].s].find(isLabel) || '' : '';
            const close = row.slice(from).find((i) => /^\s*\)/.test(i.s));
            if (!label || !close) continue;
            const x0 = it.x + it.w + 1;
            sa.fields.push({
              label,
              x: x0,
              y: it.y - it.h - 1,
              w: Math.max(30, close.x - x0 - 1),
              h: it.h * 1.5,
            });
          }
        }
        if (!sa.fields.length) warnings.push(`단답형 ${sa.id} 빈칸 위치 미검출`);
        shorts.push(sa);
      }
    }
  }
  return shorts;
}

function parseKey(keyPages, warnings) {
  const key = {};
  const score = {};
  const shortAns = {}; // id -> {label: text}
  const shortPts = {}; // id -> 빈칸당 점수
  let mode = null;
  let pendingNums = null;
  let catNums = '';
  const catStarts = [];
  for (const pg of keyPages) {
    for (const line of groupLines(pg.items)) {
      const text = line.text.replace(/\s+/g, '');
      if (text.startsWith('정답표') || text === '정답') { mode = 'ans'; pendingNums = null; continue; }
      // 공백 없이 이어진 형식(번호/정답/배점 한 줄씩)
      if (/^번호\d/.test(text)) { mode = 'ans-cat'; catNums = text.slice(2); continue; }
      if (mode === 'ans-cat' && /^정답[①-⑤]/.test(text)) {
        const ans = [...text.slice(2)].filter((ch) => CIRC.includes(ch));
        const n = ans.length;
        // 번호열(1234…)을 연속된 수열로 맞춰 시작 번호를 찾는다
        let start = null;
        for (let st0 = 1; st0 <= 300 && start == null; st0++) {
          let acc = '';
          for (let k = 0; k < n; k++) acc += String(st0 + k);
          if (acc === catNums) start = st0;
        }
        if (start == null) { warnings.push('정답표 번호를 읽지 못함'); continue; }
        ans.forEach((ch, k) => (key[start + k] = CIRC.indexOf(ch) + 1));
        catStarts.push(start);
        continue;
      }
      if (mode === 'ans-cat' && /^배점/.test(text)) {
        const pts = text.slice(2).match(/\d+\.\d/g) || [];
        const start = catStarts[catStarts.length - 1];
        pts.forEach((v, k) => (score[start + k] = Number(v)));
        continue;
      }
      if (text.startsWith('배점표')) { mode = 'score'; pendingNums = null; continue; }
      if (/^해설/.test(text) && text.length < 6) { mode = null; continue; }
      if (!mode) continue;

      if (mode === 'ans' && /^단답형\d+[:：]/.test(text)) {
        const full = line.text.replace(/\s+/g, ' ');
        const parts = full.split(/단답형\s*(\d+)\s*[:：]/);
        for (let i = 1; i < parts.length; i += 2) {
          const id = Number(parts[i]);
          const map = {};
          const seg = parts[i + 1].replace(/\s*\/\s*$/, '');
          const re = /([㉠-㉻])\s*([^㉠-㉻]*)/g;
          let mm;
          while ((mm = re.exec(seg))) {
            map[mm[1]] = mm[2].replace(/[\s,/]+$/g, '').trim();
          }
          shortAns[id] = map;
        }
        continue;
      }
      if (mode === 'score') {
        const mm = /단답형\s*(\d+)\s*[:：]\s*[\d.]+\s*점\s*\(\s*각\s*([\d.]+)\s*점/.exec(line.text.replace(/\s+/g, ' '));
        if (mm) { shortPts[Number(mm[1])] = Number(mm[2]); continue; }
      }

      const cells = line.text.trim().split(/\s+/).filter(Boolean);
      if (!cells.length) continue;
      if (cells.every((c) => /^\d+$/.test(c))) {
        pendingNums = cells.map(Number);
      } else if (pendingNums) {
        if (mode === 'ans') {
          const ans = [...text].filter((ch) => CIRC.includes(ch));
          if (ans.length === pendingNums.length) {
            pendingNums.forEach((n, i) => (key[n] = CIRC.indexOf(ans[i]) + 1));
          } else warnings.push('정답표 줄 길이 불일치');
        } else if (mode === 'score' && cells.every((c) => /^\d+(\.\d+)?$/.test(c))) {
          if (cells.length === pendingNums.length) {
            pendingNums.forEach((n, i) => (score[n] = Number(cells[i])));
          } else warnings.push('배점표 줄 길이 불일치');
        }
        pendingNums = null;
      }
    }
  }
  return { key, score, shortAns, shortPts };
}

export const PARSER_V = 2;

export async function parsePdf(doc) {
  const pages = await readPages(doc);
  const warnings = [];
  let keyStart = pages.findIndex((pg) => /정답표|정답·해설|교사용/.test(pg.items.map((i) => i.s).join('')));
  const hasKey = keyStart >= 0;
  if (!hasKey) keyStart = pages.length;
  const examPages = pages.slice(0, keyStart);
  const keyPages = pages.slice(keyStart);

  const questions = parseQuestions(examPages, warnings);
  const shorts = parseShortBlanks(examPages, warnings);
  let key = {}, score = {}, shortAns = {}, shortPts = {};
  if (hasKey) ({ key, score, shortAns, shortPts } = parseKey(keyPages, warnings));

  for (const sa of shorts) {
    const ans = shortAns[sa.id] || {};
    const per = shortPts[sa.id] ?? 1;
    for (const f of sa.fields) {
      f.answer = ans[f.label] ?? null;
      f.pts = per;
    }
  }
  for (const q of questions) {
    q.answer = key[q.n] ?? null;
    q.pts = score[q.n] ?? 0;
  }
  const total =
    questions.reduce((s, q) => s + q.pts, 0) +
    shorts.reduce((s, a) => s + a.fields.reduce((t, f) => t + (f.pts || 0), 0), 0);

  if (hasKey) {
    const miss = questions.filter((q) => q.answer == null).length;
    if (miss) warnings.push(`정답 없는 문항 ${miss}개`);
    const missS = shorts.flatMap((a) => a.fields).filter((f) => f.answer == null).length;
    if (missS) warnings.push(`정답 없는 단답 빈칸 ${missS}개`);
  } else {
    warnings.push('정답표를 찾지 못했습니다 (채점 불가)');
  }

  return {
    v: PARSER_V,
    numPages: pages.length,
    examPages: examPages.length,
    hasKey,
    questions,
    shorts,
    total: Math.round(total * 10) / 10,
    warnings,
    pageSizes: pages.slice(0, keyStart).map((pg) => [pg.w, pg.h]),
  };
}
