#!/usr/bin/env python3
"""calib_report.py — blind_solve/check_hard 결과 JSON을 모아 자료별 비교표와 문항별 JSON(본문 없음)을 만든다.

사용: python3 -I calib_report.py <작업폴더> <출력폴더>
  작업폴더에 mid.json v2.json pilot.json (blind_solve --out), hard_mid.json hard_v2.json hard_pilot.json (check_hard --json),
  mid/questions.md v2/questions.md 가 있다고 가정(경로는 아래 CFG). 문항·지문 본문은 출력에 넣지 않는다.
"""
import collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from examlib import grams, parse_questions

W, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
PART = {  # 문항 번호 구간 -> 파트
    "mid": [(1, 8, "인문"), (9, 16, "법"), (17, 25, "과학"), (26, 33, "예술")],
    "v2": [(1, 9, "인문"), (10, 17, "법"), (18, 26, "과학"), (27, 33, "예술")],
    "pilot": [(1, 4, "인문")],
}
EXCL = {"mid": {13: "표", 19: "표", 20: "그림", 24: "기호 깨짐"}, "v2": {}, "pilot": {}}
QMD = {"mid": f"{W}/midout/questions.md", "v2": f"{W}/v2out/questions.md", "pilot": None}
CIRC = "①②③④⑤"


def band(s):
    return "L1" if s <= 2.5 else "L2" if s <= 2.9 else "L3" if s <= 3.2 else "L4"


def part_of(ex, n):
    return next(p for a, b, p in PART[ex] if a <= n <= b)


def centroid(opts):
    g = [grams(o, 2) for o in opts]
    sc = []
    for i in range(5):
        sims = [len(g[i] & g[j]) / max(1, len(g[i] | g[j])) for j in range(5) if j != i]
        sc.append(sum(sims) / 4)
    return sc


def load(ex):
    blind = json.load(open(f"{W}/res/{ex}.json", encoding="utf-8"))
    hard = json.load(open(f"{W}/res/hard_{ex}.json", encoding="utf-8"))
    hrow = {r["n"]: r for r in hard["rows"]}
    qs = {}
    if QMD[ex]:
        qs = {q["n"]: q for q in parse_questions(open(QMD[ex], encoding="utf-8").read())}
    rows = []
    for r in blind["results"]:
        n = r["n"]
        h = hrow.get(n, {})
        np_, pp = r.get("nopassage") or {}, r.get("passage") or {}
        q = qs.get(n)
        row = {"n": n, "part": part_of(ex, n), "score": h.get("score"), "band": band(h["score"]) if h.get("score") else None,
               "boggi": h.get("boggi"), "neg": h.get("neg"), "key": r["key"],
               "s5_ans": np_.get("_ans"), "s5_conf": np_.get("_conf"), "s6_ans": pp.get("_ans"), "s6_conf": pp.get("_conf"),
               "s1": h.get("s1"), "s1_wrong_mean": h.get("s1_wrong_mean"), "len_rank": h.get("rank"), "vocab": h.get("vocab"),
               "ext": h.get("ext"), "signals": hard["flags"].get(str(n), []) if isinstance(hard["flags"], dict) else [],
               "excluded": EXCL[ex].get(n)}
        if q:
            c = centroid(q["opts"])
            row["centroid_max"] = c.index(max(c)) + 1
            row["centroid_min"] = c.index(min(c)) + 1
        rows.append(row)
    return rows, blind["models"]


def pct(a, b):
    return f"{a}/{b} ({a / b:.0%})" if b else "-"


def stats(rows):
    ok = [r for r in rows if not r["excluded"] and r["s5_ans"] is not None]
    hi = sum(1 for r in ok if r["s5_ans"] == r["key"] and (r["s5_conf"] or 0) >= 4)
    c5 = sum(1 for r in ok if r["s5_ans"] == r["key"] and r["s5_conf"] == 5)
    cor = sum(1 for r in ok if r["s5_ans"] == r["key"])
    wr_hi = sum(1 for r in ok if r["s5_ans"] != r["key"] and (r["s5_conf"] or 0) >= 4)
    return len(ok), hi, c5, cor, wr_hi


