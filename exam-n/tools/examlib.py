#!/usr/bin/env python3
"""문항 md 파서 공용 모듈 (check_hard.py, blind_solve.py가 쓴다). 표준 라이브러리만 사용.

문항 md 형식 (v3~v6 호환):
    ## SET 1 | [1~5] | s1.md            ← 세트 머리글(선택). 지문 파일명은 세 번째 칸
    **1. 윗글의 … 것은? [2.7점]**       ← 문항 머리글(한 줄, 굵게). '않은'은 <u>않은</u> 가능
    > <보기> 본문 (blockquote)           ← <보기>(선택)
    ① … ⑤ …                              ← 선지(한 줄에 하나)
정답키는 --key 문자열(예: 24135…), 정답표 md(`**N. ②**` 줄 또는 번호 행 + 정답 행 표),
또는 문항 md 자체에서 읽는다.
"""
import re

CIRC = "①②③④⑤"
# 극단어 오답 신호(S2): 강한 극단어는 문항당 오답 1개까지, 약한 극단어는 참고용으로만 센다.
HARD_EXTREME = ["아무런", "전혀", "오직", "오로지", "결코", "절대", "무조건", "항상",
                "완전히", "전적으로", "단지", "어떠한 경우에도"]
SOFT_EXTREME = ["반드시", "모두", "모든", "관계없이", "상관없이", "만으로"]  # 공통점 선지·한정어 기법에도 쓰여 참고용
HARD_RE = re.compile("|".join(re.escape(w) for w in HARD_EXTREME) + r"|[가-힣]에만(?![가-힣])")
SOFT_RE = re.compile("|".join(re.escape(w) for w in SOFT_EXTREME))


def strip_md(s):
    s = re.sub(r"</?u>", "", s)
    s = re.sub(r"\*\*", "", s)
    return s.strip()


def parse_questions(text):
    """-> list[dict(n, set, stem, score, neg, boggi, opts[5], line)]"""
    items, cur, cur_set = [], None, None
    for ln, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip()
        m = re.match(r"^##\s*SET\s*(\d+)\s*\|\s*(\[[^\]]*\])\s*\|\s*([^\s|]+)", line)
        if m:
            cur_set = {"id": int(m.group(1)), "range": m.group(2), "passage": m.group(3)}
            cur = None
            continue
        m = (re.match(r"^\*\*(\d+)\.\s*(.+?)\*\*\s*$", line)      # **1. 발문 [2.7점]**
             or re.match(r"^\*\*(\d+)\.\*\*\s*(.+)$", line)          # **1.** 발문 [2.7점]
             or re.match(r"^#{2,4}\s*(\d+)\.\s*(.+)$", line))           # ### 1. 발문
        if m:
            stem_raw = m.group(2)
            sm = re.search(r"\[(\d+(?:\.\d+)?)점\]", stem_raw)
            plain = strip_md(stem_raw)
            cur = {
                "n": int(m.group(1)), "set": cur_set, "line": ln,
                "score": float(sm.group(1)) if sm else None,
                "stem": re.sub(r"\s*\[\d+(?:\.\d+)?점\]", "", plain).strip(),
                "neg": bool(re.search(r"않은|않는|아닌|없는 것|적절하지", stem_raw)),
                "boggi": [], "opts": [],
            }
            items.append(cur)
            continue
        if re.match(r"^\*\*\[단답형", line) or re.match(r"^##\s", line) or line.startswith("---"):
            cur = None
            continue
        if cur is None:
            continue
        m = re.match(r"^([①②③④⑤])\s*(.+)$", line)
        if m:
            cur["opts"].append(strip_md(m.group(2)))
            continue
        if re.fullmatch(r"<\s*보\s*기\s*>", line.strip()):
            continue
        if line.startswith(">"):
            t = strip_md(line.lstrip("> ").strip())
            if t and not re.fullmatch(r"<\s*보\s*기\s*>", t):
                cur["boggi"].append(t)
        elif line.strip() and not cur["opts"]:
            cur["boggi"].append(strip_md(line))  # 인용 표시 없는 <보기>·표·그림 안내
    return [q for q in items if len(q["opts"]) == 5]


