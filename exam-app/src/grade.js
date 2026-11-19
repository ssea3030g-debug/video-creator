// 채점: 선택형은 번호 비교, 단답형은 공백·문장부호를 지운 문자열 비교
export const norm = (s) =>
  (s || '').normalize('NFC').toLowerCase().replace(/[\s.,·'"‘’“”`()\[\]{}<>~\-_/]/g, '');

export function grade(parsed, st) {
  const items = [];
  let earned = 0;
  for (const q of parsed.questions) {
    const mine = st.marks[q.n] ?? null;
    const ok = q.answer != null && mine === q.answer;
    if (ok) earned += q.pts;
    items.push({ kind: 'q', n: q.n, mine, answer: q.answer, ok, pts: q.pts });
  }
  for (const sa of parsed.shorts) {
    for (const f of sa.fields) {
      const mine = st.texts[`${sa.id}:${f.label}`] || '';
      const ok = f.answer != null && norm(mine) !== '' && norm(mine) === norm(f.answer);
      if (ok) earned += f.pts;
      items.push({ kind: 's', n: `단${sa.id}${f.label}`, id: sa.id, label: f.label, mine, answer: f.answer, ok, pts: f.pts });
    }
  }
  return { earned: Math.round(earned * 10) / 10, total: parsed.total, items };
}
