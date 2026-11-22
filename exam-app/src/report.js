// 약점 분석 보고서: 채점 결과를 분석 전용 세션에 그대로 넘길 수 있는 마크다운으로 만든다.
// 틀린 문항만 본문 발췌를 넣어 토큰을 아낀다. 외부로 자동 전송하지 않는다(사용자가 복사하거나 파일로 받는다).

const CIRC = '①②③④⑤';
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

export function buildReport(rec, parsed, st, result) {
  const items = result.items;
  const qItems = items.filter((x) => x.kind === 'q');
  const sItems = items.filter((x) => x.kind === 's');
  const wrongQ = qItems.filter((x) => !x.ok);
  const wrongS = sItems.filter((x) => !x.ok);
  const byN = new Map(parsed.questions.map((q) => [q.n, q]));

  // 지문별 정답률 (선택형만)
  const groups = new Map();
  for (const x of qItems) {
    const q = byN.get(x.n);
    const key = q?.passage || '-';
    const g = groups.get(key) || { ok: 0, total: 0, order: x.n };
    g.total++;
    if (x.ok) g.ok++;
    groups.set(key, g);
  }

  const time = rec.noTimer || !st.durationMs
    ? ''
    : (() => {
        const sec = Math.round((st.durationMs - st.remainingMs) / 1000);
        return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
      })();

  const lines = [];
  lines.push(`# ${rec.name} · 약점 분석 요청`);
  lines.push('');
  lines.push('아래는 제가 푼 시험의 채점 결과입니다. 이 내용을 바탕으로 분석해 주세요.');
  lines.push('');
  lines.push('## 할 일');
  lines.push('1. 틀린 문항을 유형별로 나누세요(어휘, 세부 내용 확인, 추론, 서술 방식, 적용 등).');
  lines.push('2. 반복되는 약점을 찾아 우선순위를 매기세요. 각 약점마다 내 답이 왜 매력적이었는지 한두 줄로 설명하세요.');
  lines.push('3. 같은 약점을 겨냥한 유사 문제 5개를 만드세요. 원래 시험과 같은 형식(지문 + 5지선다, 정답 하나, 해설 2~3줄)으로 쓰고, 정답이 하나뿐인지 확인하세요.');
  lines.push('4. 마지막에 다음에 공부할 순서를 세 줄로 정리하세요.');
  lines.push('');
  lines.push('## 시험 정보');
  lines.push(`- 시험지: ${rec.name}`);
  lines.push(`- 점수: ${result.earned} / ${result.total}점`);
  const marked = wrongQ.filter((x) => x.mine);
  const unmarked = wrongQ.filter((x) => !x.mine);
  lines.push(`- 선택형: 맞힘 ${qItems.length - wrongQ.length} · 틀림 ${marked.length} · 미표시 ${unmarked.length} (전체 ${qItems.length})`);
  if (sItems.length) lines.push(`- 단답형 빈칸: 맞힘 ${sItems.length - wrongS.length} · 틀림 ${wrongS.length} (전체 ${sItems.length})`);
  if (time) lines.push(`- 사용 시간: ${time}`);
  lines.push('');

  lines.push('## 틀린 선택형 문항 (답을 골랐으나 틀린 문항)');
  if (marked.length) {
    lines.push('| 번호 | 지문 | 내 답 | 정답 | 본문 발췌 |');
    lines.push('|---|---|---|---|---|');
    for (const x of marked) {
      const q = byN.get(x.n);
      lines.push(`| ${x.n} | ${cell(q?.passage || '-')} | ${CIRC[x.mine - 1]} | ${CIRC[x.answer - 1] ?? '?'} | ${cell(clip(q?.text || '', 300))} |`);
    }
  } else {
    lines.push('없음.');
  }
  lines.push('');
  if (unmarked.length) {
    lines.push(`## 풀지 않은 문항: ${unmarked.map((x) => x.n).join(', ')}`);
    lines.push('');
  }

  if (wrongS.length) {
    lines.push('## 틀린 단답형 빈칸');
    for (const x of wrongS) {
      lines.push(`- 단답형 ${x.id} ${x.label}: 내 답 "${cell(x.mine) || '(비움)'}" / 정답 "${cell(x.answer) || '?'}"`);
    }
    lines.push('');
  }

  lines.push('## 지문별 정답률 (선택형)');
  lines.push('| 지문(문항 번호) | 맞힘 / 전체 |');
  lines.push('|---|---|');
  for (const [k, g] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order)) {
    lines.push(`| ${cell(k)} | ${g.ok} / ${g.total} |`);
  }
  lines.push('');
  lines.push('> 개인 정보는 들어 있지 않습니다. 시험지 본문 발췌는 틀린 문항에만 넣었습니다.');
  return lines.join('\n');
}