def main():
    data = {ex: load(ex) for ex in ("mid", "v2", "pilot")}
    names = {"mid": "중간고사(기준점)", "v2": "v2(최상)", "pilot": "파일럿"}
    md = ["## 자료별 S5(지문 없이) 비교", "",
          "| 자료 | 모델 | 풀린 문항 | 확신≥4 맞힘 | 확신5 맞힘 | 맞힘(확신 무관) | 확신≥4 틀림 |", "|---|---|---|---|---|---|---|"]
    for ex, (rows, models) in data.items():
        n, hi, c5, cor, wr = stats(rows)
        md.append(f"| {names[ex]} | {','.join(models)} | {n} | {pct(hi, n)} | {pct(c5, n)} | {pct(cor, n)} | {pct(wr, n)} |")
    for title, keyf, order in (("파트별", lambda r: r["part"], ["인문", "법", "과학", "예술"]),
                               ("배점대별(L1 2.4~2.5 / L2 2.6~2.9 / L3 3.0~3.2 / L4 3.3)", lambda r: r["band"], ["L1", "L2", "L3", "L4"]),
                               ("발문 유형('않은' 여부)", lambda r: "않은" if r["neg"] else "긍정", ["긍정", "않은"]),
                               ("<보기> 유무", lambda r: "보기" if r["boggi"] else "일반", ["보기", "일반"])):
        md += ["", f"## S5 확신≥4 맞힘 — {title}", "", "| 자료 | " + " | ".join(order) + " |", "|---|" + "---|" * len(order)]
        for ex, (rows, _) in data.items():
            cells = []
            for k in order:
                sub = [r for r in rows if keyf(r) == k]
                n, hi, c5, cor, _ = stats(sub)
                cells.append(f"{hi}/{n} (5:{c5}, 맞힘:{cor})" if n else "-")
            md.append(f"| {names[ex]} | " + " | ".join(cells) + " |")
    md += ["", "## 긍정 발문 × <보기> 유무 (S5 확신≥4 맞힘)", "", "| 자료 | 긍정+보기 | 긍정+일반 |", "|---|---|---|"]
    for ex, (rows, _) in data.items():
        cells = []
        for b in (True, False):
            sub = [r for r in rows if not r["neg"] and bool(r["boggi"]) == b]
            n, hi, c5, cor, _ = stats(sub)
            cells.append(f"{hi}/{n}" if n else "-")
        md.append(f"| {names[ex]} | " + " | ".join(cells) + " |")
    md += ["", "## S6(지문 주고) 정답 일치", ""]
    for ex, (rows, _) in data.items():
        ok = [r for r in rows if r["s6_ans"] is not None and not r["excluded"]]
        agree = sum(1 for r in ok if r["s6_ans"] == r["key"])
        bad = [f"{r['n']}(키{CIRC[r['key'] - 1]}→모델{CIRC[r['s6_ans'] - 1] if r['s6_ans'] and r['s6_ans'] > 0 else r['s6_ans']}, 확신{r['s6_conf']})"
               for r in ok if r["s6_ans"] != r["key"]]
        low = [r["n"] for r in ok if r["s6_ans"] == r["key"] and (r["s6_conf"] or 9) <= 2]
        md.append(f"- {names[ex]}: 일치 {pct(agree, len(ok))}; 불일치 {', '.join(bad) or '없음'}; 정답이나 확신≤2: {low or '없음'}"
                  + ("  (정답키는 추정이므로 불일치는 키 오류일 수도 있음)" if ex == "mid" else ""))
    md += ["", "## 스크립트 신호(S1·S2·S3)와 지표", "", "| 자료 | S1 신호 | S2 신호 | S3 신호 | S1 정답 복사도 평균 | 오답 복사도 평균 | 정답 최장(어휘 제외) |", "|---|---|---|---|---|---|---|"]
    for ex, (rows, _) in data.items():
        ok = [r for r in rows if not r["excluded"]]
        c = collections.Counter(s.split()[0] for r in ok for s in r["signals"])
        s1 = [r["s1"] for r in ok if r["s1"] is not None]
        s1w = [r["s1_wrong_mean"] for r in ok if r["s1_wrong_mean"] is not None]
        nv = [r for r in ok if not r["vocab"]]
        lg = sum(1 for r in nv if r["len_rank"] == 1)
        md.append(f"| {names[ex]} | {c.get('S1', 0)} | {c.get('S2', 0)} | {c.get('S3', 0)} | {sum(s1) / len(s1):.2f} | {sum(s1w) / len(s1w):.2f} | {pct(lg, len(nv))} |")
    md += ["", "## 선지 중심값(다른 선지와 가장 비슷한 선지) 지표 — 정답 적중", "", "| 자료 | 비교 | 중심값 최대=정답 | 중심값 최소=정답 | 정답 최장 |", "|---|---|---|---|---|"]
    for ex in ("mid", "v2"):
        rows = [r for r in data[ex][0] if not r["excluded"] and "centroid_max" in r]
        for lab, sub in (("긍정 발문", [r for r in rows if not r["neg"]]), ("'않은' 발문", [r for r in rows if r["neg"]])):
            nm = sum(1 for r in sub if r["centroid_max"] == r["key"])
            nn = sum(1 for r in sub if r["centroid_min"] == r["key"])
            nl = sum(1 for r in sub if r["len_rank"] == 1)
            md.append(f"| {names[ex]} | {lab} {len(sub)} | {pct(nm, len(sub))} | {pct(nn, len(sub))} | {pct(nl, len(sub))} |")
    open(f"{OUT}/표.md", "w", encoding="utf-8").write("\n".join(md) + "\n")
    for ex, (rows, models) in data.items():
        json.dump({"models": models, "note": "추정 결과(정답률 데이터 아님). 본문 없음.", "rows": rows},
                  open(f"{OUT}/{ex}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n".join(md))


if __name__ == "__main__":
    main()