def parse_key(text, n_hint=None):
    """정답키 dict{번호: 1~5}. `**N. ②**` 줄, 번호 행 + 정답 행 표 순으로 시도."""
    key = {}
    for m in re.finditer(r"^\*\*(\d+)\.\s*([①②③④⑤])\*\*", text, re.M):
        key[int(m.group(1))] = CIRC.index(m.group(2)) + 1
    for m in re.finditer(r"^#{2,4}\s*(\d+)번\s*[—\-:]+\s*정답\s*([①②③④⑤])", text, re.M):   # ### 1번 — 정답 ③
        key.setdefault(int(m.group(1)), CIRC.index(m.group(2)) + 1)
    sec = re.search(r"^#{2,3}\s*정답표.*?$(.*?)(?=^#{1,3}\s|\Z)", text, re.M | re.S)       # ## 정답표: 1 ③ / 2 ④
    if sec:
        for m in re.finditer(r"(\d+)\s*[.:)]?\s*([①②③④⑤])", sec.group(1)):
            key.setdefault(int(m.group(1)), CIRC.index(m.group(2)) + 1)
    lines = text.splitlines()
    for i in range(len(lines) - 2):
        a, c = lines[i], lines[i + 2]
        if a.startswith("|") and c.startswith("|"):
            ha = [x.strip() for x in a.strip("|").split("|")]
            hc = [x.strip() for x in c.strip("|").split("|")]
            if ha and all(x.isdigit() for x in ha) and len(ha) == len(hc) and all(x in CIRC for x in hc):
                for h, v in zip(ha, hc):
                    key.setdefault(int(h), CIRC.index(v) + 1)
    return key


def key_from_string(s, numbers):
    """'24135…' 또는 '②④①…' 문자열을 numbers 순서대로 매핑."""
    vals = []
    for ch in s:
        if ch in CIRC:
            vals.append(CIRC.index(ch) + 1)
        elif ch in "12345":
            vals.append(int(ch))
    if len(vals) != len(numbers):
        raise SystemExit(f"--key 길이({len(vals)})와 문항 수({len(numbers)})가 다릅니다.")
    return dict(zip(numbers, vals))


def parse_levels(text):
    """해설의 `난이도: L3 (A2 B1 C1 D1 E0, 합5)` -> {번호: (L, [A,B,C,D,E], 합 또는 None)}"""
    out, cur = {}, None
    for line in text.splitlines():
        m = re.match(r"^\*\*(\d+)\.", line) or re.match(r"^#{2,4}\s*(\d+)번", line)
        if m:
            cur = int(m.group(1))
        m = re.search(r"난이도:\s*L(\d)\s*\(\s*A(\d)\s*B(\d)\s*C(\d)\s*D(\d)\s*E(\d)(?:[^)]*합\s*(\d+))?", line)
        if m and cur is not None:
            axes = [int(m.group(i)) for i in range(2, 7)]
            out[cur] = (int(m.group(1)), axes, int(m.group(7)) if m.group(7) else None)
    return out


def level_from_sum(s):
    return 1 if s <= 2 else 2 if s <= 4 else 3 if s <= 6 else 4


def norm(s):
    return re.sub(r"[^0-9A-Za-z가-힣]", "", s)


def grams(s, n=3):
    t = norm(s)
    return {t[i:i + n] for i in range(len(t) - n + 1)} if len(t) >= n else set()


def split_sentences(text):
    text = re.sub(r"^\s*>.*$", "", text, flags=re.M)  # 지문 파일 안의 <보기> 인용은 제외
    text = re.sub(r"^#.*$", "", text, flags=re.M)
    parts = re.split(r"(?<=[.?!”\"'])\s+|\n+", text)
    return [p.strip() for p in parts if len(norm(p)) >= 6]
